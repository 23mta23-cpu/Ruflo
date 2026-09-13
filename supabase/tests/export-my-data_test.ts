// Zwei Zusagen der Art.-15-Auskunft ausfuehren, nicht nur typpruefen.
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  Collector, threadFilter, eigeneKundenAuftraege,
} from "../functions/export-my-data/auswahl.ts";

const UID = "11111111-1111-1111-1111-111111111111";
const FREMD = "22222222-2222-2222-2222-222222222222";

// ── Der Abbruch bei unvollstaendiger Auskunft ──────────────────────────────

Deno.test("eine gescheiterte Kategorie wird gemerkt, nicht verschwiegen", () => {
  // Eine Auskunft, der still eine Kategorie fehlt, ist schlimmer als gar
  // keine: der Betroffene haelt sie fuer vollstaendig und fragt nicht nach.
  const c = new Collector();
  assertEquals(c.take("auftraege", { data: [1, 2], error: null }), [1, 2]);
  assertEquals(c.take("vertraege", { data: null, error: { message: "kaputt" } }), null);
  assertEquals(c.failed, ["vertraege"]);
});

Deno.test("ohne Fehler bleibt die Liste leer", () => {
  const c = new Collector();
  c.take("a", { data: [], error: null });
  c.take("b", { data: null, error: null });
  assertEquals(c.failed, []);
});

Deno.test("leere Daten sind KEIN Fehler", () => {
  // Ein Nutzer ohne Auftraege hat keine Auftraege — das ist eine vollstaendige
  // Auskunft, kein Abbruchgrund. Wer hier auf Wahrheitswert prueft statt auf
  // `error`, bricht jede Auskunft eines neuen Kontos ab.
  const c = new Collector();
  for (const leer of [[], null, 0, ""]) {
    c.take("x", { data: leer, error: null });
  }
  assertEquals(c.failed, []);
});

// ── Die Trennung fremder Gespraechsfaeden (Security-Befund L1) ─────────────

Deno.test("ohne eigene Auftraege nur der eigene Faden", () => {
  // Ein Anbieter ist bei keinem Auftrag Kunde. Er darf ausschliesslich seine
  // eigenen Faeden bekommen.
  assertEquals(threadFilter(UID, []), `provider_id.eq.${UID}`);
});

Deno.test("als Kunde auch die Faeden der eigenen Auftraege", () => {
  const f = threadFilter(UID, ["job-a", "job-b"]);
  assertEquals(f, `provider_id.eq.${UID},job_id.in.(job-a,job-b)`);
});

Deno.test("der eigene Faden bleibt IMMER drin, auch als Kunde", () => {
  // Die Luecke in die andere Richtung: ein Anbieter, der zu einem offenen
  // Auftrag rueckgefragt und den Zuschlag nicht bekommen hat, ist weder Kunde
  // noch zugewiesener Anbieter. Faellt `provider_id.eq` weg, verschwinden
  // SEINE EIGENEN Nachrichten aus SEINER Auskunft.
  assertEquals(threadFilter(UID, ["job-a"]).includes(`provider_id.eq.${UID}`), true);
});

Deno.test("nur Auftraege, bei denen der Nutzer Kunde ist", () => {
  // Der Kern von L1: waeren hier auch Auftraege dabei, bei denen er Anbieter
  // ist, enthielte seine Auskunft die Rueckfragen KONKURRIERENDER Anbieter —
  // fremdes Personendatum und zugleich ein Wettbewerbsgeheimnis.
  const jobs = [
    { id: "meiner-1", customer_id: UID },
    { id: "fremder",  customer_id: FREMD },
    { id: "meiner-2", customer_id: UID },
  ];
  assertEquals(eigeneKundenAuftraege(UID, jobs), ["meiner-1", "meiner-2"]);
});

Deno.test("keine eigenen Auftraege ergibt eine leere Liste", () => {
  assertEquals(eigeneKundenAuftraege(UID, [{ id: "x", customer_id: FREMD }]), []);
  assertEquals(eigeneKundenAuftraege(UID, []), []);
});
