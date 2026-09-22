// Kern-Reise 13 — die Anfragen-Liste des Betriebs.
//
// ANLASS (Selbst-Check 18.09.2026). Migration 0950 schickt dem Betrieb eine
// Mitteilung: „In Ihrem Postleitzahlenbereich sind N offene Auftraege
// ausgeschrieben, die zu Ihren Gewerken passen. Sie finden sie unter
// Anfragen." Die Liste zeigte aber alle offenen Auftraege des Zweigs, neueste
// zuerst, ohne jede Kennzeichnung -- der Betrieb musste die gemeinten suchen.
//
// GEPRUEFT WIRD:
//   A  Alle Anfragen sind da (es wird SORTIERT, nicht gefiltert), in der
//      richtigen Reihenfolge, und die Passung ist benannt.
//   B  GEGENPROBE: ohne Gewerke und ohne Postleitzahl bleibt die Reihenfolge
//      der Abfrage, und es steht kein Etikett da.
//   C  Eine lange Beschreibung laesst sich LESEN, ohne den Bildschirm zu
//      betreten, der ein bindendes Angebot abgibt (Founder 21.09.2026).
//
// GEGENPROBE 18.09.2026 (gemessen): liest der Bildschirm das Betriebsprofil
// nicht mehr (`gewerke: []`, `plzBereich: null`), werden A2, A3 und A4 rot --
// B1 und B2 bleiben gruen, denn die pruefen genau diesen Fall. A1 bleibt
// ebenfalls gruen: gefiltert wird nie.
//
// NICHT geprueft: die Sortierregel selbst. Das ist
// __tests__/anfragenSortierung.test.ts mit sechs Mutationen.
const { chromium } = require('playwright');
const { alsAnbieter, NUTZER_ID } = require('../lib/anbieter-sitzung.cjs');

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

const T_BEIDES = 'Sicherung raus in Koeln';
const T_GEWERK = 'Sicherung raus in Muenchen';
const T_REGION = 'Hecke schneiden in Koeln';
const T_NICHTS = 'Hecke schneiden in Muenchen';

// Die Abfrage liefert neueste zuerst. Absichtlich in der SCHLECHTESTEN
// Reihenfolge: ohne Sortierung stuende der unpassendste ganz oben.
const ANFRAGEN = [
  { id: '00000000-0000-4000-8000-00000000a001', title: T_NICHTS, description: 'Gartenarbeit.', address_city: 'München', address_plz: '80331', category_id: 'garten',  created_at: new Date().toISOString() },
  { id: '00000000-0000-4000-8000-00000000a002', title: T_REGION, description: 'Gartenarbeit.', address_city: 'Köln',    address_plz: '50823', category_id: 'garten',  created_at: new Date(Date.now() - 3600_000).toISOString() },
  { id: '00000000-0000-4000-8000-00000000a003', title: T_GEWERK, description: 'Elektroarbeit.', address_city: 'München', address_plz: '80331', category_id: 'elektro', created_at: new Date(Date.now() - 7200_000).toISOString() },
  { id: '00000000-0000-4000-8000-00000000a004', title: T_BEIDES, description: 'Elektroarbeit.', address_city: 'Köln',    address_plz: '50667', category_id: 'elektro', created_at: new Date(Date.now() - 10800_000).toISOString() },
];

// Teil C: eine lange und eine kurze Beschreibung im selben Bildschirm. Ohne
// die kurze waere „jede Karte bekommt den Knopf" gruen.
const LANG = 'Der Verteilerkasten im Keller loest seit Tagen unregelmaessig aus, meist '
  + 'abends, wenn Waschmaschine und Trockner zusammen laufen. Zwei Steckdosen im '
  + 'Wohnzimmer sind seitdem ohne Strom. Bitte zuerst messen, bevor etwas getauscht wird.';
const KURZ = 'Steckdose lose.';
const ANFRAGEN_TEXT = [
  { id: '00000000-0000-4000-8000-00000000b001', title: 'Verteilerkasten loest aus', description: LANG, address_city: 'Köln', address_plz: '50667', category_id: 'elektro', created_at: new Date().toISOString() },
  { id: '00000000-0000-4000-8000-00000000b002', title: 'Steckdose im Flur',        description: KURZ, address_city: 'Köln', address_plz: '50667', category_id: 'elektro', created_at: new Date(Date.now() - 3600_000).toISOString() },
];

// Teil D: zwei Vertraege, damit das Verdienst-Banner Zahlen hat.
//
// Die Betraege sind absichtlich so gewaehlt, dass `customer_total` (328) und
// `provider_payout` (298,80) verschieden sind -- sonst waere eine
// vertauschte Bezugsgroesse nicht messbar.
const VERTRAEGE = [
  { id: '00000000-0000-4000-8000-00000000d001', job_id: '00000000-0000-4000-8000-00000000b001',
    provider_id: NUTZER_ID, customer_id: '00000000-0000-4000-8000-00000000cccc',
    status: 'active', price_gross: 320, customer_total: 328, provider_payout: 298.8,
    provider_commission: 21.2, created_at: new Date().toISOString(),
    job: { id: '00000000-0000-4000-8000-00000000b001', title: 'Verteilerkasten loest aus' } },
  { id: '00000000-0000-4000-8000-00000000d002', job_id: '00000000-0000-4000-8000-00000000b002',
    provider_id: NUTZER_ID, customer_id: '00000000-0000-4000-8000-00000000cccc',
    status: 'completed', price_gross: 110, customer_total: 112.75, provider_payout: 101.2,
    provider_commission: 8.8, created_at: new Date().toISOString(),
    job: { id: '00000000-0000-4000-8000-00000000b002', title: 'Steckdose im Flur' } },
];

function betrieb(gewerke, plz) {
  return [{
    id: NUTZER_ID, business_name: 'Prüfstand Betrieb GmbH', trade_id: 'elektro',
    is_nachbarschaft: false, kyc_status: 'approved', available: true,
    rating_avg: null, rating_count: 0, meister_verified: false,
    stripe_onboarded: true,
    category_ids: gewerke,
    profile: { plz },
  }];
}

async function liste(b, gewerke, plz) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await alsAnbieter(ctx, {
    daten: { jobs: ANFRAGEN, provider_profiles: betrieb(gewerke, plz), contracts: [] },
  });
  const p = await ctx.newPage();
  await p.goto(`${BASIS}/betrieb/auftraege`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(3000);
  const text = await p.locator('body').innerText();
  return { ctx, p, text };
}

async function main() {
  const b = await chromium.launch({ executablePath: CHROME });

  // ── A: mit Gewerk und Postleitzahl ───────────────────────────────────────
  {
    const { ctx, text } = await liste(b, ['elektro', 'sanitaer'], '50667');
    const pos = (t) => text.indexOf(t);

    pruefe('A1 Alle vier Anfragen sind da (sortiert, nicht gefiltert)',
      [T_BEIDES, T_GEWERK, T_REGION, T_NICHTS].every((t) => pos(t) >= 0),
      [T_BEIDES, T_GEWERK, T_REGION, T_NICHTS].filter((t) => pos(t) < 0).join(', ') || 'alle da');

    pruefe('A2 Gewerk und Region stehen oben, dann Gewerk, dann Region',
      pos(T_BEIDES) >= 0 && pos(T_BEIDES) < pos(T_GEWERK)
        && pos(T_GEWERK) < pos(T_REGION) && pos(T_REGION) < pos(T_NICHTS),
      `${pos(T_BEIDES)} < ${pos(T_GEWERK)} < ${pos(T_REGION)} < ${pos(T_NICHTS)}`);

    // `T.label` setzt Versalien, und `innerText` gibt in Chromium den
    // GERENDERTEN Text zurueck -- also „IHR GEWERK". Der erste Entwurf suchte
    // schreibungsabhaengig und meldete zwei Fehlalarme an einem Bildschirm,
    // der richtig war. Gemessen, nicht vermutet.
    const etiketten = text.split('\n').map((z) => z.trim().toUpperCase())
      .filter((z) => z === 'IHR GEWERK, IHRE REGION' || z === 'IHR GEWERK' || z === 'IHRE REGION');
    pruefe('A3 Jede passende Anfrage traegt genau ihr Etikett',
      etiketten.join(' | ') === 'IHR GEWERK, IHRE REGION | IHR GEWERK | IHRE REGION',
      etiketten.join(' | ') || 'keines');
    pruefe('A4 Die Anfrage ohne Passung traegt keines',
      etiketten.length === 3, `${etiketten.length} Etiketten bei 4 Anfragen`);
    await ctx.close();
  }

  // ── B GEGENPROBE: ohne Gewerke und ohne Postleitzahl ─────────────────────
  //
  // Ohne diese Probe waere eine fest eingebaute Reihenfolge gruen, und ein
  // Etikett, das immer dasteht, auch.
  {
    const { ctx, text } = await liste(b, [], null);
    const pos = (t) => text.indexOf(t);
    pruefe('B1 Ohne Gewerk und ohne Region bleibt die Reihenfolge der Abfrage',
      pos(T_NICHTS) >= 0 && pos(T_NICHTS) < pos(T_REGION)
        && pos(T_REGION) < pos(T_GEWERK) && pos(T_GEWERK) < pos(T_BEIDES),
      `${pos(T_NICHTS)} < ${pos(T_REGION)} < ${pos(T_GEWERK)} < ${pos(T_BEIDES)}`);
    pruefe('B2 Und es steht kein Etikett da',
      !/Ihr Gewerk/.test(text) && !/Ihre Region/.test(text));
    await ctx.close();
  }

  // -- C: die lange Beschreibung laesst sich aufklappen -------------------
  //
  // ANLASS (Founder am 21.09.2026): „Warum kann ich Auftraege in der Liste
  // nicht anklicken?" Die Beschreibung war auf zwei Zeilen begrenzt und die
  // Karte reagierte auf nichts -- den ganzen Text sah nur, wer
  // „Angebot erstellen" oeffnete, also den Bildschirm, der ein BINDENDES
  // Angebot abgibt.
  //
  // Gemessen wird die HOEHE, nicht der Text: `numberOfLines` setzt in
  // react-native-web ein `-webkit-line-clamp`, das den Text nur optisch
  // abschneidet. `innerText` liefert ihn trotzdem vollstaendig -- eine
  // Textprobe waere in beiden Zustaenden gruen.
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, {
      daten: { jobs: ANFRAGEN_TEXT, provider_profiles: betrieb(['elektro'], '50667'), contracts: [] },
    });
    const p = await ctx.newPage();
    await p.goto(`${BASIS}/betrieb/auftraege`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(3000);

    const knopf = p.locator('[role="button"]:visible').filter({ hasText: /^\s*Ganze Beschreibung lesen\s*$/ });
    pruefe('C1 Nur die lange Beschreibung bietet das Aufklappen an',
      await knopf.count() === 1,
      `${await knopf.count()} Knoepfe bei einer langen und einer kurzen Beschreibung`);

    const hoehe = async (text) => p.evaluate((t) => {
      const e = [...document.querySelectorAll('div,span')]
        .find((x) => x.children.length === 0 && (x.textContent || '').trim() === t);
      if (!e) return null;
      return { sicht: Math.round(e.clientHeight), voll: Math.round(e.scrollHeight) };
    }, text);

    const vorher = await hoehe(LANG);
    pruefe('C2 Vorher ist der Text abgeschnitten',
      !!vorher && vorher.voll > vorher.sicht + 2,
      vorher ? `sichtbar ${vorher.sicht} px von ${vorher.voll} px` : 'Beschreibung nicht gefunden');

    await knopf.first().click();
    await p.waitForTimeout(500);

    const nachher = await hoehe(LANG);
    pruefe('C3 Nach dem Antippen steht der ganze Text da',
      !!nachher && !!vorher && nachher.sicht >= nachher.voll - 2 && nachher.sicht > vorher.sicht,
      nachher ? `sichtbar ${nachher.sicht} px von ${nachher.voll} px (vorher ${vorher.sicht})` : 'nicht gefunden');

    // Auszeichnung UND Wirkung -- `accessibilityState` ist in
    // react-native-web wirkungslos, `aria-expanded` nicht (21.09.2026).
    const zu = p.locator('[role="button"]:visible').filter({ hasText: /^\s*Weniger anzeigen\s*$/ });
    pruefe('C4 Der Knopf sagt jetzt „Weniger anzeigen" und meldet aria-expanded',
      await zu.count() === 1 && await zu.first().getAttribute('aria-expanded') === 'true',
      `${await zu.count()} Knopf, aria-expanded=${await zu.first().getAttribute('aria-expanded').catch(() => '?')}`);

    // GEGENPROBE: ohne sie waere „klappt immer auf" gruen.
    await zu.first().click();
    await p.waitForTimeout(500);
    const wieder = await hoehe(LANG);
    pruefe('C5 GEGENPROBE: erneutes Antippen klappt wieder zu',
      !!wieder && wieder.voll > wieder.sicht + 2,
      wieder ? `sichtbar ${wieder.sicht} px von ${wieder.voll} px` : 'nicht gefunden');

    await ctx.close();
  }

  // -- D: das Verdienst-Banner ---------------------------------------------
  //
  // ANLASS (22.09.2026): Die beiden Zahlen oben auf dem Bildschirm standen
  // auf VERSCHIEDENEN Bezugsgroessen. „Treuhand (aktiv)" kam aus
  // `customer_total` (was der Kunde zahlt), „Ausgezahlt gesamt" aus
  // `provider_payout` (was der Betrieb bekommt). Nebeneinander liest ein
  // Betrieb die erste Zahl als seinen eigenen Anspruch -- und der ist um
  // die Kunden-Servicegebuehr und die Plattformgebuehr kleiner.
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, {
      daten: { jobs: [], provider_profiles: betrieb(['elektro'], '50667'), contracts: VERTRAEGE },
    });
    const p = await ctx.newPage();
    await p.goto(`${BASIS}/betrieb/auftraege`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(3000);
    const zeilen = (await p.locator('body').innerText()).split('\n').map((z) => z.trim());
    const betragNach = (etikett) => {
      for (let i = 0; i < zeilen.length; i++) {
        if (!zeilen[i].includes(etikett)) continue;
        for (let k = i; k < Math.min(i + 3, zeilen.length); k++) {
          const m = zeilen[k].match(/€[\d.]+,\d\d/);
          if (m) return m[0];
        }
      }
      return null;
    };

    const treuhand = betragNach('Treuhand');
    pruefe('D1 „Treuhand (aktiv)" nennt den Anspruch des Betriebs, nicht die Kundensumme',
      treuhand === '€298,80',
      treuhand === null ? '„Treuhand" steht nicht da' : `nennt ${treuhand}, erwartet €298,80 (nicht €328,00)`);

    const ausgezahlt = betragNach('Ausgezahlt gesamt');
    pruefe('D2 „Ausgezahlt gesamt" steht auf derselben Grundlage',
      ausgezahlt === '€101,20',
      ausgezahlt === null ? '„Ausgezahlt gesamt" steht nicht da' : `nennt ${ausgezahlt}, erwartet €101,20`);

    // GEGENPROBE: ohne sie waere ein Banner gruen, das beide Zahlen aus
    // derselben Zeile zieht und den Unterschied gar nicht kennt.
    pruefe('D3 GEGENPROBE: die beiden Zahlen sind verschieden',
      treuhand !== ausgezahlt, `${treuhand} / ${ausgezahlt}`);
    await ctx.close();
  }

  await b.close();
  console.log(fehler === 0
    ? '\nReise 13: die Anfragen stehen in der richtigen Reihenfolge, und keine fehlt.'
    : `\nReise 13: ${fehler} Zusicherung(en) nicht erfuellt.`);
  process.exit(fehler === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
