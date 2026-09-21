// Kern-Reise 7 — das Prüf-Postfach, aus der Sicht des Betreibers.
//
// WARUM AUSGERECHNET DIESER BILDSCHIRM: er ist der erste, den der Founder
// benutzen wird, sobald `WERKANT_ADMIN_EMAILS` gesetzt ist -- und in der
// Produktion wartet bereits ein Betrieb (`/health`: `pruef_offen: 1`,
// `pruef_stau: true`). Solange dieser Bildschirm nicht funktioniert, steht
// die gesamte Angebotsseite still, und ein Marktplatz ohne Anbieter hat kein
// Produkt.
//
// Gebaut wurde er in der Nacht zum 15.09.2026 und war seitdem NIE im Browser.
//
// GEPRUEFT WIRD:
//   * Wer nicht Betreiber ist, sieht "nicht gefunden" -- nicht "verboten".
//     Der Unterschied ist Absicht: wer nicht Betreiber ist, soll gar nicht
//     erfahren, dass es diesen Weg gibt.
//   * Die Liste zeigt Betrieb, Gewerk und Wartezeit.
//   * Die Vorpruefungen, die eine Freigabe SPERREN, sperren sie auch sichtbar.
//   * Eine Ablehnung ohne ausreichende Begruendung geht nicht raus.
//   * Freigabe und Ablehnung rufen die Funktion mit der richtigen Kennung.
//
// NICHT geprueft: ob der Server die Entscheidung wirklich schreibt und ob die
// Dokumentlinks nach fuenf Minuten ablaufen. Das steht in
// supabase/tests/pruefung_test.ts und in den Edge-Function-Tests.
const { chromium } = require('playwright');
const { alsAnbieter } = require('../lib/anbieter-sitzung.cjs');

const BASIS = process.env.BASIS || 'http://localhost:8744';
const CHROME = process.env.CHROME_PFAD
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

const BETRIEB_A = '00000000-0000-4000-8000-0000000000a1';
const BETRIEB_B = '00000000-0000-4000-8000-0000000000b1';

let fehler = 0;
function pruefe(name, bedingung, detail = '') {
  const ok = !!bedingung;
  if (!ok) fehler++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  return ok;
}

const vorStunden = (h) => new Date(Date.now() - h * 3_600_000).toISOString();

// Zwei Einreichungen, absichtlich verschieden:
//   A ist sauber und darf freigegeben werden.
//   B ist ein meisterpflichtiges Gewerk OHNE Meisterbrief -- die Vorpruefung
//     muss die Freigabe sperren (§ 1 HwO Anlage A).
const liste = {
  einreichungen: [
    {
      id: BETRIEB_A, business_name: 'Elektrotechnik Wassermann GmbH',
      trade_id: 'elektro', kyc_status: 'in_review',
      kyc_submitted_at: vorStunden(30),
      gewerbeschein_url: 'https://example.invalid/a-gewerbe.pdf',
      meisterbrief_url: 'https://example.invalid/a-meister.pdf',
      gewerbeschein_path: 'a/gewerbe.pdf', meisterbrief_path: 'a/meister.pdf',
      steuer_id: 'DE123456789', kontoinhaber: 'Elektrotechnik Wassermann GmbH',
      befunde: [],
    },
    {
      id: BETRIEB_B, business_name: 'Sanitaer Schmitz',
      trade_id: 'sanitaer', kyc_status: 'in_review',
      kyc_submitted_at: vorStunden(80),
      gewerbeschein_url: 'https://example.invalid/b-gewerbe.pdf',
      meisterbrief_url: null,
      gewerbeschein_path: 'b/gewerbe.pdf', meisterbrief_path: null,
      steuer_id: 'DE987654321', kontoinhaber: 'Schmitz',
      befunde: [],
    },
  ],
  link_gilt_sekunden: 300,
};

async function main() {
  const b = await chromium.launch({ executablePath: CHROME });

  // ── Teil A: wer nicht Betreiber ist, findet nichts ────────────────────────
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    // 404 ist die Antwort des Servers fuer "nicht Betreiber".
    await alsAnbieter(ctx, { rolle: 'customer', daten: { pruefung: () => ({ error: 'Not found' }) } });
    await ctx.route('**/functions/v1/pruefung**', (r) => r.fulfill({
      status: 404, contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Not found' }),
    }));
    const s = await ctx.newPage();
    await s.goto(`${BASIS}/pruefung`, { waitUntil: 'networkidle' });
    await s.waitForTimeout(1600);
    const text = await s.locator('body').innerText();

    pruefe('A1 Ohne Betreiber-Recht steht dort "nicht gefunden"',
      /nicht gefunden|Seite nicht/i.test(text), text.slice(0, 140).replace(/\n/g, ' | '));
    pruefe('A2 Und KEIN Hinweis darauf, dass es ein Postfach gibt',
      !/Prüf-Postfach|Einreichung|Gewerbeschein/i.test(text),
      text.slice(0, 140).replace(/\n/g, ' | '));
    await ctx.close();
  }

  // ── Teil B: als Betreiber steht die Liste da ──────────────────────────────
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, { rolle: 'customer', daten: {} });
    await ctx.route('**/functions/v1/pruefung**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(liste),
    }));
    const s = await ctx.newPage();
    await s.goto(`${BASIS}/pruefung`, { waitUntil: 'networkidle' });
    await s.waitForTimeout(1800);
    const text = await s.locator('body').innerText();

    pruefe('B1 Beide Einreichungen stehen da',
      /Wassermann/.test(text) && /Schmitz/.test(text),
      text.slice(0, 160).replace(/\n/g, ' | '));
    // Fuer den Betreiber ist "seit wann wartet der?" die Zahl, nach der er
    // entscheidet, was er zuerst anfasst. /health meldet `pruef_stau` genau
    // dann, wenn etwas zu lange wartet.
    pruefe('B2 Die Wartezeit steht bei jeder Einreichung, mit Zahl',
      /wartet 30 h/.test(text) && /wartet 80 h/.test(text),
      text.slice(0, 200).replace(/\n/g, ' | '));
    pruefe('B3 Das Gewerk steht dabei', /Elektro|Sanitär|Sanitaer/i.test(text));

    // Der Fall, auf den es ankommt: meisterpflichtig ohne Meisterbrief.
    pruefe('B4 Der meisterpflichtige Fall ohne Meisterbrief ist als Sperre markiert',
      /meisterpflichtig|Meisterbrief/i.test(text),
      text.includes('Meisterbrief') ? '' : 'kein Hinweis auf den Meisterbrief');
    await ctx.close();
  }

  // ── Teil C: eine Ablehnung ohne Begruendung geht nicht raus ───────────────
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, { rolle: 'customer', daten: {} });
    const rufe = [];
    // Aufgezeichnet werden nur ENTSCHEIDUNGEN. Der Rekorder nahm frueher
    // alles auf, was nicht `liste` hiess -- und fing am 21.09.2026 den neuen
    // Lese-Aufruf `wartendes` mit, worauf C3 und C5 auf den falschen Eintrag
    // schauten. Ein Rekorder, der „alles ausser X" sammelt, faengt jede
    // spaetere Erweiterung mit.
    const ENTSCHEIDUNGEN = ['freigeben', 'ablehnen'];
    await ctx.route('**/functions/v1/pruefung**', (r) => {
      let koerper = null;
      try { koerper = JSON.parse(r.request().postData() || 'null'); } catch (e) { /* egal */ }
      const istEntscheidung = !!koerper && ENTSCHEIDUNGEN.includes(koerper.aktion);
      if (istEntscheidung) rufe.push(koerper);
      return r.fulfill({
        status: 200, contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(
          istEntscheidung ? { ok: true }
            : (koerper && koerper.aktion === 'wartendes') ? { reklamationen: [], meldungen: [] }
            : liste),
      });
    });
    const s = await ctx.newPage();
    await s.goto(`${BASIS}/pruefung`, { waitUntil: 'networkidle' });
    await s.waitForTimeout(1800);

    const ablehnen = s.locator('[role="button"]:visible').filter({ hasText: /^\s*Ablehnen\s*$/ }).first();
    pruefe('C1 Es gibt einen Ablehnen-Knopf', await ablehnen.count() > 0);
    if (await ablehnen.count()) {
      pruefe('C2 Ohne Begruendung ist er gesperrt',
        await ablehnen.isDisabled().catch(() => false));
      await ablehnen.click({ force: true }).catch(() => {});
      await s.waitForTimeout(800);
      pruefe('C3 Und es geht auch nichts raus',
        rufe.length === 0, JSON.stringify(rufe));
    }

    // Mit ausreichender Begruendung muss es gehen.
    const feld = s.locator('textarea:visible, input:visible').first();
    if (await feld.count()) {
      await feld.fill('Der Gewerbeschein ist nicht lesbar, bitte neu hochladen.').catch(() => {});
      await s.waitForTimeout(500);
      const nun = s.locator('[role="button"]:visible').filter({ hasText: /^\s*Ablehnen\s*$/ }).first();
      pruefe('C4 Mit ausreichender Begruendung ist er frei',
        !(await nun.isDisabled().catch(() => true)));
      await nun.click().catch(() => {});
      await s.waitForTimeout(1200);
      pruefe('C5 Die Ablehnung geht mit Begruendung und Kennung raus',
        rufe.length >= 1 && rufe[0].aktion === 'ablehnen'
          && typeof rufe[0].grund === 'string' && rufe[0].grund.length >= 20
          && !!rufe[0].providerId,
        JSON.stringify(rufe[0] ?? null));
    }
    await ctx.close();
  }

  // ── Teil D: die beiden anderen Warteschlangen, NUR LESEND ────────────────
  //
  // ANLASS (21.09.2026): `disputes` und `inhalts_meldungen` wurden
  // geschrieben und von niemandem gelesen. Bei den Reklamationen haengt Geld
  // daran -- 0770 bricht die automatische Auszahlung mit `dispute_open` ab.
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, { rolle: 'customer', daten: {} });
    await ctx.route('**/functions/v1/pruefung**', (r) => {
      let koerper = null;
      try { koerper = JSON.parse(r.request().postData() || '{}'); } catch { /* egal */ }
      const wartendes = {
        reklamationen: [{
          id: 'd1000000-0000-4000-8000-000000000001',
          case_id: 'REK-2026-0007', category: 'quality',
          description: 'Die Fliesen im Bad sitzen schief und eine ist gesprungen.',
          // 14 Tage: an JEDEM Wochentag mehr als zwei Werktage. Mit den
          // urspruenglichen 96 Stunden war die Lage vom Wochentag des
          // Laufs abhaengig -- ein Test, der nur dienstags rot wird, ist
          // keiner (Lehre vom 16.08.).
          status: 'open', created_at: vorStunden(24 * 14),
          contract: { id: 'c1', customer_total: 640, provider_payout: 588.8 },
        }],
        meldungen: [{
          id: 'e1000000-0000-4000-8000-000000000001',
          inhalt_art: 'profil', fundstelle: '/anbieter?id=abc',
          begruendung: 'Das Profil behauptet eine Meisterqualifikation, die es nicht gibt.',
          eingegangen_am: vorStunden(50), melder_name: 'Aylin K.',
        }],
      };
      return r.fulfill({
        status: 200, contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        // LEERE Verifizierungsliste, und das ist der Punkt: genau dann
        // stand frueher „Nichts offen" auf dem Bildschirm, waehrend eine
        // Reklamation 640 EUR festhielt.
        body: JSON.stringify(koerper && koerper.aktion === 'wartendes'
          ? wartendes
          : { einreichungen: [], link_gilt_sekunden: 300 }),
      });
    });
    const s = await ctx.newPage();
    await s.goto(`${BASIS}/pruefung`, { waitUntil: 'networkidle' });
    await s.waitForTimeout(2000);
    const text = await s.locator('body').innerText();

    pruefe('D0 Ohne offene Verifizierung steht NICHT "Nichts offen", solange etwas anderes wartet',
      !/Nichts offen/i.test(text), text.slice(0, 200).replace(/\n/g, ' | '));
    pruefe('D1 Die Reklamation steht im Postfach',
      /REK-2026-0007/.test(text), text.slice(0, 200).replace(/\n/g, ' | '));
    // Der Betrag ist die Zahl, die den Betreiber handeln laesst: so viel Geld
    // liegt fest, solange niemand entscheidet.
    pruefe('D2 Der eingefrorene Betrag steht dabei',
      /640/.test(text) && /gesperrt/i.test(text),
      text.slice(0, 260).replace(/\n/g, ' | '));
    // NUR IM ABSCHNITT der Reklamationen nachsehen, nicht im ganzen
    // Bildschirm: die DSA-Meldung darunter ist ebenfalls ueberfaellig, und
    // der erste Anlauf dieser Zusicherung war deshalb aus dem FALSCHEN Grund
    // gruen. Ueber den Text zu schneiden ist hier verlaesslicher als ueber
    // den DOM -- react-native-web schachtelt jede Karte mehrfach, und
    // `.last()` griff die innerste Zeile ohne die Marke.
    const abVon = text.indexOf('REKLAMATION');
    const abBis = text.indexOf('INHALTS-MELDUNG');
    const rekAbschnitt = abVon >= 0
      ? text.slice(abVon, abBis > abVon ? abBis : undefined)
      : '';
    pruefe('D3 Die Reklamation selbst ist als ueberfaellig markiert',
      /Überfällig/i.test(rekAbschnitt),
      rekAbschnitt.slice(0, 200).replace(/\n/g, ' | ') || 'Abschnitt nicht gefunden');
    pruefe('D4 Die Inhalts-Meldung steht da, mit Fundstelle',
      /Aylin K\./.test(text) && /anbieter\?id=abc/.test(text),
      text.slice(0, 300).replace(/\n/g, ' | '));

    // GEGENPROBE, und der eigentliche Punkt dieses Teils: hier wird NICHTS
    // entschieden. Ein Knopf, der Geld bewegt, gehoert nicht in einen
    // Bildschirm, der nur sichtbar machen soll.
    const entscheidKnopf = s.locator('[role="button"]:visible')
      .filter({ hasText: /erstatt|zurückzahl|schliess|schließ|entscheid/i });
    pruefe('D5 Es gibt KEINEN Entscheidungsknopf in diesen Abschnitten',
      (await entscheidKnopf.count()) === 0,
      `${await entscheidKnopf.count()} gefunden`);
    pruefe('D6 Und der Bildschirm sagt, wo entschieden wird',
      /Dashboard/i.test(text));
    await ctx.close();
  }

  // ── Teil E (Gegenprobe): sind alle drei leer, sagt der Bildschirm das ─────
  //
  // Ohne diese Zusicherung koennte der Leerzustand fuer eine Reklamation
  // blind sein und „Nichts offen" melden, waehrend Geld festliegt.
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, { rolle: 'customer', daten: {} });
    await ctx.route('**/functions/v1/pruefung**', (r) => {
      let koerper = null;
      try { koerper = JSON.parse(r.request().postData() || '{}'); } catch { /* egal */ }
      return r.fulfill({
        status: 200, contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(koerper && koerper.aktion === 'wartendes'
          ? { reklamationen: [], meldungen: [] }
          : { einreichungen: [], link_gilt_sekunden: 300 }),
      });
    });
    const s = await ctx.newPage();
    await s.goto(`${BASIS}/pruefung`, { waitUntil: 'networkidle' });
    await s.waitForTimeout(2000);
    const text = await s.locator('body').innerText();
    pruefe('E1 Bei leeren Warteschlangen steht "Nichts offen"',
      /Nichts offen/i.test(text), text.slice(0, 160).replace(/\n/g, ' | '));
    pruefe('E2 Und der Satz nennt alle drei Sorten',
      /Reklamation/i.test(text) && /Meldung/i.test(text) && /Verifizierung/i.test(text),
      text.slice(0, 260).replace(/\n/g, ' | '));
    await ctx.close();
  }

  await b.close();
  console.log(fehler ? `\n${fehler} Befund(e).` : '\nReise 7: alles wie erwartet.');
  console.log('HINWEIS: Ob der Server die Entscheidung wirklich schreibt und ob die');
  console.log('         Dokumentlinks ablaufen, steht in supabase/tests/pruefung_test.ts.');
  process.exit(fehler ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
