// Kern-Reise 4 — der Geldweg, so weit er ohne Datenbank pruefbar ist.
//
// ANLASS: scripts/reisen/README.md wies bisher aus:
//   "Ungeprueft und ausdruecklich nicht behauptet: offene Auftraege sehen,
//    Angebot abgeben, Annahme, 'Vertrag aktiv', Escrow, Auszahlung.
//    Das ist der halbe Marktplatz."
//
// Das war ehrlich und trotzdem ein Zustand, den man nicht lassen kann: der
// Geldweg IST das Produkt, und er war die am wenigsten gepruefte Strecke.
//
// WAS HIER GEPRUEFT WIRD: die Verdrahtung. Setzt der Bildschirm beim Klick den
// richtigen Aufruf mit den richtigen Werten ab? Das ist die Klasse "Knopf ohne
// onPress" und "Feld, das nirgends ankommt" -- beides gab es in diesem Projekt
// schon (das i-Symbol ohne Erklaerung, addressStreet, das kein Aufrufer
// uebergab).
//
// WAS HIER NICHT GEPRUEFT WIRD, und das gehoert danebengeschrieben:
//   * Ob accept_offer wirklich einen Vertrag anlegt      -> scripts/db-test/
//   * Ob die RLS-Policies greifen                        -> scripts/db-test/
//   * Ob Stripe das Geld haelt und wieder hergibt        -> gar nicht, lokal
//   * Ob das Layout auf einem echten Geraet stimmt       -> gar nicht, Web
//
// Die Daten kommen aus scripts/lib/anbieter-sitzung.cjs (`opts.daten`), die
// abgesetzten Schreibaufrufe stehen danach in `ctx.__aufrufe`.
//
// Ausfuehren ueber den Laeufer:  bash scripts/reisen/run.sh
const { chromium } = require('playwright');
const { alsAnbieter, NUTZER_ID } = require('../lib/anbieter-sitzung.cjs');

const BASIS = process.env.BASIS || 'http://localhost:8744';
const CHROME = process.env.CHROME_PFAD
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

const JOB_ID = '00000000-0000-4000-8000-0000000000aa';
const OFFER_ID = '00000000-0000-4000-8000-0000000000bb';

let fehler = 0;
function pruefe(name, bedingung, detail = '') {
  const ok = !!bedingung;
  if (!ok) fehler++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  return ok;
}

const auftrag = {
  id: JOB_ID,
  customer_id: '00000000-0000-4000-8000-0000000000cc',
  provider_id: null,
  title: 'Steckdose im Flur erneuern',
  description: 'Eine Steckdose neben der Wohnungstuer ist locker und soll getauscht werden.',
  category: 'Elektro',
  category_id: 'elektro',
  address_plz: '50667',
  address_city: 'Köln',
  track: 'handwerker',
  status: 'open',
  created_at: new Date(Date.now() - 5 * 3600_000).toISOString(),
  benachrichtigte_betriebe: 3,
  benachrichtigt_am: new Date(Date.now() - 5 * 3600_000).toISOString(),
};

const angebot = {
  id: OFFER_ID,
  job_id: JOB_ID,
  provider_id: NUTZER_ID,
  price: 320,
  material_cost: 55,
  description: 'Steckdose tauschen, Material inklusive.',
  duration_hours: 2,
  scheduled_at: null,
  status: 'pending',
  created_at: new Date().toISOString(),
};

async function main() {
  const b = await chromium.launch({ executablePath: CHROME });

  // ── Teil A: der Betrieb sieht den offenen Auftrag ────────────────────────
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, { daten: { jobs: [auftrag], offers: [] } });
    const s = await ctx.newPage();
    await s.goto(`${BASIS}/betrieb/auftraege`, { waitUntil: 'networkidle' });
    await s.waitForTimeout(1200);

    const text = await s.locator('body').innerText();
    pruefe('A1 Der offene Auftrag erscheint beim Betrieb',
      text.includes('Steckdose im Flur erneuern'),
      text.includes('Anmelden') ? 'Bildschirm zeigt die Anmeldung, Sitzungs-Ersatz greift nicht' : '');
    pruefe('A2 Der Ort steht dabei', /50667|Köln/.test(text));
    await ctx.close();
  }

  // ── Teil B: das Angebot wird wirklich abgesetzt ──────────────────────────
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, { daten: { jobs: [auftrag], offers: [angebot], auth_email_confirmed: true } });
    const s = await ctx.newPage();
    await s.goto(`${BASIS}/betrieb/angebot-erstellen?jobId=${JOB_ID}`, { waitUntil: 'networkidle' });
    await s.waitForTimeout(1200);

    const felder = s.locator('input:visible, textarea:visible');
    const anzahl = await felder.count();
    pruefe('B1 Das Angebotsformular hat Eingabefelder', anzahl >= 2, `${anzahl} sichtbar`);

    if (anzahl >= 2) {
      // Ueber den Platzhalter treffen, nicht ueber die Reihenfolge: die
      // Reihenfolge aendert sich beim naechsten Umbau des Formulars, und ein
      // Test, der dann still das falsche Feld fuellt, ist schlimmer als keiner.
      const preis = s.locator('input[placeholder="z.B. 320,00"]:visible').first();
      await preis.fill('320').catch(() => {});
      const material = s.locator('input[placeholder="z.B. 55,00"]:visible').first();
      if (await material.count()) await material.fill('55').catch(() => {});
      await s.waitForTimeout(400);

      // Ueber die ROLLE greifen, nicht ueber den Text: react-native-web haengt
      // den Handler an den aeusseren Knopf, ein Klick auf den Text darin loest
      // nichts aus. Genau daran ist diese Reise am 16.09. zuerst gescheitert,
      // und dabei kam heraus, dass der Knopf gar keine Rolle hatte.
      const knopf = s.locator('[role="button"]:visible').filter({ hasText: /Angebot senden/i }).first();
      pruefe('B1b Der Absendeknopf ist als Knopf ausgezeichnet', await knopf.count() > 0);
      if (await knopf.count()) {
        await knopf.scrollIntoViewIfNeeded().catch(() => {});
        await knopf.click().catch(() => {});
        await s.waitForTimeout(1400);
      }
    }

    const schreiben = (ctx.__aufrufe || []).filter((a) => a.name === 'offers' && a.verb === 'POST');
    pruefe('B2 Der Knopf setzt wirklich ein INSERT auf offers ab',
      schreiben.length >= 1,
      `${(ctx.__aufrufe || []).length} Schreibaufrufe insgesamt: `
      + (ctx.__aufrufe || []).map((a) => `${a.verb} ${a.name}`).join(', '));

    if (schreiben.length) {
      const k = Array.isArray(schreiben[0].koerper) ? schreiben[0].koerper[0] : schreiben[0].koerper;
      pruefe('B3 Der Auftrag haengt am Angebot', k && k.job_id === JOB_ID, JSON.stringify(k));
      pruefe('B4 Der Preis kommt an, nicht 0', k && Number(k.price) > 0, `price=${k && k.price}`);
      pruefe('B5 Das Material wird getrennt uebergeben (Bemessungsgrundlage, 0830)',
        k && k.material_cost !== undefined, `material_cost=${k && k.material_cost}`);
      pruefe('B6 Der Status ist pending, nicht schon angenommen',
        k && k.status === 'pending', `status=${k && k.status}`);
    }
    await ctx.close();
  }

  // ── Teil C: der Kunde nimmt an ───────────────────────────────────────────
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, {
      rolle: 'customer',
      daten: {
        jobs: [auftrag],
        offers: [angebot],
        auth_email_confirmed: true,
        accept_offer: [{ id: '00000000-0000-4000-8000-0000000000dd', job_id: JOB_ID, status: 'active' }],
      },
    });
    const s = await ctx.newPage();
    await s.goto(`${BASIS}/auftrag-detail?jobId=${JOB_ID}`, { waitUntil: 'networkidle' });
    await s.waitForTimeout(1400);

    const text = await s.locator('body').innerText();
    pruefe('C1 Das Angebot erscheint beim Kunden mit seinem Preis',
      /320,00|320,0|€\s?320/.test(text), text.slice(0, 200).replace(/\n/g, ' | '));
    pruefe('C2 Der leere Zustand steht NICHT mehr da, wenn es ein Angebot gibt',
      !text.includes('Sie werden benachrichtigt, sobald eines eingegangen ist'));

    const annehmen = s.locator('[role="button"]:visible').filter({ hasText: /Angebot annehmen/i }).first();
    pruefe('C2b Der Annahmeknopf ist als Knopf ausgezeichnet', await annehmen.count() > 0);
    if (await annehmen.count()) {
      await annehmen.scrollIntoViewIfNeeded().catch(() => {});
      await annehmen.click().catch(() => {});
      await s.waitForTimeout(800);
      // Die Annahme haengt hinter einer Rueckfrage (showAlert).
      const ja = s.getByText(/^Annehmen$/).last();
      if (await ja.count()) { await ja.click({ force: true }).catch(() => {}); }
      await s.waitForTimeout(1200);
    }

    const rpc = (ctx.__aufrufe || []).filter((a) => a.name === 'accept_offer');
    pruefe('C3 Die Annahme ruft accept_offer auf',
      rpc.length >= 1,
      `${(ctx.__aufrufe || []).length} Schreibaufrufe: `
      + (ctx.__aufrufe || []).map((a) => `${a.verb} ${a.name}`).join(', '));
    if (rpc.length) {
      pruefe('C4 Angebot und Auftrag werden beide uebergeben',
        rpc[0].koerper && rpc[0].koerper.p_offer_id === OFFER_ID && rpc[0].koerper.p_job_id === JOB_ID,
        JSON.stringify(rpc[0].koerper));
    }
    await ctx.close();
  }

  // ── Teil D: der leere Zustand sagt die Wahrheit ──────────────────────────
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, {
      rolle: 'customer',
      daten: { jobs: [{ ...auftrag, benachrichtigte_betriebe: 0 }], offers: [] },
    });
    const s = await ctx.newPage();
    await s.goto(`${BASIS}/auftrag-detail?jobId=${JOB_ID}`, { waitUntil: 'networkidle' });
    await s.waitForTimeout(1400);
    const text = await s.locator('body').innerText();
    pruefe('D1 Bei null benachrichtigten Betrieben sagt der Bildschirm das',
      /noch kein passender Betrieb|noch niemanden benachrichtigen/i.test(text));
    pruefe('D2 Und verspricht dabei keine Frist',
      !/innerhalb von \d+ ?(Stunden|h)\b/i.test(text));
    await ctx.close();
  }

  await b.close();
  console.log(fehler ? `\n${fehler} Befund(e).` : '\nReise 4: alles wie erwartet.');
  process.exit(fehler ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
