// Die gemeinsame Fristrechnung fuer Links aus Mails.
//
// Zwei Funktionen sagten ihren Nutzern, ein Link sei „abgelaufen", und keine
// von beiden hatte einen Ablauf (verify-email, waitlist-doi). Die Rechnung
// liegt jetzt an einer Stelle; die FRISTEN bleiben getrennt, weil sie
// verschiedene Abwaegungen sind.
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { linkGueltig } from "../functions/_shared/linkfrist.ts";

const JETZT = new Date("2026-09-13T12:00:00Z");
const vorTagen = (t: number) =>
  new Date(JETZT.getTime() - t * 24 * 60 * 60 * 1000).toISOString();

Deno.test("die Frist wird uebergeben, nicht angenommen", () => {
  // Derselbe Zeitstempel, zwei Fristen, zwei Antworten. Waere die Frist im
  // Baustein festgeschrieben, haetten beide Aufrufer dieselbe — und eine von
  // ihnen die falsche.
  const zehnTageAlt = vorTagen(10);
  assertEquals(linkGueltig(zehnTageAlt, 7, JETZT), false, "7-Tage-Frist: abgelaufen");
  assertEquals(linkGueltig(zehnTageAlt, 30, JETZT), true, "30-Tage-Frist: gilt noch");
});

Deno.test("die Grenze liegt genau auf der Frist", () => {
  for (const tage of [7, 30]) {
    const genau = new Date(JETZT.getTime() - tage * 86400_000).toISOString();
    assertEquals(linkGueltig(genau, tage, JETZT), true, `${tage}: exakt auf der Frist gilt noch`);
    const knappDrueber = new Date(JETZT.getTime() - tage * 86400_000 - 1000).toISOString();
    assertEquals(linkGueltig(knappDrueber, tage, JETZT), false, `${tage}: eine Sekunde drueber nicht`);
  }
});

Deno.test("unlesbarer oder fehlender Zeitstempel gilt als abgelaufen", () => {
  for (const wert of [null, undefined, "", "irgendwas", "0000-13-45"]) {
    assertEquals(linkGueltig(wert, 30, JETZT), false, `${JSON.stringify(wert)} galt als gueltig`);
  }
});

Deno.test("Zeitstempel aus der Zukunft sperrt nicht aus", () => {
  const zukunft = new Date(JETZT.getTime() + 60_000).toISOString();
  assertEquals(linkGueltig(zukunft, 7, JETZT), true);
});
