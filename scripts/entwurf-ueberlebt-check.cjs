// Prueft die teuerste Stelle der Kunden-Reise: Ein Gast tippt auf dem
// Datenschritt Titel, Beschreibung, PLZ und Stadt ein und folgt dann dem
// Hinweis der App -- "Tipp: Zuerst kostenlos anmelden, dann geht Ihre Anfrage
// am Ende direkt raus, ohne dass Eingaben verloren gehen."
//
// Befund vom 15.08.2026: der Hinweis loeste `router.push('/login')` ohne
// vorheriges `persistDraft()` aus. Wer ihm folgte, verlor genau das, was der
// Text zu schuetzen versprach -- und zwar die laengste Eingabe der ganzen
// Reise. Beim Einstieg ueber eine Home-Kategorie ist `entryStep = 2`, der
// Hinweis steht also ausgerechnet ueber den Eingabefeldern.
//
// Ausfuehren:
//   npx expo export --platform web
//   python3 scripts/spa-server.py &      # nach JEDEM Export neu starten
//   node scripts/entwurf-ueberlebt-check.cjs
//
// Exit 0 = Entwurf ueberlebt, Exit 1 = Eingaben gehen verloren.
// dass Eingaben verloren gehen"), bleiben seine Eingaben erhalten?
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => localStorage.setItem('werkr_consent_v1', JSON.stringify({accepted:true,analytics:false,pstg:true,version:'1.0',timestamp:new Date().toISOString()})));
  await ctx.route('**://*.supabase.co/**', r => r.abort());   // niemals Produktion
  const p = await ctx.newPage();

  // Einstieg ueber eine Kategorie-Kachel -> entryStep = 2 (der Datenschritt)
  await p.goto('http://localhost:8744/auftrag-aufgeben?category=heizung-sanitaer', { waitUntil:'networkidle' });
  await p.waitForTimeout(2500);

  const felder = await p.locator('input, textarea').all();
  console.log('Eingabefelder auf dem Schritt:', felder.length);
  const text = 'Der Heizkoerper im Wohnzimmer wird seit zwei Wochen nicht mehr warm, obwohl das Ventil ganz offen steht. Entlueftet habe ich schon zweimal, es kommt nur Wasser, keine Luft. Die anderen Raeume sind normal warm.';
  if (felder.length >= 1) await felder[0].fill('Heizkoerper wird nicht warm');
  if (felder.length >= 2) await felder[1].fill(text);
  if (felder.length >= 3) await felder[2].fill('50667');
  if (felder.length >= 4) await felder[3].fill('Koeln');
  await p.waitForTimeout(400);

  const tipp = p.getByText(/Tipp: Zuerst kostenlos anmelden/).first();
  console.log('Tipp sichtbar:', await tipp.isVisible().catch(()=>false));
  await tipp.click();
  await p.waitForTimeout(2500);

  const draft = await p.evaluate(() => localStorage.getItem('werkr_job_draft_v1'));
  console.log('Ziel nach Klick     :', p.url().replace('http://localhost:8744',''));
  console.log('Entwurf gespeichert :', draft ? 'JA' : '>>> NEIN — Eingaben weg <<<');
  if (draft) {
    const d = JSON.parse(draft);
    console.log('  Titel        :', d.jobTitle);
    console.log('  Beschreibung :', (d.description||'').length, 'Zeichen');
    console.log('  PLZ / Stadt  :', d.plz, '/', d.city);
  }
  await b.close();
  process.exit(draft ? 0 : 1);
})();
