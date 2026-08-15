// Misst, ob auf erreichbaren Screens etwas ueber den rechten Bildschirmrand
// hinauslaeuft.
//
// ANLASS (16.08.2026, Founder-Screenshot): Im Auftrags-Assistenten lief das
// Stadt-Feld rund 100px ueber den Rand hinaus und sah aus wie ein Kaesten ohne
// Ende. Ursache war `min-width: auto` -- ein Flex-Element weigert sich von Haus
// aus, unter seine Inhaltsbreite zu schrumpfen. Beide Eingabefelder meldeten
// 233px Eigenbreite: 233 + 10 Abstand + 233 = 476px in einer 356px breiten
// Zeile.
//
// Warum SYMPTOM statt MUSTER: eine Suche nach `flex: 1` ohne `minWidth: 0`
// liefert in diesem Projekt 101 Treffer, fast alle harmlos -- kurze Labels
// passen ohnehin. Ein Pruefer mit 101 Fehlalarmen wird beim ersten Mal
// abgeschaltet. Gemessen wird deshalb, was der Nutzer tatsaechlich sieht.
//
// GRENZE, ehrlich: das hier ist react-native-web. Ein Layoutfehler, der NUR
// auf Yoga auftritt (etwa langer Text in einer Kachel mit numberOfLines), ist
// von hier aus nicht sichtbar -- siehe CLAUDE.md. Dieser Pruefer faengt die
// Klasse, die beide Seiten teilen, nicht die native Restmenge.
//
// Ausfuehren ueber den Laeufer:  bash scripts/reisen/run.sh
const { chromium } = require('playwright');

const BASIS = process.env.BASIS || 'http://localhost:8744';
const CHROME = process.env.CHROME_PFAD
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

// Schmalste verbreitete Geraetebreiten. 360 ist der enge Fall, an dem
// Layoutfehler zuerst sichtbar werden.
const BREITEN = [390, 375, 360];

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
];

let fehler = 0;

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });

  for (const breite of BREITEN) {
    for (const [route] of SCREENS) {
      const ctx = await b.newContext({ viewport: { width: breite, height: 844 } });
      await ctx.addInitScript(() => localStorage.setItem('werkr_consent_v1', JSON.stringify({
        accepted: true, analytics: false, pstg: true, version: '1.0',
        timestamp: new Date().toISOString(),
      })));
      await ctx.route('**://*.supabase.co/**', (r) => r.abort());
      await ctx.route('**://*.stripe.com/**', (r) => r.abort());
      const p = await ctx.newPage();
      await p.goto(BASIS + route, { waitUntil: 'networkidle' });
      await p.waitForTimeout(1800);

      const raus = await p.evaluate(() => {
        const w = window.innerWidth;
        const treffer = [];

        // Waagerecht scrollbare Leisten ragen ABSICHTLICH ueber den Rand --
        // eine Kategorienleiste zum Wischen ist kein Layoutfehler. Ohne diese
        // Ausnahme meldete der Pruefer die Kategorien auf /suche als Fehler
        // und waere damit sofort unbrauchbar gewesen.
        const inWaagerechterLeiste = (el) => {
          for (let a = el.parentElement; a; a = a.parentElement) {
            const ox = getComputedStyle(a).overflowX;
            if (ox === 'auto' || ox === 'scroll') return true;
          }
          return false;
        };

        document.querySelectorAll('*').forEach((el) => {
          const r = el.getBoundingClientRect();
          // 1px Toleranz gegen Rundung. Nur sichtbare Elemente mit Breite.
          if (r.width > 0 && r.height > 0 && r.right > w + 1) {
            if (inWaagerechterLeiste(el)) return;
            const eigen = (el.textContent || '').trim().slice(0, 30);
            treffer.push({ text: eigen, ueber: Math.round(r.right - w) });
          }
        });
        // Nur den aeussersten Uebeltaeter je Textinhalt melden, sonst listet
        // jeder Elternknoten denselben Fehler noch einmal.
        const gesehen = new Set();
        return treffer.filter((t) => {
          if (gesehen.has(t.text)) return false;
          gesehen.add(t.text); return true;
        }).slice(0, 4);
      });

      if (raus.length) {
        fehler++;
        console.log(`FAIL  ${String(breite).padEnd(4)} ${route}`);
        for (const t of raus) console.log(`        +${t.ueber}px  "${t.text}"`);
      }
      await ctx.close();
    }
  }

  const gesamt = BREITEN.length * SCREENS.length;
  console.log(fehler === 0
    ? `\n=== ${gesamt} Messungen, nichts laeuft ueber den Rand ===`
    : `\n=== ${fehler} von ${gesamt} Messungen mit Ueberstand ===`);
  await b.close();
  process.exit(fehler ? 1 : 0);
})();
