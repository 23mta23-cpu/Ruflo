// Ausfuehrbare Tests der Escrow-Freigabe mit Payout-Ledger (Migration 0650).
//
// Getestet wird AUSSCHLIESSLICH die eigene Logik in
// supabase/functions/release-escrow/handler.ts — dieselbe Funktion, die
// index.ts in Produktion aufruft. KEINE zweite Version der Logik im Test.
//
// KEIN echter Stripe-Aufruf.
//
// GRENZE: Der Supabase-Double wertet Filter NICHT aus und fuehrt die RPCs
// payout_claim/payout_finalize NICHT aus — er liefert skriptierte Antworten.
// Was diese Datei belegt, ist die ABLAUFSTEUERUNG des Handlers: welcher
// externe Aufruf wann passiert und welcher NICHT. Die Wirkung der RPCs selbst
// (atomare Beanspruchung, Einmaligkeit des PStTG-Zaehlers, RLS) ist in
// scripts/db-test/payout-ledger.sql gegen echtes Postgres belegt, inklusive
// echter Nebenlaeufigkeit ueber zwei dblink-Verbindungen.
import { assertEquals, assert, assertFalse } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { handleReleaseEscrow } from "../functions/release-escrow/handler.ts";
import { FakeSupabase } from "../functions/_shared/testing/fakeSupabase.ts";
import { FakeStripe, makeFakePush } from "../functions/_shared/testing/fakeStripe.ts";

// deno-lint-ignore no-explicit-any
const asAny = (x: unknown) => x as any;

const KUNDE = "11111111-1111-1111-1111-111111111111";
const FREMD = "99999999-9999-9999-9999-999999999999";
const ANBIETER = "22222222-2222-2222-2222-222222222222";
const VERTRAG = "33333333-3333-3333-3333-333333333333";
const OP = "55555555-5555-5555-5555-555555555555";

const vertrag = (u: Record<string, unknown> = {}) => ({
  id: VERTRAG, job_id: "44444444-4444-4444-4444-444444444444",
  customer_id: KUNDE, provider_id: ANBIETER,
  status: "active", escrow_captured_at: "2026-08-01T10:00:00Z",
  escrow_released_at: null, provider_payout: 92,
  customer_refunded_amount: 0, dispute_state: null,
  customer_total: 100, stripe_payment_intent: "pi_1", ...u,
});

// Der PaymentIntent, wie Stripe ihn fuer diesen Vertrag zurueckgibt.
// create-payment-intent legt ihn mit metadata.contract_id und
// amount = round(customer_total * 100) an — beides ist damit pruefbar.
const intent = (u: Record<string, unknown> = {}) => ({
  id: "pi_1", status: "succeeded", amount: 10000, amount_received: 10000,
  currency: "eur", metadata: { contract_id: VERTRAG }, ...u,
});

const operation = (u: Record<string, unknown> = {}) => ({
  id: OP, contract_id: VERTRAG, status: "claimed",
  amount_cents: 9200, currency: "eur", destination_account_id: "acct_1",
  idempotency_key: `payout-op-${VERTRAG}`, transfer_group: VERTRAG,
  stripe_transfer_id: null, last_error: null, ...u,
});

const transfer = (u: Record<string, unknown> = {}) => ({
  id: "tr_1", amount: 9200, currency: "eur", destination: "acct_1", ...u,
});

function setup(o: {
  user?: string | null;
  contract?: Record<string, unknown> | null;
  providerProfile?: Record<string, unknown> | null;
  claim?: { data?: unknown; error?: unknown };
  finalize?: { data?: unknown; error?: unknown };
  opUpdate?: { data?: unknown; error?: unknown };
  vorhandeneTransfers?: unknown[];
  konto?: Record<string, unknown>;
  intent?: Record<string, unknown> | null;
  stripeFailing?: string[];
} = {}) {
  const db = new FakeSupabase({
    "contracts.select":         [{ data: o.contract === undefined ? vertrag() : o.contract }],
    "provider_profiles.select": [{ data: o.providerProfile === undefined ? { stripe_account_id: "acct_1" } : o.providerProfile }],
    "payout_operations.update": [o.opUpdate ?? { data: null, error: null }],
    "profiles.select":          [{ data: { push_token: "tok" } }, { data: { push_token: "tok2" } }],
    "jobs.select":              [{ data: { title: "Bad sanieren" } }],
  });
  db.authUser = o.user === undefined ? { id: KUNDE } : (o.user ? { id: o.user } : null);
  db.rpcResponses["payout_claim"]    = o.claim    ?? { data: operation(), error: null };
  db.rpcResponses["payout_finalize"] = o.finalize ?? { data: operation({ status: "finalized", stripe_transfer_id: "tr_1" }), error: null };
  const stripe = new FakeStripe({
    "transfers.list":     [{ data: o.vorhandeneTransfers ?? [] }],
    "transfers.create":   [transfer()],
    "accounts.retrieve":  [o.konto ?? { id: "acct_1", payouts_enabled: true, charges_enabled: true }],
    "paymentIntents.retrieve": [o.intent === undefined ? intent() : o.intent],
  }, o.stripeFailing ?? []);
  const push = makeFakePush();
  return { db, stripe, push, deps: { supabase: asAny(db), stripe: asAny(stripe), sendPush: push.fn, stripeSecretKey: "sk_test_x" } };
}

const anfrage = (body: unknown = { contract_id: VERTRAG }, auth = true) =>
  new Request("https://x/release-escrow", {
    method: "POST",
    headers: auth
      ? { Authorization: "Bearer jwt", "Content-Type": "application/json" }
      : { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

// ── 1. Normaler erster Transfer ────────────────────────────────────────────
Deno.test("1: erster Transfer — Abgleich, Kontopruefung, Transfer, Finalisierung", async () => {
  const { db, stripe, push, deps } = setup();
  const r = await handleReleaseEscrow(anfrage(), deps);
  assertEquals(r.status, 200);

  // Reihenfolge ist der Kern: erst pruefen, ob ueberhaupt gezahlt wurde, dann
  // beanspruchen, dann abgleichen, dann Konto, dann ueberweisen, dann
  // finalisieren.
  assertEquals(
    stripe.calls.map((c) => c.method),
    ["paymentIntents.retrieve", "transfers.list", "accounts.retrieve", "transfers.create"],
  );
  assertEquals(db.rpcCalls.map((c) => c.fn).filter((f) => f.startsWith("payout")),
    ["payout_claim", "payout_finalize"]);

  const t = asAny(stripe.callsTo("transfers.create")[0].args[0]);
  assertEquals(t.amount, 9200, "Betrag aus der Operation, in ganzen Cent");
  assertEquals(t.currency, "eur");
  assertEquals(t.destination, "acct_1");
  assertEquals(t.transfer_group, VERTRAG);
  assertEquals(t.metadata.payout_operation_id, OP);
  assertEquals(t.metadata.contract_id, VERTRAG);
  assertEquals(Object.keys(t.metadata).sort(), ["contract_id", "payout_operation_id"],
    "keine personenbezogenen Daten in den Stripe-Metadaten");
  assertEquals(asAny(stripe.callsTo("transfers.create")[0].args[1]).idempotencyKey, `payout-op-${VERTRAG}`);
  assertEquals(push.sent.length, 2);
});

// ── 2. Zweite identische Anfrage kurz darauf ───────────────────────────────
Deno.test("2: zweite Anfrage, Operation traegt bereits die Transfer-ID — kein neuer Transfer", async () => {
  const { stripe, deps } = setup({ claim: { data: operation({ status: "transferred", stripe_transfer_id: "tr_1" }), error: null } });
  const r = await handleReleaseEscrow(anfrage(), deps);
  assertEquals(r.status, 200);
  assertFalse(stripe.called("transfers.create"), "KEIN zweiter Transfer");
  assertFalse(stripe.called("transfers.list"), "Abgleich unnoetig, ID ist bekannt");
});

// ── 3. Zwei parallele Anfragen ─────────────────────────────────────────────
Deno.test("3 [Nebenlaeufigkeit]: parallele Anfragen nutzen denselben Idempotency-Key", async () => {
  const a = setup(); const b = setup();
  const [r1, r2] = await Promise.all([handleReleaseEscrow(anfrage(), a.deps), handleReleaseEscrow(anfrage(), b.deps)]);
  assertEquals(r1.status, 200); assertEquals(r2.status, 200);
  assertEquals(
    asAny(a.stripe.callsTo("transfers.create")[0].args[1]).idempotencyKey,
    asAny(b.stripe.callsTo("transfers.create")[0].args[1]).idempotencyKey,
  );
  // Dass nur EINE Operation entsteht, beweist payout-ledger.sql gegen echtes
  // Postgres ueber zwei dblink-Verbindungen — nicht dieser Test.
});

// ── 4. Transfer erfolgreich, Speichern der Transfer-ID scheitert ───────────
Deno.test("4: Transfer OK, ID-Speichern scheitert — 500, KEINE Finalisierung", async () => {
  const { db, stripe, deps } = setup({ opUpdate: { data: null, error: { message: "boom" } } });
  const r = await handleReleaseEscrow(anfrage(), deps);
  assertEquals(r.status, 500);
  assert(stripe.called("transfers.create"), "der Transfer ist gelaufen");
  assertEquals(db.rpcCalls.filter((c) => c.fn === "payout_finalize").length, 0,
    "ohne festgehaltene ID wird NICHT finalisiert");
});

// ── 5. Erneuter Versuch nach diesem Fehler ─────────────────────────────────
Deno.test("5: Wiederaufnahme — Transfer wird ueber die Gruppe wiedergefunden, kein neuer", async () => {
  const { stripe, db, deps } = setup({ vorhandeneTransfers: [transfer()] });
  const r = await handleReleaseEscrow(anfrage(), deps);
  assertEquals(r.status, 200);
  assert(stripe.called("transfers.list"));
  assertFalse(stripe.called("transfers.create"), "KEIN zweiter Transfer");
  assertFalse(stripe.called("accounts.retrieve"), "Kontopruefung nur vor einem NEUEN Transfer");
  assertEquals(asAny(db.rpcCalls.find((c) => c.fn === "payout_finalize")!.args).p_transfer_id, "tr_1");
});

// ── 6. Erneuter Versuch nach mehr als 24 Stunden ───────────────────────────
Deno.test("6 [24h]: abgelaufener Idempotency-Key — der Abgleich verhindert den zweiten Transfer", async () => {
  // Nach 24h wuerde Stripe den Key verwerfen. Der Schutz haengt jetzt NICHT
  // mehr daran, sondern am Abgleich ueber die transfer_group.
  const { stripe, deps } = setup({ vorhandeneTransfers: [transfer()] });
  assertEquals((await handleReleaseEscrow(anfrage(), deps)).status, 200);
  assertFalse(stripe.called("transfers.create"),
    "SOLL: auch mit abgelaufenem Key entsteht kein zweiter Transfer");
});

// ── 7. Vorhandener Transfer wird ueber transfer_group gefunden ─────────────
Deno.test("7: Abgleich sucht nach transfer_group und Limit", async () => {
  const { stripe, deps } = setup({ vorhandeneTransfers: [transfer()] });
  await handleReleaseEscrow(anfrage(), deps);
  const p = asAny(stripe.callsTo("transfers.list")[0].args[0]);
  assertEquals(p.transfer_group, VERTRAG);
  assert(p.limit >= 1, "Limit gesetzt, damit die Suche nicht stillschweigend abschneidet");
});

// ── 8./9./10. Widerspruechlicher Abgleich sperrt ───────────────────────────
const sperrt = (name: string, gefunden: unknown[]) => {
  Deno.test(name, async () => {
    const { db, stripe, deps } = setup({ vorhandeneTransfers: gefunden });
    const r = await handleReleaseEscrow(anfrage(), deps);
    assertEquals(r.status, 409);
    assertFalse(stripe.called("transfers.create"), "KEIN Transfer bei unklarem Abgleich");
    const upd = db.callsOn("payout_operations", "update");
    assertEquals(upd.length, 1);
    assertEquals(asAny(upd[0].payload).status, "manual_review");
    assertEquals(db.rpcCalls.filter((c) => c.fn === "payout_finalize").length, 0);
  });
};
sperrt("8: vorhandener Transfer mit falschem Betrag — manual_review", [transfer({ amount: 5000 })]);
sperrt("9: vorhandener Transfer mit falschem Zielkonto — manual_review", [transfer({ destination: "acct_fremd" })]);
sperrt("10: mehrere passende Transfers — manual_review", [transfer(), transfer({ id: "tr_2" })]);
sperrt("10b: falsche Waehrung — manual_review", [transfer({ currency: "usd" })]);

// ── 11. Abgleich-Aufruf schlaegt fehl ──────────────────────────────────────
Deno.test("11: transfers.list scheitert — fail-closed, 503, kein Transfer", async () => {
  const { db, stripe, deps } = setup({ stripeFailing: ["transfers.list"] });
  const r = await handleReleaseEscrow(anfrage(), deps);
  assertEquals(r.status, 503);
  assertFalse(stripe.called("transfers.create"));
  assertEquals(db.rpcCalls.filter((c) => c.fn === "payout_finalize").length, 0);
});

// ── 12. Transfer-Erstellung schlaegt fehl ──────────────────────────────────
Deno.test("12: transfers.create scheitert — 500, keine Finalisierung", async () => {
  const { db, deps } = setup({ stripeFailing: ["transfers.create"] });
  assertEquals((await handleReleaseEscrow(anfrage(), deps)).status, 500);
  assertEquals(db.rpcCalls.filter((c) => c.fn === "payout_finalize").length, 0);
});

// ── 13. Finalisierungs-RPC schlaegt fehl ───────────────────────────────────
Deno.test("13: Finalisierung scheitert — 500, Transfer bleibt festgehalten", async () => {
  const { db, stripe, deps } = setup({ finalize: { data: null, error: { message: "boom" } } });
  const r = await handleReleaseEscrow(anfrage(), deps);
  assertEquals(r.status, 500);
  assert(stripe.called("transfers.create"));
  assertEquals(asAny(db.callsOn("payout_operations", "update")[0].payload).stripe_transfer_id, "tr_1",
    "die ID ist gespeichert — der naechste Versuch finalisiert nur noch nach");
});

// ── 14. Erneuter Versuch finalisiert den bestehenden Transfer ──────────────
Deno.test("14: Wiederaufnahme finalisiert die bestehende Operation ohne neuen Transfer", async () => {
  const { db, stripe, deps } = setup({ claim: { data: operation({ status: "transferred", stripe_transfer_id: "tr_1" }), error: null } });
  const r = await handleReleaseEscrow(anfrage(), deps);
  assertEquals(r.status, 200);
  assertFalse(stripe.called("transfers.create"));
  assertEquals(asAny(db.rpcCalls.find((c) => c.fn === "payout_finalize")!.args).p_transfer_id, "tr_1");
});

// ── 15./16. PStTG, Vertrag und Auftrag genau einmal ────────────────────────
Deno.test("15/16: Handler zaehlt und schliesst NICHT selbst — alles liegt in payout_finalize", async () => {
  const { db, deps } = setup();
  await handleReleaseEscrow(anfrage(), deps);
  assertEquals(db.rpcCalls.filter((c) => c.fn === "pstg_record_transaction").length, 0,
    "kein direkter Zaehleraufruf mehr im Handler");
  assertEquals(db.callsOn("contracts", "update").length, 0, "kein direktes Vertrags-Update");
  assertEquals(db.callsOn("jobs", "update").length, 0, "kein direktes Auftrags-Update");
  assertEquals(db.rpcCalls.filter((c) => c.fn === "payout_finalize").length, 1,
    "genau ein Finalisierungsaufruf — Einmaligkeit beweist payout-ledger.sql gegen echtes Postgres");
});

// ── 17. Connect-Konto nicht auszahlungsfaehig ──────────────────────────────
Deno.test("17: payouts_enabled=false — 409, kein Transfer, Vertrag unberuehrt", async () => {
  const { db, stripe, deps } = setup({ konto: { id: "acct_1", payouts_enabled: false, charges_enabled: true } });
  const r = await handleReleaseEscrow(anfrage(), deps);
  assertEquals(r.status, 409);
  assertFalse(stripe.called("transfers.create"));
  assertEquals(db.rpcCalls.filter((c) => c.fn === "payout_finalize").length, 0);
  assertEquals(db.callsOn("contracts", "update").length, 0, "der Vertrag bleibt bestehen und stornierbar");
});

Deno.test("17b: charges_enabled=false allein blockiert NICHT", async () => {
  // Begruendung im Handler: das verbundene Konto stellt in diesem
  // Connect-Modell nie selbst eine Belastung. ANNAHME, nicht gegen echtes
  // Stripe verifiziert.
  const { stripe, deps } = setup({ konto: { id: "acct_1", payouts_enabled: true, charges_enabled: false } });
  assertEquals((await handleReleaseEscrow(anfrage(), deps)).status, 200);
  assert(stripe.called("transfers.create"));
});

// ── 18. Account-Abruf schlaegt fehl ────────────────────────────────────────
Deno.test("18: accounts.retrieve scheitert — fail-closed, 503, kein Transfer", async () => {
  const { db, stripe, deps } = setup({ stripeFailing: ["accounts.retrieve"] });
  const r = await handleReleaseEscrow(anfrage(), deps);
  assertEquals(r.status, 503);
  assertFalse(stripe.called("transfers.create"));
  assertEquals(db.rpcCalls.filter((c) => c.fn === "payout_finalize").length, 0);
});

// ── 19./20. Guards vor jedem externen Aufruf ───────────────────────────────
const keinAufruf = (name: string, o: Parameters<typeof setup>[0], status: number) => {
  Deno.test(name, async () => {
    const { db, stripe, deps } = setup(o);
    const r = await handleReleaseEscrow(anfrage(), deps);
    assertEquals(r.status, status);
    assertEquals(stripe.calls.length, 0, "KEIN einziger Stripe-Aufruf");
    assertEquals(db.rpcCalls.filter((c) => c.fn.startsWith("payout")).length, 0,
      "nicht einmal beansprucht");
  });
};
keinAufruf("19: fremder Nutzer — 403", { user: FREMD }, 403);
keinAufruf("20: Kundenerstattung vorhanden — 409", { contract: vertrag({ customer_refunded_amount: 50 }) }, 409);
keinAufruf("20b: offener Dispute — 409", { contract: vertrag({ dispute_state: "open" }) }, 409);
keinAufruf("20c: Vertrag nicht aktiv — 400", { contract: vertrag({ status: "pending" }) }, 400);
keinAufruf("20d: Zahlung nicht erfasst — 400", { contract: vertrag({ escrow_captured_at: null }) }, 400);
keinAufruf("20e: bereits ausgezahlt — 400", { contract: vertrag({ escrow_released_at: "2026-08-02T09:00:00Z" }) }, 400);
keinAufruf("20f: Anbieter ohne Konto — 400", { providerProfile: null }, 400);
keinAufruf("20g: stripe_account_id leerer String — 400", { providerProfile: { stripe_account_id: "" } }, 400);

// Der 401-Fall braucht eine Anfrage OHNE Header, deshalb nicht ueber den
// keinAufruf-Helfer (der sendet immer mit Header).
Deno.test("20h: ohne Authorization-Header — 401, kein Stripe-Aufruf", async () => {
  const { stripe, deps } = setup();
  const r = await handleReleaseEscrow(anfrage({ contract_id: VERTRAG }, false), deps);
  assertEquals(r.status, 401);
  assertEquals(stripe.calls.length, 0);
});

Deno.test("21: unbekanntes Feld im Body — 400, kein Stripe-Aufruf", async () => {
  const { stripe, deps } = setup();
  const r = await handleReleaseEscrow(anfrage({ contract_id: VERTRAG, amount: 999999 }), deps);
  assertEquals(r.status, 400);
  assertEquals(stripe.calls.length, 0);
});

Deno.test("22: Rate-Limit greift — 429, kein Stripe-Aufruf", async () => {
  const { db, stripe, deps } = setup();
  db.rpcResponses["check_rate_limit"] = { data: false, error: null };
  assertEquals((await handleReleaseEscrow(anfrage(), deps)).status, 429);
  assertEquals(stripe.calls.length, 0);
});

// ── Beanspruchung selbst gesperrt ──────────────────────────────────────────
// 23/24: Die Zahlungspruefung liegt VOR dem Beanspruchen, deshalb gibt es hier
// jetzt genau EINEN Stripe-Aufruf — das lesende paymentIntents.retrieve. Was
// diese beiden Tests absichern, ist unveraendert: es entsteht KEIN Transfer.
Deno.test("23: Operation bereits auf manual_review — 409, kein Transfer", async () => {
  const { stripe, deps } = setup({ claim: { data: operation({ status: "manual_review", last_error: "x" }), error: null } });
  assertEquals((await handleReleaseEscrow(anfrage(), deps)).status, 409);
  assertEquals(stripe.calls.map((c) => c.method), ["paymentIntents.retrieve"],
    "nur die lesende Zahlungspruefung, kein schreibender Aufruf");
});

Deno.test("24: payout_claim scheitert — 409, kein Transfer", async () => {
  const { stripe, deps } = setup({ claim: { data: null, error: { message: "already_released" } } });
  assertEquals((await handleReleaseEscrow(anfrage(), deps)).status, 409);
  assertEquals(stripe.calls.map((c) => c.method), ["paymentIntents.retrieve"],
    "nur die lesende Zahlungspruefung, kein schreibender Aufruf");
});

Deno.test("25: Finalisierung meldet manual_review — 409", async () => {
  const { deps } = setup({ finalize: { data: operation({ status: "manual_review", last_error: "abweichende Transfer-ID" }), error: null } });
  assertEquals((await handleReleaseEscrow(anfrage(), deps)).status, 409);
});

// ══════════════════════════════════════════════════════════════════════════
// Nachtrag aus den drei Reviews zu PR #162.
// ══════════════════════════════════════════════════════════════════════════

// ── Architektur-Review P0: stornierter Transfer gilt nicht als passend ─────
// Ein rueckabgewickelter Transfer hat identischen Betrag, identische Waehrung
// und identisches Ziel. Ohne die Reversal-Pruefung waere er "passend", der
// Vertrag wuerde als bezahlt abgeschlossen -- und der Anbieter haette nichts.
Deno.test("26 [P0]: stornierter Transfer (reversed) gilt NICHT als passend", async () => {
  const { db, stripe, deps } = setup({ vorhandeneTransfers: [transfer({ reversed: true })] });
  const r = await handleReleaseEscrow(anfrage(), deps);
  assertEquals(r.status, 409, "unklare Lage -> Sperre, kein stillschweigender Abschluss");
  assertFalse(stripe.called("transfers.create"));
  assertEquals(asAny(db.callsOn("payout_operations", "update")[0].payload).status, "manual_review");
  assertEquals(db.rpcCalls.filter((c) => c.fn === "payout_finalize").length, 0);
});

Deno.test("26b [P0]: teilweise rueckabgewickelter Transfer gilt NICHT als passend", async () => {
  const { stripe, deps } = setup({ vorhandeneTransfers: [transfer({ amount_reversed: 2000 })] });
  assertEquals((await handleReleaseEscrow(anfrage(), deps)).status, 409);
  assertFalse(stripe.called("transfers.create"));
});

// ── Architektur-Review P2: Abgleich blaettert nicht ────────────────────────
Deno.test("27: mehr Transfers als eine Seite fasst — fail-closed statt blaettern", async () => {
  const db = new FakeSupabase({
    "contracts.select":         [{ data: vertrag() }],
    "provider_profiles.select": [{ data: { stripe_account_id: "acct_1" } }],
    "payout_operations.update": [{ data: null, error: null }],
  });
  db.authUser = { id: KUNDE };
  db.rpcResponses["payout_claim"] = { data: operation(), error: null };
  // Die Zahlungspruefung muss durchlaufen, damit dieser Test den Fall trifft,
  // den er meint: das Blaettern im Transfer-Abgleich, nicht die Zahlung.
  const stripe = new FakeStripe({
    "paymentIntents.retrieve": [intent()],
    "transfers.list": [{ data: [], has_more: true }],
  });
  const push = makeFakePush();
  const r = await handleReleaseEscrow(anfrage(), {
    supabase: asAny(db), stripe: asAny(stripe), sendPush: push.fn, stripeSecretKey: "sk_test_x",
  });
  assertEquals(r.status, 409, "ein Transfer koennte auf einer Folgeseite liegen");
  assertFalse(stripe.called("transfers.create"), "KEIN Transfer bei unvollstaendigem Abgleich");
  assertEquals(asAny(db.callsOn("payout_operations", "update")[0].payload).status, "manual_review");
});

// ── Architektur-Review P1: Sperre muss gespeichert werden ──────────────────
// Schlaegt genau dieser Schreibvorgang fehl, bliebe die Operation offen und es
// entstuende NIE ein Datensatz, den der Support finden koennte.
Deno.test("28: Sperr-Vermerk scheitert — 500 statt stillem 409", async () => {
  const { stripe, deps } = setup({
    vorhandeneTransfers: [transfer({ amount: 5000 })],
    opUpdate: { data: null, error: { message: "boom" } },
  });
  const r = await handleReleaseEscrow(anfrage(), deps);
  assertEquals(r.status, 500, "der fehlgeschlagene Vermerk darf nicht als erledigt gelten");
  assertFalse(stripe.called("transfers.create"));
});

// ── Security-Review P1: Sperre darf nicht zurueckgedreht werden ────────────
Deno.test("29: transferred-Update traegt die Bedingung gegen manual_review", async () => {
  const { db, deps } = setup();
  await handleReleaseEscrow(anfrage(), deps);
  const upd = db.callsOn("payout_operations", "update")[0];
  assertEquals(asAny(upd.payload).status, "transferred");
  assert(
    upd.filters.some((f) => f.fn === "neq" && f.args[0] === "status" && f.args[1] === "manual_review"),
    "ohne diese Bedingung koennte eine gleichzeitige Anfrage die Sperre zurueckdrehen",
  );
});

// ── Architektur-Review: verlorene Rueckbuchung muss sperren ────────────────
// Ein verlorener Dispute heisst: die Bank des Kunden hat den Betrag bereits vom
// Plattform-Saldo eingezogen. Es entsteht dabei KEIN Refund-Objekt, also bleibt
// `customer_refunded_amount` bei 0 und der bestehende Guard greift nicht.
// Wird dann noch ausgezahlt, zahlt Werkant denselben Betrag zweimal.
Deno.test("33 [P0]: verlorene Rueckbuchung — keine Auszahlung", async () => {
  const { db, stripe, deps } = setup({ contract: vertrag({ dispute_state: "lost" }) });
  const r = await handleReleaseEscrow(anfrage(), deps);
  assertEquals(r.status, 409);
  assertFalse(stripe.called("transfers.create"),
    "SOLL: das Geld ist per Chargeback bereits weg — eine Auszahlung waere der zweite Verlust");
  assertEquals(db.rpcCalls.filter((c) => c.fn.startsWith("payout")).length, 0);
});

Deno.test("33b: gewonnene Rueckbuchung blockiert NICHT", async () => {
  const { stripe, deps } = setup({ contract: vertrag({ dispute_state: "won" }) });
  assertEquals((await handleReleaseEscrow(anfrage(), deps)).status, 200);
  assert(stripe.called("transfers.create"), "gewonnen heisst: das Geld bleibt bei Werkant");
});

Deno.test("33c: folgenlos geschlossene Rueckbuchung blockiert NICHT", async () => {
  const { deps } = setup({ contract: vertrag({ dispute_state: "closed_other" }) });
  assertEquals((await handleReleaseEscrow(anfrage(), deps)).status, 200);
});

// ── Auszahlung nur gegen eine bei Stripe belegte Zahlung ───────────────────
// Bis hierher vertraute die Freigabe der eigenen Zeile: `status='active'`,
// `escrow_captured_at` gesetzt, `provider_payout` — fertig, Transfer raus.
// Wer eine Vertragszeile faelschen konnte, bekam damit echtes Geld vom
// Plattform-Saldo, ohne je bezahlt zu haben (der P0 aus 0680/0690). Die
// Zeile ist jetzt zwar gegen direktes Anlegen gesperrt, aber eine Auszahlung,
// die nicht nachfragt, ob das Geld wirklich da ist, bleibt die eigentliche
// Luecke. Diese Tests halten das Nachfragen fest.

Deno.test("42: erfundener PaymentIntent — kein Transfer", async () => {
  // Stripe kennt die ID nicht. Genau so sieht ein gefaelschter Vertrag aus.
  const { stripe, deps } = setup({ stripeFailing: ["paymentIntents.retrieve"] });
  const r = await handleReleaseEscrow(anfrage(), deps);
  assertEquals(r.status, 409);
  assertFalse(stripe.calls.some((c) => c.method === "transfers.create"),
    "ohne belegte Zahlung darf kein Transfer entstehen");
});

Deno.test("43: PaymentIntent nicht succeeded — kein Transfer", async () => {
  const { stripe, deps } = setup({ intent: intent({ status: "requires_payment_method", amount_received: 0 }) });
  const r = await handleReleaseEscrow(anfrage(), deps);
  assertEquals(r.status, 409);
  assertFalse(stripe.calls.some((c) => c.method === "transfers.create"));
});

Deno.test("44: eingegangener Betrag deckt den Vertragswert nicht — kein Transfer", async () => {
  // Teilzahlung: 50 EUR statt 100. Der Anbieter bekaeme sonst 92 EUR aus
  // einem Topf, in den nur 50 geflossen sind.
  const { stripe, deps } = setup({ intent: intent({ amount_received: 5000 }) });
  const r = await handleReleaseEscrow(anfrage(), deps);
  assertEquals(r.status, 409);
  assertFalse(stripe.calls.some((c) => c.method === "transfers.create"));
});

Deno.test("45: PaymentIntent gehoert zu einem anderen Vertrag — kein Transfer", async () => {
  // Die ID einer echten, bezahlten Zahlung aus einem anderen Auftrag
  // eintragen waere sonst der bequemste Weg, die Pruefung auszuhebeln.
  const { stripe, deps } = setup({ intent: intent({ metadata: { contract_id: FREMD } }) });
  const r = await handleReleaseEscrow(anfrage(), deps);
  assertEquals(r.status, 409);
  assertFalse(stripe.calls.some((c) => c.method === "transfers.create"));
});

Deno.test("46: keine PaymentIntent-ID am Vertrag — kein Transfer", async () => {
  const { stripe, deps } = setup({ contract: vertrag({ stripe_payment_intent: null }) });
  const r = await handleReleaseEscrow(anfrage(), deps);
  assertEquals(r.status, 409);
  assertFalse(stripe.calls.some((c) => c.method === "transfers.create"));
});

Deno.test("47: Pruefung laeuft VOR dem Beanspruchen und vor jedem Transfer", async () => {
  const { db, stripe, deps } = setup();
  const r = await handleReleaseEscrow(anfrage(), deps);
  assertEquals(r.status, 200);
  assertEquals(stripe.calls[0].method, "paymentIntents.retrieve",
    "die Zahlung wird abgefragt, bevor irgendetwas anderes bei Stripe passiert");
  assertEquals(asAny(stripe.callsTo("paymentIntents.retrieve")[0].args[0]), "pi_1");
  // Eine gescheiterte Pruefung darf keine Auszahlungs-Operation hinterlassen.
  const { deps: d2, db: db2 } = setup({ intent: intent({ status: "canceled", amount_received: 0 }) });
  await handleReleaseEscrow(anfrage(), d2);
  assertFalse(db2.rpcCalls.some((c) => c.fn === "payout_claim"),
    "ohne belegte Zahlung wird gar nicht erst beansprucht");
  assert(db.rpcCalls.some((c) => c.fn === "payout_claim"), "im guten Fall aber schon");
});

Deno.test("48: Status wird unabhaengig vom Betrag geprueft", async () => {
  // Aufgedeckt durch eine Mutationsprobe: nimmt man die Status-Pruefung heraus,
  // blieb die Suite gruen, weil Test 43 schon am Betrag scheitert. Der Schutz
  // war also nicht belegt.
  //
  // Hier ein Intent, bei dem der volle Betrag als eingegangen gemeldet wird,
  // der Status aber nicht 'succeeded' ist. Ob Stripe diese Kombination real
  // erzeugt, ist NICHT verifiziert -- die Status-Pruefung ist an dieser Stelle
  // bewusst Guertel-und-Hosentraeger. Der Test haelt sie fest, damit sie nicht
  // unbemerkt verschwindet.
  const { stripe, deps } = setup({ intent: intent({ status: "processing", amount_received: 10000 }) });
  const r = await handleReleaseEscrow(anfrage(), deps);
  assertEquals(r.status, 409, "nur 'succeeded' zaehlt als abgeschlossene Zahlung");
  assertFalse(stripe.called("transfers.create"));
});
