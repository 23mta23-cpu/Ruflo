// Kern-Reise 24 — der Support-Assistent hilft wirklich.
//
// ANLASS (03.10.2026, Founder am Geraet): „Der Bot-Helfer ist nicht richtig
// zum Helfen." Die alte Fassung ordnete nach Reihenfolge statt nach Frage
// („Wie storniere ich meinen Auftrag?" bekam den Auftragsstatus), versprach
// Hilfe mit Daten, die sie nie sah, zeigte eine erfundene Bewertung „4.9"
// und fuehrte nirgendwohin.
//
// Jest (__tests__/supportBot.test.ts) prueft die Zuordnung und die Texte.
// Hier steht, was nur der Browser zeigt (Pruefregel 3 und 4): erscheint die
// Antwort, steht der Knopf als Knopf da, und fuehrt er wirklich hin?
//
// Ausfuehren ueber den Laeufer:  bash scripts/reisen/run.sh
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

// `\W*` am Ende: das Ionicon steht als Schriftzeichen im Knopftext.
const knopf = (s, text) => s.locator('[role="button"]:visible')
  .filter({ hasText: new RegExp(`^\\W*${text}\\W*$`) });

async function oeffnen(b, rolle) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await alsAnbieter(ctx, { rolle, daten: {} });
  const s = await ctx.newPage();
  await s.goto(`${BASIS}/support-chat`, { waitUntil: 'networkidle' });
  await s.waitForTimeout(1200);
  return { ctx, s };
}

async function frage(s, text) {
  const feld = s.locator('textarea:visible, input:visible').and(s.locator('[placeholder*="Schreiben"]')).first();
  await feld.fill(text).catch(() => {});
  await s.locator('[aria-label="Senden"]').first().click().catch(() => {});
  await s.waitForTimeout(900);
  return s.locator('body').innerText();
}

async function main() {
  const b = await chromium.launch({ executablePath: CHROME });

  // ── K: Kunde ─────────────────────────────────────────────────────────────
  {
    const { ctx, s } = await oeffnen(b, 'customer');
    pruefe('K0 Gemessen wird der Support-Chat',
      new URL(s.url()).pathname.endsWith('/support-chat'), s.url());
    const start = await s.locator('body').innerText();
    pruefe('K1 Keine erfundene Bewertung im Kopf', !/\b4[.,]9\b/.test(start));
    pruefe('K2 Er sagt, dass er keine Auftraege sieht', /Ihre Aufträge sehe ich nicht/.test(start));

    const text = await frage(s, 'Wie storniere ich meinen Auftrag?');
    pruefe('K3 „Stornieren" bekommt die Storno-Antwort, nicht den Auftragsstatus',
      /Termin stornieren/.test(text) && /48 Stunden/.test(text),
      text.split('\n').slice(-12).join(' | '));
    const hin = knopf(s, 'Meine Aufträge');
    pruefe('K4 Unter der Antwort steht genau ein Knopf „Meine Aufträge"',
      await hin.count() === 1, `${await hin.count()} gefunden`);
    await hin.first().click().catch(() => {});
    await s.waitForTimeout(1000);
    pruefe('K5 und er fuehrt zu den Auftraegen', /\/auftraege/.test(s.url()), s.url());
    await ctx.close();
  }

  // ── W: Widerruf landete frueher beim Menschen-Hinweis („echt" in „Recht") ──
  {
    const { ctx, s } = await oeffnen(b, 'customer');
    const text = await frage(s, 'Wie funktioniert das Widerrufsrecht?');
    pruefe('W1 Widerruf bekommt die Widerrufs-Antwort',
      /Widerrufsbelehrung & Formular/.test(text) && !/Einen Live-Chat/.test(text),
      text.split('\n').slice(-8).join(' | '));
    await ctx.close();
  }

  // ── B: Betrieb bekommt seine eigene Antwort ─────────────────────────────
  {
    const { ctx, s } = await oeffnen(b, 'provider');
    const chip = knopf(s, 'Auszahlung');
    pruefe('B1 Der Betrieb sieht den Themen-Knopf „Auszahlung"', await chip.count() === 1,
      `${await chip.count()} gefunden`);
    await chip.first().click().catch(() => {});
    await s.waitForTimeout(900);
    const text = await s.locator('body').innerText();
    pruefe('B2 Die Antwort nennt Frist und Provision', /2 Werktagen/.test(text) && /der Arbeitsleistung/.test(text),
      text.split('\n').slice(-10).join(' | '));
    pruefe('B3 mit dem Knopf zum Auszahlungskonto', await knopf(s, 'Auszahlungskonto').count() === 1);
    await ctx.close();
  }

  // ── R: Rueckfall eskaliert zum Menschen, mit vorbereiteter E-Mail ─────────
  {
    const { ctx, s } = await oeffnen(b, 'customer');
    const erst = await frage(s, 'xyzzy blubb');
    pruefe('R1 Erste unverstandene Frage: Stichworte, noch keine E-Mail',
      /Stichwort/.test(erst) && await knopf(s, 'E-Mail an das Team').count() === 0);
    pruefe('R2 Die Themen-Knoepfe stehen wieder da', await knopf(s, 'Stornieren').count() === 1);
    await frage(s, 'qwertz');
    pruefe('R3 Zweite: der Weg zum Menschen als Knopf',
      await knopf(s, 'E-Mail an das Team').count() === 1);
    await ctx.close();
  }

  await b.close();
  console.log(fehler === 0 ? '\nReise 24: alles gruen.' : `\nReise 24: ${fehler} FAIL.`);
  process.exit(fehler === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
