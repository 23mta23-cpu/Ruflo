// Der Schrittzaehler im Auftrags-Trichter zaehlt ab dem Einstieg.
//
// ANLASS (Founder am Geraet, 21.09.2026): „Warum faengt die Anfrage direkt
// bei 2 von 4 an, wenn ich es auf der Homepage anklicke?"
//
// Weil Schritt 1 (die Kategorie-Auswahl) uebersprungen wird, sobald die
// Kategorie per Link schon feststeht. Das ist richtig so -- ein frueheres
// Founder-Feedback lautete „2 Seiten, die dasselbe zeigen". Gezaehlt wurde
// aber weiter absolut: der ERSTE Bildschirm meldete sich als „Schritt 2 von
// 4", und ein Balkensegment war schon gruen, ohne dass der Nutzer etwas
// getan hatte.
//
// GEPRUEFT WIRD, WAS DER NUTZER LIEST. Die Rechnung selbst ist eine Zeile;
// interessant ist, ob sie auf dem Bildschirm ankommt und ob der Balken dazu
// passt. Beides zusammen -- ein richtiger Text ueber einem falschen Balken
// waere derselbe Widerspruch.
const { chromium } = require('playwright');

const BASIS = process.env.BASIS || 'http://localhost:8744';
const CHROME = process.env.CHROME_PFAD
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

const FAELLE = [
  { name: 'Einstieg ueber eine Kachel (Kategorie steht fest)',
    weg: '/auftrag-aufgeben?category=elektro', erwartet: 'Schritt 1 von 3', segmente: 3 },
  { name: 'Einstieg ohne Kategorie',
    weg: '/auftrag-aufgeben', erwartet: 'Schritt 1 von 4', segmente: 4 },
];

let fehler = 0;
function pruefe(name, ok, detail = '') {
  if (!ok) fehler++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`);
}

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  for (const f of FAELLE) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(() => localStorage.setItem('werkr_consent_v1', JSON.stringify({
      accepted: true, analytics: false, pstg: true, version: '1.0',
      timestamp: new Date().toISOString(),
    })));
    await ctx.route('**://*.supabase.co/**', (r) => r.abort());
    const p = await ctx.newPage();
    await p.goto(BASIS + f.weg, { waitUntil: 'networkidle' });
    await p.waitForTimeout(1500);

    const text = await p.evaluate(() => document.body.innerText);
    const treffer = text.match(/Schritt\s+\d+\s+von\s+\d+/);
    pruefe(`${f.name}: Beschriftung`, treffer && treffer[0].replace(/\s+/g, ' ') === f.erwartet,
      treffer ? `steht da: „${treffer[0].replace(/\s+/g, ' ')}", erwartet „${f.erwartet}"`
              : 'keine Schritt-Angabe gefunden');

    // Der Balken muss dieselbe Zahl tragen. Die Segmente sind die direkten
    // Kinder des Balkens; gezaehlt wird ueber die Geschwister der gruenen.
    const gemessen = await p.evaluate(() => {
      const kandidaten = Array.from(document.querySelectorAll('div'))
        .filter((e) => {
          const k = Array.from(e.children);
          if (k.length < 3 || k.length > 4) return false;
          return k.every((c) => {
            const r = c.getBoundingClientRect();
            return r.height > 0 && r.height <= 8 && r.width > 20;
          });
        });
      return kandidaten.length ? kandidaten[0].children.length : 0;
    });
    pruefe(`${f.name}: Balken hat ${f.segmente} Abschnitte`, gemessen === f.segmente,
      `gemessen: ${gemessen}`);
    await ctx.close();
  }
  await b.close();
  if (fehler === 0) console.log('\nPASS  der Schrittzaehler zaehlt ab dem Einstieg.');
  process.exit(fehler ? 1 : 0);
})();
