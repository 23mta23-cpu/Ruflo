// Kern-Reise 2 — der Weg eines Anbieters, so weit er ohne Datenbank fuehrt.
//
// Landing -> "Als Anbieter registrieren" -> Onboarding -> "Bewerben" ->
// Registrierung mit vorgewaehlter Rolle -> Anbieter-Verifizierung (KYC).
//
// HARTE GRENZE, ehrlich benannt: Ab Schritt 3 des Handwerks-Tracks verlangt
// die Verifizierung einen Gewerbeschein-Upload in Supabase Storage. Alles
// danach -- offene Auftraege sehen, Angebot abgeben, Annahme, Vertrag aktiv,
// Escrow, Auszahlung -- ist von hier aus NICHT pruefbar und gilt als
// ungeprueft. Dieses Skript behauptet nichts darueber.
//
// Was hier geprueft wird, ist trotzdem nicht wenig: die Rollen-Vorauswahl, die
// Pflichtfelder (ohne sie landeten leere Bewerbungen in der Pruef-Queue,
// Tester-Befund 20.07.) und der 18+-Riegel.
//
// Ausfuehren ueber den Laeufer:  bash scripts/reisen/run.sh
const { chromium } = require('playwright');

const BASIS = process.env.BASIS || 'http://localhost:8744';
const CHROME = process.env.CHROME_PFAD
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

let fehler = 0;
// Sofort ausgeben statt sammeln: bricht das Skript spaeter ab, ist der bis
// dahin erarbeitete Befund trotzdem lesbar. Beim Erproben ist genau das
// passiert -- die Mutationsprobe wurde erkannt, aber der Bericht ging im
// Stacktrace unter, weil er erst am Ende gedruckt wurde.
function pruefe(name, bedingung, detail = '') {
  const ok = !!bedingung;
  if (!ok) fehler++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  return ok;
}

async function neueSeite(b) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => localStorage.setItem('werkr_consent_v1', JSON.stringify({
    accepted: true, analytics: false, pstg: true, version: '1.0',
    timestamp: new Date().toISOString(),
  })));
  // Der Web-Build zielt ohne gesetzte EXPO_PUBLIC_SUPABASE_URL auf die
  // PRODUKTIONS-Instanz. Nichts geht hinaus, und es wird gezaehlt.
  const zaehler = { n: 0 };
  await ctx.route('**://*.supabase.co/**', (r) => { zaehler.n++; return r.abort(); });
  await ctx.route('**://*.stripe.com/**', (r) => { zaehler.n++; return r.abort(); });
  const p = await ctx.newPage();
  return { ctx, p, zaehler };
}

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  let abgefangen = 0;

  // ── 1. Landing bis Registrierung, Rolle vorgewaehlt ────────────────────
  {
    const { ctx, p, zaehler } = await neueSeite(b);
    await p.goto(`${BASIS}/landing`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(1500);
    await p.getByText('Als Anbieter registrieren').first().click();
    await p.waitForTimeout(2000);
    pruefe('Landing fuehrt ins Onboarding', p.url().includes('/onboarding'));

    await p.getByText('Bewerben').first().click();
    await p.waitForTimeout(2500);
    pruefe('"Bewerben" fuehrt zur Registrierung mit Anbieter-Rolle',
      p.url().includes('/registrierung') && p.url().includes('anbieter'),
      p.url().replace(BASIS, ''));

    const txt = await p.locator('body').innerText();
    pruefe('Registrierung zeigt den ersten Schritt', /Schritt 1|Zugangsdaten/i.test(txt));
    // Der Weg zurueck zur Anmeldung muss von hier aus offenstehen -- wer schon
    // ein Konto hat, darf nicht in der Registrierung festsitzen.
    pruefe('Weg zur Anmeldung vorhanden', /Bereits registriert/i.test(txt));
    abgefangen += zaehler.n;
    await ctx.close();
  }

  // ── 2. Verifizierung, Handwerks-Track: Pflichtfelder ───────────────────
  // Tester-Befund 20.07.: Schritt 1 und 2 waren komplett leer passierbar,
  // dadurch landeten leere Bewerbungen in der Pruef-Queue. Diese Zusicherung
  // haelt den Fix fest.
  {
    const { ctx, p, zaehler } = await neueSeite(b);
    await p.goto(`${BASIS}/onboarding-kyc?track=handwerker`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(2500);
    pruefe('Handwerks-Track startet bei Schritt 1 von 4',
      /Schritt 1 von 4/.test(await p.locator('body').innerText()));

    // Leer weiterklicken darf NICHT durchgehen.
    await p.getByText(/^Weiter$/).first().click();
    await p.waitForTimeout(1200);
    const nachLeer = await p.locator('body').innerText();
    pruefe('Leerer Schritt 1 kommt nicht durch',
      /Schritt 1 von 4/.test(nachLeer) && /vollständigen Namen|gültige/i.test(nachLeer));

    // Mit gueltigen Angaben muss er durchgehen -- sonst waere die Schranke
    // kein Schutz, sondern eine Sackgasse.
    await p.locator('[placeholder="Max Mustermann"]').first().fill('Erika Mustermann');
    await p.locator('[placeholder*="+49" i]').first().fill('+49 221 1234567');
    await p.locator('[placeholder*="beispiel.de" i]').first().fill('erika@beispiel.de');
    await p.waitForTimeout(400);
    await p.getByText(/^Weiter$/).first().click();
    await p.waitForTimeout(1500);
    pruefe('Mit gueltigen Angaben geht es weiter',
      /Schritt 2 von 4/.test(await p.locator('body').innerText()));
    abgefangen += zaehler.n;
    await ctx.close();
  }

  // ── 3. Verifizierung, Nachbarschaft: der 18+-Riegel ────────────────────
  // Rechtlich verbindlich (JArbSchG; Minderjaehrige sind ausgeschlossen).
  // Die Pruefung greift LIVE beim Tippen -- frueher zeigte das Feld bei jedem
  // vollstaendigen Datum "bestaetigt" an, auch bei Minderjaehrigen, und der
  // rote Hinweis kam erst nach dem Klick auf "Weiter".
  {
    const { ctx, p, zaehler } = await neueSeite(b);
    await p.goto(`${BASIS}/onboarding-kyc?track=nachbarschaft`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(2500);

    await p.locator('[placeholder="Max Mustermann"]').first().fill('Erika Mustermann');
    await p.locator('[placeholder*="+49" i]').first().fill('+49 221 1234567');

    // Ein Geburtsdatum, das heute genau 17 Jahre ergibt.
    const heute = new Date();
    const minderjaehrig = new Date(heute.getFullYear() - 17, heute.getMonth(), heute.getDate());
    const tt = String(minderjaehrig.getDate()).padStart(2, '0');
    const mm = String(minderjaehrig.getMonth() + 1).padStart(2, '0');
    await p.locator('[placeholder="TT.MM.JJJJ"]').first().fill(`${tt}${mm}${minderjaehrig.getFullYear()}`);
    await p.waitForTimeout(900);

    const beiMinderjaehrig = await p.locator('body').innerText();
    pruefe('17-Jaehrige/r wird SOFORT beim Tippen abgewiesen',
      /Mindestalter: 18|nicht für Minderjährige/i.test(beiMinderjaehrig));
    pruefe('Das Alter wird dabei benannt, nicht nur "ungueltig"',
      /Sie sind 17 Jahre alt/i.test(beiMinderjaehrig));

    // Und der Riegel muss halten, wenn man trotzdem weiterklickt.
    await p.getByText(/^Weiter$/).first().click();
    await p.waitForTimeout(1200);
    pruefe('Weiterklicken bringt Minderjaehrige nicht durch',
      /Schritt 1 von 2/.test(await p.locator('body').innerText()));

    // Gegenprobe: volljaehrig kommt durch. Ohne sie wuerde ein Riegel, der
    // ALLE aussperrt, als Erfolg durchgehen.
    const volljaehrig = new Date(heute.getFullYear() - 30, heute.getMonth(), heute.getDate());
    const tt2 = String(volljaehrig.getDate()).padStart(2, '0');
    const mm2 = String(volljaehrig.getMonth() + 1).padStart(2, '0');
    const datumsfeld = p.locator('[placeholder="TT.MM.JJJJ"]').first();
    if (await datumsfeld.isVisible().catch(() => false)) {
      await datumsfeld.fill(`${tt2}${mm2}${volljaehrig.getFullYear()}`);
      await p.waitForTimeout(900);
      pruefe('30-Jaehrige/r bekommt keinen Altersfehler',
        !/Mindestalter: 18/i.test(await p.locator('body').innerText()));
    } else {
      // Kein Datumsfeld mehr heisst: der Minderjaehrige ist durchgekommen und
      // der Assistent steht bereits auf dem naechsten Schritt.
      pruefe('30-Jaehrige/r bekommt keinen Altersfehler', false,
        'Datumsfeld nicht mehr da — der Riegel hat nicht gehalten');
    }
    abgefangen += zaehler.n;
    await ctx.close();
  }

  console.log(`\n(${abgefangen} Aufrufe an Produktion abgefangen — keiner ist hinausgegangen)`);
  console.log('HINWEIS: ab Gewerbeschein-Upload nicht pruefbar — Angebot, Annahme,');
  console.log('         Vertrag, Escrow und Auszahlung bleiben UNGEPRUEFT.');
  console.log(fehler === 0 ? '=== Reise 2 bestanden (bis zur Grenze) ===' : `=== ${fehler} FEHLER in Reise 2 ===`);
  await b.close();
  process.exit(fehler ? 1 : 0);
})();
