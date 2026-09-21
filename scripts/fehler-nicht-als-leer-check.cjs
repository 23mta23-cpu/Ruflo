// Ein Netzfehler darf nicht aussehen wie „da ist nichts".
//
// ANLASS (21.09.2026): `getConversationList` und `getProviderConversationList`
// in lib/messages.ts hatten beide `if (error || !data?.length) return []`.
// Ein Netzfehler kam damit als LEERE LISTE beim Bildschirm an, und der sagte
// „Keine Nachrichten" bzw. „Noch keine Konversationen". Beide Bildschirme
// haben einen Fehlerzustand samt „Erneut versuchen", und in beiden steht im
// catch der Kommentar „Netzfehler nicht als ‚Keine Nachrichten' tarnen" --
// genau das tat der Code darunter. Der Zweig war unerreichbar.
//
// Fuer den Nutzer heisst die alte Fassung: sein Posteingang laedt nicht, und
// die App sagt ihm, niemand habe ihm geschrieben. Bei einem Marktplatz ist
// das die teuerste denkbare Falschaussage.
//
// WARUM IM BROWSER: die Funktionen rufen supabase und sind damit fuer Jest
// nicht ladbar (expo-constants). Und ein Quelltext-Pruefer saehe `throw
// error` und waere zufrieden, ohne zu wissen, ob der Bildschirm ihn faengt.
// Hier wird die Abfrage absichtlich auf 500 gesetzt und nachgelesen, WAS
// dasteht.
//
// GRENZE: geprueft werden die zwei Posteingaenge. Andere Stellen mit
// demselben Muster (lib/strikes.ts, lib/contracts.ts) sind hier NICHT
// abgedeckt.
const { chromium } = require('playwright');
const { alsAnbieter } = require('./lib/anbieter-sitzung.cjs');

const BASIS = process.env.BASIS || 'http://localhost:8744';
const CHROME = process.env.CHROME_PFAD
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

const STELLEN = [
  {
    name: 'Posteingang Kunde',
    weg: '/nachrichten',
    opts: { rolle: 'customer', fehlerBei: ['konversationen_kunde'] },
    sagt: 'Nachrichten konnten nicht geladen werden',
    sagtNicht: 'Keine Nachrichten',
  },
  {
    // ANLASS (21.09.2026): `getMeineStrikes` gab bei einem Fehler eine leere
    // Liste zurueck, und das Dashboard blendet die Strike-Leiste bei leerer
    // Liste komplett aus. Ein GESPERRTER Betrieb sah damit ein sauberes
    // Dashboard: er kann nicht bieten und erfaehrt nicht, warum. Der
    // Kommentar daneben begruendet die Anzeige mit Art. 4 P2B-VO.
    name: 'Verstoss-Stand im Betriebs-Dashboard',
    weg: '/betrieb/dashboard',
    opts: { rolle: 'provider', fehlerBei: ['provider_strikes'] },
    sagt: 'Verstoß-Stand konnte nicht geladen werden',
    // KEIN `sagtNicht` hier, und das ist Absicht. Bei den Posteingaengen
    // steht im kaputten Zustand ein luegender Satz da („Keine Nachrichten");
    // hier verschwindet die Leiste GANZ, es gibt also keinen Text, den man
    // ausschliessen koennte. Gemessen: mit zurueckgenommenem Fix bleibt eine
    // `sagtNicht`-Zusicherung gruen und prueft damit nichts. Eine
    // Zusicherung, die den Fehler nicht sehen kann, gehoert nicht in die
    // Liste, auch wenn sie die Zahl erhoeht.
    sagtNicht: null,
  },
  {
    name: 'Posteingang Betrieb',
    weg: '/betrieb/nachrichten',
    opts: { rolle: 'provider', fehlerBei: ['konversationen_anbieter'] },
    sagt: 'Nachrichten konnten nicht geladen werden',
    sagtNicht: 'Noch keine Konversationen',
  },
];

let fehler = 0;
function pruefe(name, ok, detail = '') {
  if (!ok) fehler++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`);
}

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  for (const s of STELLEN) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, s.opts);
    const p = await ctx.newPage();
    await p.goto(BASIS + s.weg, { waitUntil: 'networkidle' });
    // Der Bildschirm versucht es einmal erneut (withOneRetry), das dauert.
    await p.waitForTimeout(4000);
    const text = await p.evaluate(() => document.body.innerText);

    pruefe(`${s.name}: nennt den Fehler`, text.includes(s.sagt),
      text.includes(s.sagt) ? '' : `„${s.sagt}" steht nicht da`);
    // Der eigentliche Punkt, wo es ihn gibt. Ohne diese Zusicherung waere der
    // alte, luegende Zustand bestanden.
    if (s.sagtNicht) {
      pruefe(`${s.name}: behauptet NICHT, es gebe nichts`, !text.includes(s.sagtNicht),
        text.includes(s.sagtNicht) ? `sagt „${s.sagtNicht}", obwohl die Abfrage fehlschlug` : '');
    }
    await ctx.close();
  }
  await b.close();
  if (fehler === 0) console.log('\nPASS  ein Netzfehler sieht nicht aus wie ein leerer Posteingang.');
  process.exit(fehler ? 1 : 0);
})();
