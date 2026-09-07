// Verdeckt eine klebende Fussleiste den Inhalt darunter?
//
// ANLASS (Founder-Screenshot 07.09.2026): Im „Digitalen Vertrag" war
// „ZAHLUNGSABWICKLUNG (ESCROW)" mitten in der Ueberschrift abgeschnitten und
// die Unterschriftszeile ebenfalls. Die Leiste ist `position: absolute` und
// legt sich ueber den Inhalt; der ScrollView reservierte 100 px, die Leiste
// misst rund 122.
//
// KEINE bestehende Pruefung konnte das sehen:
//   - rand-ueberstand-check misst, ob etwas SEITLICH ueber den Rand laeuft
//   - alle-screens-check prueft, ob ein Bildschirm ueberhaupt etwas zeigt
// Ein Text, der brav unter einer Leiste verschwindet, faellt in beiden nicht
// auf — er ist ja da, nur unerreichbar.
//
// Gemessen wird die Bedingung selbst: ganz nach unten scrollen, dann pruefen,
// ob der unterste sichtbare Text noch OBERHALB der Leiste endet. Sechs
// weitere Bildschirme haben dasselbe Muster (anbieter, angebot,
// auftrag-abschliessen, bewertung, stornierung, zahlung) — deshalb eine
// Pruefung und kein Einzelfix.
//
// GRENZE: geprueft wird der abgemeldete Zustand. Bildschirme, die ihre Leiste
// erst mit Daten zeigen (der Vertrag ist so einer), sind hier nicht erreichbar
// — dort haelt nur die gemessene Leistenhoehe (onLayout) statt einer festen
// Zahl.
const { chromium } = require('playwright');

const BASIS = process.env.BASIS || 'http://localhost:8744';
const CHROME = process.env.CHROME_PFAD
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const NULLID = '00000000-0000-0000-0000-000000000000';

const WEGE = [
  ['/anbieter?id=' + NULLID,  'Anbieter-Profil'],
  ['/angebot?jobId=' + NULLID, 'Angebot'],
  ['/auftrag-abschliessen?contractId=' + NULLID, 'Auftrag abschliessen'],
  ['/bewertung?contractId=' + NULLID, 'Bewertung'],
  ['/stornierung?contractId=' + NULLID, 'Stornierung'],
  ['/zahlung?contractId=' + NULLID, 'Zahlung'],
  ['/vertrag?contractId=' + NULLID, 'Vertrag'],
  ['/auftrag-aufgeben', 'Auftrag aufgeben'],
];

let fehler = 0;
const zeilen = [];
function pruefe(name, ok, detail = '') {
  if (!ok) fehler++;
  zeilen.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => localStorage.setItem('werkr_consent_v1', JSON.stringify({
    accepted: true, analytics: false, pstg: true, version: '1.0', timestamp: new Date().toISOString(),
  })));
  await ctx.route('**://*.supabase.co/**', (r) => r.abort());
  await ctx.route('**://*.stripe.com/**', (r) => r.abort());

  for (const [weg, name] of WEGE) {
    const p = await ctx.newPage();
    try {
      await p.goto(BASIS + weg, { waitUntil: 'load', timeout: 30000 });
    } catch { await p.close(); continue; }
    await p.waitForTimeout(3500);

    // Ganz nach unten, damit der letzte Inhalt ueberhaupt in Sicht kommt.
    await p.evaluate(() => {
      for (const e of document.querySelectorAll('*')) {
        if (e.scrollHeight > e.clientHeight + 8) e.scrollTop = e.scrollHeight;
      }
      window.scrollTo(0, document.body.scrollHeight);
    });
    await p.waitForTimeout(600);

    const mess = await p.evaluate(() => {
      const sicht = window.innerHeight;
      // Eine klebende Fussleiste: unten verankert, ueber die halbe Breite.
      const leisten = [...document.querySelectorAll('div')].filter((e) => {
        const st = getComputedStyle(e);
        if (st.position !== 'absolute' && st.position !== 'fixed') return false;
        const r = e.getBoundingClientRect();
        return r.width > window.innerWidth * 0.6
          && r.height > 40 && r.height < sicht * 0.5
          && Math.abs(r.bottom - sicht) < 4;
      });
      if (leisten.length === 0) return { leiste: null };
      const leiste = leisten.reduce((a, e) =>
        e.getBoundingClientRect().top < a.getBoundingClientRect().top ? e : a);
      const lr = leiste.getBoundingClientRect();

      // Der unterste sichtbare Text, der NICHT in der Leiste steht.
      let tiefster = null;
      for (const e of document.querySelectorAll('div,span,p,h1,h2,h3')) {
        if (leiste.contains(e) || e.contains(leiste)) continue;
        if (!e.textContent || !e.textContent.trim()) continue;
        if (e.children.length > 0) continue;          // nur Blattknoten
        const r = e.getBoundingClientRect();
        if (r.height === 0 || r.bottom <= 0 || r.top >= sicht) continue;
        if (!tiefster || r.bottom > tiefster.unten) {
          tiefster = { unten: r.bottom, text: e.textContent.trim().slice(0, 40) };
        }
      }
      return { leiste: { oben: Math.round(lr.top), hoehe: Math.round(lr.height) }, tiefster };
    });

    if (!mess.leiste) {
      zeilen.push(`----  ${name}: keine klebende Fussleiste`);
    } else if (!mess.tiefster) {
      zeilen.push(`----  ${name}: kein messbarer Inhalt`);
    } else {
      const frei = Math.round(mess.leiste.oben - mess.tiefster.unten);
      pruefe(`${name}: der letzte Inhalt steht ueber der Leiste`,
        frei >= 0,
        frei >= 0
          ? `${frei} px Luft, Leiste ${mess.leiste.hoehe} px`
          : `„${mess.tiefster.text}" wird ${-frei} px von der Leiste verdeckt`);
    }
    await p.close();
  }

  await b.close();
  console.log(zeilen.join('\n'));
  const geprueft = zeilen.filter((z) => z.startsWith('PASS') || z.startsWith('FAIL')).length;
  console.log(`\n${geprueft - fehler} von ${geprueft} Fussleisten lassen den Inhalt frei.`);
  process.exit(fehler ? 1 : 0);
})();
