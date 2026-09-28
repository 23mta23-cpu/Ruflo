// Reise 21 — ein Ladefehler ist keine Aussage ueber Vertrag, Beleg oder Geld.
//
// ANLASS (Messung 28.09.2026): vier Bildschirme mit Rechtsfolge stellten eine
// gescheiterte Abfrage als FESTSTEHENDE TATSACHE dar:
//   /angebot   „Dieses Angebot wurde zurueckgezogen oder bereits bearbeitet."
//   /vertrag   „Zu diesem Auftrag besteht noch kein Vertrag."
//   /rechnung  „Zu diesem Auftrag liegt kein abgerechneter Vertrag vor."
//   /zahlung   „Zu diesem Auftrag besteht kein offener Vertrag. … Es wurde
//              nichts abgebucht."
// Der letzte Satz ist der schaerfste: eine Aussage ueber eine Abbuchung,
// hergeleitet aus einer Abfrage, die nie angekommen ist.
//
// URSACHE: `mitZeitgrenze` liefert bei Zeitablauf `null` -- und genau dasselbe
// liefern die Ladefunktionen, wenn es den Datensatz wirklich nicht gibt. Beide
// Faelle waren damit ununterscheidbar. `mitZeitgrenzeMarkiert` (lib/retry.ts,
// Jest) macht den Unterschied messbar.
//
// Teil B ist die Pflicht-Gegenprobe: ein ECHTES „gibt es nicht" muss weiterhin
// so benannt werden. Ohne sie waere „immer Netzfehler sagen" der bequemste
// gruene Haken -- und ein Kunde ohne Vertrag bekaeme nie die richtige
// Erklaerung.
// MUTATIONEN (gemessen):
//   `if (error) throw` in lib/contracts.ts UND lib/jobs.ts wieder zu
//   `return null` (zwei Bibliotheken, vier Bildschirme)
//       -> A1 A2 V1 V2 R1 R2 Z1 Z2 rot, alle acht Gegenproben B gruen.
//   nur die Zustands-Trennung in app/zahlung.tsx zurueck (Bibliotheken heil)
//       -> **nur Z1 Z2 rot**. Die Bildschirm-Arbeit ist damit unabhaengig
//          von den Bibliotheks-Fixen gedeckt.
//
// Die erste Fassung dieser Reise war gegen die reparierten Bildschirme ROT:
// ich hatte die Fehlerzustaende gebaut, ohne zu pruefen, ob der Ladepfad sie
// ausloesen kann. `getContractByIdFull` und `getJobById` machten aus jedem
// Fehler ein `return null` -- also genau die Tatsachenaussage, die der
// Bildschirm dann druckte. Ohne diesen Lauf haette ich vier Fixe gemeldet,
// von denen keiner wirkt.
const { chromium } = require('playwright');
const { alsAnbieter } = require('../lib/anbieter-sitzung.cjs');

const BASIS = process.env.BASIS || 'http://localhost:8744';
const CHROME = process.env.CHROME_PFAD
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const KENNUNG = '11111111-1111-4111-8111-111111111111';

let pass = 0, fail = 0;
function pruefe(name, ok, detail) {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

// Je Bildschirm: der Satz, der bei einem Netzfehler NICHT dastehen darf,
// und der Satz, der stattdessen dastehen muss.
const SCHIRME = [
  { weg: `/angebot?jobId=${KENNUNG}`, kennung: 'A', tabelle: 'jobs',
    tatsache: 'zurückgezogen oder bereits bearbeitet',
    richtig: 'Angebot konnte nicht geladen werden' },
  { weg: `/vertrag?contractId=${KENNUNG}`, kennung: 'V', tabelle: 'contracts',
    tatsache: 'besteht noch kein Vertrag',
    richtig: 'Vertrag konnte nicht geladen werden' },
  { weg: `/rechnung?contractId=${KENNUNG}`, kennung: 'R', tabelle: 'contracts',
    tatsache: 'liegt kein abgerechneter Vertrag vor',
    richtig: 'Beleg konnte nicht geladen werden' },
  { weg: `/zahlung?contractId=${KENNUNG}`, kennung: 'Z', tabelle: 'contracts',
    tatsache: 'Es wurde nichts abgebucht',
    richtig: 'Vertragsdaten konnten nicht geladen werden' },
];

async function text(p) {
  return (await p.evaluate(() => document.body.innerText || '')).trim();
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });

  // ── A: die Abfrage faellt aus ───────────────────────────────────────────
  for (const s of SCHIRME) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, { rolle: 'customer', fehlerBei: [s.tabelle] });
    const p = await ctx.newPage();
    await p.goto(BASIS + s.weg, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(4000);

    const pfad = new URL(p.url()).pathname;
    pruefe(`${s.kennung}0 misst wirklich ${s.weg.split('?')[0]}`,
      pfad === s.weg.split('?')[0], `Pfad: ${pfad}`);

    const t = await text(p);
    pruefe(`${s.kennung}1 behauptet NICHT „${s.tatsache}"`,
      !t.includes(s.tatsache), JSON.stringify(t.slice(0, 260)));
    pruefe(`${s.kennung}2 sagt stattdessen, dass nicht geladen werden konnte`,
      t.includes(s.richtig), JSON.stringify(t.slice(0, 260)));
    await ctx.close();
  }

  // ── B: Gegenprobe — ein ECHTES „gibt es nicht" bleibt so benannt ────────
  //
  // Der Pruefstand antwortet regulaer mit einer leeren Liste: die Abfrage
  // kommt an, es gibt den Datensatz nur nicht. Genau dann ist die
  // Tatsachen-Aussage richtig und MUSS stehen.
  const LEER = { contracts: [], jobs: [], offers: [] };
  for (const s of SCHIRME) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, { rolle: 'customer', daten: LEER });
    const p = await ctx.newPage();
    await p.goto(BASIS + s.weg, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(4000);

    const t = await text(p);
    pruefe(`B-${s.kennung} ohne Fehler steht „${s.tatsache}" wieder da`,
      t.includes(s.tatsache), JSON.stringify(t.slice(0, 260)));
    pruefe(`B-${s.kennung}b und KEIN Netzfehler`,
      !t.includes(s.richtig), JSON.stringify(t.slice(0, 260)));
    await ctx.close();
  }

  await browser.close();
  console.log(fail === 0 ? `\nAlles bestanden (${pass}).` : `\n${fail} FEHLGESCHLAGEN`);
  process.exit(fail === 0 ? 0 : 1);
})();
