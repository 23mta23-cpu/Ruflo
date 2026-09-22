// Absolute Zusagen im GERENDERTEN Text.
//
// ANLASS (22.09.2026): Die fuenfte und die sechste Fundstelle derselben
// Gewerbeschein-Zusage fand kein Quelltext-Grep, sondern das Ausgeben des
// sichtbaren Textes. Ein Literal kann anders formuliert sein als das, wonach
// man sucht: „Jeder Anbieter persönlich verifiziert" (Startseite) und
// „Werkant sichert jeden Auftrag über … geprüfte Gewerbenachweise"
// (Garantieseite) enthalten das Wort „Gewerbeschein" gar nicht.
//
// Gesucht wird das MUSTER: ein absoluter Quantor („jeder", „alle", „immer",
// „100 %") im selben Satz wie ein Vertrauens-Verb. Solche Saetze sind nach
// § 5 UWG nur zulaessig, wenn sie fuer JEDEN Fall stimmen -- und Werkant hat
// zwei Wege mit verschiedenem Pruefumfang.
//
// GEMESSEN vor dem Bau (22.09.2026): ueber acht Bildschirme drei Treffer,
// davon zwei zutreffend. Ein Pruefer mit zwei begruendeten Ausnahmen und
// null Fehlalarmen ist tragbar; einer mit neun waere es nicht (siehe die
// verworfene Zeichen-Pruefung in CLAUDE.md).
//
// GRENZE: geprueft werden die acht Bildschirme unten, im abgemeldeten
// Zustand bzw. mit Kunden-Sitzung. Ein Satz, der erst mit Daten erscheint,
// faellt hier nicht auf.
const { chromium } = require('playwright');
const { alsAnbieter } = require('./lib/anbieter-sitzung.cjs');

const BASIS = process.env.BASIS || 'http://localhost:8744';
const CHROME = process.env.CHROME_PFAD
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

const WEGE = ['/landing', '/', '/suche', '/garantie', '/auftrag-aufgeben',
              '/nachbarschaft', '/agb', '/datenschutz'];

const MUSTER = /(jede[rsmn]?|alle[nsmr]?|immer|stets|sämtliche|100\s*%)\b[^.!?]{0,60}\b(geprüft|verifiziert|garantiert|gesichert|abgesichert|nachgewiesen|freigegeben)/i;

// Geprueft und in Ordnung. Jede Zeile mit Begruendung, sonst waechst die
// Liste zu einer Ausrede.
const ERLAUBT = [
  {
    teil: 'Jedes Profil einzeln freigegeben',
    grund: 'Stimmt fuer BEIDE Wege: jedes Profil geht durch das Pruef-Postfach '
         + '(kyc_status). Der Satz nennt danach ausdruecklich, was je Weg geprueft wird.',
  },
  {
    teil: 'Jedes Profil wird einzeln freigegeben',
    grund: 'Ueberschrift derselben Aussage (pruefungTitel). Siehe oben.',
  },
];

let fehler = 0;
function pruefe(name, bedingung, detail = '') {
  const ok = !!bedingung;
  if (!ok) fehler++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const gefunden = new Set();
  const befunde = [];
  let gemessen = 0;

  for (const weg of WEGE) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, {
      rolle: 'customer',
      daten: { provider_public: [], reviews: [], contracts: [] },
    });
    const p = await ctx.newPage();
    try {
      await p.goto(BASIS + weg, { waitUntil: 'load', timeout: 30000 });
    } catch { await ctx.close(); continue; }
    await p.waitForTimeout(3000);
    gemessen++;
    const text = await p.locator('body').innerText();
    for (const zeile of text.split('\n')) {
      if (!MUSTER.test(zeile)) continue;
      const treffer = ERLAUBT.find((e) => zeile.includes(e.teil));
      if (treffer) { gefunden.add(treffer.teil); continue; }
      befunde.push(`${weg}: ${zeile.trim().slice(0, 140)}`);
    }
    await ctx.close();
  }
  await b.close();

  // Ohne diese Zusicherung koennte ein leerer Bildschirm alles bestehen.
  pruefe(`A1 Es wurden Bildschirme gemessen`, gemessen >= WEGE.length - 1,
    `${gemessen} von ${WEGE.length}`);

  pruefe('A2 Keine unbelegte absolute Zusage im sichtbaren Text',
    befunde.length === 0, befunde.join(' | '));

  // Eine Ausnahme, die nicht mehr vorkommt, ist eine Liste, die nichts mehr
  // erlaubt -- und damit eine Pruefung, die weniger prueft, als ihr Name
  // sagt. Dieselbe Klasse wie „Existenz und Wirkung" (16.09.2026).
  const verwaist = ERLAUBT.filter((e) => !gefunden.has(e.teil)).map((e) => e.teil);
  pruefe('A3 Jede Ausnahme steht noch im Produkt',
    verwaist.length === 0,
    verwaist.length ? `nicht mehr gefunden: ${verwaist.join(' | ')}` : '');

  console.log(fehler === 0
    ? `\nKeine absolute Zusage ohne Beleg (${gemessen} Bildschirme, ${ERLAUBT.length} begruendete Ausnahmen).`
    : `\n${fehler} Zusicherung(en) nicht erfuellt.`);
  process.exit(fehler ? 1 : 0);
})();
