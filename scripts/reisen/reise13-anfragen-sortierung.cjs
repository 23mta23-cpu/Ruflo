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

  await b.close();
  console.log(fehler === 0
    ? '\nReise 13: die Anfragen stehen in der richtigen Reihenfolge, und keine fehlt.'
    : `\nReise 13: ${fehler} Zusicherung(en) nicht erfuellt.`);
  process.exit(fehler === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
