// Kern-Reise 10 — erreicht eine Pflichtmitteilung den Betrieb?
//
// ANLASS (16.09.2026, aus der Stand-Aufnahme, nicht aus einem Befund):
// Der Betriebsbereich hat fuenf Reiter und hatte KEINEN Weg zu
// `/benachrichtigungen`. Dorthin schreiben aber drei Vorgaenge, die
// ausschliesslich Betriebe betreffen:
//
//   Freigabe/Ablehnung der Verifizierung  (supabase/functions/pruefung)
//   `strike_benachrichtigen()`            (0860)
//   `beschraenkung_benachrichtigen()`     (0860)
//
// Die letzten beiden schuldet Art. 4 P2B-VO als UEBERMITTLUNG, nicht als
// Eintrag in einer Tabelle. In der Produktion wartet gerade ein Betrieb auf
// seine Freigabe (`/health`: `pruef_offen: 1`), und der Mailversand ist aus.
// Ohne diesen Weg haette er nie erfahren, dass die Entscheidung da ist.
//
// GEPRUEFT WIRD:
//   A  Das Dashboard hat einen Eingang zu den Mitteilungen.
//   B  Der Eingang traegt die Zahl der ungelesenen (sonst faellt nichts auf).
//   C  Er fuehrt wirklich dorthin, und die Mitteilung steht da.
//   D  Der Begruendungstext einer Beschraenkung kommt mit (P2B Art. 4).
//   E  GEGENPROBE: ohne ungelesene Mitteilung KEINE Zahl an der Glocke.
//
// NICHT geprueft: ob Mail und Push hinausgehen (das ist der pg_cron-Lauf
// `zustellung_lauf`, beim Founder) und ob der Server die Mitteilung wirklich
// schreibt (supabase/tests/pruefung_test.ts, db-test/benachrichtigungen.sql).
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

const BESCHRAENKUNG_TEXT =
  'Ihr Konto ist bis zum 30.09.2026 eingeschraenkt. Grund: wiederholte Absagen '
  + 'kurz vor dem Termin (drei Feststellungen seit Juli).';

const MITTEILUNGEN = [
  {
    id: 'aaaaaaaa-0000-4000-8000-00000000ff01',
    art: 'system', titel: 'Ihre Verifizierung ist abgeschlossen',
    text: 'Ihr Betrieb ist freigegeben. Sie können ab sofort Angebote abgeben.',
    route: '/betrieb/dashboard', erstellt_am: new Date().toISOString(),
    gelesen_am: null, pflicht: false, empfaenger: NUTZER_ID,
  },
  {
    id: 'aaaaaaaa-0000-4000-8000-00000000ff02',
    art: 'beschraenkung', titel: 'Einschränkung Ihres Zugangs',
    text: BESCHRAENKUNG_TEXT,
    route: '/betrieb/profil', erstellt_am: new Date().toISOString(),
    gelesen_am: null, pflicht: true, empfaenger: NUTZER_ID,
  },
];

async function main() {
  const b = await chromium.launch({ executablePath: CHROME });

  // ── A bis D: mit zwei ungelesenen Mitteilungen ────────────────────────────
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, { daten: { notifications: MITTEILUNGEN } });
    const p = await ctx.newPage();
    await p.goto(`${BASIS}/betrieb/dashboard`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(3000);

    const glocke = p.locator('[role="button"]:visible')
      .filter({ has: p.locator('text=/^\\s*(2|9\\+)\\s*$/') }).first();
    const perLabel = p.getByRole('button', { name: /Mitteilungen/ }).first();
    const eingang = (await perLabel.count()) > 0 ? perLabel : glocke;

    pruefe('A1 Das Dashboard hat einen Eingang zu den Mitteilungen',
      await eingang.count() > 0);

    const label = (await eingang.count()) > 0
      ? await eingang.getAttribute('aria-label') : null;
    pruefe('B1 Der Eingang nennt die Zahl der ungelesenen',
      !!label && /2/.test(label), label || 'kein aria-label');

    if (await eingang.count() > 0) {
      await eingang.click();
      await p.waitForTimeout(2000);
      const text = await p.locator('body').innerText();
      pruefe('C1 Er fuehrt zu den Mitteilungen',
        /Verifizierung ist abgeschlossen/.test(text),
        text.slice(0, 90).replace(/\n/g, ' | '));
      pruefe('C2 Auch die Beschraenkung steht da',
        /Einschränkung Ihres Zugangs/.test(text));
      // Art. 4 P2B-VO: die Begruendung gehoert zur Uebermittlung. Eine
      // Ueberschrift ohne Grund waere keine Erfuellung.
      pruefe('D1 Der Begruendungstext kommt mit',
        /wiederholte Absagen/.test(text));
    }
    await ctx.close();
  }

  // ── E GEGENPROBE: ohne Ungelesenes keine Zahl ────────────────────────────
  //
  // Ohne diese Probe waere eine fest eingebaute „2" an der Glocke gruen.
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, { daten: { notifications: [] } });
    const p = await ctx.newPage();
    await p.goto(`${BASIS}/betrieb/dashboard`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(3000);
    const label = await p.getByRole('button', { name: /Mitteilungen/ }).first()
      .getAttribute('aria-label').catch(() => null);
    pruefe('E1 Ohne ungelesene Mitteilung steht keine Zahl an der Glocke',
      !!label && !/\d/.test(label), label || 'kein aria-label');
    await ctx.close();
  }

  await b.close();
  console.log(fehler === 0
    ? '\nReise 10: die Mitteilung erreicht den Betrieb.'
    : `\nReise 10: ${fehler} Zusicherung(en) nicht erfuellt.`);
  process.exit(fehler === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
