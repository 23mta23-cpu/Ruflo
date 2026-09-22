// Kern-Reise 5 — vom Vertrag bis an die Grenze der Zahlung.
//
// Setzt an, wo Reise 4 aufhoert (Annahme -> `accept_offer`). Geprueft wird die
// Strecke, die danach kommt und die bisher in keiner Reise vorkam.
//
// HARTE GRENZE, und sie ist wichtiger als das, was hier gemessen wird:
//
//   app/zahlung.tsx bricht bei `Platform.OS === 'web'` ab, mit dem Hinweis
//   "Bitte laden Sie die Werkant App herunter". Stripes React-Native-Modul ist
//   nur nativ verfuegbar. **Auf der Web-Fassung kann also niemand bezahlen,
//   und zwar unabhaengig davon, ob die Stripe-Schluessel gesetzt sind.** Wer
//   den Geldweg auf der Website erwartet, erwartet etwas, das dort nicht
//   gebaut ist.
//
// Was von hier aus trotzdem pruefbar ist, und es ist das rechtlich heikelste
// Stueck: der Widerrufs-Haken. Ohne ihn darf nichts passieren, und der
// NACHWEIS muss VOR der Zahlung festgehalten werden (0710) -- bis 16.08.2026
// lag die Zustimmung nur in `useState` und verschwand mit dem Bildschirm.
//
// Ausfuehren ueber den Laeufer:  bash scripts/reisen/run.sh
const { chromium } = require('playwright');
const { alsAnbieter, NUTZER_ID } = require('../lib/anbieter-sitzung.cjs');

const BASIS = process.env.BASIS || 'http://localhost:8744';
const CHROME = process.env.CHROME_PFAD
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

const JOB_ID = '00000000-0000-4000-8000-0000000000aa';
const VERTRAG_ID = '00000000-0000-4000-8000-0000000000dd';

// Welcher Betrag gehoert zu diesem Etikett?
//
// Beschriftung und Betrag rendern in react-native-web als GETRENNTE Zeilen.
// Also am Etikett verankern und die naechste Euro-Zahl lesen -- nicht
// fragen, ob ein Betrag irgendwo auf dem Bildschirm vorkommt. Genau daran
// ist die Storno-Zusicherung am 22.09.2026 zuerst gescheitert: die
// Bezugsgroesse stand daneben und machte die Bedingung wahr.
//
// ALLE Vorkommen durchgehen, nicht nur das erste: der Auftragstitel steht
// auf dem Zahlbildschirm zweimal (Ueberschrift der Bestelluebersicht und
// Posten der Aufstellung). `findIndex` nahm die Ueberschrift, dort steht
// kein Betrag, und die Zusicherung meldete „steht nicht da" bei einem
// Bildschirm, der richtig war. Ein Anker, der mehrfach vorkommt, ist kein
// Anker -- dieselbe Klasse wie `interval '12 months'` dreimal in einer
// Migration (16.09.).
function betragZuEtikett(zeilen, etikett) {
  for (let i = 0; i < zeilen.length; i++) {
    if (!zeilen[i].includes(etikett)) continue;
    for (let k = i; k < Math.min(i + 3, zeilen.length); k++) {
      const m = zeilen[k].match(/€[\d.]+,\d\d/);
      if (m) return m[0];
    }
  }
  return null;
}

let fehler = 0;
function pruefe(name, bedingung, detail = '') {
  const ok = !!bedingung;
  if (!ok) fehler++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  return ok;
}

const auftrag = {
  id: JOB_ID, customer_id: NUTZER_ID, provider_id: '00000000-0000-4000-8000-0000000000ee',
  title: 'Steckdose im Flur erneuern', description: 'Eine Steckdose neben der Wohnungstuer.',
  category: 'Elektro', category_id: 'elektro', address_plz: '50667', address_city: 'Köln',
  track: 'handwerker', status: 'contracted', created_at: new Date().toISOString(),
  benachrichtigte_betriebe: 3, benachrichtigt_am: new Date().toISOString(),
};

// Die Spalten heissen wirklich so (0021): `price_gross`, `customer_total`,
// `provider_payout` — NICHT `price`. Mein erster Entwurf schrieb `price: 320`,
// und der Bildschirm zeigte folgerichtig ueberall 0,00 EUR. Ein Pruefstand mit
// erfundenen Spaltennamen misst den Pruefstand, nicht das Produkt.
//
// `job:` ist ein eingebetteter Verbund: der Bildschirm fragt
// `contracts?select=*,job:jobs!job_id(...)`. Fehlt das Unterobjekt, steht
// „Dienstleistung" statt des Auftragstitels da — auch das sah zuerst wie ein
// Produktfehler aus.
const vertrag = {
  id: VERTRAG_ID, job_id: JOB_ID,
  customer_id: NUTZER_ID, provider_id: '00000000-0000-4000-8000-0000000000ee',
  price_gross: 320, customer_service_fee: 8, werkr_schutz_fee: 0,
  provider_commission: 21.2, customer_total: 328, provider_payout: 298.8,
  status: 'active', track: 'handwerker',
  created_at: new Date().toISOString(),
  customer_signed_at: null, provider_signed_at: null,
  stripe_payment_intent: null, escrow_captured_at: null, escrow_released_at: null,
  job: {
    id: JOB_ID, title: 'Steckdose im Flur erneuern', category: 'Elektro',
    address_city: 'Köln', address_plz: '50667',
    description: 'Eine Steckdose neben der Wohnungstuer.',
  },
};

async function main() {
  const b = await chromium.launch({ executablePath: CHROME });
  const daten = {
    jobs: [auftrag], contracts: [vertrag], offers: [], auth_email_confirmed: true,
    // Die Namen der Vertragsparteien kommen ueber einen eigenen Aufruf; ohne
    // ihn steht zweimal „Name fehlt" da, und die Reise wuerde eine fehlende
    // Antwort des Pruefstands als Produktfehler melden.
    vertrag_partner: [{
      contract_id: VERTRAG_ID,
      kunde_name: 'Tayyip B.',
      anbieter_name: 'Elektrotechnik Wassermann GmbH',
    }],
  };

  // ── Teil A: der Vertrag zeigt, worauf man sich geeinigt hat ──────────────
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, { rolle: 'customer', daten });
    const s = await ctx.newPage();
    await s.goto(`${BASIS}/vertrag?contractId=${VERTRAG_ID}&jobId=${JOB_ID}`, { waitUntil: 'networkidle' });
    await s.waitForTimeout(1600);
    const text = await s.locator('body').innerText();

    pruefe('A1 Der Vertrag nennt die Leistung',
      /Steckdose im Flur erneuern/.test(text),
      text.includes('Anmelden') ? 'zeigt die Anmeldung, Sitzungs-Ersatz greift nicht' : text.slice(0, 120).replace(/\n/g, ' | '));
    pruefe('A2 Der Vertrag nennt den Preis', /320/.test(text));
    pruefe('A3 Der Vertrag nennt beide Parteien beim Namen',
      /Tayyip B\./.test(text) && /Wassermann/.test(text) && !/Name fehlt/.test(text),
      /Name fehlt/.test(text) ? 'es steht „Name fehlt" darauf' : '');
    await ctx.close();
  }

  // ── Teil B: der Widerrufs-Haken sperrt die Zahlung ───────────────────────
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, { rolle: 'customer', daten });
    const s = await ctx.newPage();
    await s.goto(`${BASIS}/zahlung?contractId=${VERTRAG_ID}`, { waitUntil: 'networkidle' });
    await s.waitForTimeout(1600);
    const text = await s.locator('body').innerText();

    pruefe('B1 Der Widerrufstext steht da, nicht nur ein Haken',
      /Widerruf/i.test(text), text.slice(0, 140).replace(/\n/g, ' | '));
    pruefe('B2 Die Servicegebuehr ist ausgewiesen', /Servicegebühr|Service-Gebühr/i.test(text));
    pruefe('B3 Der Gesamtbetrag steht da', /Gesamt|zu zahlen/i.test(text));

    const zahlen = s.locator('[role="button"]:visible').filter({ hasText: /Jetzt zahlen/i }).first();
    pruefe('B4 Der Zahlknopf ist als Knopf ausgezeichnet', await zahlen.count() > 0);

    if (await zahlen.count()) {
      // OHNE Haken: der Knopf muss gesperrt sein. Seit die Rollen gesetzt sind
      // (16.09.2026) steht `disabled` wirklich im DOM und ist damit auch fuer
      // eine Bedienungshilfe erkennbar.
      const gesperrt = await zahlen.isDisabled().catch(() => false);
      pruefe('B5 Ohne Widerrufs-Haken ist die Zahlung gesperrt', gesperrt);

      // Und die Wirkung, nicht nur die Auszeichnung.
      await zahlen.click({ force: true }).catch(() => {});
      await s.waitForTimeout(900);
      const schreiben = (ctx.__aufrufe || []).filter((a) => a.verb !== 'GET');
      pruefe('B6 Ohne Haken wird auch nichts festgehalten',
        !schreiben.some((a) => /widerruf/i.test(a.name)),
        schreiben.map((a) => `${a.verb} ${a.name}`).join(', ') || 'keine Schreibaufrufe');
    }
    await ctx.close();
  }

  // ── Teil C: mit Haken wird der Nachweis VOR der Zahlung festgehalten ─────
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, { rolle: 'customer', daten });
    const s = await ctx.newPage();
    await s.goto(`${BASIS}/zahlung?contractId=${VERTRAG_ID}`, { waitUntil: 'networkidle' });
    await s.waitForTimeout(1600);

    // Die AUFSTELLUNG, bevor der Kunde zahlt.
    //
    // ANLASS (22.09.2026): Keine einzige der vier Zahlen auf diesem
    // Bildschirm war zugesichert. § 312j Abs. 2 BGB verlangt den
    // Gesamtpreis unmittelbar vor dem Bestellknopf; eine vertauschte
    // Groesse (Werklohn statt Gesamtbetrag) faellt sonst erst auf der
    // Kontoabrechnung auf.
    //
    // Beschriftung und Betrag rendern als GETRENNTE Zeilen. Deshalb wird am
    // Etikett verankert und die naechste Euro-Zahl gelesen -- nicht
    // gefragt, ob ein Betrag irgendwo vorkommt. Genau daran ist die
    // Storno-Zusicherung heute frueh zuerst gescheitert: 328 stand als
    // Bezugsgroesse daneben und machte die Bedingung wahr.
    {
      const zeilen = (await s.locator('body').innerText()).split('\n').map((z) => z.trim());
      const betragNach = (etikett) => betragZuEtikett(zeilen, etikett);
      const posten = [
        ['C0a Der Werklohn steht mit seinem Betrag da', 'Steckdose im Flur erneuern', '€320,00'],
        ['C0b Die Servicegebuehr steht getrennt daneben', 'Servicegebühr', '€8,00'],
        ['C0c Und der Gesamtbetrag ist die Summe, nicht der Werklohn', 'Gesamtbetrag', '€328,00'],
      ];
      for (const [name, etikett, erwartet] of posten) {
        const ist = betragNach(etikett);
        pruefe(name, ist === erwartet,
          ist === null ? `„${etikett}" steht nicht da` : `„${etikett}" nennt ${ist}, erwartet ${erwartet}`);
      }
    }

    // Den Haken setzen: er haengt an der Zeile mit dem Zustimmungstext.
    const haken = s.locator('[role="button"]:visible, [role="checkbox"]:visible')
      .filter({ hasText: /Widerruf|widerrufe|Kenntnis/i }).first();
    if (await haken.count()) {
      await haken.click().catch(() => {});
      await s.waitForTimeout(500);
    }

    const zahlen = s.locator('[role="button"]:visible').filter({ hasText: /Jetzt zahlen/i }).first();
    const nunFrei = await zahlen.count() ? !(await zahlen.isDisabled().catch(() => true)) : false;
    pruefe('C1 Mit Haken ist die Zahlung freigegeben', nunFrei,
      await haken.count() ? '' : 'Haken nicht gefunden');

    if (nunFrei) {
      await zahlen.click().catch(() => {});
      await s.waitForTimeout(1600);
      const text = await s.locator('body').innerText();
      // Auf Web bricht die Zahlung ab (Stripe ist nur nativ). Das ist die
      // Grenze dieser Reise und zugleich der Befund, den sie festhaelt.
      pruefe('C2 Auf der Web-Fassung endet der Geldweg mit einem Hinweis auf die App',
        /Werkant App|nur in der mobilen App|Zahlung via App/i.test(text),
        text.slice(0, 160).replace(/\n/g, ' | '));
    }
    await ctx.close();
  }

  // ── Teil D: die Stornostufe wird live gerechnet, nicht eingefroren ───────
  //
  // Bis zum 16.09.2026 kam der Satz aus einem URL-Parameter, den der Aufrufer
  // vorher gerundet hatte. Die Edge Function rechnet live aus `scheduled_at`:
  // bei 48,4 Stunden zeigte der Bildschirm 50 % und der Server erstattete
  // 100 %. Geprueft wird deshalb an beiden Kanten.
  {
    // Die STUFE als Text reicht nicht. Der Kunde liest unmittelbar vor einer
    // unumkehrbaren Handlung einen EURO-BETRAG, und der haengt an der
    // Bezugsgroesse: `customer_total` (328) ist das, was er gezahlt hat,
    // `price_gross` (320) waere der Werklohn ohne Servicegebuehr. Die
    // Vorgabedaten sind absichtlich so gewaehlt, dass beide verschieden
    // sind -- sonst waere eine vertauschte Bezugsgroesse nicht messbar.
    //
    // Bei 0 % ist der Betrag in beiden Faellen 0,00 EUR. D6 kann die
    // Verwechslung also nicht fangen; es faengt „zeigt gar nichts" und
    // „zeigt den vollen Betrag". Das steht hier, damit niemand D6 fuer
    // mehr haelt, als es ist.
    const faelle = [
      { stunden: 48.4, erwartet: /Volle Rückerstattung/i, betrag: '€328,00',
        name: 'D1 48,4 Stunden ergibt volle Erstattung (nicht gerundet auf 48)',
        betragName: 'D4 und nennt den vollen Betrag aus customer_total' },
      { stunden: 36,   erwartet: /50 ?% Rückerstattung/i, betrag: '€164,00',
        name: 'D2 36 Stunden ergibt die halbe Erstattung',
        betragName: 'D5 und nennt die Haelfte von customer_total, nicht von price_gross' },
      { stunden: 12,   erwartet: /Keine Rückerstattung/i, betrag: '€0,00',
        name: 'D3 12 Stunden ergibt keine Erstattung',
        betragName: 'D6 und nennt ausdruecklich 0,00 EUR' },
    ];
    for (const f of faelle) {
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
      await alsAnbieter(ctx, { rolle: 'customer', daten });
      const s = await ctx.newPage();
      const termin = new Date(Date.now() + f.stunden * 3_600_000).toISOString();
      await s.goto(`${BASIS}/stornierung?contractId=${VERTRAG_ID}&jobTitle=Test&scheduledAt=${encodeURIComponent(termin)}`,
        { waitUntil: 'networkidle' });
      await s.waitForTimeout(1200);
      const text = await s.locator('body').innerText();
      pruefe(f.name, f.erwartet.test(text), text.slice(0, 130).replace(/\n/g, ' | '));

      // NUR die eine Zeile, und die Zahlen darin in der REIHENFOLGE.
      //
      // Erster Entwurf pruefte, ob beide Betraege irgendwo im Bildschirm
      // vorkommen. Unter der Mutation „Bezugsgroesse auf price_gross" blieb
      // D4 damit GRUEN: erstattet wurden 320,00, und die 328,00 stand als
      // Bezugsgroesse daneben -- die Bedingung war erfuellt, die Anzeige
      // trotzdem falsch. Dieselbe Klasse wie der Teilstring „Pflicht"
      // (22.09.) und wie `is_nachbarschaft` zweimal in einer Datei.
      //
      // „Voraussichtliche Erstattung" ist bewusst der Anker: das Wort
      // „voraussichtlich" ist hier die rechtlich gemeinte Einschraenkung
      // (verbindlich rechnet die Edge Function). Wer den Satz umschreibt,
      // soll diese Zusicherung ROT sehen und nicht still verlieren.
      const zeile = text.split('\n').find((z) => z.includes('Voraussichtliche Erstattung'));
      const zahlen = (zeile || '').match(/€[\d.]+,\d\d/g) || [];
      pruefe(f.betragName,
        zahlen[0] === f.betrag && zahlen[1] === '€328,00',
        zeile ? `„${zeile.trim()}"` : 'die Zeile „Voraussichtliche Erstattung" fehlt');
      await ctx.close();
    }
  }

  // ── Teil E: ein Vertrag ohne Leistungsgegenstand ────────────────────────
  //
  // ANLASS (21.09.2026): `app/vertrag.tsx` zeigte `job?.title ??
  // 'Dienstleistung'`. Der Fall tritt ein, wenn der Vertrag laedt, das
  // eingebettete `job` aber nicht -- geloescht, oder RLS verbirgt es.
  // „Dienstleistung" benennt keinen Leistungsgegenstand, und § 631 BGB
  // verlangt einen bestimmten. Wer bestaetigt, stimmt dann einem Vertrag zu,
  // dessen Gegenstand er nicht sieht.
  //
  // GEPRUEFT WIRD DIE WIRKUNG, nicht die Auszeichnung: der Quelltext-Pruefer
  // (versprechen-check.py) sieht den Ersatztitel, aber nicht, ob der Knopf
  // wirklich gesperrt ist.
  {
    const ohneJob = { ...vertrag };
    delete ohneJob.job;
    const datenOhneJob = { ...daten, contracts: [ohneJob] };

    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, { rolle: 'customer', daten: datenOhneJob });
    const s = await ctx.newPage();
    await s.goto(`${BASIS}/vertrag?contractId=${VERTRAG_ID}`, { waitUntil: 'networkidle' });
    await s.waitForTimeout(1600);
    const text = await s.locator('body').innerText();

    pruefe('E1 Ohne Leistungsgegenstand wird keiner erfunden',
      !/Leistung\s*\n?\s*Dienstleistung/i.test(text),
      text.slice(0, 130).replace(/\n/g, ' | '));
    pruefe('E2 Der Bildschirm sagt, dass die Leistung fehlt',
      /Leistung konnte nicht geladen werden|konnte nicht geladen werden/i.test(text),
      text.slice(0, 130).replace(/\n/g, ' | '));

    // GEFUNDEN, weil E5 in der Gegenprobe gruen blieb: an derselben Stelle
    // lagen ZWEI Leisten uebereinander. `lage.zahlbar` und
    // `status === 'active'` schliessen sich nicht aus, wenn kein Geld
    // hinterlegt ist, und beide Leisten sind absolut am unteren Rand. Der
    // spaeter gerenderte verdeckte den Zahlknopf vollstaendig.
    const leisten = await s.evaluate(() => [...document.querySelectorAll('[role="button"]')]
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 300 && r.height > 40 && r.top > window.innerHeight - 140;
      }).length);
    pruefe('E0 Am unteren Rand liegt genau EIN grosser Knopf', leisten === 1,
      `gemessen: ${leisten}`);

    const bestaetigen = s.locator('[role="button"]:visible')
      .filter({ hasText: 'Vertrag bestätigen' }).first();
    const da = await bestaetigen.count() > 0;
    pruefe('E3 Der Bestaetigen-Knopf ist ueberhaupt da', da);
    if (da) {
      // Auszeichnung UND Wirkung, wie seit dem 16.09. Standard: `disabled`
      // im DOM, und ein Klick fuehrt nirgendwohin.
      const gesperrt = await bestaetigen.isDisabled().catch(() => false);
      pruefe('E4 Ohne Leistungsgegenstand ist er gesperrt', gesperrt);
      const vorher = s.url();
      await bestaetigen.click({ timeout: 2000 }).catch(() => {});
      await s.waitForTimeout(600);
      pruefe('E5 Und ein Klick fuehrt nicht zur Zahlung',
        s.url() === vorher && !s.url().includes('/zahlung'), s.url());
    }
    await ctx.close();
  }

  // -- Teil F: der Beleg -----------------------------------------------------
  //
  // ANLASS (22.09.2026): `/rechnung` wurde bisher nur mit einer Null-Kennung
  // geoeffnet (geldwege-check) -- also ohne eine einzige Zahl. Der Beleg ist
  // aber ein Abrechnungsdokument: er nennt, was der Kunde zahlt, was der
  // Anbieter bekommt, welche Gebuehr Werkant einbehaelt und welche
  // Umsatzsteuer darin steckt (§ 3a UStG).
  //
  // Die Zahlen haengen zusammen: 320 + 8 = 328, und 320 - 21,20 = 298,80.
  // Eine vertauschte Groesse verletzt eine dieser beiden Gleichungen.
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, { rolle: 'customer', daten });
    const s = await ctx.newPage();
    await s.goto(`${BASIS}/rechnung?contractId=${VERTRAG_ID}`, { waitUntil: 'networkidle' });
    await s.waitForTimeout(2000);
    const zeilen = (await s.locator('body').innerText()).split('\n').map((z) => z.trim());

    const posten = [
      ['F1 Der Beleg nennt den Auftragswert', 'Auftragswert (Brutto)', '\u20ac320,00'],
      ['F2 Und was der Kunde insgesamt zahlt', 'Gesamtbetrag (Sie zahlen)', '\u20ac328,00'],
      ['F3 Und was beim Anbieter ankommt', 'Auszahlung an Anbieter', '\u20ac298,80'],
      ['F4 Die einbehaltene Gebuehr steht getrennt', 'Plattformgeb\u00fchr', '\u20ac21,20'],
      ['F5 Mit der darin enthaltenen Umsatzsteuer (\u00a7 3a UStG)', 'darin enthalten USt', '\u20ac3,38'],
    ];
    for (const [name, etikett, erwartet] of posten) {
      const ist = betragZuEtikett(zeilen, etikett);
      pruefe(name, ist === erwartet,
        ist === null ? `\u201e${etikett}" steht nicht auf dem Beleg` : `\u201e${etikett}" nennt ${ist}, erwartet ${erwartet}`);
    }

    // GEGENPROBE: ohne sie waere ein Beleg gruen, der gar keine Aufstellung
    // zeigt und die erwarteten Zahlen zufaellig anderswo nennt.
    pruefe('F6 GEGENPROBE: der Beleg traegt eine Belegnummer aus dem Vertrag',
      zeilen.some((z) => /^WRK-[0-9A-F]{8}$/.test(z)),
      zeilen.find((z) => z.startsWith('WRK-')) || 'keine Belegnummer');

    // Und was beim Weitergeben WIRKLICH herausgeht.
    //
    // Der Beleg auf dem Bildschirm und die Datei sind zwei verschiedene
    // Texte: `handleShare` baut eine eigene Zeile aus `priceGross`,
    // `providerPayout` und `providerCommission`. Ein Bildschirm kann also
    // stimmen und die Datei trotzdem falsche Zahlen tragen.
    // Die Technik stammt aus Reise 12 (F3), nicht von mir.
    const teilen = s.locator('[aria-label="Beleg teilen"]').first();
    pruefe('F7 Es gibt einen Knopf zum Weitergeben', await teilen.count() === 1,
      `${await teilen.count()} gefunden`);
    if (await teilen.count() === 1) {
      const [ladung] = await Promise.all([
        s.waitForEvent('download', { timeout: 10000 }).catch(() => null),
        teilen.click().catch(() => {}),
      ]);
      pruefe('F8 Der Knopf gibt wirklich eine Datei heraus', ladung !== null,
        ladung ? ladung.suggestedFilename() : 'kein Download ausgeloest');
      if (ladung) {
        const pfad = await ladung.path();
        const inhalt = pfad ? require('fs').readFileSync(pfad, 'utf8') : '';
        const zeile = (etikett) => (inhalt.split('\n').find((z) => z.startsWith(etikett)) || '').trim();
        pruefe('F9 Die Datei nennt denselben Auftragswert wie der Bildschirm',
          zeile('Auftragswert:') === 'Auftragswert: \u20ac320,00', zeile('Auftragswert:') || 'keine Zeile');
        pruefe('F10 Dieselbe Auszahlung',
          zeile('Auszahlung:') === 'Auszahlung: \u20ac298,80', zeile('Auszahlung:') || 'keine Zeile');
        pruefe('F11 Und dieselbe Gebuehr',
          zeile('Geb\u00fchr:') === 'Geb\u00fchr: \u20ac21,20', zeile('Geb\u00fchr:') || 'keine Zeile');
      }
    }
    await ctx.close();
  }

  await b.close();
  console.log(fehler ? `\n${fehler} Befund(e).` : '\nReise 5: alles wie erwartet.');
  console.log('HINWEIS: Auf der Web-Fassung ist der Geldweg konstruktionsbedingt zu Ende.');
  console.log('         Stripe laeuft nur nativ. Zahlung, Escrow, Abnahme und');
  console.log('         Auszahlung bleiben aus dem Browser heraus UNGEPRUEFT.');
  process.exit(fehler ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
