// Ausfuehrbare Tests der PaymentIntent-Erzeugung.
//
// Getestet wird AUSSCHLIESSLICH die eigene Logik in
// supabase/functions/create-payment-intent/handler.ts — dieselbe Funktion, die
// index.ts in Produktion aufruft. KEIN echter Stripe-Aufruf.
//
// GRENZE: Der Supabase-Double fuehrt die RPC `register_payment_intent` NICHT
// aus. Ihre Wirkung (genau ein aktueller Intent, Historie bleibt, Spiegel wird
// gepflegt, echte Nebenlaeufigkeit) ist in
// scripts/db-test/payment-intent-history.sql gegen echtes Postgres belegt.
import { assertEquals, assert, assertFalse } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { handleCreatePaymentIntent } from "../functions/create-payment-intent/handler.ts";
import { FakeSupabase } from "../functions/_shared/testing/fakeSupabase.ts";
import { FakeStripe } from "../functions/_shared/testing/fakeStripe.ts";

// deno-lint-ignore no-explicit-any
const asAny = (x: unknown) => x as any;

const KUNDE = "11111111-1111-1111-1111-111111111111";
const FREMD = "99999999-9999-9999-9999-999999999999";
const VERTRAG = "33333333-3333-3333-3333-333333333333";

const vertrag = (u: Record<string, unknown> = {}) => ({
  id: VERTRAG, customer_id: KUNDE, status: "pending",
  escrow_captured_at: null, customer_total: 102.50,
  stripe_payment_intent: null, ...u,
});

function setup(o: {
  user?: string | null;
  contract?: Record<string, unknown> | null;
  register?: { data?: unknown; error?: unknown };
  bestehenderIntent?: Record<string, unknown>;
  stripeFailing?: string[];
} = {}) {
  const db = new FakeSupabase({
    "contracts.select": [{ data: o.contract === undefined ? vertrag() : o.contract }],
  });
  db.authUser = o.user === undefined ? { id: KUNDE } : (o.user ? { id: o.user } : null);
  db.rpcResponses["register_payment_intent"] = o.register ?? { data: null, error: null };
  const stripe = new FakeStripe({
    "paymentIntents.create":   [{ id: "pi_neu", client_secret: "cs_neu" }],
    "paymentIntents.retrieve": [o.bestehenderIntent ?? { id: "pi_alt", status: "canceled" }],
  }, o.stripeFailing ?? []);
  return { db, stripe, deps: { supabase: asAny(db), stripe: asAny(stripe), stripeSecretKey: "sk_test_x" } };
}

const anfrage = (body: unknown = { contract_id: VERTRAG }, auth = true) =>
  new Request("https://x/create-payment-intent", {
    method: "POST",
    headers: auth
      ? { Authorization: "Bearer jwt", "Content-Type": "application/json" }
      : { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

Deno.test("1: erster Intent — Betrag in ganzen Cent, Registrierung ueber die RPC", async () => {
  const { db, stripe, deps } = setup();
  const r = await handleCreatePaymentIntent(anfrage(), deps);
  assertEquals(r.status, 200);
  assertEquals((await r.json()).client_secret, "cs_neu");

  const pi = asAny(stripe.callsTo("paymentIntents.create")[0].args[0]);
  assertEquals(pi.amount, 10250, "102,50 EUR als ganze Cent");
  assertEquals(pi.currency, "eur");
  assertEquals(pi.metadata.contract_id, VERTRAG);
  assertEquals(asAny(stripe.callsTo("paymentIntents.create")[0].args[1]).idempotencyKey,
    `create-payment-intent-${VERTRAG}`);

  const rpc = db.rpcCalls.find((c) => c.fn === "register_payment_intent");
  assert(rpc, "der Intent muss in der Historie festgehalten werden");
  assertEquals(asAny(rpc.args).p_contract_id, VERTRAG);
  assertEquals(asAny(rpc.args).p_intent_id, "pi_neu");
  assertEquals(asAny(rpc.args).p_amount_cents, 10250);
  assertEquals(db.callsOn("contracts", "update").length, 0,
    "kein direktes Update mehr — der Spiegel wird in der RPC gepflegt");
});

Deno.test("2: bestehender nutzbarer Intent wird wiederverwendet", async () => {
  const { db, stripe, deps } = setup({
    contract: vertrag({ stripe_payment_intent: "pi_alt" }),
    bestehenderIntent: { id: "pi_alt", status: "requires_payment_method", client_secret: "cs_alt" },
  });
  const r = await handleCreatePaymentIntent(anfrage(), deps);
  assertEquals(r.status, 200);
  assertEquals((await r.json()).client_secret, "cs_alt");
  assertFalse(stripe.called("paymentIntents.create"), "kein zweiter Intent");
  assertEquals(db.rpcCalls.filter((c) => c.fn === "register_payment_intent").length, 0);
});

Deno.test("3: unbrauchbarer bestehender Intent — neuer wird erzeugt UND registriert", async () => {
  // Genau hier entsteht der zweite Intent, den die Historie braucht: der alte
  // bleibt bei Stripe erstattungs- und rueckbuchungsfaehig.
  const { db, stripe, deps } = setup({
    contract: vertrag({ stripe_payment_intent: "pi_alt" }),
    bestehenderIntent: { id: "pi_alt", status: "canceled" },
  });
  assertEquals((await handleCreatePaymentIntent(anfrage(), deps)).status, 200);
  assert(stripe.called("paymentIntents.create"));
  assertEquals(asAny(db.rpcCalls.find((c) => c.fn === "register_payment_intent")!.args).p_intent_id, "pi_neu");
});

Deno.test("4: Registrierung scheitert — 500, damit der Aufrufer es erneut versucht", async () => {
  const { stripe, deps } = setup({ register: { data: null, error: { message: "boom" } } });
  const r = await handleCreatePaymentIntent(anfrage(), deps);
  assertEquals(r.status, 500);
  assert(stripe.called("paymentIntents.create"),
    "der Intent existiert bei Stripe — der naechste Versuch findet ihn ueber den Idempotency-Key");
});

Deno.test("5: Stripe-Erzeugung scheitert — 500, keine Registrierung", async () => {
  const { db, deps } = setup({ stripeFailing: ["paymentIntents.create"] });
  assertEquals((await handleCreatePaymentIntent(anfrage(), deps)).status, 500);
  assertEquals(db.rpcCalls.filter((c) => c.fn === "register_payment_intent").length, 0);
});

Deno.test("6: fremder Nutzer — 403, kein Stripe-Aufruf", async () => {
  const { stripe, deps } = setup({ user: FREMD });
  assertEquals((await handleCreatePaymentIntent(anfrage(), deps)).status, 403);
  assertEquals(stripe.calls.length, 0);
});

Deno.test("7: fehlende Authentifizierung — 401", async () => {
  const { stripe, deps } = setup();
  assertEquals((await handleCreatePaymentIntent(anfrage({ contract_id: VERTRAG }, false), deps)).status, 401);
  assertEquals(stripe.calls.length, 0);
});

Deno.test("8: Vertrag nicht pending — 400, kein Stripe-Aufruf", async () => {
  const { stripe, deps } = setup({ contract: vertrag({ status: "active" }) });
  assertEquals((await handleCreatePaymentIntent(anfrage(), deps)).status, 400);
  assertEquals(stripe.calls.length, 0);
});

Deno.test("9: Zahlung bereits erfasst — 400, kein zweiter Intent", async () => {
  const { stripe, deps } = setup({ contract: vertrag({ escrow_captured_at: "2026-08-01T10:00:00Z" }) });
  assertEquals((await handleCreatePaymentIntent(anfrage(), deps)).status, 400);
  assertEquals(stripe.calls.length, 0);
});

Deno.test("10: Vertrag nicht gefunden — 404", async () => {
  const { stripe, deps } = setup({ contract: null });
  assertEquals((await handleCreatePaymentIntent(anfrage(), deps)).status, 404);
  assertEquals(stripe.calls.length, 0);
});

Deno.test("11: unbekanntes Feld im Body — 400", async () => {
  const { stripe, deps } = setup();
  assertEquals((await handleCreatePaymentIntent(anfrage({ contract_id: VERTRAG, amount: 1 }), deps)).status, 400);
  assertEquals(stripe.calls.length, 0);
});

Deno.test("12: Rate-Limit — 429, kein Stripe-Aufruf", async () => {
  const { db, stripe, deps } = setup();
  db.rpcResponses["check_rate_limit"] = { data: false, error: null };
  assertEquals((await handleCreatePaymentIntent(anfrage(), deps)).status, 429);
  assertEquals(stripe.calls.length, 0);
});

Deno.test("13: ZAG-Gate bei Live-Schluessel ohne Freigabe — 503", async () => {
  const { stripe, deps } = setup();
  const r = await handleCreatePaymentIntent(anfrage(), { ...deps, stripeSecretKey: "sk_live_xyz" });
  assertEquals(r.status, 503, "Live-Zahlungen bleiben ohne Rechtsfreigabe gesperrt");
  assertEquals(stripe.calls.length, 0);
});

// ── Architektur-Review: bezahlter Intent darf keinen zweiten erzeugen ──────
// Der Fall, in dem der Spiegel auf einen unbezahlten Intent zeigt, waehrend das
// Geld auf dem alten liegt — und eine spaetere Stornierung gegen den falschen
// Intent erstattet haette.
Deno.test("14 [P0]: bereits bezahlter Intent — 409, KEIN zweiter Intent", async () => {
  const { db, stripe, deps } = setup({
    contract: vertrag({ stripe_payment_intent: "pi_bezahlt" }),
    bestehenderIntent: { id: "pi_bezahlt", status: "succeeded" },
  });
  const r = await handleCreatePaymentIntent(anfrage(), deps);
  assertEquals(r.status, 409);
  assertFalse(stripe.called("paymentIntents.create"),
    "SOLL: ein zweiter Intent waere eine Doppelbelastung des Kunden");
  assertEquals(db.rpcCalls.filter((c) => c.fn === "register_payment_intent").length, 0);
});

Deno.test("15 [P0]: laufende Zahlung — 409, KEIN zweiter Intent", async () => {
  const { stripe, deps } = setup({
    contract: vertrag({ stripe_payment_intent: "pi_laeuft" }),
    bestehenderIntent: { id: "pi_laeuft", status: "processing" },
  });
  assertEquals((await handleCreatePaymentIntent(anfrage(), deps)).status, 409);
  assertFalse(stripe.called("paymentIntents.create"));
});
