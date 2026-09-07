// Passen die Beschriftungen in ihre Kacheln — ohne mitten im Wort zu brechen?
//
// ANLASS (Founder-Screenshot 07.09.2026): Im Anbieter-Profil stand
// "Gebäudereini" / "gung" — das Wort war mitten durchgetrennt. Kein Absturz,
// kein Ueberlauf, deshalb hat es KEINE bestehende Pruefung gesehen:
// scripts/rand-ueberstand-check.cjs misst, ob etwas ueber den Rand laeuft.
// Ein Wort, das brav umbricht, laeuft nicht ueber — es sieht nur kaputt aus.
//
// Gemessen wird die Bedingung, die den Bruch AUSLOEST: ein einzelnes Wort,
// das breiter ist als der Platz, der ihm bleibt. Zwei Woerter dagegen duerfen
// umbrechen ("Zimmerer & Holzbau"), das ist normaler Textumbruch.
//
// Die Kacheln liegen hinter Anmeldung UND Anbieterrolle und sind im
// Browser-Durchlauf nicht erreichbar. Gemessen wird deshalb das Kastenmodell
// nachgebaut, mit derselben Schrift und denselben Groessen wie im Bildschirm.
// GRENZE: das prueft die Beschriftungen gegen das Budget, nicht den fertigen
// Bildschirm. Aendert jemand die Kachel-Stile, muss er die Zahlen unten
// mitziehen — sie stehen deshalb an einer Stelle und mit Herkunftsangabe.
const { chromium } = require('playwright');
const path = require('path');

const CHROME = process.env.CHROME_PFAD
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

// Aus app/betrieb/profil.tsx, styles.svcTile / svcTileIcon / svcTileText.
const KACHEL = {
  bildschirmBreite: 360,   // schmalstes geprueftes Geraet (wie rand-ueberstand-check)
  seitenrand: 16 * 2,      // chipGrid paddingHorizontal
  spalten: 2,
  spalte: 10,              // chipGrid gap
  innen: 10 * 2,           // svcTile paddingHorizontal
  symbol: 26,              // svcTileIcon width
  luecke: 6 * 2,           // svcTile gap, zweimal (vor und nach dem Text)
  haken: 16,               // Haken-Symbol, nur im gewaehlten Zustand
  schrift: 12,             // svcTileText fontSize
  gewicht: 600,
};

const LABELS = require(path.join(__dirname, '..', 'scripts', 'labels-leistungen.json'));

let fehler = 0;
(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const p = await b.newPage();
  await p.setContent(`<!doctype html><meta charset=utf8>
    <style>body{margin:0;font-family:'DM Sans','Geist Sans',system-ui,sans-serif}
    span{font-size:${KACHEL.schrift}px;font-weight:${KACHEL.gewicht};white-space:pre}</style>
    <span id=m></span>`);

  const halbe = Math.floor(
    (KACHEL.bildschirmBreite - KACHEL.seitenrand - KACHEL.spalte * (KACHEL.spalten - 1)) / KACHEL.spalten
  ) - KACHEL.innen - KACHEL.symbol - KACHEL.luecke - KACHEL.haken;
  const ganze = (KACHEL.bildschirmBreite - KACHEL.seitenrand)
    - KACHEL.innen - KACHEL.symbol - KACHEL.luecke - KACHEL.haken;

  console.log(`Platz fuer den Text: ${halbe} px in einer halben Kachel, ${ganze} px in einer ganzen Zeile`);
  console.log(`(bei ${KACHEL.bildschirmBreite} px Bildschirm, gewaehlter Zustand — der engste Fall)\n`);

  // Dieselbe Regel wie in app/betrieb/profil.tsx: brauchtGanzeZeile().
  // Bewusst hier NACHGEBAUT und nicht importiert: die Pruefung soll belegen,
  // dass die Regel im Bildschirm die richtige Einordnung trifft — importierte
  // ich sie, pruefte sie sich selbst.
  const LANGES_WORT_AB = 11;
  const ganzeZeile = (name) => name.split(/[\s\u00a0]+/).some((w) => w.length >= LANGES_WORT_AB);

  for (const label of LABELS) {
    const woerter = label.split(/[\s\u00a0]+/).filter(Boolean);
    const breiten = await p.evaluate((ws) => ws.map((w) => {
      const m = document.getElementById('m');
      m.textContent = w;
      return Math.ceil(m.getBoundingClientRect().width);
    }), woerter);

    const budget = ganzeZeile(label) ? ganze : halbe;
    const noetig = Math.max(...breiten);
    const ok = noetig <= budget;
    if (!ok) fehler++;
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(26)} ${ganzeZeile(label) ? 'ganze Zeile' : 'halbe Kachel'}` +
      `  ${noetig}/${budget} px${ok ? '' : `  — „${woerter[breiten.indexOf(noetig)]}" wird mitten im Wort getrennt`}`
    );
  }

  await b.close();
  console.log(`\n${LABELS.length - fehler} von ${LABELS.length} Beschriftungen passen ohne Wortbruch.`);
  process.exit(fehler ? 1 : 0);
})();
