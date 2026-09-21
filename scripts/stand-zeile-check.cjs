// Steht auf dem Bildschirm, WELCHEN Stand die App zeigt?
//
// ANLASS (21.09.2026): Der Founder prueft am Geraet die Live-Seite. Ein
// Bildschirmfoto muss sagen koennen, aus welchem Stand es stammt -- sonst
// sucht man einen Fehler in einer Fassung, in der er schon behoben ist.
//
// ARBEITSTEILUNG:
//   scripts/stand-kennung-check.py  prueft die VERDRAHTUNG im Quelltext
//                                   (Fassung und EXPO_PUBLIC_BUILD).
//   dieser Pruefer                  prueft, was am Ende DASTEHT.
//
// Warum beides: ein Quelltext-Pruefer sieht `standZeile(a, b)` und ist
// zufrieden, auch wenn `undefined` gerendert wird oder die Zeile in einem
// Zweig gar nicht erscheint. Dieselbe Trennung wie bei Knoepfen: Auszeichnung
// UND Wirkung.
//
// GEMESSEN am 21.09.2026: `npx expo export` reicht EXPO_PUBLIC_BUILD in das
// Web-Bundle durch (ein Treffer im ausgelieferten JS). Der Export in
// scripts/reisen/run.sh setzt die Variable NICHT -- dort steht deshalb
// „Entwicklungsstand", und genau das ist ein gueltiger Zustand. Was dieser
// Pruefer faengt: eine fehlende Zeile, ein `undefined`, und den Rueckfall
// auf die frueher fest eingetippte Fassung.
const { chromium } = require('playwright');
const { alsAnbieter } = require('./lib/anbieter-sitzung.cjs');

const BASIS = process.env.BASIS || 'http://localhost:8744';
const CHROME = process.env.CHROME_PFAD
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

let fehler = 0;
function pruefe(name, bedingung, detail = '') {
  const ok = !!bedingung;
  if (!ok) fehler++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  // GEMESSEN: ohne Sitzung ersetzt GastLoginHinweis den ganzen Bildschirm,
  // Fusszeile eingeschlossen. Ein Pruefer ohne Sitzungs-Ersatz misst hier
  // die Anmeldeaufforderung und meldet die Zeile als fehlend.
  await alsAnbieter(ctx);

  const p = await ctx.newPage();
  await p.goto(`${BASIS}/einstellungen`, { waitUntil: 'load', timeout: 30000 });
  await p.waitForTimeout(3500);
  // Die Fusszeile steht ganz unten.
  await p.evaluate(() => {
    for (const e of document.querySelectorAll('*')) {
      if (e.scrollHeight > e.clientHeight + 8) e.scrollTop = e.scrollHeight;
    }
  });
  await p.waitForTimeout(400);

  const text = await p.locator('body').innerText();
  const zeile = text.split('\n').map((z) => z.trim())
    .find((z) => /^Werkant\b/.test(z) && z.includes('·'));

  pruefe('S1 Die Fusszeile nennt die App und einen Stand',
    !!zeile, zeile || 'keine Zeile, die mit „Werkant" beginnt');

  pruefe('S2 Der Stand ist benannt, nicht leer und nicht „undefined"',
    !!zeile && /· (Stand .+|Entwicklungsstand)$/.test(zeile)
      && !/undefined|null|NaN/.test(zeile),
    zeile || '');

  // GEGENPROBE: ohne sie waere die frueher fest eingetippte Fassung gruen --
  // sie erfuellt S1 und S2 muehelos und sagt trotzdem nichts aus.
  pruefe('S3 GEGENPROBE: keine fest eingetippte Fassung mehr',
    !/Werkant v\d/.test(text),
    (text.match(/Werkant v[\d.]+/) || [''])[0]);

  await b.close();
  console.log(fehler === 0
    ? '\nDie Fusszeile sagt, welchen Stand dieser Bildschirm zeigt.'
    : `\n${fehler} Zusicherung(en) nicht erfuellt.`);
  process.exit(fehler ? 1 : 0);
})();
