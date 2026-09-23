// Kern-Reise 16 — „Zurueckziehen" darf keinen Erfolg melden, den es nicht gab.
//
// ANLASS (23.09.2026, gemessene Klasse „Erfolgsmeldung nach ungepruefetem
// Schreibvorgang": 28 Erfolgsmeldungen, 1 Befund, 0 Fehlalarme).
// Der Knopf auf dem Betriebs-Dashboard setzte
//
//     update offers set status='declined' where id=? and status='pending'
//
// ab, las das Ergebnis nicht, entfernte die Zeile und meldete „Angebot
// zurueckgezogen". PostgREST meldet KEINEN Fehler, wenn die Bedingung auf
// null Zeilen passt -- und genau dann hat der Kunde in derselben Sekunde
// angenommen. Der Betrieb liest „zurueckgezogen" und ist gebunden.
//
// WARUM EINE BROWSER-REISE UND NICHT NUR JEST:
// `lib/angebotRueckzug.ts` ist durch Jest gedeckt, also die REGEL.
// Ob der Bildschirm sie AUFRUFT und ob am Ende der richtige Satz dasteht,
// sieht nur ein Browser. Und `scripts/erfolgsmeldung-check.py` sieht, DASS
// das Ergebnis angefasst wird, nicht WAS der Betrieb liest.
// Herkunft ist eine Quelltext-Frage, Wirkung eine Browser-Frage.
//
// GEPRUEFT WIRD, je mit derselben Eingabe und nur unterschiedlicher Antwort:
//   Z  Eine Zeile betroffen: Erfolgsmeldung, Zeile verschwindet.
//   N  Null Zeilen betroffen: KEINE Erfolgsmeldung, der Grund steht da,
//      und die Zeile bleibt stehen.
//   F  Fehler (HTTP 500): KEINE Erfolgsmeldung.
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

const ANGEBOT_ID = '00000000-0000-4000-8000-0000000000c1';
const AUFTRAG_ID = '00000000-0000-4000-8000-0000000000c2';
const TITEL = 'Verteilerkasten erneuern';

const OFFENES_ANGEBOT = {
  id: ANGEBOT_ID, job_id: AUFTRAG_ID, price: 320,
  job: { id: AUFTRAG_ID, title: TITEL },
};

/**
 * @param antwort  Was der Pruefstand auf das PATCH zurueckgibt.
 *                 [{id}] = eine Zeile umgestellt, [] = keine.
 * @param fehlerBei  Tabellen, die mit 500 antworten sollen.
 */
async function dashboard(b, { antwort, fehlerBei = [] }) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await alsAnbieter(ctx, {
    fehlerBei,
    daten: {
      // Der Wert ist eine Funktion, weil GET und PATCH dieselbe Tabelle
      // treffen: ohne die Unterscheidung liesse sich der Rueckgabewert des
      // Schreibvorgangs gar nicht setzen.
      offers: (verb) => (verb === 'GET' ? [OFFENES_ANGEBOT] : antwort),
    },
  });
  const p = await ctx.newPage();
  await p.goto(`${BASIS}/betrieb/dashboard`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(2500);
  return { ctx, p };
}

async function zieheZurueck(p) {
  const knopf = p.locator('[role="button"]:visible').filter({ hasText: 'Zurückziehen' }).first();
  const da = await knopf.count();
  if (da) await knopf.click();
  await p.waitForTimeout(1200);
  return da;
}

async function main() {
  const b = await chromium.launch({ executablePath: CHROME });

  // ── Z: eine Zeile betroffen ─────────────────────────────────────────────
  {
    const { ctx, p } = await dashboard(b, { antwort: [{ id: ANGEBOT_ID }] });
    // Zuerst zusichern, WELCHEN Bildschirm wir messen -- eine Gegenprobe auf
    // einer Weiterleitung besteht muehelos (Lehre vom 22.09.).
    pruefe('Z0 Gemessen wird das Betriebs-Dashboard',
      new URL(p.url()).pathname.endsWith('/betrieb/dashboard'), p.url());
    const vorher = await p.locator('body').innerText();
    pruefe('Z1 Das offene Angebot steht auf dem Bildschirm', vorher.includes(TITEL));

    const da = await zieheZurueck(p);
    pruefe('Z2 Es gibt genau einen Knopf „Zurückziehen"', da === 1, `gefunden: ${da}`);

    const t = await p.locator('body').innerText();
    pruefe('Z3 Der Betrieb liest, dass es zurückgezogen wurde',
      /zur[üu]ckgezogen/i.test(t));
    pruefe('Z4 Das Angebot verschwindet aus der Liste', !t.includes(TITEL));
    await ctx.close();
  }

  // ── N: null Zeilen betroffen (der Kunde war schneller) ──────────────────
  {
    const { ctx, p } = await dashboard(b, { antwort: [] });
    pruefe('N0 Gemessen wird das Betriebs-Dashboard',
      new URL(p.url()).pathname.endsWith('/betrieb/dashboard'), p.url());
    const da = await zieheZurueck(p);
    pruefe('N1 Der Knopf ist erreichbar', da === 1, `gefunden: ${da}`);

    const t = await p.locator('body').innerText();
    // Die eigentliche Zusicherung: KEINE Erfolgsbehauptung.
    pruefe('N2 Es steht NICHT da, das Angebot sei zurückgezogen',
      !/angebot zur[üu]ckgezogen/i.test(t), t.slice(0, 400));
    pruefe('N3 Der Grund steht da: der Kunde hat angenommen oder es ist abgelaufen',
      /nicht mehr offen/i.test(t) && /angenommen/i.test(t), t.slice(0, 400));
    pruefe('N4 Das Angebot bleibt in der Liste stehen', t.includes(TITEL));
    await ctx.close();
  }

  // ── F: der Schreibvorgang scheitert ─────────────────────────────────────
  {
    // `fehlerBei` trifft ALLE Verben derselben Tabelle. Damit haette auch das
    // GET mit 500 geantwortet, das Angebot stuende gar nicht erst da, und es
    // gaebe keinen Knopf zum Antippen -- eine Zusicherung, die muehelos gruen
    // ist und unter keiner Mutation rot wird. Gemessen wird deshalb ueber
    // eine eigene Route, die NUR das Schreiben scheitern laesst.
    const { ctx, p } = await dashboard(b, { antwort: [] });
    await ctx.route('**/rest/v1/offers*', (route) => {
      if (route.request().method() === 'GET') return route.fallback();
      return route.fulfill({
        status: 500, contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ message: 'Pruefstand: Schreiben scheitert' }),
      });
    });
    pruefe('F0 Gemessen wird das Betriebs-Dashboard',
      new URL(p.url()).pathname.endsWith('/betrieb/dashboard'), p.url());
    const da = await zieheZurueck(p);
    pruefe('F1 Der Knopf ist erreichbar', da === 1, `gefunden: ${da}`);

    const t = await p.locator('body').innerText();
    pruefe('F2 Keine Erfolgsmeldung',
      !/angebot zur[üu]ckgezogen/i.test(t), t.slice(0, 400));
    pruefe('F3 Der Betrieb liest, dass es NICHT geklappt hat',
      /konnte nicht zur[üu]ckgezogen werden/i.test(t), t.slice(0, 400));
    pruefe('F4 Das Angebot bleibt in der Liste stehen', t.includes(TITEL));
    await ctx.close();
  }

  await b.close();
  console.log(fehler === 0 ? '\nAlles bestanden.' : `\n${fehler} FEHLGESCHLAGEN`);
  process.exit(fehler === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
