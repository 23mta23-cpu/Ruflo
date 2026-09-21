// Misst den echten Kontrast jedes sichtbaren Textes gegen seinen echten Grund.
//
// ANLASS (Founder, 20.09.2026: „/apple-hig"). Apple verlangt in den Human
// Interface Guidelines mindestens 4,5:1 fuer gewoehnlichen Text und 3:1 fuer
// grossen; dieselben Zahlen stehen in WCAG 2.1 AA (1.4.3) und damit im BFSG-
// Umfeld.
//
// In `constants/colors.ts` steht dazu eine BEHAUPTUNG in einem Kommentar
// („WCAG AA 4.5:1+ on bg/surface"). Nachgerechnet stimmt sie -- fuer genau
// diese zwei Gruende. Auf den getoenten Flaechen (goldBg, clayBg, redBg,
// primaryBg) faellt dasselbe Grau unter 4,5, und `amber` faellt ueberall
// darunter. Eine Tabelle sagt aber nicht, ob diese Paare auch wirklich
// aufeinandertreffen.
//
// Deshalb wird das SYMPTOM gemessen: jeder Textknoten, seine tatsaechliche
// Farbe, sein tatsaechlicher Hintergrund (den naechsten undurchsichtigen
// Vorfahren hoch), seine tatsaechliche Groesse. Dieselbe Ueberlegung wie bei
// rand-ueberstand-check.cjs, aus demselben Grund.
//
// GRENZEN, ausdruecklich:
//   * Halbtransparente Flaechen werden ueber den Vorfahren aufgeloest, nicht
//     zusammengerechnet. Text auf einem Bild oder Verlauf wird UEBERGANGEN und
//     gezaehlt, nicht geraten.
//   * react-native-web, nicht Yoga.
//   * Gemessen wird der ausgelieferte Zustand, nicht jede Datenlage.
//
// Ausfuehren ueber den Laeufer:  bash scripts/reisen/run.sh
//   Nur messen:                  MESSEN=1 node scripts/kontrast-check.cjs
const { chromium } = require('playwright');
const { alsAnbieter } = require('./lib/anbieter-sitzung.cjs');
const { oeffneFolge } = require('./lib/blatt-oeffnen.cjs');

const BASIS = process.env.BASIS || 'http://localhost:8744';
const CHROME = process.env.CHROME_PFAD
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const BREITE = 390;

const SCREENS = [
  ['/landing', null], ['/onboarding', null],
  ['/auftrag-aufgeben?category=elektro', null],
  ['/registrierung?role=anbieter', null],
  ['/onboarding-kyc?track=handwerker', null],
  ['/onboarding-kyc?track=nachbarschaft', null],
  ['/login', null], ['/suche', null], ['/einstellungen', null],
  ['/betrieb/dashboard', 'anbieter'], ['/betrieb/auftraege', 'anbieter'],
  ['/betrieb/kalender', 'anbieter'], ['/betrieb/profil', 'anbieter'],
  ['/betrieb/profil-bearbeiten', 'anbieter'], ['/betrieb/statistik', 'anbieter'],
  ['/anbieter?id=00000000-0000-4000-8000-000000000001', 'anbieter'],

  // Blaetter und Schieber: das dritte Feld wird nach dem Laden angetippt
  // (scripts/lib/blatt-oeffnen.cjs). Ohne das misst der Pruefer den
  // Bildschirm DAHINTER und meldet ihn gruen.
  ['/suche', null, ['@Filter öffnen']],
  ['/betrieb/auftraege', 'anbieter', ['Aktiv', 'Fertig']],
  ['/betrieb/profil', 'anbieter', ['Name / Firmenname']],
];

// Eigener Lauf ohne `werkr_consent_v1`: das Einwilligungs-Blatt ist der erste
// Bildschirm, den ueberhaupt jemand sieht, und war bis zum 21.09.2026 nie auf
// Kontrast vermessen.
const EINWILLIGUNG = '/landing';

let gemessen = 0, uebergangen = 0;
const befunde = new Map();

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  for (const [route, modus, oeffnen] of [...SCREENS, [EINWILLIGUNG, 'einwilligung', null]]) {
    const ctx = await b.newContext({ viewport: { width: BREITE, height: 844 } });
    if (modus === 'anbieter') {
      await alsAnbieter(ctx);
    } else if (modus === 'einwilligung') {
      await ctx.route('**://*.supabase.co/**', (r) => r.abort());
      await ctx.route('**://*.stripe.com/**', (r) => r.abort());
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

    if (oeffnen) {
      for (const f of await oeffneFolge(p, oeffnen)) {
        befunde.set(`${route} [${oeffnen.join(' > ')}]  ${f}`,
          { route, text: f, blatt: true });
      }
    }

    const erg = await p.evaluate(() => {
      const zahl = (s) => (s.match(/[\d.]+/g) || []).map(Number);
      const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
      const leucht = ([r, g, bl]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(bl);
      const kontrast = (a, b) => {
        const [x, y] = [leucht(a), leucht(b)].sort((m, n) => n - m);
        return (x + 0.05) / (y + 0.05);
      };
      // Der naechste Vorfahr mit undurchsichtigem Hintergrund. Findet sich
      // keiner, ist es der Seitengrund. Bild oder Verlauf: aufgeben statt raten.
      const grundVon = (el) => {
        for (let n = el; n; n = n.parentElement) {
          const s = getComputedStyle(n);
          if (s.backgroundImage && s.backgroundImage !== 'none') return null;
          const f = zahl(s.backgroundColor);
          if (f.length >= 3 && (f.length < 4 || f[3] === 1)) return f.slice(0, 3);
        }
        return [255, 255, 255];
      };
      const treffer = []; let z = 0, weg = 0;
      for (const el of document.querySelectorAll('*')) {
        const eigen = Array.from(el.childNodes)
          .filter((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
        if (eigen.length === 0) continue;
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        if (r.width === 0 || r.height === 0 || s.display === 'none' || s.visibility === 'hidden') { weg++; continue; }
        if (Number(s.opacity) < 0.95) { weg++; continue; }
        const vorne = zahl(s.color);
        if (vorne.length >= 4 && vorne[3] < 1) { weg++; continue; }
        const grund = grundVon(el);
        if (!grund) { weg++; continue; }
        z++;
        const px = parseFloat(s.fontSize);
        const fett = Number(s.fontWeight) >= 700;
        // WCAG „gross": ab 24px, oder ab 18.66px wenn fett.
        const grenze = (px >= 24 || (px >= 18.66 && fett)) ? 3.0 : 4.5;
        const k = kontrast(vorne.slice(0, 3), grund);
        if (k + 0.005 < grenze) {
          treffer.push({
            text: eigen.map((n) => n.textContent.trim()).join(' ').slice(0, 44),
            k: Math.round(k * 100) / 100, grenze, px: Math.round(px), fett,
            farbe: s.color, grund: `rgb(${grund.join(', ')})`,
          });
        }
      }
      return { treffer, z, weg };
    });

    gemessen += erg.z; uebergangen += erg.weg;
    for (const t of erg.treffer) {
      // Nach Farbpaar zusammenfassen: dieselbe Kachel auf zehn Bildschirmen
      // ist EIN Befund, nicht zehn. Ein Pruefer, der eine Seite Ausgabe fuer
      // eine Ursache druckt, wird nicht gelesen.
      const schluessel = `${t.farbe} auf ${t.grund} @${t.px}px${t.fett ? ' fett' : ''}`;
      if (!befunde.has(schluessel)) befunde.set(schluessel, { ...t, wo: [], zahl: 0 });
      const e = befunde.get(schluessel);
      e.zahl++;
      if (e.wo.length < 3) e.wo.push(`${route}: „${t.text}"`);
    }
    await ctx.close();
  }
  await b.close();

  console.log(`\n${gemessen} Textstellen gemessen, ${uebergangen} übergangen (unsichtbar, transparent, Bild/Verlauf).`);
  // 21.09.2026 GEMESSEN: 650 (vorher 400 als Untergrenze). Die Blaetter und
  // das Einwilligungs-Blatt bringen gut zweihundert Textstellen dazu.
  const MINDESTENS = Number(process.env.MINDESTENS || 580);
  let fehler = 0;
  if (gemessen < MINDESTENS) {
    console.log(`FAIL  nur ${gemessen} gemessen, erwartet mindestens ${MINDESTENS} -- misst der Prüfer noch?`);
    fehler++;
  }
  for (const [k, e] of [...befunde.entries()].sort((a, b) => a[1].k - b[1].k)) {
    // Ein Blatt, das sich nicht oeffnen liess, ist kein Farbbefund -- aber
    // ein Fehler: dahinter bleibt ein ganzer Bildschirm ungemessen.
    if (e.blatt) { console.log(`FAIL  ${k}`); fehler++; continue; }
    console.log(`FAIL  ${e.k}:1 statt ${e.grenze}:1 -- ${k}  (${e.zahl}x)`);
    for (const w of e.wo) console.log(`        ${w}`);
    fehler++;
  }
  if (process.env.MESSEN) { console.log(`\n(nur gemessen: ${befunde.size} Farbpaare unter der Grenze)`); process.exit(0); }
  if (fehler === 0) console.log('PASS  jeder sichtbare Text erreicht seinen Kontrast (Apple HIG, WCAG 1.4.3)');
  process.exit(fehler ? 1 : 0);
})();
