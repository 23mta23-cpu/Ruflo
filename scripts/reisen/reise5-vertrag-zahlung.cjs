// Kern-Reise 5 — vom Vertrag bis an die Grenze der Zahlung.
//
// Setzt an, wo Reise 4 aufhoert (Annahme -> `accept_offer`). Geprueft wird die
// Strecke, die danach kommt und die bisher in keiner Reise vorkam.
//
// HARTE GRENZE, und sie ist wichtiger als das, was hier gemessen wird:
//
//   app/zahlung.tsx bricht bei `Platform.OS === 'web'` ab, mit dem Hinweis
//   "Bitte laden Sie die Werkant App herunter". Stripes React-Native-Modul ist
//   nur nativ verfuegbar. **Auf der Web-Fassung kann also niemand bezahlen,
//   und zwar unabhaengig davon, ob die Stripe-Schluessel gesetzt sind.** Wer
//   den Geldweg auf der Website erwartet, erwartet etwas, das dort nicht
//   gebaut ist.
//
// Was von hier aus trotzdem pruefbar ist, und es ist das rechtlich heikelste
// Stueck: der Widerrufs-Haken. Ohne ihn darf nichts passieren, und der
// NACHWEIS muss VOR der Zahlung festgehalten werden (0710) -- bis 16.08.2026
// lag die Zustimmung nur in `useState` und verschwand mit dem Bildschirm.
//
// Ausfuehren ueber den Laeufer:  bash scripts/reisen/run.sh
const { chromium } = require('playwright');
const { alsAnbieter, NUTZER_ID } = require('../lib/anbieter-sitzung.cjs');

const BASIS = process.env.BASIS || 'http://localhost:8744';
const CHROME = process.env.CHROME_PFAD
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

const JOB_ID = '00000000-0000-4000-8000-0000000000aa';
const VERTRAG_ID = '00000000-0000-4000-8000-0000000000dd';

let fehler = 0;
function pruefe(name, bedingung, detail = '') {
  const ok = !!bedingung;
  if (!ok) fehler++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  return ok;
}

const auftrag = {
  id: JOB_ID, customer_id: NUTZER_ID, provider_id: '00000000-0000-4000-8000-0000000000ee',
  title: 'Steckdose im Flur erneuern', description: 'Eine Steckdose neben der Wohnungstuer.',
  category: 'Elektro', category_id: 'elektro', address_plz: '50667', address_city: 'Köln',
  track: 'handwerker', status: 'contracted', created_at: new Date().toISOString(),
  benachrichtigte_betriebe: 3, benachrichtigt_am: new Date().toISOString(),
};

// Die Spalten heissen wirklich so (0021): `price_gross`, `customer_total`,
// `provider_payout` — NICHT `price`. Mein erster Entwurf schrieb `price: 320`,
// und der Bildschirm zeigte folgerichtig ueberall 0,00 EUR. Ein Pruefstand mit
// erfundenen Spaltennamen misst den Pruefstand, nicht das Produkt.
//
// `job:` ist ein eingebetteter Verbund: der Bildschirm fragt
// `contracts?select=*,job:jobs!job_id(...)`. Fehlt das Unterobjekt, steht
// „Dienstleistung" statt des Auftragstitels da — auch das sah zuerst wie ein
// Produktfehler aus.
const vertrag = {
  id: VERTRAG_ID, job_id: JOB_ID,
  customer_id: NUTZER_ID, provider_id: '00000000-0000-4000-8000-0000000000ee',
  price_gross: 320, customer_service_fee: 8, werkr_schutz_fee: 0,
  provider_commission: 21.2, customer_total: 328, provider_payout: 298.8,
  status: 'active', track: 'handwerker',
  created_at: new Date().toISOString(),
  customer_signed_at: null, provider_signed_at: null,
  stripe_payment_intent: null, escrow_captured_at: null, escrow_released_at: null,
  job: {
    id: JOB_ID, title: 'Steckdose im Flur erneuern', category: 'Elektro',
    address_city: 'Köln', address_plz: '50667',
    description: 'Eine Steckdose neben der Wohnungstuer.',
  },
};

async function main() {
  const b = await chromium.launch({ executablePath: CHROME });
  const daten = {
    jobs: [auftrag], contracts: [vertrag], offers: [], auth_email_confirmed: true,
    // Die Namen der Vertragsparteien kommen ueber einen eigenen Aufruf; ohne
    // ihn steht zweimal „Name fehlt" da, und die Reise wuerde eine fehlende
    // Antwort des Pruefstands als Produktfehler melden.
    vertrag_partner: [{
      contract_id: VERTRAG_ID,
      kunde_name: 'Tayyip B.',
      anbieter_name: 'Elektrotechnik Wassermann GmbH',
    }],
  };

  // ── Teil A: der Vertrag zeigt, worauf man sich geeinigt hat ──────────────
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, { rolle: 'customer', daten });
    const s = await ctx.newPage();
    await s.goto(`${BASIS}/vertrag?contractId=${VERTRAG_ID}&jobId=${JOB_ID}`, { waitUntil: 'networkidle' });
    await s.waitForTimeout(1600);
    const text = await s.locator('body').innerText();

    pruefe('A1 Der Vertrag nennt die Leistung',
      /Steckdose im Flur erneuern/.test(text),
      text.includes('Anmelden') ? 'zeigt die Anmeldung, Sitzungs-Ersatz greift nicht' : text.slice(0, 120).replace(/\n/g, ' | '));
    pruefe('A2 Der Vertrag nennt den Preis', /320/.test(text));
    pruefe('A3 Der Vertrag nennt beide Parteien beim Namen',
      /Tayyip B\./.test(text) && /Wassermann/.test(text) && !/Name fehlt/.test(text),
      /Name fehlt/.test(text) ? 'es steht „Name fehlt" darauf' : '');
    await ctx.close();
  }

  // ── Teil B: der Widerrufs-Haken sperrt die Zahlung ───────────────────────
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, { rolle: 'customer', daten });
    const s = await ctx.newPage();
    await s.goto(`${BASIS}/zahlung?contractId=${VERTRAG_ID}`, { waitUntil: 'networkidle' });
    await s.waitForTimeout(1600);
    const text = await s.locator('body').innerText();

    pruefe('B1 Der Widerrufstext steht da, nicht nur ein Haken',
      /Widerruf/i.test(text), text.slice(0, 140).replace(/\n/g, ' | '));
    pruefe('B2 Die Servicegebuehr ist ausgewiesen', /Servicegebühr|Service-Gebühr/i.test(text));
    pruefe('B3 Der Gesamtbetrag steht da', /Gesamt|zu zahlen/i.test(text));

    const zahlen = s.locator('[role="button"]:visible').filter({ hasText: /Jetzt zahlen/i }).first();
    pruefe('B4 Der Zahlknopf ist als Knopf ausgezeichnet', await zahlen.count() > 0);

    if (await zahlen.count()) {
      // OHNE Haken: der Knopf muss gesperrt sein. Seit die Rollen gesetzt sind
      // (16.09.2026) steht `disabled` wirklich im DOM und ist damit auch fuer
      // eine Bedienungshilfe erkennbar.
      const gesperrt = await zahlen.isDisabled().catch(() => false);
      pruefe('B5 Ohne Widerrufs-Haken ist die Zahlung gesperrt', gesperrt);

      // Und die Wirkung, nicht nur die Auszeichnung.
      await zahlen.click({ force: true }).catch(() => {});
      await s.waitForTimeout(900);
      const schreiben = (ctx.__aufrufe || []).filter((a) => a.verb !== 'GET');
      pruefe('B6 Ohne Haken wird auch nichts festgehalten',
        !schreiben.some((a) => /widerruf/i.test(a.name)),
        schreiben.map((a) => `${a.verb} ${a.name}`).join(', ') || 'keine Schreibaufrufe');
    }
    await ctx.close();
  }

  // ── Teil C: mit Haken wird der Nachweis VOR der Zahlung festgehalten ─────
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, { rolle: 'customer', daten });
    const s = await ctx.newPage();
    await s.goto(`${BASIS}/zahlung?contractId=${VERTRAG_ID}`, { waitUntil: 'networkidle' });
    await s.waitForTimeout(1600);

    // Den Haken setzen: er haengt an der Zeile mit dem Zustimmungstext.
    const haken = s.locator('[role="button"]:visible, [role="checkbox"]:visible')
      .filter({ hasText: /Widerruf|widerrufe|Kenntnis/i }).first();
    if (await haken.count()) {
      await haken.click().catch(() => {});
      await s.waitForTimeout(500);
    }

    const zahlen = s.locator('[role="button"]:visible').filter({ hasText: /Jetzt zahlen/i }).first();
    const nunFrei = await zahlen.count() ? !(await zahlen.isDisabled().catch(() => true)) : false;
    pruefe('C1 Mit Haken ist die Zahlung freigegeben', nunFrei,
      await haken.count() ? '' : 'Haken nicht gefunden');

    if (nunFrei) {
      await zahlen.click().catch(() => {});
      await s.waitForTimeout(1600);
      const text = await s.locator('body').innerText();
      // Auf Web bricht die Zahlung ab (Stripe ist nur nativ). Das ist die
      // Grenze dieser Reise und zugleich der Befund, den sie festhaelt.
      pruefe('C2 Auf der Web-Fassung endet der Geldweg mit einem Hinweis auf die App',
        /Werkant App|nur in der mobilen App|Zahlung via App/i.test(text),
        text.slice(0, 160).replace(/\n/g, ' | '));
    }
    await ctx.close();
  }

  // ── Teil D: die Stornostufe wird live gerechnet, nicht eingefroren ───────
  //
  // Bis zum 16.09.2026 kam der Satz aus einem URL-Parameter, den der Aufrufer
  // vorher gerundet hatte. Die Edge Function rechnet live aus `scheduled_at`:
  // bei 48,4 Stunden zeigte der Bildschirm 50 % und der Server erstattete
  // 100 %. Geprueft wird deshalb an beiden Kanten.
  {
    const faelle = [
      { stunden: 48.4, erwartet: /Volle Rückerstattung/i, name: 'D1 48,4 Stunden ergibt volle Erstattung (nicht gerundet auf 48)' },
      { stunden: 36,   erwartet: /50 ?% Rückerstattung/i, name: 'D2 36 Stunden ergibt die halbe Erstattung' },
      { stunden: 12,   erwartet: /Keine Rückerstattung/i, name: 'D3 12 Stunden ergibt keine Erstattung' },
    ];
    for (const f of faelle) {
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
      await alsAnbieter(ctx, { rolle: 'customer', daten });
      const s = await ctx.newPage();
      const termin = new Date(Date.now() + f.stunden * 3_600_000).toISOString();
      await s.goto(`${BASIS}/stornierung?contractId=${VERTRAG_ID}&jobTitle=Test&scheduledAt=${encodeURIComponent(termin)}`,
        { waitUntil: 'networkidle' });
      await s.waitForTimeout(1200);
      const text = await s.locator('body').innerText();
      pruefe(f.name, f.erwartet.test(text), text.slice(0, 130).replace(/\n/g, ' | '));
      await ctx.close();
    }
  }

  await b.close();
  console.log(fehler ? `\n${fehler} Befund(e).` : '\nReise 5: alles wie erwartet.');
  console.log('HINWEIS: Auf der Web-Fassung ist der Geldweg konstruktionsbedingt zu Ende.');
  console.log('         Stripe laeuft nur nativ. Zahlung, Escrow, Abnahme und');
  console.log('         Auszahlung bleiben aus dem Browser heraus UNGEPRUEFT.');
  process.exit(fehler ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
