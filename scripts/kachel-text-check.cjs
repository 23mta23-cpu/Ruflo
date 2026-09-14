/**
 * Prueft, ob eine Beschriftung INNERHALB ihrer Kachel abgeschnitten wird.
 *
 * ANLASS (14.09.2026): Die neue Handlungsreihe im Anbieter-Profil bekam vier
 * gleich breite Kacheln. `rand-ueberstand-check.cjs` meldete "54 Messungen,
 * nichts laeuft ueber den Rand" — und "Bewertungen" war bei 375 px und bei
 * 360 px trotzdem abgeschnitten: 73 px Text in einer 69- bzw. 66-px-Kachel.
 *
 * Der Grund fuer die Blindheit: `numberOfLines={1}` kuerzt INNERHALB des
 * Kastens. Es laeuft nichts ueber den Rand, also sieht ein Rand-Pruefer nichts.
 * Dieselbe Klasse wie am 07.09. bei der Reiter-Leiste, nur eine Ebene tiefer.
 *
 * Gemessen wird deshalb das Symptom: `scrollWidth > clientWidth` heisst, der
 * Text passt nicht und wird gekuerzt.
 *
 * GRENZE, ausdruecklich: geprueft werden die NAMENTLICH genannten
 * Beschriftungen unten. Eine neue Kachel mit einem langen Wort faellt hier
 * NICHT auf, solange niemand sie eintraegt. Deshalb wird die erwartete ANZAHL
 * mitgeprueft — eine umbenannte oder zusaetzliche Kachel macht den Lauf rot,
 * statt ihn still durchzuwinken.
 *
 * Voraussetzung: `npx expo export --platform web` und `scripts/spa-server.py`.
 */
const { chromium } = require('playwright');
const { alsAnbieter } = require('./lib/anbieter-sitzung.cjs');

const CHROME = process.env.CHROME_PFAD
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

const BASIS = process.env.BASIS || 'http://127.0.0.1:8744';
const BREITEN = [390, 375, 360];

/** Bildschirm, erwartete Beschriftungen. */
const FAELLE = [
  {
    name: 'Anbieter-Profil, Handlungsreihe',
    pfad: '/anbieter?id=00000000-0000-4000-8000-000000000001',
    labels: ['Merken', 'Gemerkt', 'Teilen', 'Bewertungen', 'Melden'],
    erwartet: 4,
  },
];

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  let schlecht = 0;
  let messungen = 0;

  for (const fall of FAELLE) {
    for (const breite of BREITEN) {
      const ctx = await browser.newContext({ viewport: { width: breite, height: 800 } });
      await alsAnbieter(ctx);
      const page = await ctx.newPage();
      await page.goto(BASIS + fall.pfad, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3500);

      const funde = await page.evaluate((labels) => {
        const raus = [];
        for (const el of document.querySelectorAll('div,span')) {
          const t = (el.textContent || '').trim();
          if (!labels.includes(t) || el.children.length) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0) continue;
          raus.push({ t, kachel: Math.round(r.width), text: el.scrollWidth,
                      gekuerzt: el.scrollWidth > Math.ceil(r.width) + 1 });
        }
        return raus;
      }, fall.labels);

      const gesehen = new Map();
      for (const f of funde) if (!gesehen.has(f.t)) gesehen.set(f.t, f);

      if (gesehen.size !== fall.erwartet) {
        console.log(`FAIL ${breite}px  ${fall.name}: ${gesehen.size} Kacheln gefunden, `
                    + `${fall.erwartet} erwartet. Umbenannt, entfernt oder nicht gerendert?`);
        schlecht++;
      }
      for (const f of gesehen.values()) {
        messungen++;
        if (f.gekuerzt) {
          schlecht++;
          console.log(`FAIL ${breite}px  „${f.t}" abgeschnitten: Text ${f.text}px `
                      + `in ${f.kachel}px Kachel`);
        }
      }
      await ctx.close();
    }
  }

  await browser.close();
  if (schlecht) {
    console.log(`\n${schlecht} Befund(e).`);
    process.exit(1);
  }
  console.log(`\n=== ${messungen} Beschriftungen, keine abgeschnitten ===`);
})();
