// Der Vergleich des Admin-Secrets — ausgefuehrt.
//
// Er schuetzt drei Aufrufe, die ohne Nutzer-Anmeldung auskommen:
// release-escrow (gibt Geld frei), pstg-annual-report (Steuermeldung) und
// zustellung (verschickt Pflichtmitteilungen). Faellt er, faellt alles drei.
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { adminSecretStimmt } from "../functions/_shared/adminSecret.ts";

const ECHT = "s3cr3t-mit-genug-entropie-0123456789";

Deno.test("das richtige Secret kommt durch", () => {
  assertEquals(adminSecretStimmt(ECHT, ECHT), true);
});

Deno.test("ein falsches Secht gleicher Laenge kommt nicht durch", () => {
  const falsch = ECHT.slice(0, -1) + "X";
  assertEquals(falsch.length, ECHT.length);
  assertEquals(adminSecretStimmt(falsch, ECHT), false);
});

Deno.test("Abweichung im LETZTEN Zeichen wird erkannt", () => {
  // Die Schleife laeuft ueber die volle Laenge. Stiege sie frueh aus, waere
  // dieser Fall der einzige, der noch auffiele — und die Antwortzeit verriete
  // das Secret zeichenweise (Security-Befund L4).
  assertEquals(adminSecretStimmt(ECHT.slice(0, -1) + "z", ECHT), false);
});

Deno.test("Abweichung im ERSTEN Zeichen wird erkannt", () => {
  assertEquals(adminSecretStimmt("Z" + ECHT.slice(1), ECHT), false);
});

Deno.test("unterschiedliche Laenge kommt nicht durch", () => {
  assertEquals(adminSecretStimmt(ECHT + "x", ECHT), false);
  assertEquals(adminSecretStimmt(ECHT.slice(0, -1), ECHT), false);
});

Deno.test("OHNE gesetztes Secret kommt NIEMAND durch", () => {
  // Der wichtigste Fall. Stuende hier ein blosses `gemeldet === erwartet`,
  // liesse eine Umgebung ohne gesetztes Werkant_ADMIN_SECRET jeden Aufrufer
  // durch, der einen leeren Header schickt — und damit jeden, der die URL
  // kennt, an release-escrow.
  assertEquals(adminSecretStimmt("", ""), false, "leer gegen leer darf NICHT passen");
  assertEquals(adminSecretStimmt(null, null), false);
  assertEquals(adminSecretStimmt(undefined, undefined), false);
  assertEquals(adminSecretStimmt("irgendwas", undefined), false);
  assertEquals(adminSecretStimmt("irgendwas", ""), false);
  assertEquals(adminSecretStimmt(undefined, ECHT), false);
  assertEquals(adminSecretStimmt("", ECHT), false);
  assertEquals(adminSecretStimmt(null, ECHT), false);
});

Deno.test("die Schleife steigt nicht frueh aus (Quelltext-Pruefung)", async () => {
  // GRENZE, offen benannt: die Konstantzeit-Eigenschaft ist mit einem
  // Unit-Test NICHT beweisbar. Nachgemessen — ein frueher Ausstieg
  // (`if (a !== b) return false` in der Schleife) ist funktional identisch und
  // laesst ALLE sechs Tests oben gruen. Er unterscheidet sich nur in der
  // Laufzeit, und die sieht ein Test nicht.
  //
  // Eine Laufzeitmessung waere hier der falsche Weg: sie waere in einer
  // geteilten Umgebung unzuverlaessig, und ein Pruefer mit Fehlalarmen wird
  // abgeschaltet und nie wieder an.
  //
  // Also wird der Quelltext geprueft, so wie es im Haus fuer Bindungs- und
  // Verdrahtungsfragen ueblich ist.
  const quelle = await Deno.readTextFile(
    new URL("../functions/_shared/adminSecret.ts", import.meta.url),
  );
  const schleife = quelle.match(/for \(let i = 0[\s\S]*?\n  \}/);
  assertEquals(schleife !== null, true, "Vergleichsschleife nicht gefunden");
  assertEquals(
    /\breturn\b/.test(schleife![0]),
    false,
    "kein `return` in der Vergleichsschleife: ein frueher Ausstieg verraet das Secret zeichenweise",
  );
});
