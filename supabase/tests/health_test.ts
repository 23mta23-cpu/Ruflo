// Was „ok" bedeutet — ausgefuehrt, damit es niemand versehentlich umdeutet.
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { istOk, statusFuer, type Secrets } from "../functions/health/bewertung.ts";

Deno.test("ok heisst: die Secrets sitzen", () => {
  assertEquals(istOk({ mail: true, db: true }), true);
  assertEquals(istOk({ mail: false, db: true }), false);
  assertEquals(istOk({ mail: true, db: false }), false);
  assertEquals(istOk({ mail: false, db: false }), false);
});

Deno.test("ein fehlendes Secret ergibt 503, damit ein Lauf gar nicht erst startet", () => {
  assertEquals(statusFuer(true), 200);
  assertEquals(statusFuer(false), 503);
});

Deno.test("ein Rueckstand zieht ok NICHT auf false", () => {
  // Der eigentliche Punkt dieser Datei. `ok` bedeutet "die Secrets sitzen",
  // nicht "alles in Ordnung". Zoege ein Stau es auf false, antwortete /health
  // mit 503 — und ein Ueberwachungsdienst, der nur den Statuscode liest,
  // koennte "falsch eingerichtet" nicht mehr von "hat gerade etwas
  // abzuarbeiten" unterscheiden.
  //
  // Dass die Signatur die Staus gar nicht entgegennimmt, IST die Zusage: was
  // nicht uebergeben werden kann, kann das Ergebnis nicht beeinflussen.
  // Dieselbe Ueberlegung wie bei meine_aktiven_strikes() in 0820.
  // Der Beweis muss die REGEL treffen, nicht eine Kopie in diesem Test. Ein
  // erster Versuch verglich `Object.keys` eines selbst geschriebenen Literals
  // — der blieb gruen, als die Regel testweise um `&& !s.stau` erweitert
  // wurde. Ein Test, der die Mutation nicht sehen kann, beweist nichts.
  //
  // Deshalb wird ein Stau-Signal TATSAECHLICH uebergeben. Bleibt `ok` wahr,
  // ist bewiesen, dass die Regel es ignoriert.
  const mitStau = { mail: true, db: true, stau: true } as unknown as Secrets;
  assertEquals(istOk(mitStau), true, "ein Rueckstand darf ok nicht kippen");
  assertEquals(statusFuer(istOk(mitStau)), 200, "und /health bleibt bei 200");
});
