// Die Trennung zwischen Handwerk und Nachbarschaft ausfuehren, nicht nur
// typpruefen.
//
// Founder-Befund 20.07.2026: ein Nachbarschaftshelfer sah Handwerks-Anfragen
// und konnte darauf bieten. Meisterpflichtige Arbeiten (§1 HwO Anlage A)
// duerfen nicht ueber den Nachbarschafts-Zweig vermittelt werden. Die
// offers-Policy dazu (0480) ist in scripts/db-test/ abgedeckt; dieser Filter
// war es bis 13.09.2026 nicht.
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { passendeAnbieter } from "../functions/notify-matching-providers/auswahl.ts";

const handwerker = (plz: string, id = "hw") =>
  ({ id, is_nachbarschaft: false, profile: { plz } });
const nachbar = (plz: string, id = "nb") =>
  ({ id, is_nachbarschaft: true, profile: { plz } });

const handwerksAuftrag = { address_plz: "50667", track: "handwerker" };
const nachbarAuftrag = { address_plz: "50667", track: "nachbarschaft" };

Deno.test("Nachbarschaftshelfer bekommt KEINEN Handwerks-Auftrag (§1 HwO)", () => {
  const treffer = passendeAnbieter(handwerksAuftrag, [
    nachbar("50667", "nb1"),
    handwerker("50667", "hw1"),
  ]);
  assertEquals(treffer.map((t) => t.id), ["hw1"]);
});

Deno.test("Handwerker bekommt KEINEN Nachbarschafts-Auftrag", () => {
  // Auch die Gegenrichtung. Sonst wandert der guenstigere Zweig zum Gewerbe ab.
  const treffer = passendeAnbieter(nachbarAuftrag, [
    nachbar("50667", "nb1"),
    handwerker("50667", "hw1"),
  ]);
  assertEquals(treffer.map((t) => t.id), ["nb1"]);
});

Deno.test("fehlendes Kennzeichen gilt als Handwerker, nicht als Nachbar", () => {
  // Ein Anbieterprofil ohne `is_nachbarschaft` darf nicht in den
  // Nachbarschafts-Zweig rutschen — die Voreinstellung muss die strengere sein.
  const ohne = { id: "x", profile: { plz: "50667" } };
  assertEquals(passendeAnbieter(nachbarAuftrag, [ohne]).length, 0);
  assertEquals(passendeAnbieter(handwerksAuftrag, [ohne]).length, 1);
});

Deno.test("die Region muss auf zwei Ziffern passen", () => {
  const treffer = passendeAnbieter(handwerksAuftrag, [
    handwerker("50667", "koeln-innenstadt"),
    handwerker("50733", "koeln-nippes"),
    handwerker("51373", "leverkusen"),
    handwerker("10115", "berlin"),
  ]);
  // Koeln ist "50", Leverkusen "51". Die beiden liegen 15 km auseinander und
  // finden sich ueber diesen Filter NIE. Das ist keine Panne im Code, sondern
  // die Reichweite, die er hat — festgehalten in
  // notes/04-Entscheidungen/Reichweite-Anbieter-Matching.md, weil der
  // Markteintritt ausdruecklich Koeln UND Leverkusen ist.
  assertEquals(treffer.map((t) => t.id), ["koeln-innenstadt", "koeln-nippes"]);
});

Deno.test("Leverkusen erfaehrt nichts von einem Koelner Auftrag", () => {
  // Der Fall oben noch einmal allein, damit er beim Lesen der Testnamen
  // auffaellt und nicht in einer Liste untergeht.
  assertEquals(passendeAnbieter(handwerksAuftrag, [handwerker("51373")]).length, 0);
});

Deno.test("ohne PLZ am Auftrag bekommt NIEMAND eine Mitteilung", () => {
  // Der wichtige Teil: lieber keine Mitteilung als eine an alle. Ein Auftrag
  // ohne Region wuerde sonst jeden Anbieter im Bestand anschreiben.
  for (const plz of [undefined, null, "", "5"]) {
    const treffer = passendeAnbieter(
      { address_plz: plz, track: "handwerker" },
      [handwerker("50667"), handwerker("10115")],
    );
    assertEquals(treffer.length, 0, `PLZ ${JSON.stringify(plz)} traf jemanden`);
  }
});

Deno.test("Anbieter ohne PLZ ist nicht dabei", () => {
  const ohnePlz = { id: "x", is_nachbarschaft: false, profile: null };
  assertEquals(passendeAnbieter(handwerksAuftrag, [ohnePlz]).length, 0);
});

Deno.test("leere und fehlende Liste sind kein Fehler", () => {
  assertEquals(passendeAnbieter(handwerksAuftrag, []), []);
  assertEquals(passendeAnbieter(handwerksAuftrag, null), []);
  assertEquals(passendeAnbieter(handwerksAuftrag, undefined), []);
});
