// Kern-Reise 6 — Abnahme und Reklamation.
//
// Das letzte Stueck des Geldwegs, das aus dem Browser heraus pruefbar ist. Der
// Kunde sieht "fertig gemeldet", prueft, und entscheidet sich fuer eines von
// zwei Dingen: freigeben oder einen Mangel melden.
//
// WARUM DAS WICHTIG IST: die Freigabe ist unumkehrbar. Ein Bildschirm, auf dem
// der Mangel-Weg schwerer zu finden ist als die Freigabe, schiebt Menschen in
// die unumkehrbare Richtung. Und eine Reklamation, die die Auszahlung NICHT
// anhaelt, waere die teuerste Sorte Fehler (AGB §4(2b), Migration 0770).
//
// GEPRUEFT WIRD die Verdrahtung, nicht die Datenbankregel: ob `release-escrow`
// mit der richtigen Vertragskennung gerufen wird und ob die Reklamation die
// Freigabe NICHT ausloest. Ob die Datenbank die Frist wirklich anhaelt, steht
// in scripts/db-test/abnahme-frist.sql.
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
  track: 'handwerker', status: 'in_progress', created_at: new Date().toISOString(),
};

const vertrag = {
  id: VERTRAG_ID, job_id: JOB_ID,
  customer_id: NUTZER_ID, provider_id: '00000000-0000-4000-8000-0000000000ee',
  price_gross: 320, customer_service_fee: 8, werkr_schutz_fee: 0,
  provider_commission: 21.2, customer_total: 328, provider_payout: 298.8,
  status: 'active', track: 'handwerker', created_at: new Date().toISOString(),
  escrow_captured_at: new Date().toISOString(), escrow_released_at: null,
  stripe_payment_intent: 'pi_pruefstand',
  job: {
    id: JOB_ID, title: 'Steckdose im Flur erneuern', category: 'Elektro',
    address_city: 'Köln', address_plz: '50667',
    description: 'Eine Steckdose neben der Wohnungstuer.',
  },
  provider: { id: '00000000-0000-4000-8000-0000000000ee', business_name: 'Elektrotechnik Wassermann GmbH' },
};

const daten = {
  jobs: [auftrag], contracts: [vertrag], offers: [], disputes: [],
  auth_email_confirmed: true,
  vertrag_partner: [{ contract_id: VERTRAG_ID, kunde_name: 'Tayyip B.',
                      anbieter_name: 'Elektrotechnik Wassermann GmbH' }],
  'release-escrow': { ok: true },
  // Den Anbieter DIESES Vertrags vorgeben. Ohne das faellt der Bildschirm auf
  // das Wort "Anbieter" und ein "?" im Kreis zurueck -- und man gaebe Geld an
  // jemanden frei, dessen Name nirgends steht.
  provider_public: [{
    id: '00000000-0000-4000-8000-0000000000ee',
    business_name: 'Elektrotechnik Wassermann GmbH',
    trade_id: 'elektro', kyc_status: 'approved', available: true,
    rating_avg: 4.8, rating_count: 37, meister_verified: true,
    has_steuer_id: true, has_gewerbeschein: true, category_ids: ['elektro'],
    min_hourly_rate: 45, radius_km: 25, created_at: new Date().toISOString(),
  }],
};

async function seite(b) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await alsAnbieter(ctx, { rolle: 'customer', daten });
  const s = await ctx.newPage();
  return { ctx, s };
}

async function main() {
  const b = await chromium.launch({ executablePath: CHROME });

  // ── Teil A: der Bildschirm sagt, was die Freigabe bedeutet ───────────────
  {
    const { ctx, s } = await seite(b);
    await s.goto(`${BASIS}/auftrag-abschliessen?contractId=${VERTRAG_ID}`, { waitUntil: 'networkidle' });
    await s.waitForTimeout(1600);
    const text = await s.locator('body').innerText();

    pruefe('A1 Der Bildschirm nennt den Auftrag',
      /Steckdose im Flur erneuern/.test(text),
      text.includes('Anmelden') ? 'zeigt die Anmeldung' : text.slice(0, 120).replace(/\n/g, ' | '));
    pruefe('A2 Er sagt, dass die Freigabe unumkehrbar ist',
      /nicht rückgängig|unwiderruflich|nicht mehr rückgängig/i.test(text));
    pruefe('A3 Der Weg fuer einen Mangel steht gleichrangig daneben',
      /Problem melden|Reklamation/i.test(text));
    // Wer hier Geld freigibt, soll lesen koennen, AN WEN. Bis zum 07.09.2026
    // stand auf dem Vertrag das blosse Wort "Anbieter", weil der Name gar
    // nicht geladen wurde.
    pruefe('A4 Der Bildschirm nennt den Betrieb beim Namen',
      /Wassermann/.test(text) && !/^Anbieter$/m.test(text),
      /Anbieter/.test(text) && !/Wassermann/.test(text) ? 'es steht nur „Anbieter" da' : '');
    pruefe('A5 Der Treuhandbetrag steht da', /328|320/.test(text));
    await ctx.close();
  }

  // ── Teil B: die Freigabe ruft release-escrow mit dem Vertrag ─────────────
  {
    const { ctx, s } = await seite(b);
    await s.goto(`${BASIS}/auftrag-abschliessen?contractId=${VERTRAG_ID}`, { waitUntil: 'networkidle' });
    await s.waitForTimeout(1600);

    const frei = s.locator('[role="button"]:visible').filter({ hasText: /Zahlung freigeben/i }).first();
    pruefe('B1 Der Freigabeknopf ist als Knopf ausgezeichnet', await frei.count() > 0);

    // B1b: die Freigabe ist unumkehrbar und haengt deshalb an einer Pruefliste.
    // Bis zum 16.09.2026 war der Knopf dabei NICHT `disabled`, sondern hatte
    // nur keinen Handler: eine Bedienungshilfe meldete ihn als benutzbar, und
    // beim Tippen passierte wortlos nichts.
    pruefe('B1b Ohne die Pruefliste ist die Freigabe erkennbar gesperrt',
      await frei.isDisabled().catch(() => false));
    const fussnote = await s.locator('body').innerText();
    pruefe('B1c Und der Bildschirm sagt, was noch fehlt',
      /noch \d+ von \d+ Punkten/i.test(fussnote));

    // Jetzt die Pruefliste abhaken und erst dann freigeben.
    const punkte = s.locator('[role="button"]:visible').filter({
      hasText: /vereinbarte Leistung|sauber und fachgerecht|keine Mängel|zufrieden/i });
    const n = await punkte.count();
    pruefe('B1d Die Pruefliste hat alle vier Punkte', n >= 4, `${n} gefunden`);
    for (let i = 0; i < n; i++) {
      await punkte.nth(i).click().catch(() => {});
      await s.waitForTimeout(150);
    }
    await s.waitForTimeout(400);

    if (await frei.count()) {
      pruefe('B1e Nach der Pruefliste ist die Freigabe frei',
        !(await frei.isDisabled().catch(() => true)));
      await frei.scrollIntoViewIfNeeded().catch(() => {});
      await frei.click().catch(() => {});
      await s.waitForTimeout(700);
      // Die Freigabe haengt hinter einer Rueckfrage, und das ist richtig so.
      // Der Knopf im Hinweisfenster (components/ui/GlobalAlert.tsx) traegt
      // seit jeher eine Rolle; ueber den Text allein greift man den Text im
      // Knopf, nicht den Knopf.
      const bestaetigen = s.locator('[role="button"]:visible')
        .filter({ hasText: /^\s*Freigeben\s*$/ }).last();
      pruefe('B2 Die Freigabe fragt vorher nach', await bestaetigen.count() > 0,
        (await s.locator('[role="button"]:visible').allInnerTexts())
          .filter(Boolean).map((t) => t.trim()).slice(0, 8).join(' · '));
      if (await bestaetigen.count()) {
        await bestaetigen.click().catch(() => {});
        await s.waitForTimeout(1600);
      }
    }

    const ruf = (ctx.__aufrufe || []).filter((a) => a.name === 'release-escrow');
    pruefe('B3 Die Freigabe ruft release-escrow',
      ruf.length >= 1,
      (ctx.__aufrufe || []).map((a) => `${a.verb} ${a.name}`).join(', ') || 'keine Aufrufe');
    if (ruf.length) {
      pruefe('B4 Und zwar mit genau diesem Vertrag',
        ruf[0].koerper && ruf[0].koerper.contract_id === VERTRAG_ID,
        JSON.stringify(ruf[0].koerper));
    }
    await ctx.close();
  }

  // ── Teil C: eine Reklamation gibt das Geld NICHT frei ────────────────────
  //
  // Der teuerste denkbare Fehler waere, dass der Mangel-Weg die Auszahlung
  // trotzdem ausloest. AGB §4(2b): "Der Treuhandbetrag bleibt gesperrt."
  {
    const { ctx, s } = await seite(b);
    await s.goto(`${BASIS}/auftrag-abschliessen?contractId=${VERTRAG_ID}`, { waitUntil: 'networkidle' });
    await s.waitForTimeout(1600);

    const melden = s.locator('[role="button"]:visible').filter({ hasText: /Problem melden|Reklamation/i }).first();
    pruefe('C1 Der Mangel-Weg ist ein Knopf', await melden.count() > 0);
    if (await melden.count()) {
      await melden.scrollIntoViewIfNeeded().catch(() => {});
      await melden.click().catch(() => {});
      await s.waitForTimeout(1600);
    }

    const text = await s.locator('body').innerText();
    pruefe('C2 Er fuehrt auf den Reklamations-Bildschirm',
      /Reklamation|Problem|Mangel/i.test(text) && !/Zahlung freigeben/i.test(text),
      text.slice(0, 130).replace(/\n/g, ' | '));
    pruefe('C3 Dabei wird KEINE Freigabe ausgeloest',
      !(ctx.__aufrufe || []).some((a) => a.name === 'release-escrow'),
      (ctx.__aufrufe || []).map((a) => `${a.verb} ${a.name}`).join(', ') || 'keine Aufrufe');
    await ctx.close();
  }

  // -- Teil D: die Bewertungsfrist -------------------------------------------
  //
  // ANLASS (22.09.2026): Im ganzen Pruefstand gab es EINE fristbezogene
  // Zusicherung, und die war negativ formuliert. `lib/bewertungsFrist.ts`
  // ist durch Jest gedeckt -- die RECHNUNG also. Ob der Bildschirm die
  // Frist nennt und ob sie WIRKT, war ungeprueft. An ihr haengt Migration
  // 0930: nach 14 Tagen weist der Server die Bewertung ab.
  //
  // Gemessen werden Text UND Wirkung getrennt. In BEIDEN Faellen wird
  // vorher ein Stern getippt -- ohne das sperrt schon die fehlende
  // Sternwahl den Knopf, und man schriebe die Sperre der Frist zu, die
  // gar nicht von ihr kommt.
  {
    const TAG = 86_400_000;
    const faelle = [
      { name: 'D1', tage: 7,   erwartet: /noch 7 Tage lang bewerten/i, gesperrt: false,
        was: 'Sieben Tage vorbei: der Bildschirm nennt die Restfrist' },
      { name: 'D2', tage: 13.6, erwartet: /Heute ist der letzte Tag/i, gesperrt: false,
        was: 'Am letzten Tag sagt er das ausdruecklich' },
      { name: 'D3', tage: 20,  erwartet: /Bewertungsfrist von 14 Tagen ist abgelaufen/i, gesperrt: true,
        was: 'Nach 20 Tagen ist die Frist abgelaufen' },
    ];
    for (const f of faelle) {
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
      const vertragMitFrist = {
        ...vertrag,
        status: 'completed',
        completed_at: new Date(Date.now() - f.tage * TAG).toISOString(),
      };
      await alsAnbieter(ctx, {
        rolle: 'customer',
        daten: { ...daten, contracts: [vertragMitFrist], reviews: [] },
      });
      const s = await ctx.newPage();
      await s.goto(`${BASIS}/bewertung?contractId=${VERTRAG_ID}`, { waitUntil: 'networkidle' });
      await s.waitForTimeout(2000);

      const text = await s.locator('body').innerText();
      pruefe(`${f.name}a ${f.was}`, f.erwartet.test(text),
        (text.split('\n').find((z) => /bewerten|Bewertungsfrist|letzte Tag/i.test(z)) || text.slice(0, 90)).trim());

      // Erst einen Stern tippen, dann die Wirkung messen.
      const stern = s.locator('[role="button"]:visible').filter({ hasText: '' })
        .and(s.locator('[aria-label="4 Sterne"]')).first();
      const sternDa = await stern.count() === 1;
      pruefe(`${f.name}b Die Sterne tragen einen Namen`, sternDa,
        sternDa ? '' : 'kein Element mit aria-label „4 Sterne"');
      if (sternDa) await stern.click().catch(() => {});
      await s.waitForTimeout(400);

      // „Bewertung abschicken" -- gemessen, nicht geraten. Der erste Entwurf
      // suchte nach „absenden" und fand nichts; die Zusicherung meldete dann
      // „kein Absendeknopf gefunden" bei einem Bildschirm, der den Knopf hat.
      const senden = s.locator('[role="button"]:visible').filter({ hasText: /Bewertung abschicken/i }).first();
      const istGesperrt = await senden.count()
        ? await senden.isDisabled().catch(() => false)
        : null;
      pruefe(`${f.name}c Der Absendeknopf ist ${f.gesperrt ? 'gesperrt' : 'frei'}`,
        istGesperrt === f.gesperrt,
        istGesperrt === null ? 'kein Absendeknopf gefunden' : `gesperrt=${istGesperrt}`);
      await ctx.close();
    }
  }

  await b.close();
  console.log(fehler ? `\n${fehler} Befund(e).` : '\nReise 6: alles wie erwartet.');
  console.log('HINWEIS: Geprueft ist die Verdrahtung. Ob die Datenbank die Abnahmefrist');
  console.log('         wirklich anhaelt, steht in scripts/db-test/abnahme-frist.sql.');
  process.exit(fehler ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
