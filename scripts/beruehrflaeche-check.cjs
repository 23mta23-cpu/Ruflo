// Misst, ob jede Berührfläche gross genug ist, um sie mit dem Finger zu treffen.
//
// ANLASS (Founder, 20.09.2026: „/apple-hig"). Die Apple Human Interface
// Guidelines nennen fuer iOS eine Untergrenze von 44x44 pt fuer jedes
// bedienbare Element. Dieselbe Zahl steht in WCAG 2.5.5 (AAA); WCAG 2.5.8 (AA,
// seit 2.2) verlangt mindestens 24x24. Fuer den App Store ist die 44 der
// Massstab, an dem eine Pruefung haengen kann, und fuer die Barrierefreiheit
// ist sie der Unterschied zwischen bedienbar und nicht bedienbar.
//
// GEMESSEN WIRD DAS SYMPTOM, nicht das Muster. Eine Suche nach `padding` oder
// `height` im Quelltext sagt nichts: die tatsaechliche Groesse entsteht aus
// Inhalt, Zeilenumbruch, Flex-Regeln und Bildschirmbreite. Dieselbe
// Ueberlegung wie bei rand-ueberstand-check.cjs, aus demselben Grund.
//
// GRENZEN, ausdruecklich:
//   * react-native-web, nicht Yoga. Ein Element, das nur auf dem Geraet
//     schrumpft, faellt hier nicht auf.
//   * Gemessen wird das Element mit `role="button"`. Traegt ein Knopf keine
//     Rolle, sieht ihn weder dieser Pruefer noch eine Bedienungshilfe --
//     dafuer gibt es scripts/knopf-rolle-check.py.
//   * `pointer-events: none` und aufeinanderliegende Flaechen werden nicht
//     aufgeloest. Zwei Knoepfe uebereinander meldet er als zwei.
//
// Ausfuehren ueber den Laeufer:  bash scripts/reisen/run.sh
//   Nur messen, ohne Urteil:     MESSEN=1 node scripts/beruehrflaeche-check.cjs
const { chromium } = require('playwright');
const { alsAnbieter } = require('./lib/anbieter-sitzung.cjs');

const BASIS = process.env.BASIS || 'http://localhost:8744';
const CHROME = process.env.CHROME_PFAD
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

/** Apple HIG: 44x44 pt. Auf react-native-web ist 1 pt = 1 CSS-Pixel. */
const MINDEST = 44;

/** Die schmalste verbreitete Breite. Dort wird es zuerst eng. */
const BREITE = 390;

const SCREENS = [
  ['/landing', null],
  ['/onboarding', null],
  ['/auftrag-aufgeben?category=elektro', null],
  ['/registrierung?role=anbieter', null],
  ['/onboarding-kyc?track=handwerker', null],
  ['/onboarding-kyc?track=nachbarschaft', null],
  ['/login', null],
  ['/suche', null],
  ['/einstellungen', null],
  ['/betrieb/dashboard', 'anbieter'],
  ['/betrieb/auftraege', 'anbieter'],
  ['/betrieb/kalender', 'anbieter'],
  ['/betrieb/profil', 'anbieter'],
  ['/betrieb/profil-bearbeiten', 'anbieter'],
  ['/betrieb/nachrichten', 'anbieter'],
  ['/betrieb/statistik', 'anbieter'],
  ['/anbieter?id=00000000-0000-4000-8000-000000000001', 'anbieter'],
];

// Bekannte, begruendete Ausnahmen. Jede steht fuer eine Entscheidung, nicht
// fuer Bequemlichkeit -- und jede nennt ihren Grund, damit sie jemand wieder
// streichen kann.
const AUSNAHMEN = [
  {
    // Ein Wort mitten in einem Satz („Datenschutzerklärung" in der
    // Einwilligung). HIG meint bedienbare STEUERELEMENTE; ein Textlink im
    // Fliesstext auf 44 pt aufzublasen zerreisst den Absatz. WCAG 2.5.8
    // nimmt „inline" ausdruecklich aus.
    pruefe: (e) => e.imFliesstext,
    grund: 'Textlink im Fliesstext (WCAG 2.5.8 Ausnahme „inline")',
  },
  {
    // Der Schalter von React Native. react-native-web rendert ihn als
    // `<input type="checkbox" role="switch">` mit 40x20 -- auf dem GERAET ist
    // es der System-Schalter von iOS (51x31 pt) samt der Beruehrflaeche, die
    // Apple selbst dafuer vorsieht. Ihn hier zu melden waere ein Fehlalarm
    // ueber das echte Produkt, und ein Pruefer mit Fehlalarmen wird
    // abgeschaltet und nie wieder an.
    //
    // GRENZE: das gilt NUR fuer den eingebauten Schalter. Ein selbst gebauter
    // aus Views ist kein `<input>` und wird weiterhin gemessen.
    pruefe: (e) => e.eingebautesFeld,
    grund: 'System-Schalter von React Native (auf dem Gerät 51x31 pt)',
  },
];

let fehler = 0;
let gemessen = 0;
let uebergangen = 0;
const befunde = [];

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });

  for (const [route, modus] of SCREENS) {
    const ctx = await b.newContext({ viewport: { width: BREITE, height: 844 } });
    if (modus === 'anbieter') {
      await alsAnbieter(ctx);
    } else {
      await ctx.addInitScript(() => localStorage.setItem('werkr_consent_v1', JSON.stringify({
        accepted: true, analytics: false, pstg: true, version: '1.0',
        timestamp: new Date().toISOString(),
      })));
      await ctx.route('**://*.supabase.co/**', (r) => r.abort());
      await ctx.route('**://*.stripe.com/**', (r) => r.abort());
    }
    const p = await ctx.newPage();
    await p.goto(BASIS + route, { waitUntil: 'networkidle' });
    await p.waitForTimeout(modus === 'anbieter' ? 3000 : 1800);

    const ergebnis = await p.evaluate((min) => {
      const treffer = [];
      let zaehler = 0;
      let weg = 0;
      // Ueber den INDEX greifen, nie ueber die Beschriftung: mehrzeilige
      // Namen („Mo\n14") trafen am 16.09. keinen Regex, und der Erkundungslauf
      // verwarf dabei still zwei Drittel aller Knoepfe.
      const knoepfe = Array.from(document.querySelectorAll('[role="button"], [role="tab"], [role="checkbox"], [role="switch"]'));
      for (const el of knoepfe) {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        // Unsichtbar heisst nicht bedienbar. expo-router laesst inaktive
        // Bildschirme im DOM stehen.
        if (r.width === 0 || r.height === 0 || s.display === 'none'
            || s.visibility === 'hidden' || s.pointerEvents === 'none') { weg++; continue; }
        if (r.bottom < 0 || r.top > window.innerHeight * 6) { weg++; continue; }
        zaehler++;
        if (r.width >= min && r.height >= min) continue;
        // Steht der Knopf mitten in einem Textabsatz? Dann ist er ein
        // Fliesstext-Link und keine Schaltflaeche.
        const eltern = el.parentElement;
        const imFliesstext = !!eltern && (eltern.childNodes.length > 1)
          && Array.from(eltern.childNodes).some(
            (n) => n.nodeType === 3 && n.textContent.trim().length > 0);
        treffer.push({
          text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 40).replace(/\n/g, ' '),
          b: Math.round(r.width), h: Math.round(r.height), imFliesstext,
          eingebautesFeld: el.tagName === 'INPUT',
        });
      }
      return { treffer, zaehler, weg };
    }, MINDEST);

    gemessen += ergebnis.zaehler;
    uebergangen += ergebnis.weg;

    for (const t of ergebnis.treffer) {
      const ausnahme = AUSNAHMEN.find((a) => a.pruefe(t));
      if (ausnahme) {
        console.log(`      ${route}  „${t.text}"  ${t.b}x${t.h}  -- ausgenommen: ${ausnahme.grund}`);
        continue;
      }
      befunde.push({ route, ...t });
    }
    await ctx.close();
  }

  await b.close();

  // Eine leere Auswahl waere still gruen. Die Untergrenze ist GEMESSEN, nicht
  // geschaetzt -- eine geratene Zahl baut sich einen Fehlalarm ein (16.09.).
  const MINDESTENS = Number(process.env.MINDESTENS || 150);
  console.log(`\n${gemessen} Berührflächen gemessen, ${uebergangen} übergangen (unsichtbar).`);
  if (gemessen < MINDESTENS) {
    console.log(`FAIL  nur ${gemessen} gemessen, erwartet mindestens ${MINDESTENS} -- misst der Prüfer noch?`);
    fehler++;
  }

  for (const f of befunde) {
    console.log(`FAIL  ${f.route}  „${f.text}"  ${f.b}x${f.h} (unter ${MINDEST}x${MINDEST})`);
    fehler++;
  }

  if (process.env.MESSEN) {
    console.log(`\n(nur gemessen: ${befunde.length} unter ${MINDEST})`);
    process.exit(0);
  }
  if (fehler === 0) console.log(`PASS  jede Berührfläche ist mindestens ${MINDEST}x${MINDEST} (Apple HIG, WCAG 2.5.5)`);
  process.exit(fehler ? 1 : 0);
})();
