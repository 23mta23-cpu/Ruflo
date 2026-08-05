// PaymentIntent-Erzeugung — ausführbar testbar.
//
// Diese Datei enthält die VOLLSTÄNDIGE Logik. `index.ts` erzeugt nur noch die
// realen Abhängigkeiten und delegiert hierher. Produktion und Tests importieren
// dieselbe `handleCreatePaymentIntent`-Funktion.
//
// Der Inhalt ist eine wortgleiche Übernahme aus index.ts (dort Z. 31–162 vor der
// Extraktion), mit EINER Änderung: der PaymentIntent wird jetzt über die RPC
// `register_payment_intent` (Migration 0660) festgehalten statt über ein
// direktes Update auf `contracts`. Grund im Kopf von 0660.
import type Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enforceRateLimit, getClientIp } from "../_shared/rateLimit.ts";
import { assertOnlyFields, assertUuid, parseJsonObject, validationErrorResponse } from "../_shared/validate.ts";
import { assertZagSignoffForLiveMode } from "../_shared/zagGate.ts";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

export type Deps = {
  supabase: SupabaseClient;
  stripe: Stripe;
  stripeSecretKey: string;
};

export async function handleCreatePaymentIntent(
  req: Request,
  deps: Deps,
): Promise<Response> {
  const { supabase, stripe } = deps;
  const STRIPE_SECRET_KEY = deps.stripeSecretKey;

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
      if (existing.status === "succeeded" || existing.status === "processing") {
        // Der Kunde hat bereits gezahlt (oder die Zahlung laeuft) —
        // `escrow_captured_at` ist nur deshalb noch leer, weil das
        // Webhook-Ereignis aussteht. Frueher fiel der Code hier durch und
        // erzeugte einen ZWEITEN Intent: der Kunde konnte ein zweites Mal
        // belastet werden, und der Spiegel zeigte danach auf einen unbezahlten
        // Intent, waehrend das Geld auf dem alten lag. Eine spaetere
        // Stornierung haette gegen den falschen Intent erstattet.
        // (Befund des Architektur-Reviews zu Migration 0660.)
        console.warn(`PaymentIntent bereits ${existing.status}, kein zweiter wird erzeugt: contract_id=${contract_id} pi=${existingIntentId}`);
        return new Response(
          JSON.stringify({ error: "Die Zahlung ist bereits eingegangen und wird gerade verbucht. Bitte einen Moment warten." }),
          { status: 409, headers: { ...CORS, "Content-Type": "application/json" } },
        );
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

  // Der Intent wird in der Historie festgehalten (Migration 0660) statt nur in
  // der Einzelspalte `contracts.stripe_payment_intent`. Die RPC setzt ihn als
  // aktuellen, stuft frühere zurück und pflegt den Spiegel — in EINER
  // Transaktion. Getrennte Schreibvorgänge wären genau die Teilfehler-Lücke,
  // die im Auszahlungspfad schon einmal Geld gekostet hat.
  //
  // WARUM ÜBERHAUPT: Ein zweiter Intent entsteht real — oben wird ein
  // bestehender nur wiederverwendet, solange er `requires_payment_method` oder
  // `requires_confirmation` ist. In jedem anderen Zustand entsteht hier ein
  // neuer, und der alte bleibt bei Stripe erstattungs- und rückbuchungsfähig.
  // Ohne Historie fände ein Ereignis zu diesem alten Intent später keinen
  // Vertrag mehr.
  const { error: updateError } = await supabase.rpc("register_payment_intent", {
    p_contract_id: contract_id,
    p_intent_id: pi.id,
    p_amount_cents: Math.round(contract.customer_total * 100),
  });

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
}
