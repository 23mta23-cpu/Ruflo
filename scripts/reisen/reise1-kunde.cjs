// Kern-Reise 1 — der Weg, den ein Kunde ohne Konto tatsaechlich geht.
//
// Landing -> "Jetzt Unterstuetzung finden" -> Onboarding -> "Loslegen" ->
// Startseite -> Kategorie-Kachel -> Auftrags-Assistent (3 Schritte) ->
// "Auftrag abschicken" -> "Anmeldung erforderlich" -> Entwurf gesichert ->
// Assistent erneut oeffnen -> Entwurf wiederhergestellt.
//
// Diese Reise stand seit Wochen in der Agentendefinition und war nie gelaufen.
// Der teuerste Punkt darin ist der Entwurf: wer eine lange Beschreibung tippt
// und sie bei der Anmeldung verliert, kommt nicht wieder.
//
// Ausfuehren ueber den Laeufer:  bash scripts/reisen/run.sh
// Einzeln (Server muss laufen):  node scripts/reisen/reise1-kunde.cjs
const { chromium } = require('playwright');

const BASIS = process.env.BASIS || 'http://localhost:8744';
const CHROME = process.env.CHROME_PFAD
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

const BESCHREIBUNG =
  'Der Heizkoerper im Wohnzimmer wird seit zwei Wochen nicht mehr warm, obwohl das '
  + 'Ventil ganz offen steht. Entlueftet habe ich schon zweimal, es kommt nur Wasser '
  + 'und keine Luft. Die anderen Raeume sind normal warm.';

const STRASSE = 'Aachener Strasse 12a';

let fehler = 0;
const schritte = [];
function pruefe(name, bedingung, detail = '') {
  const ok = !!bedingung;
  if (!ok) fehler++;
  schritte.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  return ok;
}

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => localStorage.setItem('werkr_consent_v1', JSON.stringify({
    accepted: true, analytics: false, pstg: true, version: '1.0',
    timestamp: new Date().toISOString(),
  })));
  // Der Web-Build faellt ohne gesetzte EXPO_PUBLIC_SUPABASE_URL auf die
  // PRODUKTIONS-Instanz zurueck. Nichts davon darf hier hinausgehen.
  let netzversuche = 0;
  await ctx.route('**://*.supabase.co/**', (r) => { netzversuche++; return r.abort(); });
  await ctx.route('**://*.stripe.com/**', (r) => { netzversuche++; return r.abort(); });

  const p = await ctx.newPage();
  const seitenfehler = [];
  p.on('pageerror', (e) => seitenfehler.push(String(e).slice(0, 160)));

  const text = async () => (await p.locator('body').innerText());

  // ── 1. Landing -> Onboarding ────────────────────────────────────────────
  await p.goto(`${BASIS}/landing`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  await p.getByText(/Jetzt (Unterstützung|Handwerker) finden/).first().click();
  await p.waitForTimeout(2000);
  pruefe('Landing fuehrt ins Onboarding', p.url().includes('/onboarding'));

  // ── 2. "Loslegen" -> Startseite ────────────────────────────────────────
  await p.getByText('Loslegen').first().click();
  await p.waitForTimeout(2500);
  pruefe('Onboarding fuehrt auf die Startseite', /Was brauchen Sie|Womit können wir helfen/.test(await text()));

  // ── 3. Kategorie-Kachel -> Assistent ───────────────────────────────────
  const kachel = p.getByText('Sanitär').first();
  pruefe('Kategorie-Kachel vorhanden', await kachel.isVisible().catch(() => false));
  await kachel.click();
  await p.waitForTimeout(2500);
  pruefe('Kachel oeffnet den Auftrags-Assistenten', p.url().includes('/auftrag-aufgeben'));

  // ── 4. Schritt ausfuellen ──────────────────────────────────────────────
  // AUSDRUECKLICH nur SICHTBARE Felder, und ueber die Platzhalter statt ueber
  // die Reihenfolge: expo-router laesst inaktive Screens im DOM stehen, ein
  // schlichtes `input`-Suchmuster greift sonst das E-Mail-Feld des
  // Anmelde-Screens ab (genau daran ist der erste Entwurf dieses Skripts
  // gescheitert -- und haette bei anderer Reihenfolge stillschweigend die
  // falschen Felder befuellt).
  const feld = (platzhalter) => p.locator(`input:visible, textarea:visible`)
    .filter({ has: undefined })
    .and(p.locator(`[placeholder*="${platzhalter}" i]`)).first();

  const sichtbar = await p.locator('input:visible, textarea:visible').count();
  pruefe('Eingabefelder sichtbar', sichtbar >= 4, `${sichtbar} gefunden`);

  // Die Strasse wurde bis 16.08.2026 GAR NICHT erhoben: lib/jobs.ts nimmt sie
  // seit #140 entgegen, das Formular hat sie nie uebergeben. Der Handwerker
  // bekam also nie zu wissen, wohin er fahren soll. Deshalb ist sie hier ein
  // eigener Pruefpunkt und nicht nur beilaeufig mit ausgefuellt.
  const strassenfeld = feld('Stra\u00dfe');
  pruefe('Strassen-Feld vorhanden', await strassenfeld.isVisible().catch(() => false));
  await strassenfeld.fill(STRASSE).catch(() => {});
  await feld('PLZ').fill('50667');
  await feld('Stadt').fill('Koeln');
  const textfelder = await p.locator('input:visible, textarea:visible').all();
  // Titel und Beschreibung tragen projektabhaengige Platzhalter (ph.title /
  // ph.desc je nach Gewerk), deshalb hier ueber die Position der verbleibenden
  // sichtbaren Felder -- PLZ und Stadt sind bereits eindeutig belegt.
  await textfelder[0].fill('Heizkoerper wird nicht warm');
  await textfelder[1].fill(BESCHREIBUNG);
  await p.waitForTimeout(500);

  // ── 5. Durch die restlichen Schritte bis zum Absenden ──────────────────
  // Jeder Schritt hat eine eigene Pflichtangabe; "Weiter" ist bis dahin
  // korrekt gesperrt (disabled + opacity 0.4). Das Skript muss die Angaben
  // also wirklich machen, statt blind zu klicken -- ein Skript, das den
  // gesperrten Knopf antippt und dann aufgibt, wuerde einen echten Fehler
  // ("Weiter greift nicht") nicht von der normalen Bedienung unterscheiden.
  //
  //   Schritt 3: Zeitfenster waehlen
  //   Schritt 4: Einwilligung zur Weitergabe an Anbieter
  //
  // Hoechstens sechs Runden: mehr bedeutet, dass der Assistent haengt -- das
  // soll auffallen, nicht in einer Endlosschleife verschwinden.
  let abschicken = null;
  let amZiel = false;
  for (let i = 0; i < 6; i++) {
    abschicken = p.getByText('Auftrag abschicken').first();
    if (await abschicken.isVisible().catch(() => false)) { amZiel = true; break; }

    const zeitfenster = p.getByText('Ich bin flexibel').first();
    if (await zeitfenster.isVisible().catch(() => false)) {
      await zeitfenster.click();
      await p.waitForTimeout(700);
    }

    const weiter = p.getByText(/^Weiter$/).first();
    if (!(await weiter.isVisible().catch(() => false))) break;
    if (await weiter.isDisabled().catch(() => false)) {
      pruefe('Weiter ist bei fehlender Pflichtangabe gesperrt', true, `Schritt-Runde ${i}`);
      break;
    }
    await weiter.click();
    await p.waitForTimeout(1200);
  }
  pruefe('Assistent erreicht den Absende-Schritt', amZiel);

  // Einwilligung: ohne sie bleibt "Auftrag abschicken" gesperrt -- richtig so,
  // die Weitergabe an Anbieter braucht eine aktive Zustimmung.
  if (amZiel) {
    // Geprueft wird die WIRKUNG, nicht die Auszeichnung. `isDisabled()` trifft
    // bei react-native-web den Text im Knopf, nicht den Knopf selbst, und
    // meldete deshalb faelschlich "nicht gesperrt". Ein Klick, der nichts
    // ausloest, ist der belastbare Nachweis.
    await abschicken.click();
    await p.waitForTimeout(1200);
    const vorschnell = /Anmeldung erforderlich/i.test(await text());
    pruefe('Ohne Einwilligung passiert beim Absenden nichts', !vorschnell);
    if (vorschnell) {
      // Aufraeumen, damit der Rest der Reise weiterlaeuft und der Bericht
      // lesbar bleibt. Ohne das legt sich der Dialog ueber die Seite, der
      // naechste Klick laeuft in einen Timeout, und aus einem klaren Befund
      // wird ein Absturz-Protokoll -- genau das ist beim Erproben dieses
      // Skripts passiert.
      const abbrechen = p.getByText(/^Abbrechen$/).first();
      if (await abbrechen.isVisible().catch(() => false)) {
        await abbrechen.click();
        await p.waitForTimeout(800);
      }
    }

    const einwilligung = p.getByText(/Ich stimme zu, dass Werkant mein Anliegen/).first();
    pruefe('Einwilligungs-Zeile vorhanden', await einwilligung.isVisible().catch(() => false));
    await einwilligung.click({ timeout: 5000 }).catch(() => {
      pruefe('Einwilligung anklickbar', false, 'Klick blockiert');
    });
    await p.waitForTimeout(600);
  }

  // ── 6. Absenden ohne Konto -> Hinweis, KEIN stiller Abbruch ────────────
  if (amZiel) {
    await abschicken.click();
    await p.waitForTimeout(2000);
    pruefe('Mit Einwilligung meldet das Absenden "Anmeldung erforderlich"',
      /Anmeldung erforderlich|melden Sie sich an/i.test(await text()));
  }

  // ── 7. Der teuerste Punkt: ist der Entwurf gesichert? ──────────────────
  const roh = await p.evaluate(() => localStorage.getItem('werkr_job_draft_v1'));
  const entwurf = roh ? JSON.parse(roh) : null;
  pruefe('Entwurf ist gesichert', !!entwurf);
  if (entwurf) {
    pruefe('Beschreibung vollstaendig erhalten',
      entwurf.description === BESCHREIBUNG,
      `${(entwurf.description || '').length} von ${BESCHREIBUNG.length} Zeichen`);
    pruefe('Titel, PLZ und Ort erhalten',
      entwurf.jobTitle === 'Heizkoerper wird nicht warm' && entwurf.plz === '50667' && entwurf.city === 'Koeln');
    // Getrennt geprueft: eine Strasse, die den Entwurf nicht ueberlebt, ist
    // genau der Verlust, wegen dem jemand nicht zurueckkommt.
    pruefe('Strasse ueberlebt den Entwurf', entwurf.street === STRASSE,
      `gesichert: ${JSON.stringify(entwurf.street)}`);
    // Einwilligung gehoert NICHT in einen Entwurf: sie muss aktiv erteilt
    // werden, nicht aus einem Zwischenspeicher wiederauferstehen.
    pruefe('Einwilligung wird NICHT mitgesichert', entwurf.consent === undefined);
  }

  // ── 8. Wiederherstellung beim erneuten Oeffnen ─────────────────────────
  await p.goto(`${BASIS}/auftrag-aufgeben`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(2500);
  const nachher = await text();
  pruefe('Entwurf wird beim erneuten Oeffnen wiederhergestellt',
    nachher.includes('Heizkoerper wird nicht warm') || /wiederhergestellt/i.test(nachher));
  const rest = await p.evaluate(() => localStorage.getItem('werkr_job_draft_v1'));
  pruefe('Entwurf wird nach dem Wiederherstellen geloescht (kein Geisterentwurf)', rest === null);

  // ── 9. Nichts ist nach draussen gegangen ───────────────────────────────
  pruefe('Keine Seitenfehler', seitenfehler.length === 0, seitenfehler.join(' | ').slice(0, 120));
  console.log(schritte.join('\n'));
  console.log(`\n(${netzversuche} Aufrufe an Produktion abgefangen — keiner ist hinausgegangen)`);
  console.log(fehler === 0 ? '=== Reise 1 bestanden ===' : `=== ${fehler} FEHLER in Reise 1 ===`);

  await b.close();
  process.exit(fehler ? 1 : 0);
})();
