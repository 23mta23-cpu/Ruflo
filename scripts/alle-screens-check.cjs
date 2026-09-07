// Jeden uebrigen Bildschirm kalt oeffnen — so, wie ein Push, ein Deep-Link
// oder ein Lesezeichen ihn oeffnet: ohne Sitzung, ohne Vorgeschichte, mit
// Parametern, die auf nichts zeigen.
//
// ANLASS (06.09.2026, Founder-Auftrag "die App soll perfekt sein"): Die
// Geld-Bildschirme wurden am 16.08. auf genau diese Weise geprueft und dabei
// fielen DREI erfundene Vorgaenge auf — ein Beleg ueber eine Zahlung, die es
// nicht gab, Gebuehren fuer einen Auftrag ueber 0 Euro, ein Vertrag aus
// Vorschauwerten. Die uebrigen rund 40 Bildschirme hat so noch nie jemand
// geoeffnet.
//
// Die Kern-Reisen kommen hier nicht hin: Reise 1 endet bei "Anmeldung
// erforderlich", Reise 2 beim Gewerbeschein, und alles unter /betrieb haengt
// zusaetzlich an der Anbieterrolle.
//
// GEPRUEFT WIRD NICHT die Fachlogik — dafuer braeuchte es angemeldete Konten
// und Daten. Geprueft wird das, was ein abgemeldeter Mensch sieht:
//   1. stuerzt nicht ab
//   2. zeigt binnen Sekunden etwas Lesbares statt einer weissen Flaeche
//   3. entscheidet sich (kein ewiger Ladekreis)
//   4. hat einen Weg heraus — eine Sackgasse ist schlimmer als ein Fehler
//
// GRENZE, die hier hingehoert, damit ihr niemand zu viel zutraut:
// Geprueft wird der ABGEMELDETE Zustand. Die meisten Bildschirme fragen dann
// gar nichts ab, sondern zeigen sofort die Anmeldung — sie koennen an einem
// haengenden Netz also nicht scheitern und sagen ueber ihr Ladeverhalten im
// angemeldeten Zustand nichts aus. Von den 17 Bildschirmen, die Daten aus
// Supabase laden, haben nur /zahlung, /rechnung, /vertrag und /anbieter eine
// Zeitgrenze (lib/retry.ts, mitZeitgrenze). Die uebrigen 13 sind hier NICHT
// nachweisbar; dafuer braeuchte es angemeldete Testkonten, und die duerfen
// laut AGENTS.md nicht in der Produktion entstehen.
//
// Ausfuehren ueber den Laeufer:  bash scripts/reisen/run.sh
const { chromium } = require('playwright');

const BASIS = process.env.BASIS || 'http://localhost:8744';
const CHROME = process.env.CHROME_PFAD
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const NULLID = '00000000-0000-0000-0000-000000000000';

// Die neun Geld-Bildschirme fehlen hier bewusst: sie haben mit
// scripts/geldwege-check.cjs eine eigene, schaerfere Pruefung (dort wird
// zusaetzlich geprueft, dass kein Vorgang erfunden wird).
const WEGE = [
  // ── Oeffentlich, ohne Anmeldung erreichbar ──────────────────────────────
  ['/landing',                              'Startseite'],
  ['/login',                                'Anmeldung'],
  ['/registrierung?role=anbieter',          'Registrierung Anbieter'],
  ['/registrierung',                        'Registrierung Kunde'],
  ['/passwort-vergessen',                   'Passwort vergessen'],
  ['/reset-password',                       'Passwort neu setzen'],
  ['/onboarding',                           'Onboarding'],
  ['/onboarding-kyc?track=handwerker',      'KYC Handwerk'],
  ['/onboarding-kyc?track=nachbarschaft',   'KYC Nachbarschaft'],
  ['/bewerbung-eingegangen?track=handwerker', 'Bewerbung eingegangen'],
  ['/bewerbung-abgelehnt',                  'Bewerbung abgelehnt'],
  ['/anbieter-warteliste',                  'Anbieter-Warteliste'],

  // ── Rechtstexte: muessen IMMER lesbar sein, auch abgemeldet ─────────────
  ['/agb',                                  'AGB'],
  ['/datenschutz',                          'Datenschutz'],
  ['/impressum',                            'Impressum'],
  ['/melden',                               'Inhalt melden (Art. 16 DSA)'],
  ['/konto-loeschen',                        'Konto löschen (öffentlich)'],
  ['/widerruf',                             'Widerruf'],
  ['/garantie',                             'Werkant-Schutz'],

  // ── Suchen und stoebern ────────────────────────────────────────────────
  ['/suche',                                'Suche'],
  ['/nachbarschaft',                        'Nachbarschaft'],
  ['/nachbarschaft?category=Putzen',        'Nachbarschaft mit Kategorie'],
  ['/nachbarschaft-profil',                 'Nachbarschafts-Profil'],
  ['/anbieter?id=' + NULLID,                'Anbieter-Profil'],
  ['/meine-anbieter',                       'Meine Anbieter'],
  ['/auftrag-aufgeben',                     'Auftrag aufgeben'],
  ['/auftrag-aufgeben?track=nachbarschaft', 'Auftrag aufgeben Nachbarschaft'],

  // ── Konto und Einstellungen ────────────────────────────────────────────
  ['/profil',                               'Profil'],
  ['/einstellungen',                        'Einstellungen'],
  ['/benachrichtigungen',                   'Benachrichtigungen'],
  ['/zahlungsmethoden',                     'Zahlungsmethoden'],
  ['/support-chat',                         'Support-Chat'],

  // ── Reiter ─────────────────────────────────────────────────────────────
  ['/auftraege',                            'Auftraege (Reiter)'],
  ['/nachrichten',                          'Nachrichten (Reiter)'],
  ['/konto',                                'Konto (Reiter)'],
  ['/chat?jobId=' + NULLID + '&providerId=' + NULLID, 'Chat'],

  // ── Betriebsbereich: haengt an Anmeldung UND Anbieterrolle ─────────────
  ['/betrieb/dashboard',                    'Betrieb Dashboard'],
  ['/betrieb/auftraege',                    'Betrieb Auftraege'],
  ['/betrieb/nachrichten',                  'Betrieb Nachrichten'],
  ['/betrieb/kalender',                     'Betrieb Kalender'],
  ['/betrieb/profil',                       'Betrieb Profil'],
  ['/betrieb/profil-bearbeiten',            'Betrieb Profil bearbeiten'],
  ['/betrieb/statistik',                    'Betrieb Statistik'],
  ['/betrieb/pro',                          'Betrieb Pro'],
  ['/betrieb/onboarding-stripe',            'Betrieb Auszahlungen'],
  ['/betrieb/angebot-erstellen?jobId=' + NULLID, 'Betrieb Angebot erstellen'],
];

let fehler = 0;
const zeilen = [];
function pruefe(name, bedingung, detail = '') {
  const ok = !!bedingung;
  if (!ok) fehler++;
  zeilen.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

// Worte, an denen man erkennt, dass der Bildschirm den leeren Zustand BENENNT
// statt ihn zu verschweigen.
const ERKLAERT = /anmeld|einloggen|registrier|nicht gefunden|nicht verfügbar|keine? |noch nichts|leer|fehlt|zugriff|berechtigt|nur für|gewerbe|verifizier|fehler|erneut|zurück/i;

let netz = 0;

// Das DSGVO-Blatt legt sich sonst ueber jeden Bildschirm.
const EINWILLIGUNG = () => localStorage.setItem('werkr_consent_v1', JSON.stringify({
  accepted: true, analytics: false, pstg: true, version: '1.0', timestamp: new Date().toISOString(),
}));

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(EINWILLIGUNG);
  // Kein Aufruf geht an die Produktion. Ohne diese beiden Zeilen lief die
  // Pruefung gegen chnphpmpdpllnpqtvwhx.supabase.co — gegen die stehende
  // Test-Regel in AGENTS.md, und das Ergebnis haette am Sandbox-Proxy
  // gehangen statt am Code. abort() ist zugleich der ehrliche Fall
  // "kein Netz": der Aufruf scheitert sofort und sichtbar.
  await ctx.route('**://*.supabase.co/**', (r) => { netz++; return r.abort(); });
  await ctx.route('**://*.stripe.com/**', (r) => { netz++; return r.abort(); });

  for (const [weg, name] of WEGE) {
    const p = await ctx.newPage();
    const seitenfehler = [];
    p.on('pageerror', (e) => seitenfehler.push(String(e).split('\n')[0]));

    try {
      await p.goto(BASIS + weg, { waitUntil: 'load', timeout: 30000 });
    } catch (e) {
      pruefe(`${name}: laedt ueberhaupt`, false, String(e).slice(0, 70));
      await p.close();
      continue;
    }
    await p.waitForTimeout(2600);

    const text = (await p.evaluate(() => document.body.innerText || '')).trim();

    // 1. Kein Absturz.
    pruefe(`${name}: kein Absturz`, seitenfehler.length === 0,
      seitenfehler[0] ? seitenfehler[0].slice(0, 80) : '');

    // 2. Etwas Lesbares. Ein leerer Bildschirm ist die schlimmste Antwort:
    //    der Nutzer weiss nicht, ob es laedt, kaputt ist oder er falsch ist.
    //
    //    Die 25 Zeichen sind ein Ersatzmass fuer "nicht leer", und als solches
    //    war es zu grob: "Profil wird geladen …" sind 23 Zeichen und
    //    beantworten die Frage des Nutzers vollstaendig. Die Schwelle deshalb
    //    NICHT heruntergesetzt (eine Zahl passend zu machen, bis sie gruen
    //    ist, waere keine Pruefung mehr), sondern um den Fall ergaenzt, den
    //    sie eigentlich meint: ein Bildschirm darf kurz sein, wenn er sagt,
    //    dass er laedt. Bleibt er dabei, faellt er in Pruefpunkt 3.
    const laedtSichtbar = /wird geladen|lädt|laden …|einen moment/i.test(text);
    pruefe(`${name}: zeigt Text`, text.length >= 25 || laedtSichtbar,
      `${text.length} Zeichen`);

    // 3. Entscheidet sich. Ein Ladezustand, der nach 6 Sekunden noch steht,
    //    ist keiner mehr.
    await p.waitForTimeout(3600);
    const spaeter = (await p.evaluate(() => document.body.innerText || '')).trim();
    // Der Anker ^ war zu eng: "Profil wird geladen …" faengt mit "Profil" an
    // und rutschte nur deshalb durch, weil es zufaellig unter 25 Zeichen lang
    // ist. Ein etwas laengerer Ladehinweis waere hier still gruen geblieben —
    // genau die Klasse "gruener Haken, der nichts prueft". Jetzt zaehlt der
    // Ladehinweis selbst, egal an welcher Stelle er steht.
    const haengt = /wird geladen|^(lädt|laden|einen moment|bitte warten)|laden …/i.test(spaeter)
      || spaeter.length < 25;
    pruefe(`${name}: entscheidet sich binnen 6 Sekunden`, !haengt,
      haengt ? spaeter.slice(0, 50) : '');

    // 4. Ein Weg heraus. Entweder es steht Inhalt da, oder der Bildschirm
    //    benennt, warum nicht — und bietet einen anklickbaren Ausweg.
    //    ACHTUNG, teuer gelernt: react-native-web rendert Pressable und
    //    TouchableOpacity NICHT als <button>, sondern als <div tabindex="0">.
    //    Ein Selektor aus 'button,a,[role=button]' meldete deshalb auf dem
    //    Anmelde-Bildschirm "0 bedienbare Elemente" — obwohl dort E-Mail,
    //    Passwort, "Vergessen?", Apple, Google, "Registrieren" und
    //    "Einloggen" stehen. 13 von 16 Fehlermeldungen waren Fehlalarme.
    //    Gegenprobe auf /betrieb/dashboard: tabindex-Knoten = 7 = 2 Felder +
    //    5 Knöpfe, also genau die sichtbaren Bedienelemente, kein Rauschen.
    //    Ein Prüfer mit Fehlalarmen wird abgeschaltet und nie wieder an.
    const knoepfe = await p.evaluate(() =>
      [...document.querySelectorAll(
        'button,a,[role="button"],[tabindex="0"],input,select,textarea')]
        .filter((e) => e.offsetParent !== null || getComputedStyle(e).position === 'fixed')
        .length);
    const erklaert = ERKLAERT.test(spaeter);
    pruefe(`${name}: hat einen Weg heraus`, knoepfe > 0,
      `${knoepfe} bedienbare Elemente`);
    pruefe(`${name}: Inhalt oder Begruendung`, spaeter.length > 120 || erklaert,
      spaeter.length <= 120 && !erklaert ? spaeter.slice(0, 60) : '');

    await p.close();
  }

  // ── Zweiter Durchgang: das Netz ANTWORTET NICHT ────────────────────────
  //
  // Der Unterschied zu oben ist der ganze Punkt. Oben scheitert der Aufruf
  // SOFORT (abort) — dann greift jeder catch-Block, und der Bildschirm zeigt
  // seine Fehlermeldung. Hier antwortet die Gegenstelle nie: kein Fehler,
  // kein Ergebnis. Genau das passiert im Funkloch, im Aufzug, im WLAN eines
  // Hotels mit Anmeldeseite. supabase-js hat KEINE eingebaute Zeitgrenze,
  // also laeuft `await` unendlich, `finally` wird nie erreicht, und
  // `loading` bleibt fuer immer true.
  //
  // Ein Ladekreis ohne Text ist dabei die schlechteste Antwort: er sieht
  // genauso aus wie ein Absturz. Deshalb wird hier nicht nur verlangt, dass
  // der Bildschirm sich entscheidet, sondern dass er waehrenddessen
  // ueberhaupt etwas sagt.
  const ctxHaengt = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctxHaengt.addInitScript(EINWILLIGUNG);
  await ctxHaengt.route('**://*.supabase.co/**', () => new Promise(() => {}));
  await ctxHaengt.route('**://*.stripe.com/**', () => new Promise(() => {}));

  for (const [weg, name] of WEGE) {
    const p = await ctxHaengt.newPage();
    try {
      await p.goto(BASIS + weg, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch {
      await p.close();
      continue;
    }
    // Die Zeitgrenze in lib/retry.ts liegt bei 6 Sekunden; 11 laesst ihr Luft
    // und faengt trotzdem jeden Bildschirm ohne Zeitgrenze.
    await p.waitForTimeout(11000);
    const text = (await p.evaluate(() => document.body.innerText || '')).trim();
    pruefe(`${name}: sagt etwas, wenn das Netz nicht antwortet`,
      text.length >= 25, `${text.length} Zeichen nach 11 s`);
    await p.close();
  }

  await b.close();
  console.log(zeilen.join('\n'));
  console.log(`\n(${netz} Aufrufe an Produktion abgefangen — keiner ist hinausgegangen)`);
  console.log(`${zeilen.length - fehler} von ${zeilen.length} Pruefpunkten bestanden (${WEGE.length} Bildschirme).`);
  process.exit(fehler ? 1 : 0);
})();
