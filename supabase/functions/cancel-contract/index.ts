import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing authorization" }, 401);

  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  // ── Input ─────────────────────────────────────────────────────────────────
  let contract_id: string, reason: string;
  try {
    const body = await req.json();
    contract_id = body.contract_id;
    reason = body.reason ?? "Keine Angabe";
    if (!contract_id) throw new Error("contract_id required");
  } catch (e: unknown) {
    return json({ error: (e as Error).message }, 400);
  }

  // ── Load contract ─────────────────────────────────────────────────────────
  const { data: contract, error: fetchErr } = await supabase
    .from("contracts")
    .select("id, customer_id, status, stripe_payment_intent, escrow_captured_at, appointment_at, customer_total")
    .eq("id", contract_id)
    .single();

  if (fetchErr || !contract) return json({ error: "Vertrag nicht gefunden" }, 404);
  if (contract.customer_id !== user.id) return json({ error: "Nicht autorisiert" }, 403);
  if (contract.status !== "active") {
    return json({ error: `Stornierung nicht möglich (Status: ${contract.status})` }, 409);
  }

  // ── Refund tier calculation ────────────────────────────────────────────────
  // >48h → 100%, 24–48h → 50%, <24h → 0%
  const appointmentAt = contract.appointment_at ? new Date(contract.appointment_at) : null;
  const hoursUntil = appointmentAt
    ? (appointmentAt.getTime() - Date.now()) / 3_600_000
    : 72; // default to full refund if no appointment set
  const refundPct = hoursUntil > 48 ? 1.0 : hoursUntil > 24 ? 0.5 : 0;

  // ── Stripe refund (if escrow was captured) ────────────────────────────────
  let refundAmount = 0;
  if (contract.escrow_captured_at && contract.stripe_payment_intent && refundPct > 0) {
    refundAmount = Math.round(contract.customer_total * refundPct * 100); // in cents
    await stripe.refunds.create({
      payment_intent: contract.stripe_payment_intent,
      amount: refundAmount,
      reason: "requested_by_customer",
    });
  }

  // ── Update contract ───────────────────────────────────────────────────────
  const { error: updateErr } = await supabase
    .from("contracts")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason,
    })
    .eq("id", contract_id);

  if (updateErr) return json({ error: "Datenbankfehler beim Stornieren" }, 500);

  // ── Update job back to open so provider can re-accept ─────────────────────
  await supabase
    .from("jobs")
    .update({ status: "open" })
    .eq("id", contract.job_id ?? "");

  return json({
    cancelled: true,
    refund_pct: refundPct * 100,
    refund_amount_eur: (refundAmount / 100).toFixed(2),
  });
});
