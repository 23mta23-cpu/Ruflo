// Prueft, dass ein ABGEMELDETER Besucher unter den mehrdeutigen Adressen
// NICHT in der Anbieter-Oberflaeche landet.
//
// Hintergrund: `auftraege` und `nachrichten` existieren in BEIDEN
// Routen-Gruppen -- app/betrieb/ und app/(tabs)/ -- und Routen-Gruppen
// erzeugen kein Adress-Segment. Beide Dateien beanspruchen damit dieselbe
// sichtbare Adresse. Befund vom 15.08.2026: wer abgemeldet ein Lesezeichen
// oeffnete oder einen geteilten Link anklickte, bekam unter /auftraege das
// Handwerker-Dashboard samt "Escrow (aktiv)" und "Ausgezahlt gesamt" zu sehen
// -- dieselbe Vermischung wie im Founder-Report vom 16.07., nur ueber die
// Adresse statt ueber die Navigation.
//
// WICHTIG: Dieses Skript prueft die ABMILDERUNG (Rollen-Riegel in
// app/betrieb/_layout.tsx), nicht die Wurzel. Die Adressen bleiben
// mehrdeutig, bis die Anbieter-Gruppe ein eigenes Pfad-Segment bekommt.
//
// Ausfuehren:
//   npx expo export --platform web
//   python3 scripts/spa-server.py &      # nach JEDEM Export neu starten
//   node scripts/rollen-routen-check.cjs
const { chromium } = require('playwright');

// Formulierungen, die AUSSCHLIESSLICH in der Anbieter-Oberflaeche vorkommen.
// Je Screen mindestens eine, sonst rutscht genau der Screen durch, der keinen
// Marker hat -- beim Aufbau dieses Skripts ist /nachrichten zunaechst gruen
// geblieben, obwohl es die Anbieter-Ansicht zeigte.
//   auftraege   : Kennzahlen des Anbieter-Dashboards
//   nachrichten : Anbieter-Texte sind in der Du-Form, Kunden-Texte siezen
const ANBIETER_MARKER = [
  /Escrow \(aktiv\)/i,
  /Ausgezahlt gesamt/i,
  /Umsatz/i,
  /Stelle bei einer unklaren Anfrage/i,
  /Anfragen\s*\|?\s*Aktiv\s*\|?\s*Ausstehend/i,
];
const ROUTEN = ['/auftraege', '/nachrichten', '/profil'];

// Seit dem Routen-Umbau hat der Anbieter-Bereich ein eigenes Pfad-Segment
// (app/betrieb/ statt der Gruppe app/(provider)/). Diese Adressen sind
// eindeutig -- sie DUERFEN die Anbieter-Oberflaeche zeigen, aber nur fuer
// angemeldete Anbieter. Abgemeldet gehoert dorthin die Anmeldung.
const BETRIEB_ROUTEN = ['/betrieb/dashboard', '/betrieb/auftraege', '/betrieb/nachrichten'];
const BASIS = process.env.BASIS || 'http://localhost:8744';
const CHROME = process.env.CHROME_PFAD
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  let fehler = 0;
  for (const route of [...ROUTEN, ...BETRIEB_ROUTEN]) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(() => localStorage.setItem('werkr_consent_v1', JSON.stringify({
      accepted: true, analytics: false, pstg: true, version: '1.0',
      timestamp: new Date().toISOString(),
    })));
    // Niemals gegen Produktion: der Web-Build faellt ohne gesetzte
    // EXPO_PUBLIC_SUPABASE_URL auf die Produktions-Instanz zurueck.
    await ctx.route('**://*.supabase.co/**', (r) => r.abort());
    const p = await ctx.newPage();
    await p.goto(BASIS + route, { waitUntil: 'networkidle' });
    await p.waitForTimeout(2200);

    const txt = await p.locator('body').innerText();
    const treffer = ANBIETER_MARKER.filter((rx) => rx.test(txt)).map((rx) => rx.source);
    // Leer ist auch nicht in Ordnung: der Besucher braucht einen Weg weiter.
    const leer = txt.trim().length < 20;
    // Und "Seite nicht gefunden" schon gar nicht. Ohne diese Pruefung war der
    // Test falsch gruen: bei der Mutationsprobe (Anbieter-Verzeichnis zurueck
    // in eine Routen-Gruppe) lieferten ALLE /betrieb/-Adressen "Unmatched
    // Route" -- lang genug, um nicht als leer zu gelten, und ohne
    // Anbieter-Marker. Der Test haette also nicht gemerkt, dass der gesamte
    // Anbieterbereich nicht mehr erreichbar ist.
    const tot = /Unmatched Route|Page could not be found|Seite .*nicht gefunden/i.test(txt);
    const ok = treffer.length === 0 && !leer && !tot;
    if (!ok) fehler++;
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${route.padEnd(22)} ` +
      (treffer.length ? `Anbieter-Inhalt sichtbar: ${treffer.join(', ')}` :
       tot ? 'Adresse loest nicht auf — toter Link' :
       leer ? 'leere Seite — keine Sackgasse anbieten' :
       `-> ${txt.replace(/\n+/g, ' | ').slice(0, 60)}`),
    );
    await ctx.close();
  }
  console.log(fehler === 0 ? `\n=== alle ${ROUTEN.length + BETRIEB_ROUTEN.length} Routen PASS ===` : `\n=== ${fehler} FEHLER ===`);
  await b.close();
  process.exit(fehler ? 1 : 0);
})();
