// Kern-Reise 9 — der Anbieter-Kalender, und zwar mit ECHTEM Antippen.
//
// ANLASS (Founder am Geraet, 16.09.2026): „Die buttons beim Kalender woche
// freigeben etc. Funktionieren nicht." Ursache war `Alert.alert` aus
// react-native, das im Web nicht implementiert ist -- der Aufruf lief still
// ins Leere.
//
// WARUM DIESE REISE: der Fix (`showAlert`) wurde am selben Tag eingebaut und
// mit tsc, Jest und einem Quelltext-Pruefer abgesichert. Keines davon
// beantwortet die Frage, die der Founder gestellt hat: TUT DER KNOPF JETZT
// ETWAS? Ein Quelltext-Pruefer sieht, dass die richtige Funktion aufgerufen
// wird, nicht dass am Ende ein Schreibvorgang herauskommt.
//
// Das ist genau die Luecke, die den Fehler ueberhaupt erst hat entstehen
// lassen: die Browser-Reisen erreichten den Anbieter-Kalender, tippten dort
// aber nie einen Knopf an.
//
// GEPRUEFT WIRD, in dieser Reihenfolge:
//   A  Der Kalender rendert ueberhaupt (sonst misst alles Weitere eine
//      Anmeldeseite).
//   B  „Woche freigeben" oeffnet ein Fenster. DAS ist der Beweis: mit
//      Alert.alert erscheint im Web nichts.
//   C  „Abbrechen" schreibt NICHTS. Ohne diese Gegenprobe waere ein Pruefer
//      gruen, der jeden Klick als Erfolg zaehlt.
//   D  Bestaetigen schreibt wirklich an `provider_availability`.
//   E  Dasselbe fuer „Woche sperren".
//   F  „Diesen Tag freigeben" und „Diesen Tag sperren" wirken ohne Fenster.
//
// NICHT geprueft: ob die Datenbank die Zeilen korrekt ablegt (das steht in
// scripts/db-test/verfuegbarkeit.sql) und natives Layout.
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

/** Knoepfe ueber die Rolle greifen: den Handler traegt der AEUSSERE Knopf,
 *  nicht der Text darin, und `:visible` ist Pflicht (expo-router laesst
 *  inaktive Bildschirme im DOM stehen). */
function knopf(seite, text) {
  return seite.locator('[role="button"]:visible').filter({ hasText: text }).first();
}

/** Knopf mit GENAU dieser Beschriftung.
 *
 *  Playwright vergleicht `hasText` als Teilzeichenkette und ohne Ruecksicht
 *  auf Gross- und Kleinschreibung: „Freigeben" traf damit auch „Woche
 *  freigeben" und „Diesen Tag freigeben". `.first()` nahm dann den Knopf im
 *  HINTERGRUND, den das offene Fenster verdeckt -- der Klick lief in einen
 *  Timeout, und der Pruefer haette einen funktionierenden Knopf als Fehler
 *  gemeldet. */
function knopfGenau(seite, text) {
  const muster = new RegExp(`^\\s*${text}\\s*$`);
  return seite.locator('[role="button"]:visible').filter({ hasText: muster }).first();
}

/** Klickt, wenn es den Knopf gibt. Sonst meldet es das und macht weiter.
 *
 *  ANLASS: mit dem zurueckgenommenen Fix (Gegenprobe) erschien kein Fenster,
 *  und der Lauf blieb 30 Sekunden an „Abbrechen" haengen, statt die uebrigen
 *  Zusicherungen zu melden. Ein Pruefer, der nach dem ersten Fehler stehen
 *  bleibt, zeigt nur den ERSTEN Fehler -- die Liste danach ist aber genau
 *  das, was man beim Beheben braucht. */
async function klickeWennDa(ziel, name) {
  if (await ziel.count() === 0) {
    console.log(`SKIP  ${name} — Knopf nicht da, abhaengige Schritte entfallen`);
    return false;
  }
  try {
    await ziel.click({ timeout: 4000 });
    return true;
  } catch {
    console.log(`SKIP  ${name} — Knopf nicht klickbar`);
    return false;
  }
}

/** Schreibaufraufe an die Verfuegbarkeit, aus dem Protokoll des Pruefstands. */
function schreibzugriffe(ctx) {
  return (ctx.__aufrufe || []).filter((a) => a.name === 'provider_availability');
}

async function main() {
  const b = await chromium.launch({ executablePath: CHROME });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await alsAnbieter(ctx);
  const p = await ctx.newPage();

  await p.goto(`${BASIS}/betrieb/kalender`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(3000);

  // ── A: rendert der Kalender? ──────────────────────────────────────────────
  const text = await p.locator('body').innerText();
  pruefe('A1 Der Kalender ist offen', /Kalender/i.test(text), text.slice(0, 60).replace(/\n/g, ' | '));
  pruefe('A2 Die Sammelaktionen sind da', await knopf(p, 'Woche freigeben').count() > 0);

  // ── B: das Fenster erscheint ueberhaupt ───────────────────────────────────
  // Mit Alert.alert passiert hier im Web NICHTS. Genau das war der Fehler.
  await knopf(p, 'Woche freigeben').click();
  await p.waitForTimeout(700);
  const nachKlick = await p.locator('body').innerText();
  pruefe(
    'B1 „Woche freigeben" oeffnet ein Fenster',
    /Alle Stunden von/.test(nachKlick),
    nachKlick.includes('Alle Stunden von') ? 'Rueckfrage sichtbar' : 'KEINE Rueckfrage',
  );
  const bestaetigen = knopfGenau(p, 'Freigeben');
  pruefe('B2 Das Fenster hat einen Bestaetigungsknopf', await bestaetigen.count() > 0);

  // ── C GEGENPROBE: Abbrechen darf NICHTS schreiben ─────────────────────────
  const vorAbbruch = schreibzugriffe(ctx).length;
  await klickeWennDa(knopfGenau(p, 'Abbrechen'), 'Abbrechen');
  await p.waitForTimeout(700);
  pruefe(
    'C1 Abbrechen schliesst das Fenster',
    !/Alle Stunden von/.test(await p.locator('body').innerText()),
  );
  pruefe(
    'C2 Abbrechen schreibt nichts',
    schreibzugriffe(ctx).length === vorAbbruch,
    `${schreibzugriffe(ctx).length - vorAbbruch} Schreibaufrufe`,
  );

  // ── D: bestaetigen schreibt wirklich ──────────────────────────────────────
  const vorFrei = schreibzugriffe(ctx).length;
  await klickeWennDa(knopf(p, 'Woche freigeben'), 'Woche freigeben');
  await p.waitForTimeout(600);
  await klickeWennDa(knopfGenau(p, 'Freigeben'), 'Freigeben');
  await p.waitForTimeout(1200);
  const nachFrei = schreibzugriffe(ctx).length;
  pruefe(
    'D1 „Woche freigeben" schreibt an die Verfuegbarkeit',
    nachFrei > vorFrei,
    `${nachFrei - vorFrei} Schreibaufrufe`,
  );

  // ── E: dasselbe fuer „Woche sperren" ──────────────────────────────────────
  await klickeWennDa(knopf(p, 'Woche sperren'), 'Woche sperren');
  await p.waitForTimeout(700);
  pruefe(
    'E1 „Woche sperren" oeffnet ein Fenster',
    /Alle freien Slots/.test(await p.locator('body').innerText()),
  );
  const vorSperr = schreibzugriffe(ctx).length;
  await klickeWennDa(knopfGenau(p, 'Sperren'), 'Sperren');
  await p.waitForTimeout(1200);
  pruefe(
    'E2 „Woche sperren" schreibt an die Verfuegbarkeit',
    schreibzugriffe(ctx).length > vorSperr,
    `${schreibzugriffe(ctx).length - vorSperr} Schreibaufrufe`,
  );

  // ── F: die Tages-Knoepfe wirken ohne Rueckfrage ───────────────────────────
  const vorTagFrei = schreibzugriffe(ctx).length;
  await klickeWennDa(knopf(p, 'Diesen Tag freigeben'), 'Diesen Tag freigeben');
  await p.waitForTimeout(1200);
  pruefe(
    'F1 „Diesen Tag freigeben" schreibt sofort',
    schreibzugriffe(ctx).length > vorTagFrei,
    `${schreibzugriffe(ctx).length - vorTagFrei} Schreibaufrufe`,
  );

  // „Diesen Tag sperren" ersetzt seit 16.09. „Urlaub eintragen", das nur
  // „kommt im naechsten Release" meldete.
  const vorTagSperr = schreibzugriffe(ctx).length;
  pruefe('F2 „Diesen Tag sperren" gibt es', await knopf(p, 'Diesen Tag sperren').count() > 0);
  await klickeWennDa(knopf(p, 'Diesen Tag sperren'), 'Diesen Tag sperren');
  await p.waitForTimeout(1200);
  pruefe(
    'F3 „Diesen Tag sperren" schreibt sofort',
    schreibzugriffe(ctx).length > vorTagSperr,
    `${schreibzugriffe(ctx).length - vorTagSperr} Schreibaufrufe`,
  );

  pruefe(
    'F4 Kein Knopf kuendigt nur an',
    !/naechsten Release|nächsten Release/.test(await p.locator('body').innerText()),
  );

  await b.close();
  console.log(fehler === 0
    ? '\nReise 9: die Kalender-Knoepfe wirken.'
    : `\nReise 9: ${fehler} Zusicherung(en) nicht erfuellt.`);
  process.exit(fehler === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
