// Reise 22 — ein Doppeltipp legt keinen zweiten Vertrag an.
//
// ANLASS (Messung 28.09.2026): Die Schreib-Knoepfe sichern sich mit einem
// Zustand (`setAccepting(true)` und `disabled`). React setzt Zustaende aber
// ASYNCHRON: zwei Tipps im selben Tick koennen beide den alten Wert lesen,
// und `disabled` greift erst nach dem naechsten Rendern. Ob die Sperre haelt,
// ist damit eine Browser-Frage, keine Quelltext-Frage.
//
// GEMESSEN, mit einer absichtlich langsamen Antwort (3 s), bei 0, 60 und
// 250 ms Abstand: genau EIN Aufruf. Die Sperre haelt.
// GEGENGEPRUEFT mit entfernter Sperre: dann sieht dieselbe Probe ZWEI
// Aufrufe. Die Null ist also keine Blindheit des Messwerkzeugs.
//
// Warum ausgerechnet dieser Weg: `acceptOffer` legt einen VERTRAG an. Zwei
// Vertraege zu einem Auftrag waeren beide bindend.
//
// GRENZE, die hierher gehoert: `/zahlung` laesst sich so NICHT pruefen.
// `handlePay` bricht auf Web sofort ab („Zahlung nur in der mobilen App"),
// der Pruefstand ist Web -- der Zahlweg ist hier also nicht erreichbar und
// bleibt ungemessen.
const { chromium } = require('playwright');
const { alsAnbieter } = require('../lib/anbieter-sitzung.cjs');

const BASIS = process.env.BASIS || 'http://localhost:8744';
const CHROME = process.env.CHROME_PFAD
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const JOB_ID = '00000000-0000-4000-8000-0000000000aa';
const OFFER_ID = '00000000-0000-4000-8000-0000000000bb';

let pass = 0, fail = 0;
function pruefe(name, ok, detail) {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

const auftrag = {
  id: JOB_ID, title: 'Steckdose im Flur erneuern', category: 'elektro',
  description: 'Eine Steckdose ist locker.', status: 'open', track: 'handwerk',
  address_city: 'Köln', address_plz: '50667',
  customer_id: '00000000-0000-4000-8000-000000000001',
  created_at: new Date().toISOString(),
};
const angebot = {
  id: OFFER_ID, job_id: JOB_ID, provider_id: '00000000-0000-4000-8000-0000000000cc',
  price: 320, price_gross: 320, status: 'pending', message: 'Mache ich gern.',
  created_at: new Date().toISOString(),
};

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });

  for (const abstand of [0, 250]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, {
      rolle: 'customer',
      daten: { jobs: [auftrag], offers: [angebot], auth_email_confirmed: true, contracts: [] },
    });
    // Langsame Antwort: nur so ist das Zeitfenster offen, in dem ein zweiter
    // Tipp die Sperre ueberholen koennte. Ohne das misst die Probe nichts.
    await ctx.route('**/rest/v1/rpc/accept_offer*', async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      return route.fallback();
    });
    const p = await ctx.newPage();
    await p.goto(`${BASIS}/angebot?jobId=${JOB_ID}`, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(2500);

    const pfad = new URL(p.url()).pathname;
    pruefe(`${abstand}ms A misst wirklich /angebot`, pfad === '/angebot', `Pfad: ${pfad}`);

    const knopf = p.locator('[role="button"]:visible').filter({ hasText: /annehmen/i }).first();
    // Zusichern, dass wirklich getippt wurde -- sonst waere „nur ein Aufruf"
    // auch mit null Tipps erfuellt.
    pruefe(`${abstand}ms B der Annehmen-Knopf ist da`, (await knopf.count()) === 1,
      `gefunden: ${await knopf.count()}`);

    await knopf.click({ noWaitAfter: true }).catch(() => {});
    if (abstand) await p.waitForTimeout(abstand);
    await knopf.click({ noWaitAfter: true, force: true }).catch(() => {});
    await p.waitForTimeout(4000);

    const schreib = (ctx.__aufrufe || []).filter((a) => /accept_offer/.test(a.name));
    pruefe(`${abstand}ms C zwei Tipps legen genau EINEN Vertrag an`,
      schreib.length === 1, `${schreib.length} Aufruf(e)`);
    await ctx.close();
  }

  await browser.close();
  console.log(fail === 0 ? `\nAlles bestanden (${pass}).` : `\n${fail} FEHLGESCHLAGEN`);
  process.exit(fail === 0 ? 0 : 1);
})();
