// Reise 19 — ein Ladefehler darf keine Geldaussage von Null erzeugen.
//
// ANLASS (Messung 27.09.2026, haengendes Netz auf 18 Bildschirmen):
//   /betrieb/auftraege  zeigte „Treuhand (aktiv) 0,00" und „Ausgezahlt
//                       gesamt 0,00"
//   /betrieb/statistik  zeigte „0 Euro Umsatz, 0 Auftraege, Annahmequote"
// Ein Betrieb mit Geld im Treuhandkonto liest daraus, dass nichts da ist.
// Null heisst „nichts verdient", nicht „nicht geladen".
//
// Bei der Statistik lag die Ursache eine Ebene tiefer als gedacht:
// `loadStats` las `contractsRes.data ?? []` und pruefte `.error` nie.
// supabase-js WIRFT nicht, es legt den Fehler in `.error` — der `catch` des
// Bildschirms konnte also gar nicht ausloesen. Dieselbe Klasse wie der
// Vorgabesatz in lib/providerProfiles.ts, nur eine Etage tiefer.
//
// Teil C und D sind Pflicht-Gegenproben: im gesunden Fall MUESSEN die Zahlen
// dastehen. Ohne sie waere „nie eine Zahl zeigen" der bequemste gruene Haken.
// MUTATIONEN (gemessen):
//   `if (contractsRes.error) throw` in loadStats entfernt  ZUSAMMEN MIT
//   `ladefehler ? '…'` im Verdienst-Banner entfernt (zwei Bildschirme, koennen
//   sich nicht verdecken)
//       -> A1 A2 A3 A4 rot und B1 B2 rot; B3 B4 GRUEN, C und D gruen.
//          Die FAIL-Zeilen drucken den Originalfehler woertlich aus:
//          „€0 Umsatz, 0 Auftraege" und „Treuhand (aktiv) €0,00".
//          Dass B3/B4 dabei gruen bleiben, ist der Beleg: der Grund kann
//          dastehen, waehrend die Zahl daneben luegt.
//   nur die Begruendungszeile entfernt
//       -> NUR B3 B4 rot, B1 B2 gruen. Damit ist die Trennung in beide
//          Richtungen belegt.
//
// NOCH OFFEN auf /betrieb/auftraege, bewusst nicht in diesem Block: faellt
// die Vertragsabfrage aus, sagen die Reiter „Aktiv"/„Ausstehend"/„Erledigt"
// weiterhin „Keine Auftraege". Das ist die Klasse „luegender Leerstand", die
// im Handoff mit vier weiteren Bildschirmen als naechster Block steht.
const { chromium } = require('playwright');
const { alsAnbieter } = require('../lib/anbieter-sitzung.cjs');

const BASIS = process.env.BASIS || 'http://localhost:8744';
const CHROME = process.env.CHROME_PFAD
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

let pass = 0, fail = 0;
function pruefe(name, ok, detail) {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

/** Die Zeile NACH einem Etikett — Beschriftung und Betrag rendern getrennt. */
function zeileNachEtikett(zeilen, etikett) {
  for (let i = 0; i < zeilen.length; i++) {
    if (zeilen[i].trim() === etikett && i + 1 < zeilen.length) return zeilen[i + 1].trim();
  }
  return null;
}

async function text(p) {
  return (await p.evaluate(() => document.body.innerText || '')).trim();
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });

  // ── A: /betrieb/statistik, Vertragsabfrage faellt aus ───────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, { fehlerBei: ['contracts'] });
    const p = await ctx.newPage();
    await p.goto(`${BASIS}/betrieb/statistik`, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(3000);

    const pfad = new URL(p.url()).pathname;
    pruefe('A0 misst wirklich /betrieb/statistik', pfad === '/betrieb/statistik', `Pfad: ${pfad}`);

    const t = await text(p);
    pruefe('A1 der Bildschirm benennt den Ladefehler',
      t.includes('Zahlen konnten nicht geladen werden'), JSON.stringify(t.slice(0, 200)));
    pruefe('A2 er sagt, dass es keine Aussage ueber den Umsatz ist',
      t.includes('keine Aussage über Ihren Umsatz'), JSON.stringify(t.slice(0, 200)));
    // Der Kern: KEINE erfundene Null.
    pruefe('A3 es steht kein Euro-Betrag da', !/€\s*\d/.test(t), JSON.stringify(t.slice(0, 200)));
    pruefe('A4 und keine Umsatz-Kachel', !t.includes('Letzte 30 Tage'), JSON.stringify(t.slice(0, 200)));
    await ctx.close();
  }

  // ── B: /betrieb/auftraege, Vertragsabfrage faellt aus ───────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, { fehlerBei: ['contracts'] });
    const p = await ctx.newPage();
    await p.goto(`${BASIS}/betrieb/auftraege`, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(3000);

    const pfad = new URL(p.url()).pathname;
    pruefe('B0 misst wirklich /betrieb/auftraege', pfad === '/betrieb/auftraege', `Pfad: ${pfad}`);

    const t = await text(p);
    const zeilen = t.split('\n');
    const treuhand = zeileNachEtikett(zeilen, 'Treuhand (aktiv)');
    const ausgezahlt = zeileNachEtikett(zeilen, 'Ausgezahlt gesamt');
    pruefe('B1 „Treuhand (aktiv)" nennt keinen Betrag', treuhand === '…', `steht da: ${JSON.stringify(treuhand)}`);
    pruefe('B2 „Ausgezahlt gesamt" nennt keinen Betrag', ausgezahlt === '…', `steht da: ${JSON.stringify(ausgezahlt)}`);
    pruefe('B3 der Grund steht dabei',
      t.includes('Beträge konnten nicht geladen werden'), JSON.stringify(t.slice(0, 250)));
    pruefe('B4 und es ist keine Aussage ueber das Guthaben',
      t.includes('keine Aussage über Ihr'), JSON.stringify(t.slice(0, 250)));
    await ctx.close();
  }

  // ── C: Gegenprobe Statistik, gesunder Fall ──────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx);
    const p = await ctx.newPage();
    await p.goto(`${BASIS}/betrieb/statistik`, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(3000);

    const t = await text(p);
    pruefe('C1 kein Ladefehler im gesunden Fall',
      !t.includes('Zahlen konnten nicht geladen werden'), JSON.stringify(t.slice(0, 200)));
    pruefe('C2 die Umsatz-Kacheln stehen da', t.includes('Letzte 30 Tage'), JSON.stringify(t.slice(0, 200)));
    pruefe('C3 und sie nennen einen Euro-Betrag', /€\s*\d/.test(t), JSON.stringify(t.slice(0, 200)));
    await ctx.close();
  }

  // ── D: Gegenprobe Auftraege, gesunder Fall ──────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx);
    const p = await ctx.newPage();
    await p.goto(`${BASIS}/betrieb/auftraege`, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(3000);

    const t = await text(p);
    const zeilen = t.split('\n');
    const treuhand = zeileNachEtikett(zeilen, 'Treuhand (aktiv)');
    const ausgezahlt = zeileNachEtikett(zeilen, 'Ausgezahlt gesamt');
    pruefe('D1 „Treuhand (aktiv)" nennt wieder einen Betrag',
      !!treuhand && /€/.test(treuhand), `steht da: ${JSON.stringify(treuhand)}`);
    pruefe('D2 „Ausgezahlt gesamt" nennt wieder einen Betrag',
      !!ausgezahlt && /€/.test(ausgezahlt), `steht da: ${JSON.stringify(ausgezahlt)}`);
    pruefe('D3 kein Ladefehler-Hinweis',
      !t.includes('Beträge konnten nicht geladen werden'), JSON.stringify(t.slice(0, 250)));
    await ctx.close();
  }

  await browser.close();
  // „PASS" bewusst NICHT im Schlusssatz: run.sh zaehlt Zeilen mit grep -c.
  console.log(fail === 0 ? `\nAlles bestanden (${pass}).` : `\n${fail} FEHLGESCHLAGEN`);
  process.exit(fail === 0 ? 0 : 1);
})();
