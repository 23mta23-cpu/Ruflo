// Kern-Reise 17 — /zahlungsmethoden sagt nur, was es weiss.
//
// ANLASS (23.09.2026). Der Bildschirm hatte VIER Bedienelemente, von denen
// keines etwas bewirkte:
//   - „Standard" und der Papierkorb aenderten nur den React-Zustand. Die
//     Karte verschwand und war beim naechsten Oeffnen wieder da.
//   - „Kreditkarte hinzufuegen" meldete „Stripe Checkout oeffnet sich" und
//     oeffnete nichts. Dieselbe Attrappe in der SEPA-Zeile.
// Dazu zwei Befunde dahinter: die Liste kann gar nichts enthalten (
// `create-payment-intent` uebergibt Stripe keinen `customer`), und das blosse
// Oeffnen legte einen Stripe-Kunden an -- ein Schreibvorgang im Lesepfad.
//
// GEPRUEFT WIRD:
//   K  Mit einer Methode: sie steht da, und es gibt KEIN Bedienelement, das
//      eine Aenderung verspricht.
//   L  Ohne Methode: der Text sagt, WARUM nichts da ist, und behauptet
//      keinen Fehler.
//   F  Bei einem Fehler: er wird als Fehler benannt und NICHT als „nichts
//      hinterlegt" getarnt (dieselbe Klasse wie fehler-nicht-als-leer-check).
const { chromium } = require('playwright');
const { alsAnbieter } = require('../lib/anbieter-sitzung.cjs');

const BASIS = process.env.BASIS || 'http://localhost:8744';
const CHROME = process.env.CHROME_PFAD
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

let fehler = 0;
function pruefe(name, bedingung, detail = '') {
  const ok = !!bedingung;
  if (!ok) fehler++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? '  — ' + detail : ''}`);
  return ok;
}

// `isDefault: false` ist NICHT beliebig: die alte Fassung blendete den Knopf
// „Standard" nur bei einer NICHT-Standardkarte ein. Mit `true` waere die
// Zusicherung „kein Knopf Standard" auch im kaputten Zustand gruen gewesen --
// also eine Kopie ohne eigene Mutation (gemessen am 23.09.2026).
const KARTE = {
  id: 'pm_pruefstand', brand: 'Visa', last4: '4242',
  expiry: '12/29', type: 'card', isDefault: false,
};

// Beschriftungen, die eine Aenderung versprechen. Jede davon war einmal da
// und hat nichts getan.
const VERSPRECHEN = ['Kreditkarte hinzufügen', 'Hinzufügen', 'Standard'];

async function bildschirm(b, { antwort, fehlerBei = [] }) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await alsAnbieter(ctx, {
    rolle: 'customer',
    fehlerBei,
    daten: { 'list-payment-methods': { methods: antwort } },
  });
  const p = await ctx.newPage();
  await p.goto(`${BASIS}/zahlungsmethoden`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(2000);
  return { ctx, p };
}

/** Zaehlt sichtbare Knoepfe, deren Beschriftung GENAU so lautet. */
async function knoepfeMit(p, text) {
  return await p.locator('[role="button"]:visible').filter({ hasText: text }).count();
}

async function main() {
  const b = await chromium.launch({ executablePath: CHROME });

  // ── K: eine Methode ist da ──────────────────────────────────────────────
  {
    const { ctx, p } = await bildschirm(b, { antwort: [KARTE] });
    pruefe('K0 Gemessen wird /zahlungsmethoden',
      new URL(p.url()).pathname.endsWith('/zahlungsmethoden'), p.url());
    const t = await p.locator('body').innerText();
    pruefe('K1 Die Methode steht da', t.includes('Visa') && t.includes('4242'), t.slice(0, 300));
    // Das Abzeichen „Standard" darf bleiben -- es ist eine AUSSAGE. Verboten
    // ist der KNOPF gleichen Namens, der eine Aenderung verspricht.
    for (const wort of VERSPRECHEN) {
      const n = await knoepfeMit(p, wort);
      pruefe(`K2 Kein Knopf „${wort}"`, n === 0, `gefunden: ${n}`);
    }
    const papierkorb = await p.locator('[role="button"]:visible svg, [role="button"]:visible path').count();
    pruefe('K3 Der Bildschirm rendert ueberhaupt Knoepfe (Zurueck)',
      (await p.locator('[role="button"]:visible').count()) >= 1, `symbole: ${papierkorb}`);
    await ctx.close();
  }

  // ── L: keine Methode ────────────────────────────────────────────────────
  {
    const { ctx, p } = await bildschirm(b, { antwort: [] });
    const t = await p.locator('body').innerText();
    pruefe('L1 Es steht da, dass nichts gespeichert ist',
      /keine zahlungsmethode gespeichert/i.test(t), t.slice(0, 300));
    pruefe('L2 Und der Grund steht dabei',
      /speichert keine kartendaten/i.test(t) && /stripe/i.test(t), t.slice(0, 400));
    pruefe('L3 Kein Fehler behauptet',
      !/konnte nicht geladen werden/i.test(t));
    for (const wort of VERSPRECHEN) {
      const n = await knoepfeMit(p, wort);
      pruefe(`L4 Kein Knopf „${wort}"`, n === 0, `gefunden: ${n}`);
    }
    await ctx.close();
  }

  // ── F: die Abfrage scheitert ────────────────────────────────────────────
  {
    const { ctx, p } = await bildschirm(b, { antwort: [], fehlerBei: ['list-payment-methods'] });
    pruefe('F0 Gemessen wird /zahlungsmethoden',
      new URL(p.url()).pathname.endsWith('/zahlungsmethoden'), p.url());
    const t = await p.locator('body').innerText();
    pruefe('F1 Der Fehler wird als Fehler benannt',
      /konnte nicht geladen werden/i.test(t), t.slice(0, 400));
    // Die eigentliche Zusicherung: ein Netzfehler ist KEINE Aussage ueber
    // das Konto des Nutzers.
    // Bewusst BEIDE Formulierungen: die alte Fassung schrieb bei einem Fehler
    // „Keine Karten hinterlegt" hin. Eine Zusicherung nur gegen den neuen
    // Wortlaut waere im kaputten Zustand muehelos gruen gewesen.
    //
    // Und bewusst der GANZE Satz, nicht „keine Karten": der Sicherheitshinweis
    // oben sagt „Werkant sieht und speichert keine Kartennummern". Ein
    // kuerzeres Muster schlug dort an und meldete einen Fehler an einem
    // Bildschirm, der stimmte (gemessen am 23.09.2026, dritte Wiederholung
    // derselben Ursache: ein Wort, das anderswo Teil eines anderen Wortes ist).
    pruefe('F2 Es steht NICHT da, es sei nichts gespeichert',
      !/keine zahlungsmethode gespeichert/i.test(t)
      && !/keine karten hinterlegt/i.test(t), t.trim().slice(0, 300));
    await ctx.close();
  }

  await b.close();
  console.log(fehler === 0 ? '\nAlles bestanden.' : `\n${fehler} FEHLGESCHLAGEN`);
  process.exit(fehler === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
