// Eingeloggter E2E-Lauf gegen PRODUKTION (Test-User, nur Lese-/Gate-Pfade).
const path = require('path');
const { chromium } = require(path.join(process.cwd(), 'node_modules', 'playwright-core'));
const BASE = 'http://127.0.0.1:8745';
(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
    proxy: { server: process.env.HTTPS_PROXY || process.env.https_proxy, bypass: '127.0.0.1,localhost' },
  });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true });
  await ctx.addInitScript(() => {
    localStorage.setItem('werkr_consent_v1', JSON.stringify({ accepted: true, analytics: false, pstg: true, version: '1.0', timestamp: new Date().toISOString() }));
    localStorage.setItem('werkr_guest_browse', 'true');
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('JS: ' + String(e).slice(0, 100)));
  const step = async (name, fn) => {
    try { await fn(); console.log('OK  ', name); }
    catch (e) { console.log('FAIL', name, '—', String(e).slice(0, 140)); }
  };

  await step('Login-Seite laden', async () => {
    await page.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('input[placeholder="name@beispiel.de"]', { timeout: 10000 });
  });
  await step('Login mit Test-User', async () => {
    await page.fill('input[placeholder="name@beispiel.de"]', 'b1debug1907@example.com');
    await page.fill('input[placeholder*="asswort"]', 'testpasswort1');
    await page.getByText('Einloggen', { exact: true }).click();
    await page.waitForTimeout(4000);
    const url = page.url();
    if (url.includes('/login')) throw new Error('noch auf /login: ' + url);
  });
  await step('Home zeigt Segment-Umschalter + keine Fehler', async () => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2500);
    await page.getByText('Nachbarschaftshilfe').first().waitFor({ timeout: 8000 });
  });
  await step('Aufträge-Tab lädt OHNE Fehler-Screen (Ex-PGRST200)', async () => {
    await page.goto(BASE + '/auftraege', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3500);
    const bad = await page.getByText('konnten nicht geladen werden').count();
    if (bad > 0) throw new Error('Fehler-Screen sichtbar!');
    await page.screenshot({ path: 'e2e-auftraege.png' });
  });
  await step('Nachrichten-Tab lädt ohne Fehler-Screen', async () => {
    await page.goto(BASE + '/nachrichten', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2500);
    const bad = await page.getByText('konnten nicht geladen werden').count();
    if (bad > 0) throw new Error('Fehler-Screen sichtbar!');
  });
  await step('Wizard: E-Mail-Gate greift korrekt', async () => {
    await page.goto(BASE + '/auftrag-aufgeben?category=elektro', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.fill('input[placeholder*="z. B."]', 'E2E Testauftrag bitte ignorieren').catch(() => {});
    const inputs = await page.$$('textarea, input');
    for (const el of inputs) {
      const ph = (await el.getAttribute('placeholder')) || '';
      if (/Beschreiben Sie/.test(ph)) await el.fill('Dies ist ein automatischer E2E-Testlauf, bitte ignorieren. Mindestens dreissig Zeichen lang.');
      if (/12345/.test(ph)) await el.fill('51373');
      if (/erlin/.test(ph)) await el.fill('Leverkusen');
    }
    await page.getByText('Weiter', { exact: true }).click();
    await page.waitForTimeout(600);
    await page.getByText('Diese Woche', { exact: true }).first().click().catch(() => {});
    await page.waitForTimeout(400);
    await page.getByText('Weiter', { exact: true }).click().catch(() => {});
    await page.waitForTimeout(600);
    // Schritt 4: Consent + Abschicken
    const boxes = await page.$$('[role="checkbox"]');
    for (const el of boxes) await el.click().catch(() => {});
    await page.getByText('Auftrag abschicken').click().catch(() => {});
    await page.waitForTimeout(2500);
    const gate = await page.getByText(/bestätig/i).count();
    const success = await page.getByText('Auftrag eingereicht').count();
    if (success > 0) throw new Error('Auftrag wurde OHNE E-Mail-Bestätigung angelegt — Gate-Lücke!');
    if (gate === 0) console.log('  (Hinweis: weder Gate-Meldung noch Erfolg sichtbar — Schrittfolge prüfen)');
  });
  await step('Einstellungen: Konto-löschen-Dialog öffnet (ohne Bestätigung!)', async () => {
    await page.goto(BASE + '/einstellungen', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.getByText('Konto löschen').click();
    await page.waitForTimeout(800);
    const dlg = await page.getByText('Art. 17 DSGVO').count();
    if (dlg === 0) throw new Error('Dialog nicht sichtbar');
    await page.getByText('Abbrechen').click();
  });
  console.log(errs.length ? 'JS-FEHLER: ' + errs.join(' | ') : 'KEINE JS-FEHLER');
  await b.close();
})();
