// Ausfuehrbare Tests des Meldewegs nach Art. 16 DSA.
//
// Getestet wird AUSSCHLIESSLICH die eigene Logik in
// supabase/functions/inhalts-meldung/handler.ts — dieselbe Funktion, die
// index.ts in Produktion aufruft. Keine zweite Fassung der Logik im Test.
//
// WARUM diese Tests: die Pflichtangaben aus Art. 16 Abs. 2 lit. a-d sind
// Rechtspflichten, keine Bequemlichkeiten. Wird eine davon still optional —
// weil jemand eine Zeile umstellt oder eine Untergrenze senkt —, entsteht ein
// Meldeweg, der Meldungen annimmt, die sich nicht bearbeiten lassen. Das faellt
// niemandem auf, bis eine Aufsichtsbehoerde fragt.
//
// GRENZE: Der Supabase-Double wertet keine Filter aus und fuehrt kein SQL aus.
// Was hier belegt wird, ist die ABLAUFSTEUERUNG und die Eingabepruefung des
// Handlers. Die Wirkung der CHECK-Bedingungen und der RLS ist gegen echtes
// Postgres in scripts/db-test/dsa.sql belegt.
import { assertEquals, assert } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { handleInhaltsMeldung } from "../functions/inhalts-meldung/handler.ts";
import { FakeSupabase } from "../functions/_shared/testing/fakeSupabase.ts";

// deno-lint-ignore no-explicit-any
const asAny = (x: unknown) => x as any;

const GUELTIG = {
  inhaltArt: "profil",
  fundstelle: "/anbieter/abc123",
  begruendung:
    "Das Profil verwendet eine Meisterurkunde, die nachweislich zu einem anderen Betrieb gehoert.",
  melderName: "Melderin M",
  melderEmail: "melderin@example.com",
  treuUndGlauben: true,
};

function bau(body: unknown, kopf: Record<string, string> = {}): Request {
  return new Request("https://x/inhalts-meldung", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...kopf },
    body: JSON.stringify(body),
  });
}

function doubleMitErfolg(): FakeSupabase {
  const db = new FakeSupabase({
    "inhalts_meldungen.insert": [
      { data: { id: "11111111-1111-1111-1111-111111111111", eingegangen_am: "2026-09-07T20:00:00Z" } },
    ],
  });
  // check_rate_limit liefert true = innerhalb des Kontingents.
  db.rpcResponses = { check_rate_limit: { data: true } };
  return db;
}

Deno.test("A: eine vollstaendige Meldung wird angenommen und quittiert", async () => {
  const db = doubleMitErfolg();
  const res = await handleInhaltsMeldung(bau(GUELTIG), { supabase: db });
  assertEquals(res.status, 201);
  const body = await res.json();
  assertEquals(body.id, "11111111-1111-1111-1111-111111111111");
  assert(body.eingegangenAm, "Art. 16 Abs. 4: der Eingang muss quittiert werden");
});

Deno.test("B: ohne Erklaerung in gutem Glauben wird abgewiesen (Art. 16(2)(d))", async () => {
  const db = doubleMitErfolg();
  const res = await handleInhaltsMeldung(
    bau({ ...GUELTIG, treuUndGlauben: false }),
    { supabase: db },
  );
  assertEquals(res.status, 400);
  // Und die Meldung darf NICHT gespeichert worden sein.
  assertEquals(db.calls.filter((c) => c.op === "insert").length, 0);
});

Deno.test("C: eine zu duenne Begruendung wird abgewiesen (Art. 16(2)(a))", async () => {
  const db = doubleMitErfolg();
  const res = await handleInhaltsMeldung(
    bau({ ...GUELTIG, begruendung: "ist illegal" }),
    { supabase: db },
  );
  assertEquals(res.status, 400);
  assertEquals(db.calls.filter((c) => c.op === "insert").length, 0);
});

Deno.test("D: eine fehlende Fundstelle wird abgewiesen (Art. 16(2)(b))", async () => {
  const db = doubleMitErfolg();
  const res = await handleInhaltsMeldung(
    bau({ ...GUELTIG, fundstelle: "" }),
    { supabase: db },
  );
  assertEquals(res.status, 400);
});

Deno.test("E: eine unbrauchbare E-Mail-Adresse wird abgewiesen (Art. 16(2)(c))", async () => {
  const db = doubleMitErfolg();
  const res = await handleInhaltsMeldung(
    bau({ ...GUELTIG, melderEmail: "keine-adresse" }),
    { supabase: db },
  );
  assertEquals(res.status, 400);
});

Deno.test("F: eine unbekannte Inhaltsart wird abgewiesen, nicht an die DB gereicht", async () => {
  const db = doubleMitErfolg();
  const res = await handleInhaltsMeldung(
    bau({ ...GUELTIG, inhaltArt: "irgendwas" }),
    { supabase: db },
  );
  assertEquals(res.status, 400);
  assertEquals(db.calls.filter((c) => c.op === "insert").length, 0);
});

Deno.test("G: unerwartete Felder werden abgewiesen", async () => {
  const db = doubleMitErfolg();
  const res = await handleInhaltsMeldung(
    bau({ ...GUELTIG, melder_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" }),
    { supabase: db },
  );
  assertEquals(res.status, 400);
});

Deno.test("H: OHNE Anmeldung geht die Meldung durch, melder_id bleibt leer", async () => {
  // Das ist der Kern von Art. 16 Abs. 1: der Weg richtet sich an "Personen und
  // Einrichtungen", nicht an Nutzer. Ein Meldeweg hinter einer Anmeldung ist
  // keiner.
  const db = doubleMitErfolg();
  const res = await handleInhaltsMeldung(bau(GUELTIG), { supabase: db });
  assertEquals(res.status, 201);
  const insert = db.calls.find((c) => c.op === "insert");
  assertEquals(asAny(insert?.payload).melder_id, null);
});

Deno.test("I: mit Anmeldung wird die Meldung der Person zugeordnet", async () => {
  const db = doubleMitErfolg();
  db.authUser = { id: "22222222-2222-2222-2222-222222222222" };
  const res = await handleInhaltsMeldung(
    bau(GUELTIG, { Authorization: "Bearer gueltiges-token" }),
    { supabase: db },
  );
  assertEquals(res.status, 201);
  const insert = db.calls.find((c) => c.op === "insert");
  assertEquals(asAny(insert?.payload).melder_id, "22222222-2222-2222-2222-222222222222");
});

Deno.test("J: ein ABGELAUFENES Token laesst die Meldung nicht scheitern", async () => {
  // Sonst haengt der gesetzliche Meldeweg an einer alten Sitzung. Die Meldung
  // geht durch, nur eben ohne Zuordnung.
  const db = doubleMitErfolg();
  db.authUser = null;
  const res = await handleInhaltsMeldung(
    bau(GUELTIG, { Authorization: "Bearer abgelaufen" }),
    { supabase: db },
  );
  assertEquals(res.status, 201);
  const insert = db.calls.find((c) => c.op === "insert");
  assertEquals(asAny(insert?.payload).melder_id, null);
});

Deno.test("K: der Straftatsverdacht wird uebernommen (Art. 18)", async () => {
  const db = doubleMitErfolg();
  const res = await handleInhaltsMeldung(
    bau({ ...GUELTIG, straftatVerdacht: true }),
    { supabase: db },
  );
  assertEquals(res.status, 201);
  const insert = db.calls.find((c) => c.op === "insert");
  assertEquals(asAny(insert?.payload).straftat_verdacht, true);
});

Deno.test("L: automatisiert ist false — die Angabe wird offengelegt, nicht behauptet", async () => {
  // Art. 16 Abs. 6 verlangt die Offenlegung automatisierter Mittel. Solange von
  // Hand geprueft wird, MUSS hier false stehen; ein true waere eine falsche
  // Selbstauskunft, ein fehlendes Feld eine unvollstaendige.
  const db = doubleMitErfolg();
  await handleInhaltsMeldung(bau(GUELTIG), { supabase: db });
  const insert = db.calls.find((c) => c.op === "insert");
  assertEquals(asAny(insert?.payload).automatisiert, false);
});

Deno.test("M: der Eingang wird beim Speichern vermerkt (Art. 16 Abs. 4)", async () => {
  const db = doubleMitErfolg();
  await handleInhaltsMeldung(bau(GUELTIG), { supabase: db });
  const insert = db.calls.find((c) => c.op === "insert");
  assert(asAny(insert?.payload).bestaetigt_am, "bestaetigt_am fehlt");
});

Deno.test("N: ein ueberschrittenes Kontingent gibt 429 und speichert nichts", async () => {
  const db = new FakeSupabase({});
  db.rpcResponses = { check_rate_limit: { data: false } };
  const res = await handleInhaltsMeldung(bau(GUELTIG), { supabase: db });
  assertEquals(res.status, 429);
  assertEquals(db.calls.filter((c) => c.op === "insert").length, 0);
});

Deno.test("O: das Kontingent wird pro IP UND pro E-Mail geprueft", async () => {
  const db = doubleMitErfolg();
  await handleInhaltsMeldung(bau(GUELTIG), { supabase: db });
  const schluessel = db.rpcCalls
    .filter((c) => c.fn === "check_rate_limit")
    .map((c) => asAny(c.args).p_key as string);
  assertEquals(schluessel.length, 2);
  assert(schluessel.some((k) => k.startsWith("ip:")), "IP-Kontingent fehlt");
  assert(schluessel.some((k) => k.startsWith("mail:")), "E-Mail-Kontingent fehlt");
});

Deno.test("P: GET wird abgewiesen", async () => {
  const db = doubleMitErfolg();
  const res = await handleInhaltsMeldung(
    new Request("https://x/inhalts-meldung", { method: "GET" }),
    { supabase: db },
  );
  assertEquals(res.status, 405);
});
