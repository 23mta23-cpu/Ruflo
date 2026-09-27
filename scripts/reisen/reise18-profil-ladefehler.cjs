// Reise 18 — ein Ladefehler darf die Profilmaske nicht LEER zeigen.
//
// ANLASS (Messung 27.09.2026, haengendes Netz auf 18 Bildschirmen):
// `lib/providerProfiles.ts` fing JEDEN Fehler ab und lieferte den
// Vorgabesatz. Beide Profil-Bildschirme des Betriebs zeigten daraufhin eine
// vollstaendig leere Maske -- und ihr „Speichern" schrieb diese Leerwerte
// ueber das echte Profil:
//   app/betrieb/profil.tsx         business_name, bio, phone, category_ids
//   app/betrieb/profil-bearbeiten  business_name, bio, phone, trade_id
// Ueber `category_ids` laeuft das gesamte Auftrags-Matching
// (notify-matching-providers/auswahl.ts). Der Betrieb haette nach einem
// einzigen Funkloch keine Anfrage mehr bekommen, ohne jede Meldung.
//
// Die `.catch()`-Bloecke BEIDER Bildschirme waren dabei toter Code -- einer
// davon mit einem Kommentar, der genau diesen Datenverlust verhindern wollte.
// Ein Kommentar ist kein Beleg.
//
// Geprueft wird deshalb BEIDES, Auszeichnung UND Wirkung: dass der Bildschirm
// den Ladefehler benennt, und dass beim Antippen von „Speichern" wirklich
// nichts geschrieben wird. Teil C ist die Pflicht-Gegenprobe: im gesunden
// Fall MUSS geschrieben werden, sonst waere „nie speichern" der bequemste
// gruene Haken.
//
// MUTATIONEN (gemessen, jede in einem eigenen Export):
//   `throw e` in lib/providerProfiles.ts wieder zu `return DEFAULTS`
//       -> A1 A2 A3 A4 B1 B2 B4 B5 rot, C durchgehend gruen.
//          B5 druckt dabei den Schaden woertlich aus:
//          POST provider_profiles {"business_name":"","bio":"","phone":"",
//          "category_ids":[],"min_hourly_rate":13}
//   nur `disabled={saving || ladefehler}` -> `disabled={saving}`
//       -> NUR B4 rot, B5 gruen. Auszeichnung und Wirkung sind damit
//          nachweislich zwei verschiedene Zusicherungen.
//   ein Schreibvorgang im Ladepfad von profil-bearbeiten
//       -> NUR A5 rot. A5 bewacht die Klasse "ein Lesepfad legt etwas an"
//          (23.09.) und haette ohne diese Mutation keinen eigenen Nachweis.
//
// Beim Bauen dieser dritten Mutation selbst in die Projektfalle gelaufen:
// `void supabase.from(...).upsert(...)` schickt NICHTS ab -- PostgREST-Builder
// sind Thenables und laufen erst mit `.then()` oder `await`. Die Mutation war
// damit wirkungslos, und A5 blieb zu Recht gruen.
const { chromium } = require('playwright');
const { alsAnbieter } = require('../lib/anbieter-sitzung.cjs');

const BASIS = process.env.BASIS || 'http://localhost:8744';
const CHROME = process.env.CHROME_PFAD
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

let pass = 0, fail = 0;
function pruefe(name, ok, detail) {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  // Detail NUR im Fehlerfall: ein Pruefer, der neben PASS das Gegenteil
  // schreibt, wird nicht mehr geglaubt (Lehre 22.09.).
  else { fail++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

/** Schreibende Aufrufe auf provider_profiles. */
function schreibzugriffe(ctx) {
  return (ctx.__aufrufe || []).filter((a) => a.name === 'provider_profiles');
}

async function speichernKnopf(p) {
  return p.locator('[role="button"]:visible').filter({ hasText: 'Speichern' });
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });

  // ── A: /betrieb/profil-bearbeiten mit gestoerter Profilabfrage ──────────
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, { fehlerBei: ['provider_profiles'] });
    const p = await ctx.newPage();
    await p.goto(`${BASIS}/betrieb/profil-bearbeiten`, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(3000);

    // Zuerst zusichern, WELCHEN Bildschirm wir messen (Lehre 22.09.): eine
    // Weiterleitung zur Anmeldung wuerde jede folgende Zusicherung entwerten.
    const pfad = new URL(p.url()).pathname;
    pruefe('A0 misst wirklich /betrieb/profil-bearbeiten', pfad === '/betrieb/profil-bearbeiten', `Pfad: ${pfad}`);

    const text = await p.evaluate(() => document.body.innerText || '');
    pruefe('A1 der Bildschirm benennt den Ladefehler',
      text.includes('Profil konnte nicht geladen werden'), JSON.stringify(text.slice(0, 160)));
    pruefe('A2 er sagt, dass der gespeicherte Stand unveraendert ist',
      text.includes('unverändert'), JSON.stringify(text.slice(0, 160)));

    const knopf = await speichernKnopf(p);
    pruefe('A3 die leere Maske wird gar nicht erst gezeigt (kein Speichern)',
      (await knopf.count()) === 0, `Speichern-Knoepfe: ${await knopf.count()}`);

    const erneut = p.locator('[role="button"]:visible').filter({ hasText: 'Erneut versuchen' });
    pruefe('A4 es gibt einen Weg heraus', (await erneut.count()) >= 1);

    pruefe('A5 nichts wurde geschrieben', schreibzugriffe(ctx).length === 0,
      JSON.stringify(schreibzugriffe(ctx)));
    await ctx.close();
  }

  // ── B: /betrieb/profil mit gestoerter Profilabfrage ─────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx, { fehlerBei: ['provider_profiles'] });
    const p = await ctx.newPage();
    await p.goto(`${BASIS}/betrieb/profil`, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(3000);

    const pfad = new URL(p.url()).pathname;
    pruefe('B0 misst wirklich /betrieb/profil', pfad === '/betrieb/profil', `Pfad: ${pfad}`);

    const text = await p.evaluate(() => document.body.innerText || '');
    pruefe('B1 ein bleibender Hinweis steht da (kein Toast)',
      text.includes('konnte nicht geladen werden'), JSON.stringify(text.slice(0, 200)));
    pruefe('B2 er sagt ausdruecklich, dass die Felder NICHT den Stand zeigen',
      text.includes('NICHT Ihren gespeicherten Stand'), JSON.stringify(text.slice(0, 200)));

    // Auszeichnung: der Knopf meldet sich als gesperrt.
    const knopf = await speichernKnopf(p);
    pruefe('B3 der Speichern-Knopf ist ueberhaupt da', (await knopf.count()) >= 1);
    const ariaDisabled = await knopf.first().getAttribute('aria-disabled');
    pruefe('B4 er ist als gesperrt ausgezeichnet', ariaDisabled === 'true',
      `aria-disabled=${ariaDisabled}`);

    // WIRKUNG: antippen darf nichts schreiben. Die Auszeichnung allein ist
    // keine Zusicherung -- ein Knopf kann „gesperrt" heissen und trotzdem
    // ausloesen (Lehre 16.09.).
    await knopf.first().click({ force: true, timeout: 5000 }).catch(() => {});
    await p.waitForTimeout(1500);
    pruefe('B5 Antippen schreibt NICHTS', schreibzugriffe(ctx).length === 0,
      JSON.stringify(schreibzugriffe(ctx)));
    await ctx.close();
  }

  // ── C: Gegenprobe — im gesunden Fall MUSS gespeichert werden ────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await alsAnbieter(ctx);
    const p = await ctx.newPage();
    await p.goto(`${BASIS}/betrieb/profil`, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(3000);

    const text = await p.evaluate(() => document.body.innerText || '');
    pruefe('C1 kein Ladefehler-Hinweis im gesunden Fall',
      !text.includes('konnte nicht geladen werden'), JSON.stringify(text.slice(0, 200)));
    pruefe('C2 der geladene Name steht da',
      text.includes('Prüfstand Betrieb GmbH'), JSON.stringify(text.slice(0, 200)));

    const knopf = await speichernKnopf(p);
    const ariaDisabled = await knopf.first().getAttribute('aria-disabled');
    pruefe('C3 der Speichern-Knopf ist NICHT gesperrt', ariaDisabled !== 'true',
      `aria-disabled=${ariaDisabled}`);

    await knopf.first().click({ timeout: 5000 }).catch((e) => console.log('    (Klick:', e.message.split('\n')[0], ')'));
    await p.waitForTimeout(2000);
    pruefe('C4 Antippen schreibt SEHR WOHL', schreibzugriffe(ctx).length >= 1,
      `Aufrufe: ${JSON.stringify(ctx.__aufrufe)}`);
    await ctx.close();
  }

  await browser.close();
  console.log(`\nReise 18: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
})();
