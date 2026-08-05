// Ausfuehrbare Tests der Stripe-Webhook-Handlerlogik.
//
// Getestet wird AUSSCHLIESSLICH unsere eigene Logik in
// supabase/functions/stripe-webhook/handler.ts — dieselbe Funktion, die
// index.ts in Produktion aufruft. In dieser Datei wird KEINE zweite Version
// der Eventlogik implementiert.
//
// Es findet KEIN echter Stripe-Aufruf statt. Alle Annahmen ueber
// Stripe-Verhalten stecken in den Doubles und sind als Annahmen markiert.
//
// Ablage ausserhalb supabase/functions/, damit nichts davon deployt wird.
import { assertEquals, assert, assertFalse } from "https://deno.land/std@0.208.0/assert/mod.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { constructStripeEvent, handleStripeEvent } from "../functions/stripe-webhook/handler.ts";
import { FakeSupabase } from "../functions/_shared/testing/fakeSupabase.ts";
import { FakeStripe, makeFakePush } from "../functions/_shared/testing/fakeStripe.ts";

// deno-lint-ignore no-explicit-any
const asAny = (x: unknown) => x as any;

function setup(queues: Record<string, Array<{ data?: unknown; error?: unknown }>> = {},
               stripeScript: Record<string, unknown[]> = {},
               failing: string[] = []) {
  const db = new FakeSupabase(queues);
  // Seit Migration 0660 loest der Handler den Vertrag ueber die Historie auf,
  // nicht mehr ueber contracts.stripe_payment_intent. Standard: der Intent ist
  // der aktuelle des Vertrags c1.
  db.rpcResponses["contract_for_payment_intent"] = {
    data: { contract_id: "c1", is_current: true }, error: null,
  };
  const stripe = new FakeStripe(stripeScript, failing);
  const push = makeFakePush();
  return { db, stripe, push, deps: { supabase: asAny(db), stripe: asAny(stripe), sendPush: push.fn } };
}

const ev = (type: string, object: unknown) =>
  asAny({ id: `evt_${type}`, type, data: { object } });

async function bodyOf(r: Response) { return await r.json().catch(() => null); }

// ── 1. Identisches payment_intent.succeeded zweimal ────────────────────────
Deno.test("1: payment_intent.succeeded zweimal — zweite Zustellung ohne Folgewirkung", async () => {
  const pi = { id: "pi_1", metadata: { contract_id: "c1" } };

  // Erste Zustellung: CAS trifft eine Zeile.
  const a = setup({
    "contracts.update": [{ data: { job_id: "j1", provider_id: "p1", customer_id: "k1", jobs: { title: "Bad" } } }],
    "profiles.select": [{ data: { push_token: "tok" } }],
    "messages.insert": [{}],
  });
  const r1 = await handleStripeEvent(ev("payment_intent.succeeded", pi), a.deps);
  assertEquals(r1.status, 200);
  assertEquals(await bodyOf(r1), { received: true });
  assertEquals(a.db.callsOn("messages", "insert").length, 1, "System-Nachricht beim ersten Mal");
  assertEquals(a.push.sent.length, 1);
  // CAS-Bedingungen muessen gebaut werden (Wirkung: siehe webhook-idempotency.sql)
  const cas = a.db.callsOn("contracts", "update")[0];
  assert(cas.filters.some((f) => f.fn === "eq" && f.args[1] === "pending"));
  assert(cas.filters.some((f) => f.fn === "is" && f.args[0] === "escrow_captured_at"));

  // Zweite Zustellung: CAS trifft nichts, Vertrag ist bereits aktiv.
  const b = setup({
    "contracts.update": [{ data: null }],
    "contracts.select": [{ data: { status: "active", escrow_captured_at: "2026-07-30T10:00:00Z", stripe_payment_intent: "pi_1", customer_total: 100 } }],
  });
  const r2 = await handleStripeEvent(ev("payment_intent.succeeded", pi), b.deps);
  assertEquals(r2.status, 200);
  assertEquals(b.db.callsOn("messages", "insert").length, 0, "KEINE zweite System-Nachricht");
  assertEquals(b.push.sent.length, 0, "KEIN zweiter Push");
  assertFalse(b.stripe.called("refunds.create"), "KEINE Erstattung");
});

// ── 2. Zwei kumulative Teilerstattungen in korrekter Reihenfolge ───────────
Deno.test("2: zwei Teilerstattungen aufsteigend — kumuliert, Zeitstempel nur einmal", async () => {
  const charge = (refunded: number) => ({
    id: "ch_1", payment_intent: "pi_1", amount_refunded: refunded,
    balance_transaction: "bt_1", created: 1753900000,
  });

  const a = setup(
    { "contracts.select": [{ data: { customer_refunded_amount: 0, refunded_at: null } }],
      "contracts.update": [{ data: { id: "c1", status: "active", escrow_released_at: null, provider_id: "p1", provider_payout: 90 } }] },
    { "charges.retrieve": [{ id: "ch_1", amount_refunded: 3000, balance_transaction: "bt_1" }],
      "balanceTransactions.retrieve": [{ fee: 100 }] },
  );
  const r1 = await handleStripeEvent(ev("charge.refunded", charge(3000)), a.deps);
  assertEquals(r1.status, 200);
  const p1 = asAny(a.db.callsOn("contracts", "update")[0].payload);
  assertEquals(p1.customer_refunded_amount, 30, "30 EUR verbucht");
  assertEquals(p1.stripe_fee_lost, 1);
  const ersterZeitpunkt = p1.refunded_at;
  assert(typeof ersterZeitpunkt === "string");

  const b = setup(
    { "contracts.select": [{ data: { customer_refunded_amount: 30, refunded_at: ersterZeitpunkt } }],
      "contracts.update": [{ data: { id: "c1", status: "active", escrow_released_at: null, provider_id: "p1", provider_payout: 90 } }] },
    { "charges.retrieve": [{ id: "ch_1", amount_refunded: 5000, balance_transaction: "bt_1" }],
      "balanceTransactions.retrieve": [{ fee: 100 }] },
  );
  const r2 = await handleStripeEvent(ev("charge.refunded", charge(5000)), b.deps);
  assertEquals(r2.status, 200);
  const p2 = asAny(b.db.callsOn("contracts", "update")[0].payload);
  assertEquals(p2.customer_refunded_amount, 50, "kumulierter Stand, nicht addiert");
  assertEquals(p2.refunded_at, ersterZeitpunkt, "Zeitstempel bleibt der erste");
});

// ── 3. charge.refund.updated mit Status failed ─────────────────────────────
Deno.test("3: charge.refund.updated failed — Stand, Zeitpunkt und Gebuehr zurueckgesetzt", async () => {
  const { db, stripe, deps } = setup(
    { "contracts.select": [{ data: { customer_refunded_amount: 100 } }],
      "contracts.update": [{ data: { id: "c1" } }] },
    { "charges.retrieve": [{ amount_refunded: 0 }] },
  );
  const r = await handleStripeEvent(
    ev("charge.refund.updated", { id: "re_1", status: "failed", payment_intent: "pi_1", charge: "ch_1" }),
    deps,
  );
  assertEquals(r.status, 200);
  const p = asAny(db.callsOn("contracts", "update")[0].payload);
  assertEquals(p.customer_refunded_amount, 0);
  assertEquals(p.refunded_at, null, "Erstattungsdatum muss mit zurueck");
  assertEquals(p.stripe_fee_lost, 0);
  assertFalse(stripe.called("refunds.create"), "kein erneuter Erstattungsversuch");
});

// ── 4./5./6. Dispute ───────────────────────────────────────────────────────
const disputeObj = (status: string) => ({
  id: "dp_1", payment_intent: "pi_1", status, amount: 10000,
  balance_transactions: [{ fee: 1500 }],
});

Deno.test("4: charge.dispute.created — Zustand 'open', keine Geldbewegung", async () => {
  const { db, stripe, deps } = setup({ "contracts.update": [{ data: { id: "c1", escrow_released_at: null } }] });
  const r = await handleStripeEvent(ev("charge.dispute.created", disputeObj("needs_response")), deps);
  assertEquals(r.status, 200);
  const p = asAny(db.callsOn("contracts", "update")[0].payload);
  assertEquals(p.dispute_state, "open");
  assertEquals(p.dispute_fee, 15);
  assertFalse(stripe.called("refunds.create"));
  assertFalse(stripe.called("transfers.create"));
});

Deno.test("5: charge.dispute.closed won — Zustand 'won', keine Geldbewegung", async () => {
  const { db, stripe, deps } = setup({ "contracts.update": [{ data: { id: "c1", escrow_released_at: null } }] });
  const r = await handleStripeEvent(ev("charge.dispute.closed", disputeObj("won")), deps);
  assertEquals(r.status, 200);
  assertEquals(asAny(db.callsOn("contracts", "update")[0].payload).dispute_state, "won");
  assertFalse(stripe.called("refunds.create"));
});

Deno.test("6: charge.dispute.closed lost — Zustand 'lost', keine automatische Kompensation", async () => {
  const { db, stripe, deps } = setup({ "contracts.update": [{ data: { id: "c1", escrow_released_at: null } }] });
  const r = await handleStripeEvent(ev("charge.dispute.closed", disputeObj("lost")), deps);
  assertEquals(r.status, 200);
  assertEquals(asAny(db.callsOn("contracts", "update")[0].payload).dispute_state, "lost");
  assertFalse(stripe.called("refunds.create"));
  assertFalse(stripe.called("transfers.create"));
});

// ── 7. Unbekannter Eventtyp ────────────────────────────────────────────────
Deno.test("7: unbekannter Eventtyp — 200, keinerlei Seiteneffekt", async () => {
  const { db, stripe, push, deps } = setup();
  const r = await handleStripeEvent(ev("invoice.paid", { id: "in_1" }), deps);
  assertEquals(r.status, 200);
  assertEquals(await bodyOf(r), { received: true });
  assertEquals(db.calls.length, 0, "keine einzige DB-Abfrage");
  assertEquals(db.rpcCalls.length, 0);
  assertEquals(stripe.calls.length, 0, "kein einziger Stripe-Aufruf");
  assertEquals(push.sent.length, 0);
});

// ── 8. Signaturpruefung ────────────────────────────────────────────────────
// Nutzt die ECHTE Stripe-Bibliothek (lokale HMAC-Kryptografie, kein Netzaufruf,
// kein API-Schluessel noetig).
const echtStripe = new Stripe("sk_test_dummy_nicht_verwendet", {
  apiVersion: "2023-10-16", httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const SECRET = "whsec_testgeheimnis";

async function signiere(payload: string, secret: string, ts: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${ts}.${payload}`));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `t=${ts},v1=${hex}`;
}

Deno.test("8a: ungueltige Signatur — kein Event, Aufrufer antwortet 400", async () => {
  const payload = JSON.stringify({ id: "evt_x", type: "charge.refunded", data: { object: {} } });
  const event = await constructStripeEvent(
    asAny(echtStripe), cryptoProvider, payload, "t=1,v1=deadbeef", SECRET,
  );
  assertEquals(event, null, "manipulierte Signatur muss abgewiesen werden");
});

Deno.test("8b: gueltige Signatur — Event wird akzeptiert (Gegenprobe)", async () => {
  const payload = JSON.stringify({ id: "evt_y", type: "charge.refunded", data: { object: {} } });
  const ts = Math.floor(Date.now() / 1000);
  const header = await signiere(payload, SECRET, ts);
  const event = await constructStripeEvent(asAny(echtStripe), cryptoProvider, payload, header, SECRET);
  assert(event !== null, "korrekt signiertes Event darf nicht abgewiesen werden");
  assertEquals(event?.id, "evt_y");
});

// ══════════════════════════════════════════════════════════════════════════
// PHASE 3 — Reproduktion der vermuteten Befunde aus dem Audit (P0-2).
//
// Diese beiden Tests formulieren den fachlich SICHEREN Sollzustand. Sie sind
// KEINE Festschreibung des Ist-Verhaltens. Werden sie rot, ist der vermutete
// Fehler reproduziert; der Fix erfolgt erst nach gesonderter Freigabe.
//
// Stripe garantiert fuer Webhooks KEINE Zustellreihenfolge und wiederholt bis
// zu drei Tage lang. Jedes Event traegt einen Snapshot des Objekts zum
// Entstehungszeitpunkt. Beides ist Kategorie 1 (offizielle Stripe-Semantik,
// hier angenommen), nicht durch diese Tests bewiesen.
// ══════════════════════════════════════════════════════════════════════════

// ── 9. Zwei Teilerstattungen in UMGEKEHRTER Reihenfolge ────────────────────
Deno.test("9 [Risiko]: Teilerstattungen umgekehrt zugestellt — Stand darf nicht sinken", async () => {
  const charge = (refunded: number) => ({
    id: "ch_1", payment_intent: "pi_1", amount_refunded: refunded,
    balance_transaction: "bt_1", created: 1753900000,
  });

  // Zuerst trifft der spaetere Snapshot ein (kumuliert 50 EUR).
  const a = setup(
    { "contracts.select": [{ data: { refunded_at: null, customer_refunded_amount: 0 } }],
      "contracts.update": [{ data: { id: "c1", status: "active", escrow_released_at: null, provider_id: "p1", provider_payout: 90 } }] },
    // Autoritativ bei Stripe: kumuliert 50 EUR.
    { "charges.retrieve": [{ id: "ch_1", amount_refunded: 5000, balance_transaction: "bt_1" }],
      "balanceTransactions.retrieve": [{ fee: 100 }] },
  );
  await handleStripeEvent(ev("charge.refunded", charge(5000)), a.deps);
  const nach1 = asAny(a.db.callsOn("contracts", "update")[0].payload).customer_refunded_amount;
  assertEquals(nach1, 50);

  // Danach trifft der AELTERE Snapshot ein (kumuliert erst 30 EUR).
  const b = setup(
    { "contracts.select": [{ data: { refunded_at: "2026-07-30T12:00:00Z", customer_refunded_amount: 50 } }],
      "contracts.update": [{ data: { id: "c1", status: "active", escrow_released_at: null, provider_id: "p1", provider_payout: 90 } }] },
    // Das EVENT traegt den alten Snapshot 30 — Stripe selbst sagt aber 50.
    { "charges.retrieve": [{ id: "ch_1", amount_refunded: 5000, balance_transaction: "bt_1" }],
      "balanceTransactions.retrieve": [{ fee: 100 }] },
  );
  await handleStripeEvent(ev("charge.refunded", charge(3000)), b.deps);

  const upd = b.db.callsOn("contracts", "update");
  assertEquals(upd.length, 1, "der Handler muss den autoritativen Stand tatsaechlich schreiben");
  assertEquals(
    asAny(upd[0].payload).customer_refunded_amount, 50,
    "SOLL: der verbuchte Erstattungsstand darf durch einen aelteren Snapshot nicht auf 30 sinken. " +
    "Sinkt er, sind Buchhaltung und DAC7-Meldegrundlage zu niedrig.",
  );
});

// ── 10. Verspaetetes altes charge.refunded nach fehlgeschlagenem Refund ────
Deno.test("10 [Risiko]: altes charge.refunded nach failed-Refund — darf 0 nicht wiederbeleben", async () => {
  // Ausgangszustand: Erstattung wurde von der Bank abgewiesen, Szenario 3 hat
  // korrekt auf 0 / null zurueckgesetzt. Es ist KEIN Geld zurueckgeflossen.
  const { db, deps } = setup(
    { "contracts.select": [{ data: { refunded_at: null, customer_refunded_amount: 0 } }],
      "contracts.update": [{ data: { id: "c1", status: "active", escrow_released_at: null, provider_id: "p1", provider_payout: 90 } }] },
    // Stripe selbst: die Erstattung ist fehlgeschlagen, es sind 0 EUR zurueck.
    { "charges.retrieve": [{ id: "ch_1", amount_refunded: 0, balance_transaction: "bt_1" }],
      "balanceTransactions.retrieve": [{ fee: 100 }] },
  );

  // Stripe stellt das urspruengliche charge.refunded erneut zu — mit dem alten
  // Snapshot amount_refunded = 10000.
  await handleStripeEvent(
    ev("charge.refunded", { id: "ch_1", payment_intent: "pi_1", amount_refunded: 10000, balance_transaction: "bt_1", created: 1753900000 }),
    deps,
  );

  const upd = db.callsOn("contracts", "update");
  // KEIN Fallback auf "nicht geschrieben = in Ordnung": genau das machte diesen
  // Test falsch gruen (QA-Review). Der Handler MUSS schreiben, und zwar 0.
  assertEquals(upd.length, 1, "der Handler muss den korrigierten Stand tatsaechlich schreiben");
  assertEquals(
    asAny(upd[0].payload).customer_refunded_amount, 0,
    "SOLL: eine fehlgeschlagene Erstattung darf durch eine verspaetete Wiederholung des alten " +
    "Events nicht als erfolgt verbucht werden. Sonst blockiert release-escrow dauerhaft " +
    "(Guard auf customer_refunded_amount > 0): Kunde ohne Geld, Anbieter nie auszahlbar.",
  );
});

// ── 11. Autoritativer Zustandsabruf schlaegt fehl ──────────────────────────
// Nach dem Fix ruft `charge.refunded` den massgeblichen Stand bei Stripe ab,
// statt dem Event-Snapshot zu glauben. Ist dieser Abruf nicht moeglich, darf
// NICHT geschrieben werden — und die Antwort muss sichtbar fehlschlagen, damit
// Stripe wiederholt. Ein stilles 200 wuerde den Geldvorgang als verarbeitet
// gelten lassen, ohne dass er es ist.
Deno.test("11: autoritativer Abruf scheitert — 500, keinerlei DB-Aenderung", async () => {
  const { db, stripe, deps } = setup(
    { "contracts.select": [{ data: { customer_refunded_amount: 0, refunded_at: null } }],
      "contracts.update": [{ data: { id: "c1" } }] },
    {},
    ["charges.retrieve"], // Abruf schlaegt fehl
  );

  const r = await handleStripeEvent(
    ev("charge.refunded", { id: "ch_1", payment_intent: "pi_1", amount_refunded: 10000, balance_transaction: "bt_1", created: 1753900000 }),
    deps,
  );

  assertEquals(r.status, 500, "muss sichtbar fehlschlagen, damit Stripe wiederholt");
  assertEquals(db.callsOn("contracts", "update").length, 0, "KEINE DB-Aenderung bei fehlender Autoritaet");
  assert(stripe.called("charges.retrieve"), "der Abruf wurde ueberhaupt versucht");
});

// ── 12. Nebenlaeufige Aenderung zwischen Lesen und Schreiben ───────────────
// Die CAS-Bedingung auf `customer_refunded_amount` laesst den ersten
// Schreibversuch ins Leere laufen. Der Handler muss den Stand dann erneut
// holen und erneut schreiben, statt still aufzugeben.
Deno.test("12: CAS-Konflikt — erneuter Versuch statt stiller Aufgabe", async () => {
  const { db, stripe, deps } = setup(
    { "contracts.select": [
        { data: { customer_refunded_amount: 0, refunded_at: null } },   // 1. Lesen
        { data: { customer_refunded_amount: 50, refunded_at: "2026-07-30T12:00:00Z" } }, // 2. Lesen nach Konflikt
      ],
      "contracts.update": [
        { data: null },                                                  // CAS verfehlt
        { data: { id: "c1", status: "active", escrow_released_at: null, provider_id: "p1", provider_payout: 90 } },
      ] },
    { "charges.retrieve": [
        { id: "ch_1", amount_refunded: 5000, balance_transaction: "bt_1" },
        { id: "ch_1", amount_refunded: 5000, balance_transaction: "bt_1" },
      ],
      "balanceTransactions.retrieve": [{ fee: 100 }, { fee: 100 }] },
  );

  const r = await handleStripeEvent(
    ev("charge.refunded", { id: "ch_1", payment_intent: "pi_1", amount_refunded: 5000, balance_transaction: "bt_1", created: 1753900000 }),
    deps,
  );

  assertEquals(r.status, 200);
  assertEquals(db.callsOn("contracts", "update").length, 2, "zweiter Schreibversuch nach CAS-Konflikt");
  assertEquals(stripe.callsTo("charges.retrieve").length, 2, "Autoritaet wird pro Versuch neu geholt");
  // Beide Schreibversuche tragen die CAS-Bedingung.
  for (const c of db.callsOn("contracts", "update")) {
    assert(c.filters.some((f) => f.fn === "eq" && f.args[0] === "customer_refunded_amount"),
      "CAS-Bedingung auf customer_refunded_amount fehlt");
  }
});

// ── 13. CAS dreimal verfehlt ───────────────────────────────────────────────
// Befund des Security-Reviews: Der Handler loggte nur und antwortete 200.
// Stripe wertet das als erledigt und wiederholt nicht mehr — der
// Erstattungsstand bliebe dauerhaft veraltet.
Deno.test("13: CAS dreimal verfehlt — 500 statt stillem 200", async () => {
  const { db, deps } = setup(
    { "contracts.select": [
        { data: { customer_refunded_amount: 0, refunded_at: null } },
        { data: { customer_refunded_amount: 10, refunded_at: null } },
        { data: { customer_refunded_amount: 20, refunded_at: null } },
      ],
      "contracts.update": [{ data: null }, { data: null }, { data: null }] },
    { "charges.retrieve": [
        { id: "ch_1", amount_refunded: 5000 }, { id: "ch_1", amount_refunded: 5000 }, { id: "ch_1", amount_refunded: 5000 },
      ] },
  );
  const r = await handleStripeEvent(
    ev("charge.refunded", { id: "ch_1", payment_intent: "pi_1", amount_refunded: 5000, created: 1753900000 }),
    deps,
  );
  assertEquals(r.status, 500, "muss fehlschlagen, damit Stripe wiederholt");
  assertEquals(db.callsOn("contracts", "update").length, 3, "genau drei Versuche, dann Aufgabe");
});

// ── 14. charge.refunded ohne zugehoerigen Vertrag ──────────────────────────
// Gegenprobe zu Test 13: Hier hilft Wiederholen NICHT. Der Handler muss 200
// antworten, sonst wiederholt Stripe drei Tage lang vergeblich.
Deno.test("14: kein Vertrag zum PaymentIntent — 200, keine Wiederholungsschleife", async () => {
  const { db, deps } = setup(
    { "contracts.select": [{ data: null }] },
    { "charges.retrieve": [{ id: "ch_1", amount_refunded: 5000 }] },
  );
  const r = await handleStripeEvent(
    ev("charge.refunded", { id: "ch_1", payment_intent: "pi_unbekannt", amount_refunded: 5000, created: 1753900000 }),
    deps,
  );
  assertEquals(r.status, 200, "Wiederholen wuerde nichts aendern");
  assertEquals(db.callsOn("contracts", "update").length, 0, "keine DB-Aenderung");
});

// ── 15. charge.refund.updated mit CAS-Konflikt ─────────────────────────────
// Befund des Security-Reviews: Dieser Zweig schrieb unconditional und konnte
// damit einen frischeren, CAS-geschuetzt verbuchten Wert aus `charge.refunded`
// wieder ueberschreiben.
Deno.test("15: charge.refund.updated — CAS-Konflikt fuehrt zu 500, nicht zum Ueberschreiben", async () => {
  const { db, deps } = setup(
    { "contracts.select": [{ data: { customer_refunded_amount: 50 } }],
      "contracts.update": [{ data: null }] },  // CAS verfehlt
    { "charges.retrieve": [{ amount_refunded: 0 }] },
  );
  const r = await handleStripeEvent(
    ev("charge.refund.updated", { id: "re_1", status: "failed", payment_intent: "pi_1", charge: "ch_1" }),
    deps,
  );
  assertEquals(r.status, 500, "nebenlaeufige Aenderung darf nicht still ueberschrieben werden");
  const upd = db.callsOn("contracts", "update")[0];
  assert(upd.filters.some((f) => f.fn === "eq" && f.args[0] === "customer_refunded_amount"),
    "CAS-Bedingung fehlt in charge.refund.updated");
});

// ── 16. charge.refunded ohne payment_intent ────────────────────────────────
// Fehlender Negativfall (QA-Review): frueher Abbruch, keinerlei Wirkung.
Deno.test("16: charge.refunded ohne payment_intent — 200, keine Wirkung", async () => {
  const { db, stripe, deps } = setup();
  const r = await handleStripeEvent(ev("charge.refunded", { id: "ch_1", amount_refunded: 5000 }), deps);
  assertEquals(r.status, 200);
  assertEquals(db.calls.length, 0, "keine DB-Abfrage ohne PaymentIntent");
  assertFalse(stripe.called("charges.retrieve"), "kein Stripe-Abruf ohne PaymentIntent");
});

// ── 17. Gebuehren-Abruf schlaegt fehl ──────────────────────────────────────
// Fehlender Negativfall (QA-Review): Die Bearbeitungsgebuehr ist Nebensache —
// ihr Fehlschlag darf die Verbuchung der Erstattung NICHT verhindern.
Deno.test("17: balanceTransactions-Abruf scheitert — Erstattung wird trotzdem verbucht", async () => {
  const { db, deps } = setup(
    { "contracts.select": [{ data: { customer_refunded_amount: 0, refunded_at: null } }],
      "contracts.update": [{ data: { id: "c1", status: "active", escrow_released_at: null, provider_id: "p1", provider_payout: 90 } }] },
    { "charges.retrieve": [{ id: "ch_1", amount_refunded: 3000, balance_transaction: "bt_1" }] },
    ["balanceTransactions.retrieve"],
  );
  const r = await handleStripeEvent(
    ev("charge.refunded", { id: "ch_1", payment_intent: "pi_1", amount_refunded: 3000, created: 1753900000 }),
    deps,
  );
  assertEquals(r.status, 200);
  const p = asAny(db.callsOn("contracts", "update")[0].payload);
  assertEquals(p.customer_refunded_amount, 30, "Erstattung trotz fehlender Gebuehr verbucht");
  assertEquals(p.stripe_fee_lost, 0, "Gebuehr bleibt 0, wenn nicht ermittelbar");
});

// ══════════════════════════════════════════════════════════════════════════
// account.updated — Spiegel des Connect-Konto-Zustands
//
// `stripe_onboarded` steuert die Sichtbarkeit des Anbieters: app/(tabs)/index.tsx
// und app/nachbarschaft.tsx filtern darauf, app/suche.tsx macht daraus das
// „verifiziert"-Abzeichen. Die Spalte ist als Spiegel des Stripe-Zustands
// dokumentiert (handler.ts: "Both charges_enabled AND payouts_enabled must be
// true before we consider a Connect account fully operational").
//
// Ein Spiegel, der nur in eine Richtung folgt, ist kein Spiegel.
// ══════════════════════════════════════════════════════════════════════════

const konto = (charges: boolean, payouts: boolean) => ({
  id: "acct_1", charges_enabled: charges, payouts_enabled: payouts,
});

Deno.test("18: account.updated voll freigeschaltet — stripe_onboarded=true", async () => {
  const { db, deps } = setup({ "provider_profiles.update": [{ data: null, error: null }] },
    { "accounts.retrieve": [konto(true, true)] });
  const r = await handleStripeEvent(ev("account.updated", konto(true, true)), deps);
  assertEquals(r.status, 200);
  const upd = db.callsOn("provider_profiles", "update");
  assertEquals(upd.length, 1);
  assertEquals(asAny(upd[0].payload).stripe_onboarded, true);
  assert(upd[0].filters.some((f) => f.fn === "eq" && f.args[0] === "stripe_account_id"));
});

Deno.test("19: Auszahlungen gesperrt — stripe_onboarded muss auf false zurueck", async () => {
  const { db, deps } = setup({ "provider_profiles.update": [{ data: null, error: null }] },
    { "accounts.retrieve": [konto(true, false)] });
  const r = await handleStripeEvent(ev("account.updated", konto(true, false)), deps);
  assertEquals(r.status, 200);
  const upd = db.callsOn("provider_profiles", "update");
  assertEquals(upd.length, 1, "SOLL: der Zustand muss auch nach unten gespiegelt werden");
  assertEquals(
    asAny(upd[0].payload).stripe_onboarded, false,
    "SOLL: sperrt Stripe die Auszahlungen, darf der Anbieter nicht weiter als " +
    "voll onboardet gefuehrt und in Suche/Startseite als verifiziert gezeigt werden.",
  );
});

Deno.test("20: Zahlungen gesperrt — stripe_onboarded muss auf false zurueck", async () => {
  const { db, deps } = setup({ "provider_profiles.update": [{ data: null, error: null }] },
    { "accounts.retrieve": [konto(false, true)] });
  await handleStripeEvent(ev("account.updated", konto(false, true)), deps);
  const upd = db.callsOn("provider_profiles", "update");
  assertEquals(upd.length, 1);
  assertEquals(asAny(upd[0].payload).stripe_onboarded, false);
});

Deno.test("21: Konto vollstaendig gesperrt — stripe_onboarded=false", async () => {
  const { db, deps } = setup({ "provider_profiles.update": [{ data: null, error: null }] },
    { "accounts.retrieve": [konto(false, false)] });
  await handleStripeEvent(ev("account.updated", konto(false, false)), deps);
  const upd = db.callsOn("provider_profiles", "update");
  assertEquals(upd.length, 1);
  assertEquals(asAny(upd[0].payload).stripe_onboarded, false);
});

// ── 22. Verspaetetes altes account.updated ─────────────────────────────────
// Erst dadurch, dass der Handler jetzt auch `false` schreibt, entsteht diese
// Fehlermoeglichkeit (Befund des Security-Reviews). Stripe garantiert keine
// Zustellreihenfolge: ein altes Event „Konto gesperrt" darf einen inzwischen
// wieder freigeschalteten Anbieter nicht dauerhaft unsichtbar machen.
Deno.test("22 [Reihenfolge]: altes 'gesperrt'-Event, Konto laengst wieder frei", async () => {
  const { db, stripe, deps } = setup(
    { "provider_profiles.update": [{ data: null, error: null }] },
    // Stripe selbst sagt: das Konto ist voll freigeschaltet.
    { "accounts.retrieve": [konto(true, true)] },
  );
  // Das EVENT traegt den alten Snapshot „gesperrt".
  const r = await handleStripeEvent(ev("account.updated", konto(false, false)), deps);
  assertEquals(r.status, 200);
  assert(stripe.called("accounts.retrieve"), "der massgebliche Zustand muss erfragt werden");
  assertEquals(
    asAny(db.callsOn("provider_profiles", "update")[0].payload).stripe_onboarded, true,
    "SOLL: der autoritative Zustand gewinnt, nicht der veraltete Event-Snapshot.",
  );
});

// ── 23. Kontoabruf scheitert ───────────────────────────────────────────────
Deno.test("23: Kontostand nicht abrufbar — 500, keine DB-Aenderung", async () => {
  const { db, deps } = setup(
    { "provider_profiles.update": [{ data: null, error: null }] },
    {},
    ["accounts.retrieve"],
  );
  const r = await handleStripeEvent(ev("account.updated", konto(true, true)), deps);
  assertEquals(r.status, 500, "muss fehlschlagen, damit Stripe wiederholt");
  assertEquals(db.callsOn("provider_profiles", "update").length, 0, "lieber unverarbeitet als falsch gespiegelt");
});

// ══════════════════════════════════════════════════════════════════════════
// Offene Geldfehler aus den Reviews zu #159 / #162.
//
// Gemeinsame Klasse: Ein fehlgeschlagener DB-Schreibvorgang wird nicht geprueft,
// die Function antwortet trotzdem 200 — und Stripe wiederholt daraufhin NIE.
// Der Geldvorgang gilt als verarbeitet, ohne es zu sein.
// ══════════════════════════════════════════════════════════════════════════

const disputeCash = () => ({
  id: "dp_1", payment_intent: "pi_1", amount: 10000,
  balance_transactions: [{ fee: 1500 }],
});

Deno.test("24 [P0]: funds_withdrawn, DB-Update scheitert — kein stilles 200", async () => {
  const { deps } = setup({ "contracts.update": [{ data: null, error: { message: "boom" } }] });
  const r = await handleStripeEvent(ev("charge.dispute.funds_withdrawn", disputeCash()), deps);
  assertEquals(r.status, 500,
    "SOLL: Geld hat den Plattform-Saldo real verlassen. Ohne Fehlerantwort " +
    "wiederholt Stripe nicht und die Buchfuehrung driftet dauerhaft ab.");
});

Deno.test("25 [P0]: funds_reinstated, DB-Update scheitert — kein stilles 200", async () => {
  const { deps } = setup({ "contracts.update": [{ data: null, error: { message: "boom" } }] });
  const r = await handleStripeEvent(ev("charge.dispute.funds_reinstated", disputeCash()), deps);
  assertEquals(r.status, 500);
});

Deno.test("26: funds_withdrawn ohne zugehoerigen Vertrag — 200, Wiederholen hilft nicht", async () => {
  const { deps } = setup({ "contracts.update": [{ data: null, error: null }] });
  const r = await handleStripeEvent(ev("charge.dispute.funds_withdrawn", disputeCash()), deps);
  assertEquals(r.status, 200, "kein Vertrag zum PaymentIntent — endlose Wiederholung waere sinnlos");
});

// ── Subscription-Zweige ───────────────────────────────────────────────────
const sub = (u: Record<string, unknown> = {}) => ({
  id: "sub_1", customer: "cus_1", status: "active",
  current_period_start: 1753900000, current_period_end: 1756578400,
  cancel_at_period_end: false, ...u,
});

Deno.test("27 [P1]: Subscription-Upsert scheitert — kein stilles 200", async () => {
  const { deps } = setup({
    "profiles.select": [{ data: { id: "p1" } }],
    "pro_subscriptions.upsert": [{ data: null, error: { message: "boom" } }],
  });
  const r = await handleStripeEvent(ev("customer.subscription.updated", sub()), deps);
  assertEquals(r.status, 500, "sonst laeuft der Billing-Zustand dauerhaft auseinander");
});

Deno.test("28 [P1]: is_pro-Spiegel scheitert — kein stilles 200", async () => {
  const { deps } = setup({
    "profiles.select": [{ data: { id: "p1" } }],
    "pro_subscriptions.upsert": [{ data: null, error: null }],
    "provider_profiles.update": [{ data: null, error: { message: "boom" } }],
  });
  const r = await handleStripeEvent(ev("customer.subscription.updated", sub()), deps);
  assertEquals(r.status, 500);
});

Deno.test("29 [P1]: Subscription geloescht, DB-Update scheitert — kein stilles 200", async () => {
  const { deps } = setup({
    "profiles.select": [{ data: { id: "p1" } }],
    "pro_subscriptions.update": [{ data: null, error: { message: "boom" } }],
  });
  const r = await handleStripeEvent(ev("customer.subscription.deleted", sub({ status: "canceled" })), deps);
  assertEquals(r.status, 500);
});

Deno.test("30: Subscription ohne passendes Profil — 200, Wiederholen hilft nicht", async () => {
  const { deps } = setup({ "profiles.select": [{ data: null }] });
  const r = await handleStripeEvent(ev("customer.subscription.updated", sub()), deps);
  assertEquals(r.status, 200);
});

// ── dispute_state darf nicht rueckwaerts ──────────────────────────────────
Deno.test("31 [P0]: verspaetetes 'created' nach 'won' setzt NICHT auf 'open' zurueck", async () => {
  const { db, deps } = setup({
    "contracts.update": [{ data: null }],          // CAS greift nicht
    "contracts.select": [{ data: { id: "c1", dispute_state: "won" } }],
  });
  const r = await handleStripeEvent(ev("charge.dispute.created", disputeObj("needs_response")), deps);
  assertEquals(r.status, 200, "der Vorgang ist abgeschlossen, Wiederholen hilft nicht");
  const upd = db.callsOn("contracts", "update")[0];
  // EXAKTER Vergleich, nicht `includes`: das QA-Review hat gezeigt, dass eine
  // semantisch verkehrte Bedingung (etwa `eq.lost`) mit einer Teilstring-Pruefung
  // durchgerutscht waere. Die WIRKUNG dieser Bedingung ist zusaetzlich gegen
  // echtes Postgres belegt (scripts/db-test/webhook-idempotency.sql).
  const orFilter = upd.filters.find((f) => f.fn === "or");
  assert(orFilter, "Bedingung gegen Ruecksetzen fehlt vollstaendig");
  assertEquals(
    orFilter.args[0], "dispute_state.is.null,dispute_state.eq.open",
    "SOLL: nur ein leerer oder bereits offener Zustand darf auf 'open' gesetzt " +
    "werden — sonst faellt ein abgeschlossener Vorgang zurueck auf offen",
  );
});

Deno.test("32: erstes 'created' bei leerem Zustand — setzt 'open'", async () => {
  const { db, deps } = setup({ "contracts.update": [{ data: { id: "c1", escrow_released_at: null } }] });
  const r = await handleStripeEvent(ev("charge.dispute.created", disputeObj("needs_response")), deps);
  assertEquals(r.status, 200);
  assertEquals(asAny(db.callsOn("contracts", "update")[0].payload).dispute_state, "open");
});

Deno.test("33: 'closed won' ueberschreibt 'open' ohne Zusatzbedingung", async () => {
  const { db, deps } = setup({ "contracts.update": [{ data: { id: "c1", escrow_released_at: null } }] });
  await handleStripeEvent(ev("charge.dispute.closed", disputeObj("won")), deps);
  const upd = db.callsOn("contracts", "update")[0];
  assertEquals(asAny(upd.payload).dispute_state, "won");
  assertFalse(upd.filters.some((f) => f.fn === "or"),
    "ein Endzustand darf einen offenen ueberschreiben");
});

// ══════════════════════════════════════════════════════════════════════════
// PaymentIntent-Historie (Migration 0660).
//
// Der Kernzweck: Ein Ereignis zu einem ALTEN PaymentIntent muss seinen Vertrag
// finden. Vorher filterte jeder Zweig auf contracts.stripe_payment_intent —
// die haelt nur den letzten Intent, und ein Ereignis zu einem aelteren fand
// keine Zeile und hinterliess weder Spur noch Alarm.
// ══════════════════════════════════════════════════════════════════════════

/** Setup, bei dem der Intent NICHT der aktuelle des Vertrags ist. */
function alterIntent(queues: Record<string, Array<{ data?: unknown; error?: unknown }>> = {},
                     stripeScript: Record<string, unknown[]> = {}) {
  const s = setup(queues, stripeScript);
  s.db.rpcResponses["contract_for_payment_intent"] = {
    data: { contract_id: "c_alt", is_current: false }, error: null,
  };
  return s;
}

Deno.test("35 [P0]: Erstattung auf einem ALTEN PaymentIntent findet den Vertrag", async () => {
  const { db, deps } = alterIntent(
    { "contracts.select": [{ data: { customer_refunded_amount: 0, refunded_at: null } }],
      "contracts.update": [{ data: { id: "c_alt", status: "active", escrow_released_at: null, provider_id: "p1", provider_payout: 90 } }] },
    { "charges.retrieve": [{ id: "ch_1", amount_refunded: 3000, balance_transaction: "bt_1" }],
      "balanceTransactions.retrieve": [{ fee: 100 }] },
  );
  const r = await handleStripeEvent(
    ev("charge.refunded", { id: "ch_1", payment_intent: "pi_alt", amount_refunded: 3000, created: 1753900000 }),
    deps,
  );
  assertEquals(r.status, 200);
  const upd = db.callsOn("contracts", "update")[0];
  assertEquals(asAny(upd.payload).customer_refunded_amount, 30, "die Erstattung wird verbucht");
  assert(upd.filters.some((f) => f.fn === "eq" && f.args[0] === "id" && f.args[1] === "c_alt"),
    "SOLL: ueber die Vertrags-ID aus der Historie, nicht ueber den aktuellen Intent");
});

Deno.test("36 [P0]: Rueckbuchung auf einem ALTEN PaymentIntent findet den Vertrag", async () => {
  const { db, deps } = alterIntent({ "contracts.update": [{ data: { id: "c_alt", escrow_released_at: null } }] });
  const r = await handleStripeEvent(ev("charge.dispute.created", disputeObj("needs_response")), deps);
  assertEquals(r.status, 200);
  assertEquals(asAny(db.callsOn("contracts", "update")[0].payload).dispute_state, "open");
});

Deno.test("37 [P0]: Cash-Bewegung auf einem ALTEN PaymentIntent wird verbucht", async () => {
  const { db, deps } = alterIntent({ "contracts.update": [{ data: { id: "c_alt" } }] });
  const r = await handleStripeEvent(ev("charge.dispute.funds_withdrawn", disputeCash()), deps);
  assertEquals(r.status, 200);
  assertEquals(asAny(db.callsOn("contracts", "update")[0].payload).dispute_funds_withdrawn, true);
});

Deno.test("38 [P0]: Fruehwarnung auf einem ALTEN PaymentIntent findet den Vertrag", async () => {
  const { db, deps } = alterIntent({
    "contracts.select": [
      { data: { id: "c_alt", status: "active", escrow_released_at: null, customer_total: 100, provider_payout: 90, customer_refunded_amount: 0, dispute_state: null } },
      { data: { fraud_warning_at: null } },
    ],
    "contracts.update": [{ data: null, error: null }],
  });
  const r = await handleStripeEvent(
    ev("radar.early_fraud_warning.created", { payment_intent: "pi_alt", charge: "ch_1", fraud_type: "made_with_stolen_card" }),
    deps,
  );
  assertEquals(r.status, 200);
  assert(db.callsOn("contracts", "select").length > 0, "der Vertrag wird ueber die Historie gefunden");
});

Deno.test("39: unbekannter PaymentIntent — 200, kein Schreibvorgang", async () => {
  const { db, deps } = setup();
  db.rpcResponses["contract_for_payment_intent"] = { data: null, error: null };
  const r = await handleStripeEvent(
    ev("charge.refunded", { id: "ch_1", payment_intent: "pi_fremd", amount_refunded: 3000, created: 1753900000 }),
    deps,
  );
  assertEquals(r.status, 200, "Wiederholen wuerde nichts aendern");
  assertEquals(db.callsOn("contracts", "update").length, 0);
});

Deno.test("40: Auflösung scheitert — 500, damit Stripe wiederholt", async () => {
  const { db, deps } = setup();
  db.rpcResponses["contract_for_payment_intent"] = { data: null, error: { message: "boom" } };
  const r = await handleStripeEvent(
    ev("charge.refunded", { id: "ch_1", payment_intent: "pi_1", amount_refunded: 3000, created: 1753900000 }),
    deps,
  );
  assertEquals(r.status, 500, "ohne Aufloesung darf kein Ereignis als erledigt gelten");
  assertEquals(db.callsOn("contracts", "update").length, 0);
});
