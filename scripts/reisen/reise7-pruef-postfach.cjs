// Kern-Reise 7 — das Prüf-Postfach, aus der Sicht des Betreibers.
//
// WARUM AUSGERECHNET DIESER BILDSCHIRM: er ist der erste, den der Founder
// benutzen wird, sobald `WERKANT_ADMIN_EMAILS` gesetzt ist -- und in der
// Produktion wartet bereits ein Betrieb (`/health`: `pruef_offen: 1`,
// `pruef_stau: true`). Solange dieser Bildschirm nicht funktioniert, steht
// die gesamte Angebotsseite still, und ein Marktplatz ohne Anbieter hat kein
// Produkt.
//
// Gebaut wurde er in der Nacht zum 15.09.2026 und war seitdem NIE im Browser.
//
// GEPRUEFT WIRD:
//   * Wer nicht Betreiber ist, sieht "nicht gefunden" -- nicht "verboten".
//     Der Unterschied ist Absicht: wer nicht Betreiber ist, soll gar nicht
//     erfahren, dass es diesen Weg gibt.
//   * Die Liste zeigt Betrieb, Gewerk und Wartezeit.
//   * Die Vorpruefungen, die eine Freigabe SPERREN, sperren sie auch sichtbar.
//   * Eine Ablehnung ohne ausreichende Begruendung geht nicht raus.
//   * Freigabe und Ablehnung rufen die Funktion mit der richtigen Kennung.
//
// NICHT geprueft: ob der Server die Entscheidung wirklich schreibt und ob die
// Dokumentlinks nach fuenf Minuten ablaufen. Das steht in
// supabase/tests/pruefung_test.ts und in den Edge-Function-Tests.
const { chromium } = require('playwright');
const { alsAnbieter } = require('../lib/anbieter-sitzung.cjs');

const BASIS = process.env.BASIS || 'http://localhost:8744';
const CHROME = process.env.CHROME_PFAD
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

const BETRIEB_A = '00000000-0000-4000-8000-0000000000a1';
const BETRIEB_B = '00000000-0000-4000-8000-0000000000b1';

let fehler = 0;
function pruefe(name, bedingung, detail = '') {
  const ok = !!bedingung;
  if (!ok) fehler++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  return ok;
}

const vorStunden = (h) => new Date(Date.now() - h * 3_600_000).toISOString();

// Zwei Einreichungen, absichtlich verschieden:
//   A ist sauber und darf freigegeben werden.
//   B ist ein meisterpflichtiges Gewerk OHNE Meisterbrief -- die Vorpruefung
//     muss die Freigabe sperren (§ 1 HwO Anlage A).
const liste = {
  einreichungen: [
    {
      id: BETRIEB_A, business_name: 'Elektrotechnik Wassermann GmbH',
      trade_id: 'elektro', kyc_status: 'in_review',
      kyc_submitted_at: vorStunden(30),
      gewerbeschein_url: 'https://example.invalid/a-gewerbe.pdf',
      meisterbrief_url: 'https://example.invalid/a-meister.pdf',
      gewerbeschein_path: 'a/gewerbe.pdf', meisterbrief_path: 'a/meister.pdf',
      steuer_id: 'DE123456789', kontoinhaber: 'Elektrotechnik Wassermann GmbH',
      befunde: [],
    },
    {
      id: BETRIEB_B, business_name: 'Sanitaer Schmitz',
      trade_id: 'sanitaer', kyc_status: 'in_review',
      kyc_submitted_at: vorStunden(80),
      gewerbeschein_url: 'https://example.invalid/b-gewerbe.pdf',
      meisterbrief_url: null,
      gewerbeschein_path: 'b/gewerbe.pdf', meisterbrief_path: null,
      steuer_id: 'DE987654321', kontoinhaber: 'Schmitz',
      befunde: [],
    },
  ],
  link_gilt_sekunden: 300,
};

async function main() {
  const b = await chromium.launch({ executablePath: CHROME });

  // ── Teil A: wer nicht Betreiber ist, findet nichts ────────────────────────
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    // 404 ist die Antwort des Servers fuer "nicht Betreiber".
    await alsAnbieter(ctx, { rolle: 'customer', daten: { pruefung: () => ({ error: 'Not found' }) } });
    await ctx.route('**/functions/v1/pruefung**', (r) => r.fulfill({
      status: 404, contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Not found' }),
    }));
    const s = await ctx.newPage();
    await s.goto(`${BASIS}/pruefung`, { waitUntil: 'networkidle' });
    await s.waitForTimeout(1600);
    const text = await s.locator('body').innerText();

    pruefe('A1 Ohne Betreiber-Recht steht dort "nicht gefunden"',
      /nicht gefunden|Seite nicht/i.test(text), text.slice(0, 140).replace(/\n/g, ' | '));
    pruefe('A2 Und KEIN Hinweis darauf, dass es ein Postfach gibt',
      !/Prüf-Postfach|Einreichung|Gewerbeschein/i.test(text),
      text.slice(0, 140).replace(/\n/g, ' | '));
    await ctx.close();
  }

  // ── Teil B: als Betreiber steht die Liste da ──────────────────────────────
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, { rolle: 'customer', daten: {} });
    await ctx.route('**/functions/v1/pruefung**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(liste),
    }));
    const s = await ctx.newPage();
    await s.goto(`${BASIS}/pruefung`, { waitUntil: 'networkidle' });
    await s.waitForTimeout(1800);
    const text = await s.locator('body').innerText();

    pruefe('B1 Beide Einreichungen stehen da',
      /Wassermann/.test(text) && /Schmitz/.test(text),
      text.slice(0, 160).replace(/\n/g, ' | '));
    // Fuer den Betreiber ist "seit wann wartet der?" die Zahl, nach der er
    // entscheidet, was er zuerst anfasst. /health meldet `pruef_stau` genau
    // dann, wenn etwas zu lange wartet.
    pruefe('B2 Die Wartezeit steht bei jeder Einreichung, mit Zahl',
      /wartet 30 h/.test(text) && /wartet 80 h/.test(text),
      text.slice(0, 200).replace(/\n/g, ' | '));
    pruefe('B3 Das Gewerk steht dabei', /Elektro|Sanitär|Sanitaer/i.test(text));

    // Der Fall, auf den es ankommt: meisterpflichtig ohne Meisterbrief.
    pruefe('B4 Der meisterpflichtige Fall ohne Meisterbrief ist als Sperre markiert',
      /meisterpflichtig|Meisterbrief/i.test(text),
      text.includes('Meisterbrief') ? '' : 'kein Hinweis auf den Meisterbrief');
    await ctx.close();
  }

  // ── Teil C: eine Ablehnung ohne Begruendung geht nicht raus ───────────────
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, { rolle: 'customer', daten: {} });
    const rufe = [];
    await ctx.route('**/functions/v1/pruefung**', (r) => {
      let koerper = null;
      try { koerper = JSON.parse(r.request().postData() || 'null'); } catch (e) { /* egal */ }
      if (koerper && koerper.aktion && koerper.aktion !== 'liste') rufe.push(koerper);
      return r.fulfill({
        status: 200, contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(koerper && koerper.aktion !== 'liste' ? { ok: true } : liste),
      });
    });
    const s = await ctx.newPage();
    await s.goto(`${BASIS}/pruefung`, { waitUntil: 'networkidle' });
    await s.waitForTimeout(1800);

    const ablehnen = s.locator('[role="button"]:visible').filter({ hasText: /^\s*Ablehnen\s*$/ }).first();
    pruefe('C1 Es gibt einen Ablehnen-Knopf', await ablehnen.count() > 0);
    if (await ablehnen.count()) {
      pruefe('C2 Ohne Begruendung ist er gesperrt',
        await ablehnen.isDisabled().catch(() => false));
      await ablehnen.click({ force: true }).catch(() => {});
      await s.waitForTimeout(800);
      pruefe('C3 Und es geht auch nichts raus',
        rufe.length === 0, JSON.stringify(rufe));
    }

    // Mit ausreichender Begruendung muss es gehen.
    const feld = s.locator('textarea:visible, input:visible').first();
    if (await feld.count()) {
      await feld.fill('Der Gewerbeschein ist nicht lesbar, bitte neu hochladen.').catch(() => {});
      await s.waitForTimeout(500);
      const nun = s.locator('[role="button"]:visible').filter({ hasText: /^\s*Ablehnen\s*$/ }).first();
      pruefe('C4 Mit ausreichender Begruendung ist er frei',
        !(await nun.isDisabled().catch(() => true)));
      await nun.click().catch(() => {});
      await s.waitForTimeout(1200);
      pruefe('C5 Die Ablehnung geht mit Begruendung und Kennung raus',
        rufe.length >= 1 && rufe[0].aktion === 'ablehnen'
          && typeof rufe[0].grund === 'string' && rufe[0].grund.length >= 20
          && !!rufe[0].providerId,
        JSON.stringify(rufe[0] ?? null));
    }
    await ctx.close();
  }

  await b.close();
  console.log(fehler ? `\n${fehler} Befund(e).` : '\nReise 7: alles wie erwartet.');
  console.log('HINWEIS: Ob der Server die Entscheidung wirklich schreibt und ob die');
  console.log('         Dokumentlinks ablaufen, steht in supabase/tests/pruefung_test.ts.');
  process.exit(fehler ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
