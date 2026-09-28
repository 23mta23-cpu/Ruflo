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
//   Fehlerzweig auf /betrieb/auftraege raus + die vier Fehlerpruefungen in
//   loadDashboard raus
//       -> G1c G1d G2c rot, H gruen.
//   der Fehlerzustand AUCH auf dem Reiter „Anfragen" (zu breit angewandt)
//       -> **nur H1 rot**. Der Reiter liest `jobs`, sein Leerstand ist WAHR
//          und muss stehen bleiben; ohne H1 waere „ueberall Fehler zeigen"
//          der bequemste gruene Haken.
//
// G1c hing zuerst an „Auftraege konnten nicht geladen werden" und blieb unter
// der Mutation GRUEN: derselbe Satz steht auf dem Bildschirm auch im Toast des
// Verdienst-Banners. Anker ist jetzt der zweite, eindeutige Satz.
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

  // ── G: die beiden Betriebs-Bildschirme ─────────────────────────────────
  //
  // /betrieb/auftraege: die Reiter „Aktiv"/„Ausstehend"/„Erledigt" haengen an
  // `contracts`; „Anfragen" liest `jobs` und bleibt richtig.
  // /betrieb/dashboard: jede Kachel liest `dash?.…`, also stand bei einem
  // Ladefehler nur die Reiterleiste da (gemessen: 66 Zeichen Gesamttext).
  const BETRIEB = [
    // Anker bewusst der ZWEITE Satz: „Auftraege konnten nicht geladen werden"
    // steht auf demselben Bildschirm auch im Toast des Verdienst-Banners.
    // GEMESSEN: mit dem kuerzeren Anker blieb G1c unter der Mutation gruen.
    { weg: '/betrieb/auftraege', kennung: 'G1', reiter: 'Aktiv',
      leer: 'Keine Aufträge', fehler: 'keine Aussage über Ihre Aufträge' },
    { weg: '/betrieb/dashboard', kennung: 'G2', reiter: null,
      leer: null, fehler: 'Übersicht konnte nicht geladen werden' },
  ];
  for (const s of BETRIEB) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, { fehlerBei: ['contracts'] });
    const p = await ctx.newPage();
    await p.goto(BASIS + s.weg, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(3500);

    const pfad = new URL(p.url()).pathname;
    pruefe(`${s.kennung}a misst wirklich ${s.weg}`, pfad === s.weg, `Pfad: ${pfad}`);

    if (s.reiter) {
      // Der Bildschirm oeffnet auf „Anfragen"; der betroffene Reiter liegt
      // dahinter und muss angetippt werden, sonst misst man den falschen.
      const reiter = p.locator('[role="button"]:visible').filter({ hasText: s.reiter });
      pruefe(`${s.kennung}b der Reiter „${s.reiter}" ist da`, (await reiter.count()) >= 1);
      await reiter.first().click().catch(() => {});
      await p.waitForTimeout(800);
    }

    const t = await text(p);
    pruefe(`${s.kennung}c der Ladefehler wird benannt`,
      t.includes(s.fehler), JSON.stringify(t.slice(0, 250)));
    if (s.leer) {
      pruefe(`${s.kennung}d „${s.leer}" steht NICHT da`,
        !t.includes(s.leer), JSON.stringify(t.slice(0, 250)));
    }
    await ctx.close();
  }

  // ── H: Gegenprobe — ohne Fehler kein Fehlertext, und „Anfragen" bleibt ──
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, { fehlerBei: ['contracts'] });
    const p = await ctx.newPage();
    await p.goto(`${BASIS}/betrieb/auftraege`, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(3500);
    const t = await text(p);
    // „Anfragen" liest `jobs`, nicht `contracts` -- dort ist der Leerstand
    // WAHR und muss stehen bleiben. Sonst waere „ueberall Fehler zeigen" der
    // bequemste gruene Haken.
    pruefe('H1 der Reiter „Anfragen" zeigt weiter seinen echten Leerstand',
      t.includes('keine offenen Anfragen'), JSON.stringify(t.slice(0, 250)));
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx);
    const p = await ctx.newPage();
    await p.goto(`${BASIS}/betrieb/dashboard`, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(3500);
    const t = await text(p);
    pruefe('H2 das Dashboard zeigt im gesunden Fall keinen Ladefehler',
      !t.includes('konnte nicht geladen werden'), JSON.stringify(t.slice(0, 250)));
    pruefe('H3 und es steht wirklich etwas darauf', t.length > 200, `Textlaenge: ${t.length}`);
    await ctx.close();
  }

  await browser.close();
  console.log(fail === 0 ? `\nAlles bestanden (${pass}).` : `\n${fail} FEHLGESCHLAGEN`);
  process.exit(fail === 0 ? 0 : 1);
})();
