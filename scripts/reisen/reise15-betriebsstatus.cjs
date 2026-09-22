// Kern-Reise 15 — der Betriebsstatus im Pruef-Postfach.
//
// ANLASS (22.09.2026). Die Datenbank hat drei Betreiber-Selbstauskuenfte
// (0850, 0880, 1010), und kein BILDSCHIRM rief eine davon auf. An zweien
// haengen Fristen mit Rechtsfolge (DSA Art. 17 und Art. 4 P2B-VO bei der
// Zustellung, § 13 und § 25 PStTG bei der Jahresmeldung).
//
// WARUM EINE BROWSER-REISE UND NICHT NUR DER QUELLTEXT-PRUEFER:
// `scripts/betriebsauskunft-check.py` sieht, dass die Funktion GERUFEN wird
// -- nicht, ob am Ende ein Satz dasteht oder `undefined`. Herkunft ist eine
// Quelltext-Frage, Wirkung eine Browser-Frage.
//
// GEPRUEFT WIRD:
//   B  Schlechter Stand: die drei Zeilen stehen da, mit Zahl und Rechtsfolge.
//   G  GEGENPROBE guter Stand: kein Alarm-Abzeichen, aber die drei Zeilen
//      stehen TROTZDEM da -- ein leerer Abschnitt saehe aus wie „nicht
//      geladen".
//   F  Kommen die drei Auskuenfte LEER zurueck, sagt der Bildschirm das.
//   H  Faellt der ganze Aufruf mit einem HTTP-Fehler aus, ebenso.
const { chromium } = require('playwright');
const { alsAnbieter } = require('../lib/anbieter-sitzung.cjs');

const BASIS = process.env.BASIS || 'http://localhost:8744';
const CHROME = process.env.CHROME_PFAD
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

let fehler = 0;
function pruefe(name, bedingung, detail = '') {
  const ok = !!bedingung;
  if (!ok) fehler++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? '  — ' + detail : ''}`);
  return ok;
}

// Absichtlich UNTERSCHEIDBARE Zahlen je Feld: dreimal dieselbe koennte nicht
// zeigen, ob die Angaben an der richtigen Stelle landen (Lehre aus Reise 8 E).
const SCHLECHT = {
  zustellung: {
    offene_pflichtmitteilungen: 3, aelteste_offene_stunden: 26,
    stau: true, zeitplan_vorhanden: true,
  },
  abnahme: {
    zeitplan_vorhanden: false, letzter_lauf_am: null,
    letzter_lauf_erfolgreich: false, faellige_vertraege: 0,
    aeltester_faelliger_tage: 0, stau: false,
  },
  pstg: {
    melde_jahr: 2025, frist: '2026-01-31', tage_bis_frist: -3,
    meldepflichtige: 7, vorbereitet: 7, abgegeben: 0,
    lauf_fehlt: false, abgabe_fehlt: true, frist_verstrichen: true,
  },
};

const GUT = {
  zustellung: {
    offene_pflichtmitteilungen: 0, aelteste_offene_stunden: 0,
    stau: false, zeitplan_vorhanden: true,
  },
  abnahme: {
    zeitplan_vorhanden: true, letzter_lauf_am: new Date().toISOString(),
    letzter_lauf_erfolgreich: true, faellige_vertraege: 0,
    aeltester_faelliger_tage: 0, stau: false,
  },
  pstg: {
    melde_jahr: 2025, frist: '2026-01-31', tage_bis_frist: 131,
    meldepflichtige: 0, vorbereitet: 0, abgegeben: 0,
    lauf_fehlt: false, abgabe_fehlt: false, frist_verstrichen: false,
  },
};

/**
 * Alle drei Aktionen des Pruef-Postfachs gehen an DIESELBE URL und
 * unterscheiden sich nur im Rumpf. Der Pruefstand muss den also lesen --
 * sonst bekaeme `betriebsstatus` die Antwort von `liste`.
 */
function postfach(status) {
  return (_verb, request) => {
    let aktion = '';
    try { aktion = (JSON.parse(request.postData() || '{}').aktion) || ''; } catch { /* leer */ }
    if (aktion === 'betriebsstatus') {
      return status === null ? { error: 'Prüfstand: absichtlicher Fehler' } : status;
    }
    if (aktion === 'wartendes') return { reklamationen: [], meldungen: [] };
    return { einreichungen: [] };
  };
}

async function postfachSeite(b, status) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await alsAnbieter(ctx, { daten: { pruefung: postfach(status) } });
  const p = await ctx.newPage();
  await p.goto(`${BASIS}/pruefung`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(3000);
  return { ctx, p, text: await p.locator('body').innerText() };
}

async function main() {
  const b = await chromium.launch({ executablePath: CHROME });

  // ── B: schlechter Stand ─────────────────────────────────────────────────
  {
    const { ctx, p, text } = await postfachSeite(b, SCHLECHT);
    pruefe('B0 Gemessen wird das Pruef-Postfach',
      new URL(p.url()).pathname.endsWith('/pruefung'), p.url());

    pruefe('B1 Der Abschnitt „Hintergrund-Läufe" steht da',
      /Hintergrund-Läufe/i.test(text), text.split('\n').slice(0, 10).join(' | '));

    // Die Zahl, nicht nur das Etikett: ein Abschnitt, der „irgendetwas
    // klemmt" sagt, schickt niemanden los.
    pruefe('B2 Die unzugestellten Mitteilungen stehen mit Zahl und Alter da',
      /3 Mitteilungen/.test(text) && /26 Stunden/.test(text),
      text.split('\n').filter((z) => /Mitteilung/.test(z)).join(' | '));

    pruefe('B3 Der fehlende Abnahme-Lauf nennt die Geldfolge',
      /Treuhandkonto/.test(text));

    // Die Rechtsfolge gehoert in den Satz. Ohne sie liest sich eine
    // verstrichene Frist wie ein Aufraeumhinweis.
    pruefe('B4 Die verstrichene DAC7-Frist nennt das Bußgeld',
      /§ 25/.test(text) && /31\. Januar/.test(text),
      text.split('\n').filter((z) => /PStTG|Januar/.test(z)).join(' | '));

    pruefe('B5 Das Abzeichen zaehlt die dringenden Punkte',
      /3 offen/.test(text), text.split('\n').filter((z) => /offen/.test(z)).join(' | '));

    // Ein Quelltext-Pruefer sieht `betriebsstatus(a, b, c)` und ist
    // zufrieden, auch wenn `undefined` gerendert wird.
    pruefe('B6 Kein „undefined" im sichtbaren Text', !/undefined/i.test(text));

    // Die deutsche Mehrzahl NIE zusammensetzen (08.09.). Der Jest-Test fing
    // „Auftrage" beim ersten Lauf; hier steht die Gegenprobe am Bildschirm.
    pruefe('B7 Kein „Auftrage" und kein „Mitteilungn"',
      !/Auftrage\b/.test(text) && !/Mitteilungn/.test(text));
    await ctx.close();
  }

  // ── G GEGENPROBE: guter Stand ───────────────────────────────────────────
  //
  // Ohne diese Probe waere „immer alles rot" bestanden -- und ein Bildschirm,
  // auf dem immer alles rot ist, wird nicht mehr gelesen.
  {
    const { ctx, text } = await postfachSeite(b, GUT);
    pruefe('G1 Der Abschnitt steht auch bei gutem Stand da',
      /Hintergrund-Läufe/i.test(text));

    // Der eigentliche Punkt: NICHT leer. Ein leerer Abschnitt sieht aus wie
    // „nicht geladen" -- dieselbe Klasse wie ein Netzfehler, der sich als
    // leerer Posteingang tarnt (21.09.).
    // `T.label` setzt Versalien, und `innerText` gibt in Chromium den
    // GERENDERTEN Text zurueck -- also „DAC7-JAHRESMELDUNG". Die erste
    // Fassung suchte schreibungsabhaengig und meldete einen Bildschirm als
    // Fehler, der richtig war. Dieselbe Falle wie in Reise 13 (A3).
    pruefe('G2 Und er zeigt alle drei Zeilen, statt leer zu bleiben',
      /Pflichtmitteilungen/i.test(text) && /Abnahme-Frist/i.test(text)
      && /DAC7-Jahresmeldung/i.test(text),
      text.split('\n').filter((z) => /pflicht|abnahme|dac7/i.test(z)).join(' | '));

    pruefe('G3 Ohne dringende Punkte steht kein Alarm-Abzeichen da',
      !/\d+ offen/.test(text),
      text.split('\n').filter((z) => /offen/.test(z)).join(' | '));

    pruefe('G4 Und keine Rechtsfolge, die gar nicht eingetreten ist',
      !/§ 25/.test(text));
    await ctx.close();
  }

  // ── F: die drei Auskuenfte kommen LEER zurueck ──────────────────────────
  //
  // „Nichts angezeigt" und „alles in Ordnung" sind zwei verschiedene Dinge.
  // Die Edge Function faengt jede Auskunft einzeln; faellt eine aus, kommt
  // sie als `null` und muss als dringend dastehen.
  //
  // PRAEZISIERT nach der Mutationsprobe: der Pruefstand antwortet hier mit
  // HTTP 200 und einem Fehler-RUMPF. Das ist also NICHT der Fehlerzweig des
  // Bildschirms -- der steht in Teil H. Die erste Fassung hiess „der Aufruf
  // faellt aus" und mass etwas anderes als ihr Name sagte.
  {
    const { ctx, text } = await postfachSeite(b, null);
    pruefe('F1 Leere Auskuenfte stehen als „nicht abrufbar" da',
      /nicht abrufbar/i.test(text),
      text.split('\n').filter((z) => /Hintergrund|abrufbar/i.test(z)).join(' | '));
    pruefe('F2 Und behaupten nicht, es sei alles in Ordnung',
      !/Nichts liegt unzugestellt/.test(text));
    await ctx.close();
  }

  // ── H: der ganze Aufruf scheitert mit einem HTTP-Fehler ─────────────────
  //
  // Eine ZUSAETZLICHE Route nach `alsAnbieter`: Playwright nimmt die zuletzt
  // registrierte zuerst. Nur die Aktion `betriebsstatus` scheitert, die
  // Verifizierungsliste bleibt erreichbar -- sonst maesse man den
  // Fehlerzustand des ganzen Bildschirms statt den dieses Abschnitts.
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, { daten: { pruefung: postfach(GUT) } });
    await ctx.route('**/functions/v1/pruefung*', async (route) => {
      let aktion = '';
      try { aktion = (JSON.parse(route.request().postData() || '{}').aktion) || ''; } catch { /* leer */ }
      if (aktion !== 'betriebsstatus') return route.fallback();
      return route.fulfill({
        status: 500, contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Pruefstand: absichtlicher HTTP-Fehler' }),
      });
    });
    const p = await ctx.newPage();
    await p.goto(`${BASIS}/pruefung`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(3000);
    const text = await p.locator('body').innerText();

    pruefe('H1 Der Abschnitt steht trotzdem da', /Hintergrund-Läufe/i.test(text));
    pruefe('H2 Und sagt, dass der Stand nicht abrufbar ist',
      /nicht abrufbar/i.test(text),
      text.split('\n').filter((z) => /Hintergrund|abrufbar/i.test(z)).join(' | '));
    // Der eigentliche Punkt: ein stiller Rueckfall auf „geladen" waere ein
    // leerer Abschnitt, und der liest sich als „alles in Ordnung".
    //
    // GEMESSEN, und zwar unfreiwillig: waehrend einer anderen Probe stand
    // `setStatusLage('da')` statt `('fehler')` im Baum -- H2 wurde rot,
    // H1, H3 und H4 blieben gruen. Genau die dokumentierte Trennung: der
    // Abschnitt ist da, er sagt nur nichts mehr.
    pruefe('H3 Er behauptet nicht, die Laeufe seien in Ordnung',
      !/Stündlicher Lauf eingerichtet/.test(text)
      && !/Täglicher Lauf eingerichtet/.test(text));
    pruefe('H4 Die Verifizierungsliste bleibt erreichbar',
      /Prüf-Postfach/i.test(text));
    await ctx.close();
  }

  await b.close();
  console.log(fehler === 0 ? '\nReise 15: alles gruen.' : `\nReise 15: ${fehler} FAIL.`);
  process.exit(fehler === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
