// Kern-Reise 12 — die Start-PIN und die Termin-Weitergabe.
//
// ANLASS: Migration 0960 und `docs/produkt/start-pin-entwurf.md`. Der Kunde
// nennt dem Betrieb an der Tuer vier Ziffern; erst wenn der Betrieb sie
// eintraegt, gilt der Arbeitsbeginn als belegt.
//
// GEPRUEFT WIRD hier die WIRKUNG, nicht die Existenz:
//   A  Der Kunde sieht die Zahl und erfaehrt, wozu sie da ist.
//   B  GEGENPROBE: der Betrieb sieht sie NICHT, sondern ein Eingabefeld.
//   C  Eine unvollstaendige Eingabe loest NICHTS aus; vier Ziffern rufen
//      `arbeit_beginnen` mit genau diesem Vertrag und genau dieser Zahl.
//   D  Bei 'ok' steht danach der belegte Zeitpunkt da.
//   E  Bei 'falsch' steht die Meldung da und NICHT "belegt".
//   F  Der Kunde kann den Termin an eine Vertrauensperson weitergeben, und
//      die weitergegebene Nachricht enthaelt die vier Ziffern NICHT.
//
// GEGENPROBEN 18.09.2026 (gemessen, nicht angenommen):
//   "Eingabepruefung in pinEinloesen entfernt"  -> NICHTS wird rot. Der Knopf
//     traegt `disabled`, und mit `accessibilityRole="button"` rendert
//     react-native-web daraus einen echten gesperrten Knopf. Die Pruefung in
//     der Funktion ist also die zweite Schicht, nicht die erste.
//   "Eingabepruefung UND disabled entfernt"     -> C1, C2, C3 rot.
//   "jeder Ausgang gilt als Erfolg"             -> NICHTS wird rot, und das
//     ist die Aussage: `begonnenAm` kommt ausschliesslich vom Server zurueck.
//     Der Bildschirm KANN keinen Beginn behaupten, den die Datenbank nicht
//     hat.
//   "Zeitpunkt aus der Uhr des Geraets"         -> E1 und E2 rot. Genau der
//     Fehler, gegen den die beiden Zusicherungen stehen.
//   "die PIN reist in der Weitergabe mit"       -> F5 rot. Der Fall, um den
//     es bei der Weitergabe ueberhaupt geht.
//
// GRENZE von B1: dass der Betrieb die Zahl nicht sieht, haelt hier nur der
// Pruefstand fest (er antwortet fuer ihn mit einer leeren Liste, wie es die
// Policy taete). Der Nachweis, dass die Policy das wirklich tut, ist SP1 in
// scripts/db-test/start-pin.sql gegen echtes Postgres.
//
// NICHT geprueft: dass der Vergleich serverseitig richtig entscheidet. Das
// ist `scripts/db-test/start-pin.sql` (SP5 bis SP9) gegen echtes Postgres.
const { chromium } = require('playwright');
const { alsAnbieter, NUTZER_ID } = require('../lib/anbieter-sitzung.cjs');

const BASIS = process.env.BASIS || 'http://localhost:8744';
const CHROME = process.env.CHROME_PFAD
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

const JOB_ID = '00000000-0000-4000-8000-0000000000aa';
const VERTRAG_ID = '00000000-0000-4000-8000-0000000000dd';
const FREMD_ID = '00000000-0000-4000-8000-0000000000ee';
const PIN = '4821';
const BETRIEB = 'Elektro Yilmaz GmbH';

let fehler = 0;
function pruefe(name, bedingung, detail = '') {
  const ok = !!bedingung;
  if (!ok) fehler++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  return ok;
}

function vertrag(alsKunde, begonnen = null) {
  return {
    id: VERTRAG_ID, job_id: JOB_ID,
    customer_id: alsKunde ? NUTZER_ID : FREMD_ID,
    provider_id: alsKunde ? FREMD_ID : NUTZER_ID,
    price_gross: 320, customer_service_fee: 8, werkr_schutz_fee: 0,
    provider_commission: 21.2, customer_total: 328, provider_payout: 298.8,
    status: 'active', track: 'handwerker',
    created_at: new Date().toISOString(),
    customer_signed_at: null, provider_signed_at: null,
    stripe_payment_intent: null, escrow_captured_at: null, escrow_released_at: null,
    arbeit_begonnen_am: begonnen,
    job: {
      id: JOB_ID, title: 'Steckdose im Flur erneuern', category: 'Elektro',
      address_city: 'Köln', address_plz: '50667',
      description: 'Eine Steckdose neben der Wohnungstuer.',
    },
  };
}

async function seiteFuer(b, opts) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await alsAnbieter(ctx, opts);
  const p = await ctx.newPage();
  await p.goto(`${BASIS}/vertrag?contractId=${VERTRAG_ID}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(2500);
  return { ctx, p };
}

async function main() {
  const b = await chromium.launch({ executablePath: CHROME });

  // ── A: der Kunde ──────────────────────────────────────────────────────────
  {
    const { ctx, p } = await seiteFuer(b, {
      rolle: 'customer',
      daten: {
        contracts: [vertrag(true)],
        vertrag_start_pins: [{ pin: PIN }],
        vertrag_partner: [{ contract_id: VERTRAG_ID, anbieter_name: BETRIEB, kunde_name: 'T. A.' }],
      },
    });
    const text = await p.locator('body').innerText();
    pruefe('A1 Der Kunde sieht die vier Ziffern',
      text.includes(PIN), text.slice(0, 80).replace(/\n/g, ' | '));
    pruefe('A2 Der Bildschirm sagt, dass der Betrieb sie nicht einsehen kann',
      /nicht einsehen/.test(text));
    // Entscheidung 2 aus 0960: keine Folge, und das steht auch da. Ohne den
    // Satz liest jemand eine Wirkung hinein, die es nicht gibt.
    pruefe('A3 Er sagt ausdruecklich, dass ein Nichteinloesen keine Folgen hat',
      /keine Folgen/.test(text));

    // ── F: den Termin weitergeben ───────────────────────────────────────────
    const teilen = p.locator('[role="button"]:visible')
      .filter({ hasText: /Termin jemandem weitergeben/ }).first();
    pruefe('F1 Der Kunde kann den Termin weitergeben', await teilen.count() > 0);
    pruefe('F2 Und liest, dass die vier Ziffern bei ihm bleiben',
      /Ziffern bleiben bei Ihnen/.test(text));

    if (await teilen.count() > 0) {
      // WIRKUNG, nicht Auszeichnung: im Pruefstand-Browser gibt es kein
      // `navigator.share`, also faellt `teileText` auf den Download zurueck.
      // Genau den fangen wir ab und lesen, was wirklich hinausgegangen waere.
      const [download] = await Promise.all([
        p.waitForEvent('download', { timeout: 8000 }).catch(() => null),
        teilen.click(),
      ]);
      pruefe('F3 Der Knopf gibt wirklich etwas heraus', !!download,
        download ? download.suggestedFilename() : 'kein Download');
      if (download) {
        const pfad = await download.path();
        const inhalt = pfad ? require('fs').readFileSync(pfad, 'utf8') : '';
        pruefe('F4 Die Nachricht nennt den Betrieb', inhalt.includes(BETRIEB),
          inhalt.slice(0, 70).replace(/\n/g, ' | '));
        // Der Kern der ganzen Sache: die Zahl darf NICHT mitgehen. Sie ist
        // das Mittel, mit dem der Kunde entscheidet, wer seine Tuer passiert.
        pruefe('F5 Und enthaelt die vier Ziffern NICHT', !inhalt.includes(PIN));
      } else {
        pruefe('F4 Die Nachricht nennt den Betrieb', false, 'kein Download');
        pruefe('F5 Und enthaelt die vier Ziffern NICHT', false, 'kein Download');
      }
    }
    await ctx.close();
  }

  // ── B und C: der Betrieb ──────────────────────────────────────────────────
  {
    const { ctx, p } = await seiteFuer(b, {
      rolle: 'provider',
      // Wie die Policy aus 0960 es tut: fuer den Betrieb ist die Liste leer.
      daten: {
        contracts: [vertrag(false)],
        vertrag_start_pins: [],
        arbeit_beginnen: () => 'ok',
      },
    });
    const text = await p.locator('body').innerText();
    pruefe('B1 Der Betrieb sieht die Zahl NICHT', !text.includes(PIN));

    const feld = p.locator('input:visible').filter({ hasNot: p.locator('[type="email"]') }).last();
    pruefe('B2 Der Betrieb hat ein Eingabefeld', await feld.count() > 0);

    const knopf = p.locator('[role="button"]:visible').filter({ hasText: /Beginn belegen/ }).first();
    pruefe('B3 Und einen Knopf dazu', await knopf.count() > 0);

    // C1: unvollstaendige Eingabe. Geprueft wird die WIRKUNG (kein Aufruf),
    // nicht die Auszeichnung -- `isDisabled()` trifft bei react-native-web
    // den Text im Knopf, nicht den Knopf.
    await feld.fill('48');
    await knopf.click({ force: true }).catch(() => {});
    await p.waitForTimeout(600);
    const vorzeitig = ctx.__aufrufe.filter((a) => a.name === 'arbeit_beginnen');
    pruefe('C1 Mit zwei Ziffern wird nichts ausgeloest',
      vorzeitig.length === 0, `${vorzeitig.length} Aufrufe`);

    await feld.fill(PIN);
    await knopf.click();
    await p.waitForTimeout(1800);
    const rufe = ctx.__aufrufe.filter((a) => a.name === 'arbeit_beginnen');
    pruefe('C2 Mit vier Ziffern wird arbeit_beginnen gerufen', rufe.length === 1,
      `${rufe.length} Aufrufe`);
    pruefe('C3 Und zwar mit genau diesem Vertrag und dieser Zahl',
      rufe.length === 1 && rufe[0].koerper?.p_vertrag === VERTRAG_ID
        && rufe[0].koerper?.p_pin === PIN,
      JSON.stringify(rufe[0]?.koerper ?? null));
    await ctx.close();
  }

  // ── D: nach dem Einloesen steht der Zeitpunkt da ──────────────────────────
  {
    const belegt = new Date().toISOString();
    const { ctx, p } = await seiteFuer(b, {
      rolle: 'provider',
      daten: { contracts: [vertrag(false, belegt)], vertrag_start_pins: [] },
    });
    const text = await p.locator('body').innerText();
    pruefe('D1 Ist der Beginn belegt, steht der Zeitpunkt da',
      /Belegt am/.test(text), text.slice(0, 80).replace(/\n/g, ' | '));
    pruefe('D2 Und kein Eingabefeld mehr',
      !/Beginn belegen/.test(text));
    await ctx.close();
  }

  // ── E GEGENPROBE: eine falsche Zahl belegt nichts ─────────────────────────
  //
  // Ohne diese Probe waere ein Bildschirm gruen, der JEDEN Klick als Erfolg
  // meldet -- dieselbe Klasse wie ein Pruefer, der jeden Klick zaehlt.
  {
    const { ctx, p } = await seiteFuer(b, {
      rolle: 'provider',
      daten: {
        contracts: [vertrag(false)],
        vertrag_start_pins: [],
        arbeit_beginnen: () => 'falsch',
      },
    });
    const feld = p.locator('input:visible').last();
    await feld.fill('0000');
    await p.locator('[role="button"]:visible').filter({ hasText: /Beginn belegen/ }).first().click();
    await p.waitForTimeout(1500);
    const text = await p.locator('body').innerText();
    pruefe('E1 Eine falsche Zahl meldet das auch so',
      /stimmt nicht/.test(text), text.slice(0, 80).replace(/\n/g, ' | '));
    pruefe('E2 Und behauptet NICHT, der Beginn sei belegt',
      !/Belegt am/.test(text));
    await ctx.close();
  }

  await b.close();
  console.log(fehler === 0
    ? '\nReise 12: die Start-PIN wirkt, und der Termin geht ohne sie hinaus.'
    : `\nReise 12: ${fehler} Zusicherung(en) nicht erfuellt.`);
  process.exit(fehler === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
