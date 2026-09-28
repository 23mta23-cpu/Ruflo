// Reise 20 — ein Netzfehler darf nicht wie „da ist nichts" aussehen.
//
// ANLASS (Messung 27./28.09.2026, haengendes Netz): vier Bildschirme sagten
// bei gestoerter Verbindung, es gebe nichts:
//   /auftraege           „Keine aktiven Auftraege"
//   /nachrichten         „Keine Nachrichten"
//   /meine-anbieter      „Noch keine Anbieter" (und „0 gebuchte Profis")
//   /benachrichtigungen  „Nichts Neues"
//
// ZWEI Ursachen, die sich ueberlagerten:
//   1. `load()` setzte `loading` NIE auf true. Beim ersten Rendern ist `user`
//      noch null, der `!user`-Zweig setzt `loading=false` -- danach stand der
//      Leer-Text da, SOLANGE die Abfrage lief. Mit withOneRetry und der
//      20-Sekunden-Grenze sind das ueber 40 Sekunden, auch auf einem
//      funktionierenden, nur langsamen Netz. Keiner der vier Bildschirme las
//      `loading` aus dem AuthContext.
//   2. Bei /benachrichtigungen kam dazu: `const { data } = await supabase…`
//      ohne `error`. supabase-js wirft nicht, also konnte der `catch` -- und
//      damit der Fehlerzustand -- gar nicht ausloesen.
//
// Teil E ist die Pflicht-Gegenprobe: im gesunden Fall MUSS der Leer-Text
// dastehen. Ohne sie waere „nie einen Leer-Text zeigen" der bequemste gruene
// Haken, und ein Kunde ohne Auftraege saehe nie eine Erklaerung.
// MUTATIONEN (gemessen, alle vier Bildschirme in einem Export -- sie koennen
// sich nicht verdecken, weil jede Zusicherung an ihrem eigenen Bildschirm
// haengt):
//   alle vier Korrekturen zurueckgenommen
//       -> C1 C2 D1 D2 rot, **A und B GRUEN**.
//          Genau deshalb gibt es Teil F: der Fehler-Fall war auf /auftraege
//          und /nachrichten schon vorher abgedeckt, meine Korrektur betrifft
//          das LADEFENSTER. Ohne diese Messung haette ich zwei Zusicherungen
//          fuer gedeckt gehalten, die eine fremde, aeltere Behandlung messen.
//   nur die Ladefenster-Korrektur zurueckgenommen
//       -> **nur F-A und F-B rot**, A1 A2 B1 B2 gruen.
//
// Die Gegenprobe E lief zuerst gegen den normalen Stub und war rot -- der
// liefert zwei Vertraege und einen Anbieter, dort gehoert kein Leer-Text hin.
// Nicht das Produkt war falsch, sondern die Zusicherung. Eine Gegenprobe muss
// den Zustand HERSTELLEN, den sie misst (LEER_DATEN).
const { chromium } = require('playwright');
const { alsAnbieter } = require('../lib/anbieter-sitzung.cjs');

const BASIS = process.env.BASIS || 'http://localhost:8744';
const CHROME = process.env.CHROME_PFAD
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

let pass = 0, fail = 0;
function pruefe(name, ok, detail) {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

// Je Bildschirm: Weg, Tabelle die ausfaellt, der LUEGENDE Leer-Text,
// und ein Stueck des erwarteten Fehlertexts.
const SCHIRME = [
  { weg: '/auftraege',          kennung: 'A', tabelle: 'contracts',
    leer: 'Keine aktiven Aufträge',  fehler: 'konnten nicht geladen werden' },
  { weg: '/nachrichten',        kennung: 'B', tabelle: 'konversationen_kunde',
    leer: 'Keine Nachrichten',       fehler: 'konnten nicht geladen werden' },
  { weg: '/meine-anbieter',     kennung: 'C', tabelle: 'contracts',
    leer: 'Noch keine Anbieter',     fehler: 'konnten nicht geladen werden' },
  { weg: '/benachrichtigungen', kennung: 'D', tabelle: 'notifications',
    leer: 'Nichts Neues',            fehler: 'konnten nicht geladen werden' },
];

async function text(p) {
  return (await p.evaluate(() => document.body.innerText || '')).trim();
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });

  // ── A bis D: die Abfrage faellt aus ─────────────────────────────────────
  for (const s of SCHIRME) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, { rolle: 'customer', fehlerBei: [s.tabelle] });
    const p = await ctx.newPage();
    await p.goto(BASIS + s.weg, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(4000);

    const pfad = new URL(p.url()).pathname;
    pruefe(`${s.kennung}0 misst wirklich ${s.weg}`, pfad === s.weg, `Pfad: ${pfad}`);

    const t = await text(p);
    // Der Kern: der Leer-Text darf NICHT dastehen.
    pruefe(`${s.kennung}1 „${s.leer}" steht NICHT da`,
      !t.includes(s.leer), JSON.stringify(t.slice(0, 220)));
    pruefe(`${s.kennung}2 der Ladefehler wird benannt`,
      t.includes(s.fehler), JSON.stringify(t.slice(0, 220)));
    await ctx.close();
  }

  // ── E: Gegenprobe — ohne Fehler MUSS der Leer-Text dastehen ─────────────
  //
  // MIT LEEREN Vorgabedaten. Der erste Entwurf lief gegen den normalen Stub,
  // und der liefert zwei Vertraege und einen Anbieter -- „Keine Auftraege"
  // gehoert dort zu Recht NICHT hin, und die Zusicherung war falsch, nicht
  // das Produkt. Eine Gegenprobe muss den Zustand herstellen, den sie misst.
  const LEER_DATEN = {
    contracts: [], konversationen_kunde: [], notifications: [],
    jobs: [], offers: [], messages: [],
  };
  for (const s of SCHIRME) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, { rolle: 'customer', daten: LEER_DATEN });
    const p = await ctx.newPage();
    await p.goto(BASIS + s.weg, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(4000);

    const t = await text(p);
    pruefe(`E-${s.kennung} ohne Fehler steht „${s.leer}" wieder da`,
      t.includes(s.leer), JSON.stringify(t.slice(0, 220)));
  }

  // ── F: das LADEFENSTER — eine langsame Antwort ist kein leerer Stand ────
  //
  // Teil A bis D messen den FEHLER-Fall, und der war auf /auftraege und
  // /nachrichten schon vorher abgedeckt (ein `loadError`-Bildschirm mit
  // Erneut-Knopf). GEMESSEN: mit zurueckgenommener Korrektur bleiben A1/A2
  // und B1/B2 gruen. Die eigentliche Korrektur betrifft die Zeit WAEHREND
  // der Abfrage, und dafuer braucht es eine langsame, nicht eine kaputte
  // Antwort.
  for (const s of [SCHIRME[0], SCHIRME[1]]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, { rolle: 'customer', daten: LEER_DATEN });
    // NACH alsAnbieter registriert -> gewinnt. Nur die eine Abfrage wird
    // langsam; Anmeldung und Profil antworten sofort, sonst misst man eine
    // Weiterleitung zur Anmeldung statt des Ladefensters.
    await ctx.route('**://*.supabase.co/**', async (route) => {
      const url = route.request().url();
      if (url.includes(`/${s.tabelle}`)) {
        await new Promise((r) => setTimeout(r, 8000));
      }
      return route.fallback();
    });
    const p = await ctx.newPage();
    await p.goto(BASIS + s.weg, { waitUntil: 'domcontentloaded' });
    // Frueh genug lesen, dass die Abfrage noch laeuft.
    await p.waitForTimeout(2500);

    const pfad = new URL(p.url()).pathname;
    pruefe(`F-${s.kennung}0 misst wirklich ${s.weg}`, pfad === s.weg, `Pfad: ${pfad}`);
    const t = await text(p);
    pruefe(`F-${s.kennung} waehrend des Ladens steht „${s.leer}" NICHT da`,
      !t.includes(s.leer), JSON.stringify(t.slice(0, 220)));
    await ctx.close();
  }

  await browser.close();
  console.log(fail === 0 ? `\nAlles bestanden (${pass}).` : `\n${fail} FEHLGESCHLAGEN`);
  process.exit(fail === 0 ? 0 : 1);
})();
