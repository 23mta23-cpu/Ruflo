// Kern-Reise 25 — das Angebots-Detail beim Kunden (`/angebot`).
//
// ANLASS (05.10.2026, „improve"): der Bildschirm, auf den die Push-Nachricht
// „Neues Angebot erhalten" fuehrt, hatte keine Browser-Reise. Am selben Tag
// bekam er die Material-Zeile; ob sie dasteht, pruefte niemand
// (Pruefregel 4: die Rechnung kann gedeckt sein und die Anzeige nicht).
//
// Nach ECC `skills/e2e-testing`: auf eine Bedingung warten (Text sichtbar),
// nicht auf eine feste Zeit; Auszeichnung UND Wirkung des Geld-Knopfs.
//
// Ausfuehren ueber den Laeufer:  bash scripts/reisen/run.sh
const { chromium } = require('playwright');
const { alsAnbieter, NUTZER_ID } = require('../lib/anbieter-sitzung.cjs');

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

const JOB_ID = '00000000-0000-4000-8000-0000000000e1';
const OFFER_ID = '00000000-0000-4000-8000-0000000000e2';
const BETRIEB_ID = '00000000-0000-4000-8000-0000000000e3';

const auftrag = {
  id: JOB_ID, customer_id: NUTZER_ID, provider_id: null, title: 'Bad neu verfugen',
  description: 'Fugen im Bad sind rissig.', category: 'Fliesen', address_plz: '50667',
  address_city: 'Köln', track: 'handwerker', status: 'open', created_at: new Date().toISOString(),
};
const angebot = {
  id: OFFER_ID, job_id: JOB_ID, provider_id: BETRIEB_ID, price: 400, material_cost: 80,
  // So schreibt angebot-erstellen die Beschreibung (materialZeile, '\n\n').
  description: 'Alte Fugen raus, neu verfugen.\n\nIm Preis enthaltene Materialkosten: €80,00',
  duration_hours: 5, scheduled_at: null, status: 'pending', created_at: new Date().toISOString(),
};

async function main() {
  const b = await chromium.launch({ executablePath: CHROME });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await alsAnbieter(ctx, {
    rolle: 'customer',
    daten: {
      jobs: [auftrag], offers: [angebot], auth_email_confirmed: true,
      provider_public: [{ id: BETRIEB_ID, business_name: 'Fliesen Demir', rating_avg: 4.6, rating_count: 9 }],
      accept_offer: [{ id: '00000000-0000-4000-8000-0000000000e4', job_id: JOB_ID, status: 'pending' }],
    },
  });
  const s = await ctx.newPage();
  await s.goto(`${BASIS}/angebot?jobId=${JOB_ID}`, { waitUntil: 'networkidle' });
  await s.getByText('Angebotsdetails').first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  pruefe('G0 Gemessen wird das Angebots-Detail',
    new URL(s.url()).pathname.endsWith('/angebot'), s.url());
  const text = await s.locator('body').innerText();

  pruefe('G1 Preis und Betrieb stehen da',
    /400,00/.test(text) && text.includes('Fliesen Demir'), text.slice(0, 160).replace(/\n/g, ' | '));
  // 400 + 2,5 % = 10,00 Servicegebuehr, 410,00 gesamt.
  pruefe('G2 Servicegebuehr und Gesamtbetrag auf den ganzen Preis',
    /10,00/.test(text) && /410,00/.test(text),
    (text.match(/[^\n]*(Gebühr|Gesamt)[^\n]*/g) || []).join(' / '));
  pruefe('G3 Material als eigene Zeile, genau einmal, nicht im Freitext',
    /davon Material/.test(text) && (text.match(/80,00/g) || []).length === 1
      && !/Im Preis enthaltene Materialkosten/.test(text),
    (text.match(/[^\n]*Material[^\n]*/g) || []).join(' / '));
  pruefe('G4 Die Nachricht des Betriebs bleibt stehen', text.includes('Alte Fugen raus, neu verfugen.'));
  pruefe('G5 Keine Zahl des Betriebs beim Kunden', !/Anbieter erhält|Provision/.test(text));

  const annehmen = s.locator('[role="button"]:visible').filter({ hasText: /Angebot annehmen/ });
  pruefe('G6 Der Annahme-Knopf ist genau einmal als Knopf ausgezeichnet',
    await annehmen.count() === 1, `${await annehmen.count()} gefunden`);
  await annehmen.first().click().catch(() => {});
  await s.waitForURL(/\/zahlung/, { timeout: 8000 }).catch(() => {});
  const rpc = (ctx.__aufrufe || []).filter((a) => a.name === 'accept_offer');
  pruefe('G7 Die Annahme ruft accept_offer mit Angebot und Auftrag',
    rpc.length === 1 && rpc[0].koerper && rpc[0].koerper.p_offer_id === OFFER_ID
      && rpc[0].koerper.p_job_id === JOB_ID,
    `${rpc.length} Aufrufe ${rpc[0] ? JSON.stringify(rpc[0].koerper) : ''}`);
  pruefe('G8 und fuehrt zur Zahlung', /\/zahlung/.test(s.url()), s.url());

  await b.close();
  console.log(fehler === 0 ? '\nReise 25: alles gruen.' : `\nReise 25: ${fehler} FAIL.`);
  process.exit(fehler === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
