// Der Ablauf eines Bestaetigungslinks — ausgefuehrt, nicht nur behauptet.
//
// ANLASS (13.09.2026, Selbst-Check): Die Seite sagte woertlich „bereits
// verwendet ODER IST ABGELAUFEN". Einen Ablauf gab es nicht: die Abfrage war
// `.eq("token", token)`, `sent_at` wurde gespeichert und nie gelesen, und
// keine Aufraeumung entfernte alte Zeilen. Ein Link aus einer Mail von vor
// einem Jahr haette unveraendert funktioniert.
//
// Dieselbe Klasse wie AGB §7(3) („innerhalb von 12 Monaten"), wo der Code ohne
// Datumsgrenze zaehlte: eine Zusage im sichtbaren Text, die niemand gegen den
// Code gelegt hat.
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { linkGueltig, TOKEN_GUELTIG_TAGE } from "../functions/verify-email/gueltigkeit.ts";

const JETZT = new Date("2026-09-13T12:00:00Z");
const vorTagen = (t: number) =>
  new Date(JETZT.getTime() - t * 24 * 60 * 60 * 1000).toISOString();

Deno.test("frischer Link gilt", () => {
  assertEquals(linkGueltig(JETZT.toISOString(), JETZT), true);
  assertEquals(linkGueltig(vorTagen(1), JETZT), true);
  assertEquals(linkGueltig(vorTagen(TOKEN_GUELTIG_TAGE - 1), JETZT), true);
});

Deno.test("alter Link gilt nicht mehr", () => {
  assertEquals(linkGueltig(vorTagen(TOKEN_GUELTIG_TAGE + 1), JETZT), false);
  assertEquals(linkGueltig(vorTagen(365), JETZT), false);
});

Deno.test("die Grenze liegt genau bei der Frist, nicht daneben", () => {
  // Ein Aus-den-Augen-Fehler an dieser Stelle verschiebt die Frist um einen
  // ganzen Tag, ohne dass irgendetwas auffaellt.
  const genau = new Date(JETZT.getTime() - TOKEN_GUELTIG_TAGE * 86400_000);
  assertEquals(linkGueltig(genau.toISOString(), JETZT), true, "exakt auf der Frist gilt noch");
  const knappDrueber = new Date(genau.getTime() - 1000);
  assertEquals(linkGueltig(knappDrueber.toISOString(), JETZT), false);
});

Deno.test("unlesbarer oder fehlender Zeitstempel gilt als abgelaufen", () => {
  // Die sichere Richtung ist die strengere: bei einem Wert, den niemand deuten
  // kann, darf ein Link nicht einfach weitergelten.
  for (const wert of [null, undefined, "", "irgendwas", "0000-13-45"]) {
    assertEquals(linkGueltig(wert, JETZT), false, `${JSON.stringify(wert)} galt als gueltig`);
  }
});

Deno.test("Zeitstempel aus der Zukunft sperrt nicht aus", () => {
  // Uhrversatz zwischen Datenbank und Laufzeit darf keinen frischen Link
  // entwerten — aber auch nicht dazu fuehren, dass er ewig gilt: der Fall
  // laeuft ueber die negative Differenz, nicht ueber die Frist.
  const zukunft = new Date(JETZT.getTime() + 60_000).toISOString();
  assertEquals(linkGueltig(zukunft, JETZT), true);
});

Deno.test("die Frist ist lang genug, um niemanden auszusperren", () => {
  // Eine Frist von einer Stunde waere eine gruene Zahl, die Menschen
  // aussperrt: die Mail kann im Spam liegen oder am Wochenende ungelesen
  // bleiben. Ein Angreifer haette die Mail ohnehin sofort.
  assertEquals(TOKEN_GUELTIG_TAGE >= 3, true);
  assertEquals(TOKEN_GUELTIG_TAGE <= 30, true);
});
