// Prueft, dass ein Gast (ohne Sitzung) auf JEDEM Screen, der Daten aus einer
// Sitzung zieht, einen sichtbaren Weg zur Anmeldung findet.
//
// Anlass (Founder-Report 09.08.2026): "Wenn ich ohne einloggen auf
// Unterstuetzung finden reinklicke, kann ich mich nirgends einloggen, dort ist
// kein Button." Sieben Screens zeigten Gaesten eine Leermeldung, die nach
// "hier ist noch nichts passiert" klang, und boten keinen Anmelde-Weg an.
//
// Ausfuehren:
//   npx expo export --platform web
//   python3 scripts/spa-server.py &        # serviert dist/ auf :8744
//   node scripts/gast-login-check.cjs
//
// Der Server muss nach JEDEM `expo export` neu gestartet werden -- der Export
// legt dist/ neu an, wodurch der laufende Prozess sein Arbeitsverzeichnis
// verliert (aeussert sich als FileNotFoundError in os.getcwd()).
const { chromium } = require('playwright');

const ROUTES = [
  '/profil',
  '/benachrichtigungen',
  '/(tabs)/auftraege',
  '/(tabs)/nachrichten',
  '/einstellungen',
  '/zahlungsmethoden',
  '/meine-anbieter',
];
const BASIS = process.env.BASIS || 'http://localhost:8744';
const CHROME = process.env.CHROME_PFAD
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  let fehler = 0;

  for (const route of ROUTES) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    // Das DSGVO-Sheet ueberlagert sonst jeden Screen.
    await ctx.addInitScript(() => localStorage.setItem('werkr_consent_v1', JSON.stringify({
      accepted: true, analytics: false, pstg: true, version: '1.0',
      timestamp: new Date().toISOString(),
    })));
    const p = await ctx.newPage();
    p.on('pageerror', (e) => { console.log(`   PAGEERROR ${route}: ${String(e).slice(0, 140)}`); fehler++; });

    await p.goto(BASIS + route, { waitUntil: 'networkidle' });
    await p.waitForTimeout(2000);

    // Nicht nur "steht da irgendwo" — der Knopf muss sichtbar sein UND auf
    // /login fuehren. Ein Element im DOM, das niemand sehen kann, ist kein
    // Anmelde-Weg.
    const knopf = p.getByText(/^Einloggen$/).first();
    const sichtbar = await knopf.isVisible().catch(() => false);
    let ziel = '-';
    if (sichtbar) {
      await knopf.click();
      await p.waitForTimeout(2000);
      ziel = p.url().replace(BASIS, '');
    }
    const ok = sichtbar && ziel === '/login';
    if (!ok) fehler++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${route.padEnd(22)} sichtbar=${sichtbar}  -> ${ziel}`);
    await ctx.close();
  }

  console.log(fehler === 0
    ? `\n=== alle ${ROUTES.length} Screens PASS ===`
    : `\n=== ${fehler} FEHLER ===`);
  await b.close();
  process.exit(fehler ? 1 : 0);
})();
