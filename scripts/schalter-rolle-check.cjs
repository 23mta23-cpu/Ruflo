// Ein selbst gebauter Schalter muss sich auch wie einer melden.
//
// ANLASS (21.09.2026): Zwei Schalter in der App sind aus Views gebaut statt
// aus dem <Switch> von React Native: die Analyse-Einwilligung im
// Einwilligungs-Blatt und „Nur sofort buchbare Anbieter" im Filter-Schieber.
// Beide trugen `accessibilityRole="button"`. Eine Bedienungshilfe hoert dann
// „Knopf" und erfaehrt NIE, ob der Schalter an oder aus ist -- bei der
// Analyse-Einwilligung ist das eine datenschutzrechtliche Angabe.
//
// WARUM IM BROWSER UND NICHT IM QUELLTEXT: `accessibilityState={{ checked }}`
// laesst sich hinschreiben, ohne dass es wirkt (falsche Variable, Zustand
// nicht verdrahtet). Ein Quelltext-Pruefer saehe die Zeile und waere
// zufrieden. Hier wird GEDRUECKT und nachgesehen, ob `aria-checked` kippt.
//
// GRENZE: geprueft werden die zwei bekannten Stellen. Ein dritter selbst
// gebauter Schalter faellt hier nicht auf; dafuer waere ein Quelltext-Pruefer
// noetig, der Views mit `translateX` als Schalter erkennt.
const { chromium } = require('playwright');
const { oeffneFolge } = require('./lib/blatt-oeffnen.cjs');

const BASIS = process.env.BASIS || 'http://localhost:8744';
const CHROME = process.env.CHROME_PFAD
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const MINDEST = 44;

let fehler = 0;
function pruefe(name, ok, detail = '') {
  if (!ok) fehler++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`);
}

const STELLEN = [
  {
    name: 'Analyse-Einwilligung (Einwilligungs-Blatt)',
    weg: '/landing',
    einwilligungWegraeumen: false,
    oeffnen: null,
    pflichtwort: 'Pflicht',
  },
  {
    name: 'Nur sofort buchbare Anbieter (Filter-Schieber)',
    weg: '/suche',
    einwilligungWegraeumen: true,
    oeffnen: ['@Filter öffnen'],
  },
];

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  for (const stelle of STELLEN) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    if (stelle.einwilligungWegraeumen) {
      await ctx.addInitScript(() => localStorage.setItem('werkr_consent_v1', JSON.stringify({
        accepted: true, analytics: false, pstg: true, version: '1.0',
        timestamp: new Date().toISOString(),
      })));
    }
    await ctx.route('**://*.supabase.co/**', (r) => r.abort());
    await ctx.route('**://*.stripe.com/**', (r) => r.abort());
    const p = await ctx.newPage();
    await p.goto(BASIS + stelle.weg, { waitUntil: 'networkidle' });
    await p.waitForTimeout(1800);
    if (stelle.oeffnen) {
      for (const f of await oeffneFolge(p, stelle.oeffnen)) pruefe(`${stelle.name}: aufmachen`, false, f);
    }

    // Eine Zeile ohne Schalter muss in WORTEN sagen, warum.
    //
    // ANLASS (22.09.2026): In der Pflicht-Zeile des Einwilligungs-Blatts
    // stand genau dort, wo die andere Zeile ihren Schalter hat, ein gruener
    // Haken. Er las sich als „eingeschaltet" statt als „nicht abwaehlbar"
    // und trug keinen Namen. Die Aussage steht links als Wort („Pflicht") --
    // das Zeichen sagte nichts Neues und sah aus wie ein Bedienelement.
    if (stelle.pflichtwort) {
      // GENAUER Text, kein Teilstring: „Pflicht" steckt auf demselben Blatt
      // auch in „meisterpflichtigen", „Pflichtdaten" und „Meldepflicht".
      // Die erste Fassung blieb deshalb gruen, als das Abzeichen entfernt
      // wurde -- eine Pruefung, die ihren eigenen Fehler nicht sieht.
      const anzahl = await p.locator(`text="${stelle.pflichtwort}"`).count();
      pruefe(`${stelle.name}: die nicht abwaehlbare Zeile sagt es in Worten`,
        anzahl > 0,
        anzahl > 0 ? '' : `kein eigenstaendiges „${stelle.pflichtwort}" auf dem Blatt`);
    }

    const schalter = p.locator('[role="switch"]:visible').first();
    const da = await schalter.count() > 0;
    pruefe(`${stelle.name}: meldet sich als Schalter`, da,
      da ? '' : 'kein [role="switch"] sichtbar -- meldet sich die Bedienungshilfe als „Knopf"?');
    if (!da) { await ctx.close(); continue; }

    const vorher = await schalter.getAttribute('aria-checked');
    pruefe(`${stelle.name}: nennt seinen Zustand`, vorher === 'true' || vorher === 'false',
      `aria-checked=${vorher}`);

    const kasten = await schalter.boundingBox();
    pruefe(`${stelle.name}: Beruehrflaeche ${MINDEST}x${MINDEST}`,
      !!kasten && kasten.width >= MINDEST && kasten.height >= MINDEST,
      kasten ? `${Math.round(kasten.width)}x${Math.round(kasten.height)}` : 'nicht messbar');

    // Der eigentliche Punkt: die Angabe muss MITGEHEN. Ein fest
    // hingeschriebenes `checked` waere sonst genauso gruen.
    await schalter.click();
    await p.waitForTimeout(400);
    const nachher = await p.locator('[role="switch"]:visible').first().getAttribute('aria-checked');
    pruefe(`${stelle.name}: der Zustand geht beim Druecken mit`, vorher !== nachher,
      `${vorher} -> ${nachher}`);

    await ctx.close();
  }
  await b.close();
  if (fehler === 0) console.log('\nPASS  jeder selbst gebaute Schalter meldet Rolle und Zustand.');
  process.exit(fehler ? 1 : 0);
})();
