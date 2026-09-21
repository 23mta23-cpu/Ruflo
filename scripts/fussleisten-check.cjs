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
// GRENZE ZUR DOPPELLEISTEN-PRUEFUNG (21.09.2026): dieser Pruefer oeffnet die
// Bildschirme mit NULL-Kennungen und ohne Sitzung. Genau der Fall, der den
// Anlass gab -- zwei Leisten in app/vertrag.tsx --, ist damit hier NICHT
// erreichbar: ohne geladenen Vertrag rendert der Bildschirm gar keine Leiste
// („Vertrag: keine klebende Fussleiste"). Abgedeckt wird er von
// scripts/reisen/reise5-vertrag-zahlung.cjs (E0), die mit Sitzungs-Ersatz und
// Vorgabedaten arbeitet.
// Hier faengt die Zusicherung die drei Bildschirme, die auch abgemeldet eine
// Leiste zeigen. Das ist weniger, als der Name verspricht, und deshalb steht
// es hier.
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

      // ZWEI Leisten uebereinander sind schlimmer als eine, die Text
      // verdeckt: dann ist ein ganzer Knopf unerreichbar.
      //
      // ANLASS (21.09.2026): In app/vertrag.tsx lagen „Vertrag bestaetigen &
      // Zahlung starten" und „Auftrag abschliessen" exakt uebereinander
      // (beide 17/775, 356x53). `lage.zahlbar` und `status === 'active'`
      // schliessen sich nicht aus, wenn kein Geld hinterlegt ist, und beide
      // Leisten sind absolut am unteren Rand. Der Kunde sah bei einem
      // UNBEZAHLTEN Vertrag den Knopf zur Freigabe des Treuhandbetrags und
      // kam an den richtigen gar nicht heran.
      //
      // Verschachtelte zaehlen NICHT mit: eine Leiste, die eine andere
      // enthaelt, ist ein Aufbau, kein Befund.
      const eigenstaendig = leisten.filter(
        (e) => !leisten.some((a) => a !== e && a.contains(e)));

      const leiste = eigenstaendig.reduce((a, e) =>
        e.getBoundingClientRect().top < a.getBoundingClientRect().top ? e : a);
      const lr = leiste.getBoundingClientRect();
      const anzahlLeisten = eigenstaendig.length;
      const beschriftungen = eigenstaendig
        .map((e) => (e.innerText || '').trim().slice(0, 40).replace(/\n/g, ' '));

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
      return { leiste: { oben: Math.round(lr.top), hoehe: Math.round(lr.height) }, tiefster, anzahlLeisten, beschriftungen };
    });

    if (mess.leiste) {
      pruefe(`${name}: nur EINE klebende Leiste am unteren Rand`,
        mess.anzahlLeisten === 1,
        mess.anzahlLeisten === 1 ? '' :
          `${mess.anzahlLeisten} Leisten uebereinander: ${mess.beschriftungen.map((b) => `„${b}"`).join(' / ')}`);
    }

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
