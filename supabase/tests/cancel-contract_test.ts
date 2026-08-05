// Ausfuehrbare Tests der Stornierungslogik.
//
// Getestet wird AUSSCHLIESSLICH die eigene Logik in
// supabase/functions/cancel-contract/handler.ts — dieselbe Funktion, die
// index.ts in Produktion aufruft. KEINE zweite Version der Logik im Test.
//
// KEIN echter Stripe-Aufruf.
//
// FACHLICHE GRENZE: Die Erstattungsquoten (100 % / 50 % / 0 %), die Stornofristen
// und die Frage, wem das bei einer Null-Erstattung nicht zurueckgezahlte Geld
// zusteht, sind NICHT entschieden. Diese Tests halten den Ist-Zustand fest und
// erklaeren ihn NICHT fuer rechtlich oder geschaeftlich bestaetigt.
import { assertEquals, assert, assertFalse } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { handleCancelContract } from "../functions/cancel-contract/handler.ts";
import { FakeSupabase } from "../functions/_shared/testing/fakeSupabase.ts";
import { FakeStripe, makeFakePush } from "../functions/_shared/testing/fakeStripe.ts";

// deno-lint-ignore no-explicit-any
const asAny = (x: unknown) => x as any;

const KUNDE = "11111111-1111-1111-1111-111111111111";
const ANBIETER = "22222222-2222-2222-2222-222222222222";
const FREMD = "99999999-9999-9999-9999-999999999999";
const VERTRAG = "33333333-3333-3333-3333-333333333333";

/** Termin in `h` Stunden — steuert die Erstattungsstufe. */
const inStunden = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

const vertrag = (u: Record<string, unknown> = {}) => ({
  id: VERTRAG, job_id: "44444444-4444-4444-4444-444444444444",
  customer_id: KUNDE, provider_id: ANBIETER,
  status: "active", stripe_payment_intent: "pi_1",
  escrow_captured_at: "2026-08-01T10:00:00Z", customer_total: 102.50,
  customer_refunded_amount: 0,
  jobs: { title: "Bad sanieren", scheduled_at: inStunden(72) }, ...u,
});

function setup(o: {
  user?: string | null;
  contract?: Record<string, unknown> | null;
  contractUpdate?: { data?: unknown; error?: unknown };
  vorhandeneRefunds?: unknown[];
  historie?: Array<{ payment_intent_id: string }>;
  paymentIntent?: Record<string, unknown>;
  stripeFailing?: string[];
} = {}) {
  const db = new FakeSupabase({
    "contract_payment_intents.select": [{ data: o.historie ?? [{ payment_intent_id: "pi_1" }] }],
    "contracts.select": [{ data: o.contract === undefined ? vertrag() : o.contract }],
    "contracts.update": [o.contractUpdate ?? { data: { id: VERTRAG }, error: null }],
    "jobs.update":      [{ data: null, error: null }],
    "profiles.select":  [{ data: { push_token: "tok" } }],
  });
  db.authUser = o.user === undefined ? { id: KUNDE } : (o.user ? { id: o.user } : null);
  const stripe = new FakeStripe({
    "refunds.list":            [{ data: o.vorhandeneRefunds ?? [] }],
    "refunds.create":          [{ id: "re_1" }],
    "paymentIntents.retrieve": [o.paymentIntent ?? { id: "pi_1", status: "requires_payment_method" }],
    "paymentIntents.cancel":   [{ id: "pi_1", status: "canceled" }],
  }, o.stripeFailing ?? []);
  const push = makeFakePush();
  return { db, stripe, push, deps: { supabase: asAny(db), stripe: asAny(stripe), sendPush: push.fn } };
}

const anfrage = (body: unknown = { contract_id: VERTRAG }, auth = true) =>
  new Request("https://x/cancel-contract", {
    method: "POST",
    headers: auth
      ? { Authorization: "Bearer jwt", "Content-Type": "application/json" }
      : { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const erstattung = (n: number) => asAny(n).toFixed ? n : n;

// ── 1. Stornierung vor Zahlung ─────────────────────────────────────────────
Deno.test("1: Storno vor Zahlung — kein Refund, Vertrag storniert, Auftrag offen", async () => {
  const { db, stripe, deps } = setup({
    contract: vertrag({ status: "pending", escrow_captured_at: null }),
  });
  const r = await handleCancelContract(anfrage(), deps);
  assertEquals(r.status, 200);
  assertFalse(stripe.called("refunds.create"), "es wurde nie gezahlt");
  assertEquals(asAny(db.callsOn("contracts", "update")[0].payload).status, "cancelled");
  assertEquals(asAny(db.callsOn("jobs", "update")[0].payload).status, "open", "Auftrag wieder offen");
});

// ── 2. PaymentIntent noch offen ────────────────────────────────────────────
Deno.test("2: offener PaymentIntent wird storniert, damit er nicht doch einzieht", async () => {
  const { stripe, deps } = setup({
    contract: vertrag({ status: "pending", escrow_captured_at: null }),
    paymentIntent: { id: "pi_1", status: "requires_payment_method" },
  });
  assertEquals((await handleCancelContract(anfrage(), deps)).status, 200);
  assert(stripe.called("paymentIntents.cancel"), "offener Intent muss geschlossen werden");
  assertFalse(stripe.called("refunds.create"));
});

// ── 3. Zahlung erfolgreich, DB-Zeitstempel fehlt ───────────────────────────
Deno.test("3: gezahlt, aber escrow_captured_at leer — wird regulaer erstattet", async () => {
  const { stripe, deps } = setup({
    contract: vertrag({ status: "pending", escrow_captured_at: null }),
    paymentIntent: { id: "pi_1", status: "succeeded" },
  });
  const r = await handleCancelContract(anfrage(), deps);
  assertEquals(r.status, 200);
  assert(stripe.called("refunds.create"), "echtes Kundengeld darf nicht im Nichts stehen");
  assertFalse(stripe.called("paymentIntents.cancel"), "ein bezahlter Intent wird nicht storniert");
});

// ── 4./5./6. Erstattungsstufen — IST-ZUSTAND, nicht bestaetigt ─────────────
// Diese drei Tests halten die heutige Staffelung fest. Sie sagen NICHTS
// darueber, ob die Quoten fachlich oder rechtlich richtig sind.
Deno.test("4 [Ist-Zustand]: Kunde storniert >48h vorher — volle Erstattung", async () => {
  const { stripe, deps } = setup({ contract: vertrag({ jobs: { title: "T", scheduled_at: inStunden(72) } }) });
  const r = await handleCancelContract(anfrage(), deps);
  assertEquals((await r.json()).refund_pct, 100);
  assertEquals(asAny(stripe.callsTo("refunds.create")[0].args[0]).amount, 10250);
});

Deno.test("5 [Ist-Zustand]: Kunde storniert 24–48h vorher — halbe Erstattung", async () => {
  const { stripe, deps } = setup({ contract: vertrag({ jobs: { title: "T", scheduled_at: inStunden(36) } }) });
  const r = await handleCancelContract(anfrage(), deps);
  assertEquals((await r.json()).refund_pct, 50);
  assertEquals(asAny(stripe.callsTo("refunds.create")[0].args[0]).amount, 5125);
});

Deno.test("6 [Ist-Zustand]: Kunde storniert <24h vorher — keine Erstattung", async () => {
  const { stripe, deps } = setup({ contract: vertrag({ jobs: { title: "T", scheduled_at: inStunden(6) } }) });
  const r = await handleCancelContract(anfrage(), deps);
  assertEquals((await r.json()).refund_pct, 0);
  assertFalse(stripe.called("refunds.create"), "Ist-Zustand: kein Geld zurueck");
  // OFFEN und hier NICHT entschieden: wem der einbehaltene Betrag zusteht.
});

Deno.test("6b [Ist-Zustand]: Anbieter storniert — immer volle Erstattung", async () => {
  const { stripe, deps } = setup({
    user: ANBIETER,
    contract: vertrag({ jobs: { title: "T", scheduled_at: inStunden(2) } }),
  });
  const r = await handleCancelContract(anfrage(), deps);
  assertEquals((await r.json()).refund_pct, 100);
  assertEquals(asAny(stripe.callsTo("refunds.create")[0].args[0]).amount, 10250);
});

// ── 7. Stripe nicht erreichbar ─────────────────────────────────────────────
Deno.test("7: PaymentIntent-Abfrage scheitert — 503, kein blindes Stornieren", async () => {
  const { db, deps } = setup({
    contract: vertrag({ status: "pending", escrow_captured_at: null }),
    stripeFailing: ["paymentIntents.retrieve"],
  });
  const r = await handleCancelContract(anfrage(), deps);
  assertEquals(r.status, 503);
  assertEquals(db.callsOn("contracts", "update").length, 0, "Vertrag bleibt unveraendert");
});

// ── 8. Refund erfolgreich, DB-Update scheitert ─────────────────────────────
Deno.test("8: Refund OK, DB-Update scheitert — 500, Geld ist aber schon zurueck", async () => {
  const { stripe, deps } = setup({ contractUpdate: { data: null, error: { message: "boom" } } });
  const r = await handleCancelContract(anfrage(), deps);
  assertEquals(r.status, 500);
  assert(stripe.called("refunds.create"), "die Erstattung ist gelaufen");
});

// ── 9. Wiederholte identische Stornierung ──────────────────────────────────
Deno.test("9: erneuter Versuch nach erfolgreicher Stornierung — 409, kein Refund", async () => {
  const { stripe, deps } = setup({ contract: vertrag({ status: "cancelled" }) });
  const r = await handleCancelContract(anfrage(), deps);
  assertEquals(r.status, 409);
  assertFalse(stripe.called("refunds.create"));
});

// ── 10./17. Nebenlaeufigkeit und 24-Stunden-Fenster ────────────────────────
Deno.test("10: zwei parallele Stornierungen senden denselben Idempotency-Key", async () => {
  const a = setup(); const b = setup();
  const [r1, r2] = await Promise.all([
    handleCancelContract(anfrage(), a.deps),
    handleCancelContract(anfrage(), b.deps),
  ]);
  assertEquals(r1.status, 200); assertEquals(r2.status, 200);
  assertEquals(
    asAny(a.stripe.callsTo("refunds.create")[0].args[1]).idempotencyKey,
    asAny(b.stripe.callsTo("refunds.create")[0].args[1]).idempotencyKey,
  );
});

Deno.test("17: Wiederholung nach >24h — der Abgleich verhindert die zweite Erstattung", async () => {
  // Nach 24h verwirft Stripe den Idempotency-Key (ANNAHME, offizielle Semantik,
  // hier nicht verifiziert). Der Schutz muss daher am Abgleich haengen.
  const { stripe, deps } = setup({
    vorhandeneRefunds: [{ id: "re_alt", amount: 10250, status: "succeeded" }],
  });
  await handleCancelContract(anfrage(), deps);
  assertFalse(stripe.called("refunds.create"),
    "SOLL: bereits vollstaendig erstattet — kein zweiter Refund");
});

// ── 12./13./20. Bereits vorhandene Erstattungen ────────────────────────────
Deno.test("12 [P0]: Erstattung bereits vollstaendig vorhanden — kein zweiter Refund", async () => {
  const { stripe, deps } = setup({
    vorhandeneRefunds: [{ id: "re_x", amount: 10250, status: "succeeded" }],
  });
  const r = await handleCancelContract(anfrage(), deps);
  assertEquals(r.status, 200);
  assertFalse(stripe.called("refunds.create"),
    "SOLL: der Kunde hat sein Geld bereits — eine zweite Erstattung waere Verlust");
});

Deno.test("13 [P0]: Erstattung teilweise vorhanden — nur die Differenz", async () => {
  const { stripe, deps } = setup({
    vorhandeneRefunds: [{ id: "re_y", amount: 4000, status: "succeeded" }],
  });
  const r = await handleCancelContract(anfrage(), deps);
  assertEquals(r.status, 200);
  assertEquals(stripe.callsTo("refunds.create").length, 1);
  assertEquals(asAny(stripe.callsTo("refunds.create")[0].args[0]).amount, 6250,
    "SOLL: 102,50 minus bereits erstattete 40,00 = 62,50");
});

Deno.test("20: fehlgeschlagene Erstattungen zaehlen NICHT als erstattet", async () => {
  const { stripe, deps } = setup({
    vorhandeneRefunds: [{ id: "re_f", amount: 10250, status: "failed" }],
  });
  await handleCancelContract(anfrage(), deps);
  assertEquals(asAny(stripe.callsTo("refunds.create")[0].args[0]).amount, 10250,
    "eine abgewiesene Erstattung hat kein Geld bewegt");
});

// ── 24. Refund von Stripe abgelehnt ────────────────────────────────────────
Deno.test("24: refunds.create scheitert — 500, Vertrag bleibt unveraendert", async () => {
  const { db, deps } = setup({ stripeFailing: ["refunds.create"] });
  const r = await handleCancelContract(anfrage(), deps);
  assertEquals(r.status, 500);
  assertEquals(db.callsOn("contracts", "update").length, 0);
});

// ── 11./18./19./22. Abgleich und Wiederaufnahme ────────────────────────────
Deno.test("18 [P0]: Stripe-Refund existiert, lokale Spur fehlt — kein zweiter Refund", async () => {
  // Der Fall nach Szenario 8: Erstattung gelaufen, DB-Update gescheitert.
  const { stripe, deps } = setup({
    vorhandeneRefunds: [{ id: "re_ohne_spur", amount: 10250, status: "succeeded" }],
    contract: vertrag({ status: "active" }),
  });
  const r = await handleCancelContract(anfrage(), deps);
  assertEquals(r.status, 200);
  assertFalse(stripe.called("refunds.create"));
});

Deno.test("19: Wiederaufnahme finalisiert die Stornierung ohne neue Geldbewegung", async () => {
  const { db, stripe, deps } = setup({
    vorhandeneRefunds: [{ id: "re_da", amount: 10250, status: "succeeded" }],
  });
  await handleCancelContract(anfrage(), deps);
  assertFalse(stripe.called("refunds.create"));
  assertEquals(asAny(db.callsOn("contracts", "update")[0].payload).status, "cancelled",
    "die Stornierung wird trotzdem abgeschlossen");
});

Deno.test("21: Abgleich scheitert — fail-closed, kein Refund, kein stilles 200", async () => {
  const { db, stripe, deps } = setup({ stripeFailing: ["refunds.list"] });
  const r = await handleCancelContract(anfrage(), deps);
  assertEquals(r.status, 503, "ohne belastbaren Abgleich wird nicht erstattet");
  assertFalse(stripe.called("refunds.create"));
  assertEquals(db.callsOn("contracts", "update").length, 0);
});

Deno.test("23: der Abgleich laeuft ueber ALLE PaymentIntents des Vertrags", async () => {
  // Frueher lief er nur gegen den gespeicherten, also den letzten. Eine
  // Erstattung auf einem ersetzten Intent blieb damit unsichtbar und der
  // Quotenbetrag wurde erneut voll erstattet. Seit Migration 0660 liefert die
  // Historie alle Intents.
  const { stripe, deps } = setup({
    contract: vertrag({ stripe_payment_intent: "pi_neu" }),
    historie: [{ payment_intent_id: "pi_alt" }, { payment_intent_id: "pi_neu" }],
  });
  await handleCancelContract(anfrage(), deps);
  const abgefragt = stripe.callsTo("refunds.list").map((c) => asAny(c.args[0]).payment_intent);
  assertEquals(abgefragt.sort(), ["pi_alt", "pi_neu"],
    "SOLL: beide Intents werden abgeglichen, nicht nur der aktuelle");
});

Deno.test("23b [P0]: Erstattung auf einem ALTEN Intent zaehlt mit", async () => {
  // Ohne die Historie erstattete die Stornierung hier den vollen Quotenbetrag
  // ein zweites Mal.
  const db = new FakeSupabase({
    "contract_payment_intents.select": [{ data: [{ payment_intent_id: "pi_alt" }, { payment_intent_id: "pi_neu" }] }],
    "contracts.select": [{ data: vertrag({ stripe_payment_intent: "pi_neu" }) }],
    "contracts.update": [{ data: { id: VERTRAG }, error: null }],
    "jobs.update":      [{ data: null, error: null }],
    "profiles.select":  [{ data: { push_token: "tok" } }],
  });
  db.authUser = { id: KUNDE };
  const stripe = new FakeStripe({
    // Der ALTE Intent traegt bereits eine Erstattung, der neue nicht.
    "refunds.list": [
      { data: [{ id: "re_alt", amount: 4000, status: "succeeded" }] },
      { data: [] },
    ],
    "refunds.create": [{ id: "re_neu" }],
  });
  const push = makeFakePush();
  const r = await handleCancelContract(anfrage(), {
    supabase: asAny(db), stripe: asAny(stripe), sendPush: push.fn,
  });
  assertEquals(r.status, 200);
  assertEquals(asAny(stripe.callsTo("refunds.create")[0].args[0]).amount, 6250,
    "102,50 minus die 40,00 vom alten Intent — nicht erneut voll");
});

Deno.test("23c: Historie nicht lesbar — fail-closed, keine Erstattung", async () => {
  const db = new FakeSupabase({
    "contract_payment_intents.select": [{ data: null, error: { message: "boom" } }],
    "contracts.select": [{ data: vertrag() }],
  });
  db.authUser = { id: KUNDE };
  const stripe = new FakeStripe({});
  const push = makeFakePush();
  const r = await handleCancelContract(anfrage(), {
    supabase: asAny(db), stripe: asAny(stripe), sendPush: push.fn,
  });
  assertEquals(r.status, 503);
  assertFalse(stripe.called("refunds.create"));
  assertEquals(db.callsOn("contracts", "update").length, 0);
});

// ── 14./15./16. Zugriff und Zustand ────────────────────────────────────────
Deno.test("14: fremder Nutzer — 403, keine Geldbewegung", async () => {
  const { db, stripe, deps } = setup({ user: FREMD });
  assertEquals((await handleCancelContract(anfrage(), deps)).status, 403);
  assertEquals(stripe.calls.length, 0);
  assertEquals(db.callsOn("contracts", "update").length, 0);
});

Deno.test("15: fehlende Authentifizierung — 401, kein Stripe-Aufruf", async () => {
  const { stripe, deps } = setup();
  assertEquals((await handleCancelContract(anfrage({ contract_id: VERTRAG }, false), deps)).status, 401);
  assertEquals(stripe.calls.length, 0);
});

Deno.test("16: Vertrag nicht stornierbar (completed) — 409, keine Geldbewegung", async () => {
  const { stripe, deps } = setup({ contract: vertrag({ status: "completed" }) });
  assertEquals((await handleCancelContract(anfrage(), deps)).status, 409);
  assertEquals(stripe.calls.length, 0);
});

Deno.test("16b: Vertrag nicht gefunden — 404", async () => {
  const { stripe, deps } = setup({ contract: null });
  assertEquals((await handleCancelContract(anfrage(), deps)).status, 404);
  assertEquals(stripe.calls.length, 0);
});

Deno.test("16c: unbekanntes Feld im Body — 400, kein Stripe-Aufruf", async () => {
  const { stripe, deps } = setup();
  const r = await handleCancelContract(anfrage({ contract_id: VERTRAG, amount: 1 }), deps);
  assertEquals(r.status, 400);
  assertEquals(stripe.calls.length, 0);
});

Deno.test("16d: Rate-Limit — 429, kein Stripe-Aufruf", async () => {
  const { db, stripe, deps } = setup();
  db.rpcResponses["check_rate_limit"] = { data: false, error: null };
  assertEquals((await handleCancelContract(anfrage(), deps)).status, 429);
  assertEquals(stripe.calls.length, 0);
});

// ══════════════════════════════════════════════════════════════════════════
// Nachtrag aus den drei Reviews.
// ══════════════════════════════════════════════════════════════════════════

// ── Security-Review P0: gleichzeitiges Storno mit UNTERSCHIEDLICHEN Quoten ─
// Kunde (50 %) und Anbieter (100 %) stornieren zugleich. Beide sehen den
// Vertrag noch aktiv und beide Abgleiche noch 0 EUR erstattet. Nur der
// vertragsweite Idempotency-Key verhindert, dass 150 % zurueckfliessen.
Deno.test("27 [P0]: gleichzeitiges Storno beider Parteien — identischer Idempotency-Key", async () => {
  const kunde = setup({ contract: vertrag({ jobs: { title: "T", scheduled_at: inStunden(36) } }) });   // 50 %
  const anbieter = setup({ user: ANBIETER, contract: vertrag({ jobs: { title: "T", scheduled_at: inStunden(36) } }) }); // 100 %
  await Promise.all([
    handleCancelContract(anfrage(), kunde.deps),
    handleCancelContract(anfrage(), anbieter.deps),
  ]);
  const kK = asAny(kunde.stripe.callsTo("refunds.create")[0].args[1]).idempotencyKey;
  const kA = asAny(anbieter.stripe.callsTo("refunds.create")[0].args[1]).idempotencyKey;
  // Die Betraege sind unterschiedlich — genau deshalb MUSS der Schluessel gleich
  // sein, damit Stripe die zweite Anfrage abweist statt sie auszufuehren.
  assertEquals(asAny(kunde.stripe.callsTo("refunds.create")[0].args[0]).amount, 5125);
  assertEquals(asAny(anbieter.stripe.callsTo("refunds.create")[0].args[0]).amount, 10250);
  assertEquals(kK, kA, "SOLL: identischer Schluessel, sonst erstattet Stripe beide Betraege");
  assertEquals(kK, `cancel-refund-${VERTRAG}`, "der Betrag darf NICHT im Schluessel stehen");
});

// ── Architektur-Review P0: unrecordedCapture muss vermerkt werden ──────────
// Sonst erstattet der Webhook bei einem verspaeteten payment_intent.succeeded
// ein zweites Mal (stripe-webhook/handler.ts:191, eigener Idempotency-Key).
Deno.test("28 [P0]: nachtraeglich erkannte Zahlung wird vermerkt — kein zweiter Webhook-Refund", async () => {
  const { db, stripe, deps } = setup({
    contract: vertrag({ status: "pending", escrow_captured_at: null }),
    paymentIntent: { id: "pi_1", status: "succeeded" },
  });
  const r = await handleCancelContract(anfrage(), deps);
  assertEquals(r.status, 200);
  assert(stripe.called("refunds.create"));
  const payload = asAny(db.callsOn("contracts", "update")[0].payload);
  assertEquals(payload.status, "cancelled");
  assert(payload.escrow_captured_at,
    "SOLL: die erfasste Zahlung muss vermerkt werden, sonst greift der " +
    "late-capture-Zweig im Webhook und erstattet ein zweites Mal");
});

Deno.test("28b: unbezahlter Vertrag setzt escrow_captured_at NICHT", async () => {
  const { db, deps } = setup({
    contract: vertrag({ status: "pending", escrow_captured_at: null }),
    paymentIntent: { id: "pi_1", status: "requires_payment_method" },
  });
  await handleCancelContract(anfrage(), deps);
  const payload = asAny(db.callsOn("contracts", "update")[0].payload);
  assertEquals(payload.escrow_captured_at, undefined,
    "ohne erfasste Zahlung bleibt das Feld leer — der Webhook-Schutz bleibt aktiv");
});

// ── QA-Review: has_more war voellig ungetestet ────────────────────────────
Deno.test("29: mehr Erstattungen als eine Seite fasst — 409, kein Refund", async () => {
  const db = new FakeSupabase({
    "contracts.select": [{ data: vertrag() }],
    "contracts.update": [{ data: { id: VERTRAG }, error: null }],
  });
  db.authUser = { id: KUNDE };
  const stripe = new FakeStripe({ "refunds.list": [{ data: [], has_more: true }] });
  const push = makeFakePush();
  const r = await handleCancelContract(anfrage(), {
    supabase: asAny(db), stripe: asAny(stripe), sendPush: push.fn,
  });
  assertEquals(r.status, 409, "unklarer Erstattungsstand -> nicht erstatten");
  assertFalse(stripe.called("refunds.create"));
  assertEquals(db.callsOn("contracts", "update").length, 0);
});

// ── QA-Review: Zeitgrenzen waren ungetestet ───────────────────────────────
// Die Quoten selbst sind fachlich NICHT entschieden. Diese Tests halten nur
// fest, WO die heutigen Grenzen liegen, damit eine Verschiebung auffaellt.
Deno.test("30 [Ist-Zustand]: knapp ueber 48h — volle Erstattung", async () => {
  const { deps } = setup({ contract: vertrag({ jobs: { title: "T", scheduled_at: inStunden(48.5) } }) });
  assertEquals((await handleCancelContract(anfrage(), deps)).status, 200);
});

Deno.test("30b [Ist-Zustand]: knapp unter 48h — halbe Erstattung", async () => {
  const { deps } = setup({ contract: vertrag({ jobs: { title: "T", scheduled_at: inStunden(47.5) } }) });
  const r = await handleCancelContract(anfrage(), deps);
  assertEquals((await r.json()).refund_pct, 50, "die 48-Stunden-Grenze liegt hier");
});

Deno.test("30c [Ist-Zustand]: knapp unter 24h — keine Erstattung", async () => {
  const { stripe, deps } = setup({ contract: vertrag({ jobs: { title: "T", scheduled_at: inStunden(23.5) } }) });
  const r = await handleCancelContract(anfrage(), deps);
  assertEquals((await r.json()).refund_pct, 0, "die 24-Stunden-Grenze liegt hier");
  assertFalse(stripe.called("refunds.create"));
});

Deno.test("30d [Ist-Zustand]: ohne Termin gilt die volle Erstattung", async () => {
  const { deps } = setup({ contract: vertrag({ jobs: { title: "T", scheduled_at: null } }) });
  const r = await handleCancelContract(anfrage(), deps);
  assertEquals((await r.json()).refund_pct, 100, "Fallback 72h im Code");
});

// ── QA-Review: ungetestete Kombinationen ──────────────────────────────────
Deno.test("31: nachtraeglich erkannte Zahlung UND bereits erstattet — kein zweiter Refund", async () => {
  const { stripe, deps } = setup({
    contract: vertrag({ status: "pending", escrow_captured_at: null }),
    paymentIntent: { id: "pi_1", status: "succeeded" },
    vorhandeneRefunds: [{ id: "re_a", amount: 10250, status: "succeeded" }],
  });
  assertEquals((await handleCancelContract(anfrage(), deps)).status, 200);
  assertFalse(stripe.called("refunds.create"));
});

Deno.test("32: Anbieter-Storno mit vorhandener Teilerstattung — nur die Differenz", async () => {
  const { stripe, deps } = setup({
    user: ANBIETER,
    vorhandeneRefunds: [{ id: "re_b", amount: 3000, status: "succeeded" }],
  });
  await handleCancelContract(anfrage(), deps);
  assertEquals(asAny(stripe.callsTo("refunds.create")[0].args[0]).amount, 7250,
    "102,50 volle Quote minus bereits erstattete 30,00");
});
