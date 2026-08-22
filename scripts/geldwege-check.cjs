// Die Geld-Bildschirme kalt oeffnen — so, wie ein Push oder ein Deep-Link sie
// oeffnet.
//
// ANLASS (16.08.2026): Reise 1 endet bei "Anmeldung erforderlich", Reise 2 beim
// Gewerbeschein. Die Bildschirme dazwischen — Angebot, Vertrag, Zahlung,
// Abschluss, Rechnung, Reklamation, Stornierung, Bewertung — wurden von KEINER
// Pruefung je geoeffnet. Genau die erreicht man aber per Push-Benachrichtigung
// oder Deep-Link, oft Tage spaeter und ohne gueltige Sitzung.
//
// Ein weisser Bildschirm oder ein ewiger Ladekreis ist dort besonders teuer:
// er trifft den Nutzer in dem Moment, in dem es um sein Geld geht, und er kann
// nicht unterscheiden, ob seine Zahlung durchgelaufen ist oder nicht.
//
// GEPRUEFT WIRD NICHT die Fachlogik — dafuer braucht es zwei angemeldete
// Konten und eine Datenbank, beides gibt es hier nicht. Geprueft wird, dass
// der Bildschirm ueberhaupt etwas Verstaendliches zeigt statt zu verschwinden.
//
// Ausfuehren ueber den Laeufer:  bash scripts/reisen/run.sh
const { chromium } = require('playwright');

const BASIS = process.env.BASIS || 'http://localhost:8744';
const CHROME = process.env.CHROME_PFAD
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

// Jeweils so aufgerufen, wie eine Push-Benachrichtigung es tut: mit Parametern,
// die auf etwas zeigen, das es (fuer diesen Abgemeldeten) nicht gibt.
const WEGE = [
  ['/angebot?offerId=00000000-0000-0000-0000-000000000000',             'Angebot pruefen'],
  ['/vertrag?jobId=00000000-0000-0000-0000-000000000000',               'Vertrag'],
  ['/zahlung?contractId=00000000-0000-0000-0000-000000000000',          'Zahlung'],
  ['/auftrag-abschliessen?contractId=00000000-0000-0000-0000-000000000000', 'Auftrag abschliessen'],
  ['/auftrag-detail?jobId=00000000-0000-0000-0000-000000000000',        'Auftragsdetail'],
  ['/rechnung?contractId=00000000-0000-0000-0000-000000000000',         'Rechnung'],
  ['/reklamation?contractId=00000000-0000-0000-0000-000000000000',      'Reklamation'],
  ['/stornierung?contractId=00000000-0000-0000-0000-000000000000',      'Stornierung'],
  ['/bewertung?contractId=00000000-0000-0000-0000-000000000000',        'Bewertung'],
];

let fehler = 0;
const zeilen = [];
function pruefe(name, bedingung, detail = '') {
  const ok = !!bedingung;
  if (!ok) fehler++;
  zeilen.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => localStorage.setItem('werkr_consent_v1', JSON.stringify({
    accepted: true, analytics: false, pstg: true, version: '1.0',
    timestamp: new Date().toISOString(),
  })));
  // Nichts darf an die Produktionsinstanz gehen.
  let netz = 0;
  await ctx.route('**://*.supabase.co/**', (r) => { netz++; return r.abort(); });
  await ctx.route('**://*.stripe.com/**', (r) => { netz++; return r.abort(); });

  for (const [pfad, name] of WEGE) {
    const p = await ctx.newPage();
    const seitenfehler = [];
    p.on('pageerror', (e) => seitenfehler.push(String(e).slice(0, 120)));

    await p.goto(`${BASIS}${pfad}`, { waitUntil: 'networkidle' }).catch(() => {});

    // ── Frueh: sagt der Bildschirm ueberhaupt schon etwas? ──────────────
    // Ein Ladehinweis zaehlt hier ausdruecklich — er ist die richtige Antwort,
    // solange geladen wird. Was NICHT zaehlt: ein leerer Bildschirm oder ein
    // reines Symbol. Skelett-Flaechen und Ladekringel tragen kein Wort; wer
    // nicht sieht, bekommt von ihnen nichts.
    await p.waitForTimeout(3000);
    const frueh = (await p.locator('body').innerText().catch(() => '')).trim();

    pruefe(`${name}: kein Absturz`, seitenfehler.length === 0,
      seitenfehler.join(' | ').slice(0, 100));
    pruefe(`${name}: sagt sofort etwas Lesbares`,
      frueh.length > 8 && /[A-Za-zÄÖÜäöüß]{4,}/.test(frueh),
      `${frueh.length} Zeichen: ${JSON.stringify(frueh.slice(0, 40))}`);

    // ── Spaet: hat er sich entschieden? ─────────────────────────────────
    // Das ist die eigentliche Pruefung. Ohne Zeitgrenze standen /rechnung und
    // /vertrag ZEHN SEKUNDEN im Ladezustand (gemessen 16.08.2026), weil
    // Supabase-Aufrufe keine eingebaute Grenze haben. Auf einem
    // Rechnungsbildschirm darf das nicht sein: der Nutzer weiss sonst nicht,
    // ob seine Zahlung durchgelaufen ist.
    await p.waitForTimeout(6000);
    const spaet = (await p.locator('body').innerText().catch(() => '')).trim();

    const laedtNoch = /wird geladen|lädt|laedt/i.test(spaet);
    pruefe(`${name}: entscheidet sich binnen 9 Sekunden`, !laedtNoch,
      JSON.stringify(spaet.slice(0, 50)));

    // Und die Entscheidung muss ausgesprochen sein — Inhalt ODER eine klare
    // Auskunft, warum keiner da ist. Bis 16.08.2026 bauten /rechnung und
    // /vertrag stattdessen aus `?? 0` und `'—'` einen vollstaendigen Beleg
    // bzw. Vertrag fuer etwas, das es gar nicht gab.
    pruefe(`${name}: zeigt Inhalt oder sagt, warum keiner da ist`,
      spaet.length > 40 && /[A-Za-zÄÖÜäöüß]{4,}/.test(spaet),
      `${spaet.length} Zeichen`);

    // ── Und vor allem: erfindet er nichts? ──────────────────────────────
    //
    // Diese Pruefung existiert, weil die erste Fassung dieses Skripts eine
    // Mutationsprobe DURCHGELASSEN hat: "erfundene Rechnung wieder zulassen"
    // blieb gruen, weil eine erfundene Rechnung eben auch lesbarer Text ist.
    // Ein Pruefer, der nur "sagt etwas" prueft, faengt genau den teuersten
    // Fall nicht.
    //
    // Alle Kennungen oben zeigen auf Nullen — es GIBT den Vorgang nicht. Ein
    // Bildschirm, der dazu einen Geldbetrag nennt oder eine abgeschlossene
    // Zahlung behauptet, erfindet ihn. Genau das taten /rechnung ("Auftrag
    // abgeschlossen & Zahlung freigegeben") und /vertrag ("Vertrag
    // #WRK-PREV…, Ausstehend") aus `?? 0`- und `'—'`-Ersatzwerten.
    const behauptung = spaet.match(
      /Zahlung freigegeben|Auftrag abgeschlossen|freigegeben am|€\s?[1-9]\d*(?:[.,]\d+)?/i,
    );
    pruefe(`${name}: erfindet keinen Vorgang`, !behauptung,
      behauptung ? `behauptet: ${JSON.stringify(behauptung[0])}` : '');

    await p.close();
  }

  // ── Zweiter Durchgang: die HAENGENDE Verbindung ──────────────────────
  //
  // Der Durchgang oben bricht Netzaufrufe ab — sie scheitern damit SOFORT.
  // Das ist nicht der Fall, gegen den die Zeitgrenze in lib/retry.ts schuetzt:
  // gefaehrlich ist die Verbindung, die weder antwortet noch aufgibt (Funkloch,
  // Netzwechsel, ueberlastetes Netz). Genau so stand /rechnung am 16.08.2026
  // zehn Sekunden lang leer da.
  //
  // Nachgewiesen wurde das erst durch eine Mutationsprobe, die GRUEN blieb:
  // "Zeitgrenze ausgehebelt" fiel dem Pruefer nicht auf, weil abgebrochene
  // Aufrufe ohnehin sofort scheitern. Ein Pruefer, der den Fall nicht
  // herstellt, kann ihn auch nicht finden.
  const ctxHaengt = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctxHaengt.addInitScript(() => localStorage.setItem('werkr_consent_v1', JSON.stringify({
    accepted: true, analytics: false, pstg: true, version: '1.0',
    timestamp: new Date().toISOString(),
  })));
  // Nie erfuellen, nie abbrechen — die Anfrage bleibt einfach offen.
  await ctxHaengt.route('**://*.supabase.co/**', () => new Promise(() => {}));
  await ctxHaengt.route('**://*.stripe.com/**', () => new Promise(() => {}));

  for (const [pfad, name] of WEGE) {
    const p = await ctxHaengt.newPage();
    await p.goto(`${BASIS}${pfad}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    // Die Zeitgrenze liegt bei 6 Sekunden; nach 9 muss der Bildschirm sich
    // entschieden haben.
    await p.waitForTimeout(9000);
    const text = (await p.locator('body').innerText().catch(() => '')).trim();
    const laedtNoch = /wird geladen|lädt|laedt/i.test(text);
    pruefe(`${name}: haengende Verbindung blockiert nicht dauerhaft`,
      !laedtNoch && text.length > 20,
      laedtNoch ? 'haengt weiterhin im Ladezustand' : `${text.length} Zeichen`);
    await p.close();
  }

  console.log(zeilen.join('\n'));
  console.log(`\n(${netz} Aufrufe an Produktion abgefangen — keiner ist hinausgegangen)`);
  console.log(fehler === 0
    ? `=== alle ${WEGE.length} Geld-Bildschirme oeffnen sich verstaendlich ===`
    : `=== ${fehler} FEHLER auf den Geld-Bildschirmen ===`);

  await b.close();
  process.exit(fehler ? 1 : 0);
})();
