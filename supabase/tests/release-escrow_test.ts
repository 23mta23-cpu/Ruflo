// Ausfuehrbare Tests der Escrow-Freigabe.
//
// Getestet wird AUSSCHLIESSLICH die eigene Logik in
// supabase/functions/release-escrow/handler.ts — dieselbe Funktion, die
// index.ts in Produktion aufruft. KEINE zweite Version der Logik im Test.
//
// KEIN echter Stripe-Aufruf. Alle Annahmen ueber Stripe stecken in den Doubles
// und sind als Annahmen gekennzeichnet.
import { assertEquals, assert, assertFalse } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { handleReleaseEscrow } from "../functions/release-escrow/handler.ts";
import { FakeSupabase } from "../functions/_shared/testing/fakeSupabase.ts";
import { FakeStripe, makeFakePush } from "../functions/_shared/testing/fakeStripe.ts";

// deno-lint-ignore no-explicit-any
const asAny = (x: unknown) => x as any;

const KUNDE = "11111111-1111-1111-1111-111111111111";
const ANBIETER = "22222222-2222-2222-2222-222222222222";
const VERTRAG = "33333333-3333-3333-3333-333333333333";

/** Ein freigabefaehiger Vertrag; einzelne Felder pro Szenario ueberschreibbar. */
const vertrag = (u: Record<string, unknown> = {}) => ({
  id: VERTRAG, job_id: "44444444-4444-4444-4444-444444444444",
  customer_id: KUNDE, provider_id: ANBIETER,
  status: "active", escrow_captured_at: "2026-08-01T10:00:00Z",
  escrow_released_at: null, provider_payout: 92,
  customer_refunded_amount: 0, dispute_state: null, ...u,
});

function setup(opts: {
  user?: string | null;
  contract?: Record<string, unknown> | null;
  providerProfile?: Record<string, unknown> | null;
  contractUpdate?: { data?: unknown; error?: unknown };
  stripeFailing?: string[];
} = {}) {
  const db = new FakeSupabase({
    "contracts.select":          [{ data: opts.contract === undefined ? vertrag() : opts.contract }],
    "provider_profiles.select":  [{ data: opts.providerProfile === undefined ? { stripe_account_id: "acct_1" } : opts.providerProfile }],
    "contracts.update":          [opts.contractUpdate ?? { data: { id: VERTRAG }, error: null }],
    "jobs.update":               [{ data: null, error: null }],
    "profiles.select":           [{ data: { push_token: "tok" } }, { data: { push_token: "tok2" } }],
    "jobs.select":               [{ data: { title: "Bad sanieren" } }],
  });
  db.authUser = opts.user === undefined ? { id: KUNDE } : (opts.user ? { id: opts.user } : null);
  const stripe = new FakeStripe(
    { "transfers.create": [{ id: "tr_1" }, { id: "tr_2" }] },
    opts.stripeFailing ?? [],
  );
  const push = makeFakePush();
  return { db, stripe, push, deps: { supabase: asAny(db), stripe: asAny(stripe), sendPush: push.fn, stripeSecretKey: "sk_test_x" } };
}

const anfrage = () => new Request("https://x/release-escrow", {
  method: "POST",
  headers: { Authorization: "Bearer jwt", "Content-Type": "application/json" },
  body: JSON.stringify({ contract_id: VERTRAG }),
});

// ── 1. Normaler Transfer ───────────────────────────────────────────────────
Deno.test("1: normaler Transfer — Betrag in Cent, Vertrag abgeschlossen, PStTG gezaehlt", async () => {
  const { db, stripe, push, deps } = setup();
  const r = await handleReleaseEscrow(anfrage(), deps);
  assertEquals(r.status, 200);
  assertEquals((await r.json()).transfer_id, "tr_1");

  const t = stripe.callsTo("transfers.create")[0];
  assertEquals(asAny(t.args[0]).amount, 9200, "92,00 EUR als ganze Cent");
  assertEquals(asAny(t.args[0]).currency, "eur");
  assertEquals(asAny(t.args[0]).destination, "acct_1");
  assertEquals(asAny(t.args[1]).idempotencyKey, `release-escrow-${VERTRAG}`);

  const upd = asAny(db.callsOn("contracts", "update")[0].payload);
  assertEquals(upd.status, "completed");
  assert(upd.escrow_released_at, "Freigabezeitpunkt gesetzt");
  assertEquals(db.rpcCalls.filter((c) => c.fn === "pstg_record_transaction").length, 1,
    "PStTG-Zaehler genau einmal");
  assertEquals(push.sent.length, 2, "Anbieter und Kunde benachrichtigt");
});

// ── 2.–6. Guards: keine Geldbewegung ───────────────────────────────────────
const keinTransfer = async (name: string, opts: Parameters<typeof setup>[0], status: number) => {
  Deno.test(name, async () => {
    const { db, stripe, deps } = setup(opts);
    const r = await handleReleaseEscrow(anfrage(), deps);
    assertEquals(r.status, status);
    assertFalse(stripe.called("transfers.create"), "KEIN Transfer");
    assertEquals(db.callsOn("contracts", "update").length, 0, "KEINE Vertragsaenderung");
    assertEquals(db.rpcCalls.filter((c) => c.fn === "pstg_record_transaction").length, 0,
      "KEINE PStTG-Zaehlung");
  });
};

await keinTransfer("2: Vertrag nicht aktiv (pending) — 400, keine Geldbewegung",
  { contract: vertrag({ status: "pending" }) }, 400);
await keinTransfer("3: Zahlung nicht erfasst — 400, keine Geldbewegung",
  { contract: vertrag({ escrow_captured_at: null }) }, 400);
await keinTransfer("4: bereits ausgezahlt — 400, keine zweite Auszahlung",
  { contract: vertrag({ escrow_released_at: "2026-08-02T09:00:00Z" }) }, 400);
await keinTransfer("5: Kundenerstattung vorhanden — 409, kein Geld an den Anbieter",
  { contract: vertrag({ customer_refunded_amount: 50 }) }, 409);
await keinTransfer("6: Anbieter ohne Stripe-Konto — 400, keine Geldbewegung",
  { providerProfile: null }, 400);
await keinTransfer("6b: fremder Nutzer — 403, keine Geldbewegung",
  { user: "99999999-9999-9999-9999-999999999999" }, 403);
await keinTransfer("6c: laufende Rueckbuchung — 409, Auszahlung ausgesetzt",
  { contract: vertrag({ dispute_state: "open" }) }, 409);

// ── 7. Transfer erfolgreich, DB-Update schlaegt fehl ───────────────────────
// Der gefaehrlichste Zwischenzustand: Geld ist beim Anbieter, die Datenbank
// weiss nichts davon. escrow_released_at bleibt leer.
Deno.test("7: Transfer OK, DB-Update scheitert — 500, Geld ist aber schon weg", async () => {
  const { db, stripe, deps } = setup({ contractUpdate: { data: null, error: { message: "boom" } } });
  const r = await handleReleaseEscrow(anfrage(), deps);
  assertEquals(r.status, 500);
  assert(stripe.called("transfers.create"), "der Transfer ist bereits gelaufen");
  assertEquals(db.rpcCalls.filter((c) => c.fn === "pstg_record_transaction").length, 0,
    "PStTG wird nach dem Fehlschlag nicht mehr gezaehlt");
  // Dokumentiert den Ist-Zustand: es gibt KEINE Rueckabwicklung des Transfers.
  assertFalse(stripe.called("transfers.createReversal"), "keine Rueckabwicklung im Code");
});

// ── 8. Derselbe Versuch zweimal ────────────────────────────────────────────
Deno.test("8: zweiter Versuch nach erfolgreicher Freigabe — 400, kein zweiter Transfer", async () => {
  const a = setup();
  assertEquals((await handleReleaseEscrow(anfrage(), a.deps)).status, 200);
  // Zweiter Aufruf trifft auf den bereits freigegebenen Vertrag.
  const b = setup({ contract: vertrag({ escrow_released_at: "2026-08-02T09:00:00Z", status: "completed" }) });
  const r2 = await handleReleaseEscrow(anfrage(), b.deps);
  assertEquals(r2.status, 400);
  assertFalse(b.stripe.called("transfers.create"));
});

// ── 9. Zwei parallele Versuche ─────────────────────────────────────────────
// Beide passieren die Guards, weil der Zustand zwischen Lesen und Schreiben
// nicht gesperrt wird (Read-then-Act, kein Compare-and-Swap).
//
// GRENZE: Der Double fuehrt KEINE echte Nebenlaeufigkeit aus. Der Test zeigt,
// dass beide Aufrufe DENSELBEN Idempotency-Key an Stripe senden — dass Stripe
// daraufhin nur einmal ueberweist, ist eine ANNAHME ueber Stripe (Kategorie 1),
// hier nicht bewiesen.
Deno.test("9 [Nebenlaeufigkeit]: zwei parallele Versuche senden denselben Idempotency-Key", async () => {
  const a = setup(); const b = setup();
  const [r1, r2] = await Promise.all([
    handleReleaseEscrow(anfrage(), a.deps),
    handleReleaseEscrow(anfrage(), b.deps),
  ]);
  assertEquals(r1.status, 200); assertEquals(r2.status, 200);
  const k1 = asAny(a.stripe.callsTo("transfers.create")[0].args[1]).idempotencyKey;
  const k2 = asAny(b.stripe.callsTo("transfers.create")[0].args[1]).idempotencyKey;
  assertEquals(k1, k2, "identischer Key — nur DARAUF stuetzt sich der Schutz");
  assertEquals(k1, `release-escrow-${VERTRAG}`);
  // Beide zaehlen PStTG hoch — der Zaehler ist NICHT durch den Key geschuetzt.
  const n = a.db.rpcCalls.filter((c) => c.fn === "pstg_record_transaction").length
          + b.db.rpcCalls.filter((c) => c.fn === "pstg_record_transaction").length;
  assertEquals(n, 2, "beide Aufrufe beanspruchen die Freigabe — der Double wertet " +
    "Filter nicht aus, die CAS-Wirkung selbst ist hier NICHT bewiesen (siehe 9b)");
});

// ── 9b. CAS-Bedingung und Verhalten bei verlorenem Rennen ──────────────────
// Was der Double belegen KANN: dass die Bedingung gebaut wird, und dass bei
// leerem Ergebnis nicht gezaehlt wird. Die reale Wirkung von
// `.is("escrow_released_at", null)` unter Nebenlaeufigkeit ist Sache der
// Datenbank, nicht dieses Tests.
Deno.test("9b: Freigabe wird per CAS beansprucht; verlorenes Rennen zaehlt NICHT", async () => {
  const gewinner = setup();
  await handleReleaseEscrow(anfrage(), gewinner.deps);
  const upd = gewinner.db.callsOn("contracts", "update")[0];
  assert(upd.filters.some((f) => f.fn === "eq" && f.args[0] === "id"));
  assert(upd.filters.some((f) => f.fn === "is" && f.args[0] === "escrow_released_at" && f.args[1] === null),
    "CAS-Bedingung auf escrow_released_at fehlt");

  // Verlierer: das CAS-Update trifft keine Zeile.
  const verlierer = setup({ contractUpdate: { data: null, error: null } });
  const r = await handleReleaseEscrow(anfrage(), verlierer.deps);
  assertEquals(r.status, 200, "kein Fehler — der Transfer war idempotent derselbe");
  assertEquals(
    verlierer.db.rpcCalls.filter((c) => c.fn === "pstg_record_transaction").length, 0,
    "SOLL: der PStTG-Jahreszaehler darf pro Auszahlung nur EINMAL steigen. " +
    "Zu hoch gezaehlt meldet den Anbieter dem BZSt mit einer Verguetung, die " +
    "er nie erhalten hat (§ 3 Abs. 5 PStTG).",
  );
  assertEquals(verlierer.push.sent.length, 0, "keine doppelte Benachrichtigung");
});

// ── 10. Erneuter Versuch nach mehr als 24 Stunden ──────────────────────────
// Stripe verwirft Idempotency-Keys nach 24 Stunden (ANNAHME, offizielle
// Semantik, hier nicht verifiziert). Der Handler sendet weiterhin denselben
// Key — der Schutz haengt also allein an Stripes Aufbewahrungsfrist.
Deno.test("10 [24h]: Wiederholung sendet unveraendert denselben Key", async () => {
  const { stripe, deps } = setup();
  await handleReleaseEscrow(anfrage(), deps);
  const spaeter = setup();
  await handleReleaseEscrow(anfrage(), spaeter.deps);
  assertEquals(
    asAny(stripe.callsTo("transfers.create")[0].args[1]).idempotencyKey,
    asAny(spaeter.stripe.callsTo("transfers.create")[0].args[1]).idempotencyKey,
    "kein zeitabhaengiger Zusatz im Key — nach Ablauf der Stripe-Frist waere " +
    "ein zweiter Transfer moeglich, wenn escrow_released_at leer geblieben ist",
  );
});

// ── 11. PStTG-Zaehler nur einmal pro erfolgreicher Freigabe ────────────────
Deno.test("11: PStTG-Zaehler steigt genau einmal und mit dem Auszahlungsbetrag", async () => {
  const { db, deps } = setup();
  await handleReleaseEscrow(anfrage(), deps);
  const pstg = db.rpcCalls.filter((c) => c.fn === "pstg_record_transaction");
  assertEquals(pstg.length, 1);
  assertEquals(asAny(pstg[0].args).p_provider_id, ANBIETER);
  assertEquals(asAny(pstg[0].args).p_payout, 92);
});

// ── 12. Connect-Konto nicht mehr auszahlungsfaehig ─────────────────────────
// Der Handler prueft NUR, ob stripe_account_id existiert — nicht, ob das Konto
// noch auszahlungsfaehig ist. Dieser Test haelt den Ist-Zustand fest.
Deno.test("12 [Ist-Zustand]: gesperrtes Connect-Konto wird nicht geprueft", async () => {
  const { stripe, deps } = setup({
    providerProfile: { stripe_account_id: "acct_gesperrt", stripe_onboarded: false },
  });
  const r = await handleReleaseEscrow(anfrage(), deps);
  assertEquals(r.status, 200, "Ist-Zustand: die Freigabe laeuft durch");
  assert(stripe.called("transfers.create"),
    "BEFUND: der Transfer wird versucht, obwohl stripe_onboarded=false. " +
    "Ob eine Auszahlung an ein gesperrtes Konto blockiert werden soll, " +
    "beruehrt das Auszahlungsverhalten — Founder-Entscheidung, siehe Bericht.");
});

// ── Stripe-Transfer scheitert ──────────────────────────────────────────────
Deno.test("13: Stripe-Transfer scheitert — 500, keine Vertragsaenderung", async () => {
  const { db, deps } = setup({ stripeFailing: ["transfers.create"] });
  const r = await handleReleaseEscrow(anfrage(), deps);
  assertEquals(r.status, 500);
  assertEquals(db.callsOn("contracts", "update").length, 0, "Vertrag bleibt unveraendert");
  assertEquals(db.rpcCalls.filter((c) => c.fn === "pstg_record_transaction").length, 0);
});

// ── Auth / Eingabevalidierung ──────────────────────────────────────────────
Deno.test("14: ohne Authorization-Header — 401, keine Geldbewegung", async () => {
  const { stripe, deps } = setup();
  const r = await handleReleaseEscrow(
    new Request("https://x/release-escrow", { method: "POST", body: JSON.stringify({ contract_id: VERTRAG }) }),
    deps,
  );
  assertEquals(r.status, 401);
  assertFalse(stripe.called("transfers.create"));
});

Deno.test("15: unbekanntes Feld im Body — 400, keine Geldbewegung", async () => {
  const { stripe, deps } = setup();
  const r = await handleReleaseEscrow(
    new Request("https://x/release-escrow", {
      method: "POST",
      headers: { Authorization: "Bearer jwt", "Content-Type": "application/json" },
      body: JSON.stringify({ contract_id: VERTRAG, amount: 999999 }),
    }),
    deps,
  );
  assertEquals(r.status, 400, "unerwartete Felder werden abgewiesen");
  assertFalse(stripe.called("transfers.create"));
});

Deno.test("16: Rate-Limit greift — 429, keine Geldbewegung", async () => {
  const { db, stripe, deps } = setup();
  db.rpcResponses["check_rate_limit"] = { data: false, error: null };
  const r = await handleReleaseEscrow(anfrage(), deps);
  assertEquals(r.status, 429);
  assertFalse(stripe.called("transfers.create"));
});

// ── Nachtrag QA-Review: Anbieterprofil ohne Konto-ID ───────────────────────
// Der reale Fall ist NICHT "kein Profil", sondern "Profil da, Onboarding nie
// abgeschlossen". Der Guard prueft `!providerProfile?.stripe_account_id` —
// ohne diese Faelle bliebe eine Verkuerzung auf `!providerProfile` unbemerkt.
Deno.test("17: Anbieterprofil vorhanden, stripe_account_id null — 400, keine Geldbewegung", async () => {
  const { db, stripe, deps } = setup({ providerProfile: { stripe_account_id: null } });
  const r = await handleReleaseEscrow(anfrage(), deps);
  assertEquals(r.status, 400);
  assertFalse(stripe.called("transfers.create"));
  assertEquals(db.callsOn("contracts", "update").length, 0);
});

Deno.test("18: stripe_account_id leerer String — 400, keine Geldbewegung", async () => {
  const { stripe, deps } = setup({ providerProfile: { stripe_account_id: "" } });
  assertEquals((await handleReleaseEscrow(anfrage(), deps)).status, 400);
  assertFalse(stripe.called("transfers.create"), "leerer String darf nicht als Konto durchgehen");
});

// ── Nachtrag QA-Review: Autorisierung VOR der Geschaeftslogik ──────────────
// Jeder bisherige Guard-Test setzte nur EIN abweichendes Feld. Damit blieb
// ungeprueft, ob ein Fremder den Vertragsstatus erfaehrt: liefe die
// Status-Pruefung zuerst, bekaeme er 400 statt 403 und wuesste, dass der
// Vertrag existiert und in welchem Zustand er ist.
Deno.test("19: Fremder bei nicht-aktivem Vertrag — 403, kein Status-Leak ueber 400", async () => {
  const { stripe, deps } = setup({
    user: "99999999-9999-9999-9999-999999999999",
    contract: vertrag({ status: "pending" }),
  });
  const r = await handleReleaseEscrow(anfrage(), deps);
  assertEquals(r.status, 403, "Autorisierung muss VOR der Geschaeftslogik greifen");
  assertEquals((await r.json()).error, "Forbidden", "kein Hinweis auf den Vertragszustand");
  assertFalse(stripe.called("transfers.create"));
});

Deno.test("20: Fremder bei bereits ausgezahltem Vertrag — 403, nicht 400", async () => {
  const { deps } = setup({
    user: "99999999-9999-9999-9999-999999999999",
    contract: vertrag({ escrow_released_at: "2026-08-02T09:00:00Z" }),
  });
  assertEquals((await handleReleaseEscrow(anfrage(), deps)).status, 403);
});
