// Smoke-Test: besucht Kern-Routen, sammelt uncaught exceptions + console.error.
// Ausgabe: pro Route OK oder Fehlerliste. Kein Screenshot (Token-Disziplin).
// playwright-core aus dem AUFRUF-Verzeichnis laden (liegt im Session-Scratchpad,
// nicht im Repo) — require() löst sonst vom Skript-Ort auf und findet es nicht.
const path = require('path');
const pw = process.env.PW_MODULE ?? path.join(process.cwd(), 'node_modules', 'playwright-core');
const { chromium } = require(pw);

const ROUTES = [
  ['/landing', 'Landing'],
  ['/', 'Home (Gast-Browse)'],
  ['/onboarding', 'Onboarding'],
  ['/auftrag-aufgeben', 'Auftrag-Wizard'],
  ['/auftrag-aufgeben?track=nachbarschaft', 'Wizard (Nachbarschaft)'],
  ['/suche', 'Suche'],
  ['/login', 'Login'],
  ['/registrierung', 'Registrierung'],
  ['/einstellungen', 'Einstellungen'],
  ['/impressum', 'Impressum'],
  ['/agb', 'AGB'],
  ['/widerruf', 'Widerruf'],
  ['/datenschutz', 'Datenschutz'],
  // Tabs + Gast-Fallbacks
  ['/auftraege', 'Auftraege-Tab (Gast)'],
  ['/nachrichten', 'Nachrichten-Tab (Gast)'],
  ['/konto', 'Konto-Tab (Gast)'],
  ['/nachbarschaft', 'Nachbarschaft'],
  ['/anbieter-warteliste', 'Anbieter-Warteliste'],
  ['/garantie', 'Garantie'],
  ['/support-chat', 'Support-Chat'],
  ['/meine-anbieter', 'Meine Anbieter (Gast)'],
  ['/benachrichtigungen', 'Benachrichtigungen (Gast)'],
  ['/profil', 'Profil (Gast)'],
  ['/zahlungsmethoden', 'Zahlungsmethoden (Gast)'],
  // Detail-Screens OHNE Pflicht-Parameter (Weissbild-Kandidaten)
  ['/chat', 'Chat (ohne jobId)'],
  ['/auftrag-detail', 'Auftrag-Detail (ohne jobId)'],
  ['/vertrag', 'Vertrag (ohne contractId)'],
  ['/angebot', 'Angebot (ohne jobId)'],
];

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => {
    localStorage.setItem('werkr_consent_v1', JSON.stringify({ accepted: true, analytics: false, pstg: true, version: '1.0', timestamp: new Date().toISOString() }));
    localStorage.setItem('werkr_guest_browse', 'true');
  });
  const page = await ctx.newPage();
  let totalErrors = 0;
  for (const [route, name] of ROUTES) {
    const errors = [];
    const onPageError = (e) => errors.push('EXCEPTION: ' + e.message.slice(0, 160));
    const onConsole = (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 160)); };
    page.on('pageerror', onPageError);
    page.on('console', onConsole);
    try {
      await page.goto('http://127.0.0.1:8745' + route, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(1200);
      const bodyText = (await page.textContent('body').catch(() => '')) || '';
      const blank = bodyText.trim().length < 10;
      // Netzwerk-Fehler (Supabase nicht erreichbar aus Sandbox) sind erwartbar — filtern
      const real = errors.filter((e) => !/net::|Failed to fetch|NetworkError|ERR_|fetch failed|AuthRetryable/i.test(e));
      if (real.length === 0 && !blank) {
        console.log('OK   ' + name);
      } else {
        totalErrors += real.length + (blank ? 1 : 0);
        console.log('FAIL ' + name + (blank ? ' [LEERER SCREEN]' : ''));
        real.slice(0, 3).forEach((e) => console.log('     ' + e));
      }
    } catch (e) {
      totalErrors++;
      console.log('FAIL ' + name + ' [LOAD: ' + e.message.slice(0, 80) + ']');
    }
    page.off('pageerror', onPageError);
    page.off('console', onConsole);
  }
  console.log('---');
  console.log(totalErrors === 0 ? 'ALLE ROUTEN SAUBER' : totalErrors + ' echte Fehler gefunden');
  await browser.close();
})();

// Nutzung (Sandbox-Harness, siehe docs/SESSION_HANDOFF.md):
//   1. npx expo export --platform web
//   2. python3 <scratchpad>/spa-server2.py   (serviert dist/ auf :8745)
//   3. cd <verzeichnis mit playwright-core in node_modules> && node <repo>/scripts/smoke.cjs
// Erwartung: "ALLE ROUTEN SAUBER". Netzwerk-Fehler (Supabase offline) werden gefiltert.
