// Kern-Reise 8 — die zwei Wege, die ein Gesetz verlangt.
//
// Beides sind keine Wunschmerkmale: hinter dem einen steht Art. 16 DSA, hinter
// dem anderen Art. 246a EGBGB. Ein Fehler kostet hier nicht einen Kunden,
// sondern hat eine Aufsicht im Ruecken.
//
//   /melden    Meldeweg fuer rechtswidrige Inhalte (Art. 16 DSA). Muss "leicht
//              zugaenglich" sein, OHNE Konto benutzbar, und der Eingang muss
//              bestaetigt werden.
//   /widerruf  Widerrufsbelehrung samt Muster-Formular (Anlage 2 zu Art. 246a
//              § 1 Abs. 2 S. 1 Nr. 1 EGBGB). Der Wortlaut ist VORGESCHRIEBEN.
//
// Genau deshalb steht im Kopf von scripts/anrede-check.py, dass das
// Muster-Formular von der Duz-Pruefung ausgenommen ist: ein Pruefer, der den
// gesetzlichen Wortlaut aendern will, verlangt einen Rechtsverstoss.
const { chromium } = require('playwright');
const { alsAnbieter } = require('../lib/anbieter-sitzung.cjs');

const BASIS = process.env.BASIS || 'http://localhost:8744';
const CHROME = process.env.CHROME_PFAD
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

let fehler = 0;
function pruefe(name, bedingung, detail = '') {
  const ok = !!bedingung;
  if (!ok) fehler++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  return ok;
}

/** Ohne Konto: genau so, wie Art. 16 DSA den Meldeweg verlangt. */
async function ohneKonto(b) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => localStorage.setItem('werkr_consent_v1', JSON.stringify({
    accepted: true, analytics: false, pstg: true, version: '1.0',
    timestamp: new Date().toISOString(),
  })));
  const rufe = [];
  await ctx.route('**://*.supabase.co/**', (r) => {
    const url = r.url();
    if (url.includes('/functions/v1/inhalts-meldung')) {
      let koerper = null;
      try { koerper = JSON.parse(r.request().postData() || 'null'); } catch (e) { /* egal */ }
      rufe.push(koerper);
      return r.fulfill({
        status: 200, contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ ok: true, kennung: 'WRK-MELD-0001' }),
      });
    }
    return r.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' }, body: '[]',
    });
  });
  const s = await ctx.newPage();
  return { ctx, s, rufe };
}

async function main() {
  const b = await chromium.launch({ executablePath: CHROME });

  // ── Teil A: der Meldeweg steht OHNE Konto offen ──────────────────────────
  {
    const { ctx, s } = await ohneKonto(b);
    await s.goto(`${BASIS}/melden`, { waitUntil: 'networkidle' });
    await s.waitForTimeout(1600);
    const text = await s.locator('body').innerText();

    pruefe('A1 Der Meldeweg ist ohne Anmeldung erreichbar',
      !/Anmelden|Bitte melden Sie sich an/i.test(text),
      text.slice(0, 140).replace(/\n/g, ' | '));
    pruefe('A2 Er nennt den Zweck, nicht nur ein Formular',
      /rechtswidrig|melden|Meldung/i.test(text));
    pruefe('A3 Er sagt zu, den Eingang zu bestaetigen (Art. 16 Abs. 4 DSA)',
      /Eingang/i.test(text), text.slice(0, 200).replace(/\n/g, ' | '));
    await ctx.close();
  }

  // ── Teil B: eine leere Meldung geht nicht raus ───────────────────────────
  {
    const { ctx, s, rufe } = await ohneKonto(b);
    await s.goto(`${BASIS}/melden`, { waitUntil: 'networkidle' });
    await s.waitForTimeout(1600);

    const senden = s.locator('[role="button"]:visible')
      .filter({ hasText: /Meldung (absenden|senden)|Absenden|Melden/i }).first();
    pruefe('B1 Es gibt einen Absendeknopf', await senden.count() > 0,
      (await s.locator('[role="button"]:visible').allInnerTexts())
        .filter(Boolean).map((t) => t.trim()).slice(0, 8).join(' · '));
    if (await senden.count()) {
      await senden.scrollIntoViewIfNeeded().catch(() => {});
      await senden.click({ force: true }).catch(() => {});
      await s.waitForTimeout(1000);
      pruefe('B2 Eine leere Meldung geht nicht hinaus',
        rufe.length === 0, JSON.stringify(rufe));
    }
    await ctx.close();
  }

  // ── Teil C: die Widerrufsbelehrung steht im gesetzlichen Wortlaut ────────
  //
  // Nicht "sinngemaess": Anlage 2 zu Art. 246a EGBGB gibt den Text vor. Wer
  // ihn umformuliert, verliert den Schutz der Musterbelehrung.
  {
    const { ctx, s } = await ohneKonto(b);
    await s.goto(`${BASIS}/widerruf`, { waitUntil: 'networkidle' });
    await s.waitForTimeout(1600);
    const text = await s.locator('body').innerText();

    pruefe('C1 Die Belehrung nennt die 14 Tage', /14 Tage/.test(text));
    pruefe('C2 Sie nennt eine Anschrift oder E-Mail zum Widerruf',
      /@|Anschrift|Adresse/i.test(text));
    pruefe('C3 Das Muster-Widerrufsformular ist da',
      /Muster-Widerrufsformular/i.test(text));
    pruefe('C4 Und zwar im vorgeschriebenen Wortlaut',
      /Hiermit widerrufe\(n\) ich\/wir/.test(text)
      || /Hiermit widerrufe ich/.test(text),
      text.slice(0, 200).replace(/\n/g, ' | '));
    pruefe('C5 Es siezt, wie der Rest des Produkts',
      !/\bdu\b|\bdein\b|\bdir\b/i.test(text));

    // ── D: der Knopf muss WIRKEN, nicht nur dastehen ──────────────────────
    //
    // GEMESSEN am 16.09.2026: hier stand `Share.share` ohne Web-Weiche und
    // ohne catch. Im Browser meldete die Seite
    // „Error: Share is not supported in this browser", der Erfolgszustand
    // wurde nie erreicht, und der Nutzer sah NICHTS. Das ist der gesetzliche
    // Widerrufsweg (§ 355 BGB) -- dieselbe Klasse wie die Kalender-Knoepfe.
    //
    // Die Anschrift ist `multiline` und rendert als <textarea>. Wer nur
    // `input` fuellt, laesst sie leer, die Pflichtfeld-Pruefung greift, und
    // der eigentliche Weg wird nie betreten. Genau so ist meine erste Probe
    // an diesem Fehler vorbeigelaufen.
    const seitenfehler = [];
    s.on('pageerror', (e) => seitenfehler.push(String(e)));

    const felder = s.locator('input:visible, textarea:visible');
    const anzahl = await felder.count();
    pruefe('D1 Das Formular hat alle drei Felder', anzahl >= 3, `${anzahl} Felder`);
    for (let i = 0; i < anzahl; i++) await felder.nth(i).fill('Pruefstand');

    const senden = s.locator('[role="button"]:visible').filter({ hasText: 'Widerruf erklären' }).first();
    pruefe('D2 Es gibt einen Absendeknopf', await senden.count() > 0);
    if (await senden.count() > 0) {
      await senden.click();
      await s.waitForTimeout(1500);
      const danach = await s.locator('body').innerText();
      pruefe('D3 Der Knopf fuehrt zu einer Rueckmeldung',
        /Widerruf vorbereitet/.test(danach),
        danach.includes('Widerruf vorbereitet') ? 'Erfolgszustand sichtbar' : 'KEINE Rueckmeldung');
      pruefe('D4 Dabei bricht nichts auf der Seite ab',
        seitenfehler.length === 0,
        seitenfehler.slice(0, 1).map((f) => f.slice(0, 90)).join(''));
      const nachErfolg = danach.split('Widerruf vorbereitet')[1] ?? '';
      pruefe('D5 Die Rueckmeldung selbst nennt den Weg zur Erklaerung',
        /E-Mail|Downloads/.test(nachErfolg),
        nachErfolg ? nachErfolg.slice(0, 90).replace(/\n/g, ' ') : 'kein Erfolgszustand');
    }
    await ctx.close();
  }

  // -- Teil E: was im Widerruf wirklich steht ---------------------------------
  //
  // ANLASS (22.09.2026): Teil D belegt, dass der Knopf etwas ausloest. Was
  // der Nutzer dabei WEGSCHICKT, war ungeprueft. Ein Widerruf, der den
  // Vertrag nicht bezeichnet, geht ins Leere -- und die Angaben stehen nur
  // in der erzeugten Datei, nicht auf dem Bildschirm.
  //
  // Auf dem Pruefstand gibt es `navigator.share` nicht (gemessen am
  // 16.09.2026), also nimmt `lib/teilen.ts` den Download-Weg. Der erzeugt
  // ein <a download>, und genau das faengt Playwright ab.
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    await ctx.addInitScript(() => localStorage.setItem('werkr_consent_v1', JSON.stringify({
      accepted: true, analytics: false, pstg: true, version: '1.0',
      timestamp: new Date().toISOString(),
    })));
    await ctx.route('**://*.supabase.co/**', (r) => r.abort());
    const s = await ctx.newPage();
    await s.goto(`${BASIS}/widerruf`, { waitUntil: 'networkidle' });
    await s.waitForTimeout(1500);

    // Unterscheidbare Werte je Feld: mit dreimal demselben Text liesse sich
    // nicht sagen, ob die Angaben an der richtigen Stelle landen.
    await s.locator('input[placeholder="z. B. 01.06.2025"]:visible').first().fill('03.02.2026');
    await s.locator('input[placeholder="Vor- und Nachname"]:visible').first().fill('Mara Grün');
    await s.locator('textarea[placeholder="Straße, PLZ, Ort"]:visible, input[placeholder="Straße, PLZ, Ort"]:visible')
      .first().fill('Elsaßstraße 7, 50677 Köln');

    const senden = s.locator('[role="button"]:visible').filter({ hasText: 'Widerruf erklären' }).first();
    const [ladung] = await Promise.all([
      s.waitForEvent('download', { timeout: 15000 }).catch(() => null),
      senden.click().catch(() => {}),
    ]);

    pruefe('E1 Der Widerruf wird als Datei bereitgestellt', ladung !== null,
      ladung ? ladung.suggestedFilename() : 'kein Download ausgeloest');

    if (ladung) {
      const pfad = await ladung.path();
      const inhalt = pfad ? require('fs').readFileSync(pfad, 'utf8') : '';
      const zeile = (etikett) => (inhalt.split('\n').find((z) => z.startsWith(etikett)) || '').trim();

      pruefe('E2 Er traegt den vorgeschriebenen Satz (Anlage 2 zu Art. 246a EGBGB)',
        /Hiermit widerrufe ich den von mir abgeschlossenen Vertrag/.test(inhalt),
        inhalt.slice(0, 80).replace(/\n/g, ' | '));
      pruefe('E3 Der Name steht an seiner Stelle', zeile('Name:') === 'Name: Mara Grün', zeile('Name:') || 'keine Namenszeile');
      pruefe('E4 Die Anschrift auch',
        zeile('Anschrift:') === 'Anschrift: Elsaßstraße 7, 50677 Köln',
        zeile('Anschrift:') || 'keine Anschriftszeile');
      pruefe('E5 Und das Bestelldatum, nicht der Platzhalter',
        zeile('Bestellt am:') === 'Bestellt am: 03.02.2026',
        zeile('Bestellt am:') || 'keine Datumszeile');
      pruefe('E6 Der Empfaenger ist genannt, sonst weiss niemand wohin',
        /^An: .+/m.test(inhalt) && /E-Mail: .+@.+/m.test(inhalt),
        (inhalt.split('\n').find((z) => z.startsWith('An:')) || 'keine Empfaengerzeile').trim());

      // GEGENPROBE: ohne sie waere eine Datei gruen, die einfach den ganzen
      // Bildschirmtext enthaelt und die gesuchten Woerter zufaellig fuehrt.
      pruefe('E7 GEGENPROBE: die Belehrung steht NICHT mit in der Erklaerung',
        !/Widerrufsbelehrung|Widerrufsfolgen/.test(inhalt),
        inhalt.length > 900 ? `${inhalt.length} Zeichen, zu viel fuer eine Erklaerung` : '');
    }
    await ctx.close();
  }

  await b.close();
  console.log(fehler ? `\n${fehler} Befund(e).` : '\nReise 8: alles wie erwartet.');
  console.log('HINWEIS: Ob die Meldung im Server ankommt und ob die Fristen laufen,');
  console.log('         steht in supabase/tests/inhalts-meldung_test.ts und db-test/dsa.sql.');
  process.exit(fehler ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
