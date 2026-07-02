import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enforceRateLimit, getClientIp } from "../_shared/rateLimit.ts";
import { assertOnlyFields, assertUuid, parseJsonObject, validationErrorResponse } from "../_shared/validate.ts";
import { assertZagSignoffForLiveMode } from "../_shared/zagGate.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const zagBlocked = assertZagSignoffForLiveMode(STRIPE_SECRET_KEY);
  if (zagBlocked) return zagBlocked;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const jwt = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const rateLimited = await enforceRateLimit(
    supabase,
    `user:${user.id}:create-payment-intent`,
    { limit: 10, windowSeconds: 60 },
    CORS,
  ) ?? await enforceRateLimit(
    supabase,
    `ip:${getClientIp(req)}:create-payment-intent`,
    { limit: 30, windowSeconds: 60 },
    CORS,
  );
  if (rateLimited) return rateLimited;

  let contract_id: string;
  try {
    const body = await parseJsonObject(req);
    assertOnlyFields(body, ["contract_id"]);
    contract_id = assertUuid(body.contract_id, "contract_id");
  } catch (err) {
    return validationErrorResponse(err, CORS);
  }

  const { data: contract, error: contractError } = await supabase
    .from("contracts")
    .select("id, customer_id, status, escrow_captured_at, customer_total, stripe_payment_intent")
    .eq("id", contract_id)
    .single();

  if (contractError || !contract) {
    return new Response(JSON.stringify({ error: "Contract not found" }), {
      status: 404,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (contract.customer_id !== user.id) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (contract.status !== "pending") {
    return new Response(JSON.stringify({ error: "Contract is not in pending status" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (contract.escrow_captured_at !== null) {
    return new Response(JSON.stringify({ error: "Escrow already captured" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Idempotency: reuse an existing PaymentIntent if one was already created
  // for this contract and is still in a usable state (requires_payment_method
  // or requires_confirmation). This prevents duplicate charges when the user
  // navigates back to the payment screen or taps the button twice.
  const existingIntentId = (contract as any).stripe_payment_intent as string | null;
  let pi: Stripe.PaymentIntent;
  if (existingIntentId) {
    try {
      const existing = await stripe.paymentIntents.retrieve(existingIntentId);
      if (existing.status === "requires_payment_method" || existing.status === "requires_confirmation") {
        return new Response(JSON.stringify({ client_secret: existing.client_secret }), {
          status: 200,
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
      // Intent in a terminal or incompatible state — fall through to create a new one
    } catch (retrieveErr) {
      console.warn("Could not retrieve existing PaymentIntent:", retrieveErr);
    }
  }

  try {
    pi = await stripe.paymentIntents.create(
      {
        amount: Math.round(contract.customer_total * 100),
        currency: "eur",
        metadata: { contract_id },
        transfer_group: contract_id,
      },
      { idempotencyKey: `create-payment-intent-${contract_id}` },
    );
  } catch (err) {
    console.error("Stripe paymentIntents.create failed:", err);
    return new Response(JSON.stringify({ error: "Payment provider error" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const { error: updateError } = await supabase
    .from("contracts")
    .update({ stripe_payment_intent: pi.id })
    .eq("id", contract_id);

  if (updateError) {
    console.error("Failed to persist stripe_payment_intent:", updateError);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ client_secret: pi.client_secret }), {
    status: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
