// Die Berechtigung und die Entscheidung der Anbieter-Pruefung.
//
// Der teuerste Fehler waere hier, dass die leere Betreiber-Liste ein Freibrief
// ist: dann kaeme jeder Angemeldete an fremde Gewerbescheine. Genau diese
// Fehlerklasse gab es im Haus schon einmal, bei adminSecretStimmt — ein
// blosses `gemeldet === erwartet` haette eine Umgebung ohne gesetztes Secret
// jeden durchgelassen, der einen leeren Header schickt.
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  istBetreiber, entscheidungPruefen, ablehnungsText, MIN_GRUND,
} from "../functions/pruefung/handler.ts";

const UUID = "11111111-2222-4333-8444-555555555555";

Deno.test("OHNE gesetzte Liste ist NIEMAND Betreiber", () => {
  for (const liste of [undefined, null, "", "   ", ",", " , , "]) {
    assertEquals(istBetreiber("chef@werkant.de", liste), false);
  }
});

Deno.test("ohne Adresse kommt niemand durch, auch nicht bei gesetzter Liste", () => {
  for (const email of [undefined, null, ""]) {
    assertEquals(istBetreiber(email, "chef@werkant.de"), false);
  }
});

Deno.test("die eingetragene Adresse kommt durch, Gross- und Kleinschreibung egal", () => {
  assertEquals(istBetreiber("chef@werkant.de", "chef@werkant.de"), true);
  assertEquals(istBetreiber("Chef@Werkant.DE", " chef@werkant.de "), true);
});

Deno.test("mehrere Adressen, kommagetrennt", () => {
  const liste = "chef@werkant.de, zweite@werkant.de";
  assertEquals(istBetreiber("zweite@werkant.de", liste), true);
  assertEquals(istBetreiber("dritte@werkant.de", liste), false);
});

Deno.test("eine fremde Adresse kommt NICHT durch", () => {
  assertEquals(istBetreiber("angreifer@example.com", "chef@werkant.de"), false);
});

Deno.test("eine Teilzeichenkette reicht NICHT", () => {
  // „chef@werkant.de.angreifer.com" enthaelt die erlaubte Adresse.
  assertEquals(istBetreiber("chef@werkant.de.angreifer.com", "chef@werkant.de"), false);
  assertEquals(istBetreiber("xchef@werkant.de", "chef@werkant.de"), false);
});

Deno.test("Freigabe braucht eine gueltige Kennung", () => {
  const e = entscheidungPruefen({ art: "freigeben", providerId: "keine-uuid" });
  assertEquals(e.ok, false);
});

Deno.test("Freigabe setzt approved und hat keinen Grund", () => {
  const e = entscheidungPruefen({ art: "freigeben", providerId: UUID });
  assertEquals(e, { ok: true, status: "approved", grund: null });
});

Deno.test("Ablehnung OHNE Begruendung wird abgewiesen (Art. 4 P2B-VO)", () => {
  for (const grund of ["", "   ", "passt nicht", "nein"]) {
    const e = entscheidungPruefen({ art: "ablehnen", providerId: UUID, grund });
    assertEquals(e.ok, false, `„${grund}" haette abgewiesen werden muessen`);
  }
});

Deno.test("Ablehnung MIT Begruendung geht durch, getrimmt", () => {
  const grund = "  Der Gewerbeschein ist unleserlich fotografiert.  ";
  const e = entscheidungPruefen({ art: "ablehnen", providerId: UUID, grund });
  assertEquals(e, {
    ok: true, status: "rejected",
    grund: "Der Gewerbeschein ist unleserlich fotografiert.",
  });
});

Deno.test("die Untergrenze ist dieselbe Groessenordnung wie anderswo im Haus", () => {
  assertEquals(MIN_GRUND, 20);
});

Deno.test("der Ablehnungstext nennt den Grund UND den Weg zurueck", () => {
  const t = ablehnungsText("Der Gewerbeschein ist unleserlich fotografiert.");
  assertEquals(t.text.includes("unleserlich"), true);
  assertEquals(t.text.includes("erneut einreichen"), true);
  // Art. 22 Abs. 3 DSGVO ist hier nicht einschlaegig (es entscheidet ohnehin
  // ein Mensch), aber der Weg zu einem Menschen gehoert trotzdem hinein.
  assertEquals(t.text.includes("Eine Person sieht sie sich an."), true);
});
