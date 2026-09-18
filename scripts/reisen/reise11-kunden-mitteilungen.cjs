// Kern-Reise 11 — erreicht die Kaltstart-Mitteilung den Kunden?
//
// ANLASS (17.09.2026, Kaltstart-Block). Migration 0950 schreibt dem wartenden
// Kunden eine Mitteilung, sobald ein passender Betrieb dazukommt. Bis heute
// trug die Glocke auf der Kundenstartseite KEINE Zahl -- anders als die des
// Betriebs (PR #208). Eine Glocke ohne Anzeige tippt niemand an, und dann ist
// die Mitteilung genauso wenig zugestellt wie ein Text in einer Spalte.
//
// GEPRUEFT WIRD:
//   A  Die Startseite hat einen Eingang zu den Benachrichtigungen.
//   B  Der Eingang traegt die Zahl der ungelesenen.
//   C  Er fuehrt wirklich dorthin, und die Mitteilung steht da.
//   D  Sie nennt den Auftrag beim Namen und fuehrt zu ihm (Wirkung, nicht
//      nur Existenz).
//   E  GEGENPROBE: ohne ungelesene Mitteilung KEINE Zahl an der Glocke.
//
// GEGENPROBE 17.09.2026 (gemessen, nicht angenommen): nimmt man den Zaehler
// an der Glocke wieder heraus, wird GENAU B1 rot -- A1, C1, C2, D1 und E1
// bleiben gruen. Genau richtig: der Eingang war die ganze Zeit da, er hat nur
// nichts angezeigt. Wer nur die Existenz zusichert, misst eine Attrappe.
//
// GRENZE von E1: die Probe kann "nie eine Zahl" nicht von "Zahl korrekt
// weggelassen" unterscheiden -- sie blieb in der Gegenprobe gruen. Die andere
// Richtung deckt B1 ab; erst beide zusammen sind eine Aussage.
//
// NICHT geprueft: ob der Trigger die Zeile schreibt. Das ist
// scripts/db-test/kaltstart.sql (KS2, KS13) gegen echtes Postgres.
const { chromium } = require('playwright');
const { alsAnbieter, NUTZER_ID } = require('../lib/anbieter-sitzung.cjs');

const BASIS = process.env.BASIS || 'http://localhost:8744';
const CHROME = process.env.CHROME_PFAD
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

let fehler = 0;
function pruefe(name, bedingung, detail = '') {
  const ok = !!bedingung;
  if (!ok) fehler++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  return ok;
}

const JOB_ID = 'bbbbbbbb-0000-4000-8000-0000000000a1';
const AUFTRAG = {
  id: JOB_ID, customer_id: NUTZER_ID, title: 'Sicherung fliegt raus',
  description: 'Seit zwei Wochen faellt der Strom im Bad aus.',
  category: 'Elektro', category_id: 'elektro',
  address_plz: '50667', address_city: 'Köln', track: 'handwerker',
  status: 'open', created_at: new Date(Date.now() - 3 * 86400_000).toISOString(),
  benachrichtigte_betriebe: 1, benachrichtigt_am: new Date().toISOString(),
};

// Wortgleich zu dem, was 0950 schreibt. Geht der Wortlaut dort auseinander,
// faellt es hier auf.
const MITTEILUNG = {
  id: 'bbbbbbbb-0000-4000-8000-00000000ff01',
  art: 'system', titel: 'Ein passender Betrieb ist dazugekommen',
  text: 'Zu Ihrem Auftrag "Sicherung fliegt raus" ist jetzt ein Betrieb in '
    + 'Ihrem Postleitzahlenbereich angemeldet und wurde informiert. Ob er ein '
    + 'Angebot schreibt, entscheidet er selbst.',
  route: `/auftrag-detail?jobId=${JOB_ID}`,
  erstellt_am: new Date().toISOString(),
  gelesen_am: null, pflicht: false, empfaenger: NUTZER_ID,
};

async function main() {
  const b = await chromium.launch({ executablePath: CHROME });

  // ── A bis D: mit einer ungelesenen Mitteilung ─────────────────────────────
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, {
      rolle: 'customer',
      daten: { notifications: [MITTEILUNG], jobs: [AUFTRAG], offers: [] },
    });
    const p = await ctx.newPage();
    await p.goto(`${BASIS}/`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(3000);

    const eingang = p.getByRole('button', { name: /Benachrichtigungen/ }).first();
    pruefe('A1 Die Startseite hat einen Eingang zu den Benachrichtigungen',
      await eingang.count() > 0);

    const label = (await eingang.count()) > 0
      ? await eingang.getAttribute('aria-label') : null;
    pruefe('B1 Der Eingang nennt die Zahl der ungelesenen',
      !!label && /1/.test(label), label || 'kein aria-label');

    if (await eingang.count() > 0) {
      await eingang.click();
      await p.waitForTimeout(2000);
      const text = await p.locator('body').innerText();
      pruefe('C1 Er fuehrt zu den Benachrichtigungen',
        /Ein passender Betrieb ist dazugekommen/.test(text),
        text.slice(0, 90).replace(/\n/g, ' | '));
      // Bei mehreren offenen Auftraegen waere eine Mitteilung ohne Titel
      // wertlos: der Kunde wuesste nicht, welcher gemeint ist.
      pruefe('C2 Sie nennt den Auftrag beim Namen',
        /Sicherung fliegt raus/.test(text));

      // Wirkung, nicht Existenz: tippt man sie an, muss man beim Auftrag
      // landen. Eine Zeile, die nirgendwohin fuehrt, ist eine Attrappe.
      const zeile = p.locator('[role="button"]:visible')
        .filter({ hasText: 'Ein passender Betrieb ist dazugekommen' }).first();
      if (await zeile.count() > 0) {
        await zeile.click();
        await p.waitForTimeout(2500);
        pruefe('D1 Die Mitteilung fuehrt zum Auftrag',
          /auftrag-detail/.test(p.url()), p.url());
      } else {
        pruefe('D1 Die Mitteilung fuehrt zum Auftrag', false, 'Zeile nicht antippbar');
      }
    }
    await ctx.close();
  }

  // ── E GEGENPROBE: ohne Ungelesenes keine Zahl ─────────────────────────────
  //
  // Ohne diese Probe waere eine fest eingebaute „1" an der Glocke gruen.
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, { rolle: 'customer', daten: { notifications: [], jobs: [], offers: [] } });
    const p = await ctx.newPage();
    await p.goto(`${BASIS}/`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(3000);
    const label = await p.getByRole('button', { name: /Benachrichtigungen/ }).first()
      .getAttribute('aria-label').catch(() => null);
    pruefe('E1 Ohne ungelesene Mitteilung steht keine Zahl an der Glocke',
      !!label && !/\d/.test(label), label || 'kein aria-label');
    await ctx.close();
  }

  await b.close();
  console.log(fehler === 0
    ? '\nReise 11: die Kaltstart-Mitteilung erreicht den Kunden.'
    : `\nReise 11: ${fehler} Zusicherung(en) nicht erfuellt.`);
  process.exit(fehler === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
