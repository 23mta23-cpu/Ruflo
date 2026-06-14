import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Service role client bypasses RLS and the guard trigger that blocks
// client-side writes to stripe_onboarded (ADR-0004 C-1 / migration 005).
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req: Request) => {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
  const body = await req.text();

  // Verify webhook signature before processing anything.
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature ?? "", webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      // ── account.updated ──────────────────────────────────────────────────
      // The only permitted write path for stripe_onboarded (ADR-0004 C-1).
      // Both charges_enabled AND payouts_enabled must be true before we
      // consider a Connect account fully operational.
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        if (account.charges_enabled && account.payouts_enabled) {
          const { error } = await supabase
            .from("provider_profiles")
            .update({ stripe_onboarded: true })
            .eq("stripe_account_id", account.id);
          if (error) throw error;
          console.log(`Provider onboarded: stripe_account_id=${account.id}`);
        } else {
          // Log partial state changes for observability without mutating the row.
          console.log(
            `account.updated received but not fully enabled: ` +
              `stripe_account_id=${account.id} ` +
              `charges_enabled=${account.charges_enabled} ` +
              `payouts_enabled=${account.payouts_enabled}`,
          );
        }
        break;
      }

      // ── payment_intent.succeeded ─────────────────────────────────────────
      // Records escrow capture time on the matching contract row.
      // contract_id is stored in the PaymentIntent metadata at creation time.
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const contractId = pi.metadata?.contract_id;
        if (!contractId) {
          console.warn(
            `payment_intent.succeeded missing contract_id metadata: pi=${pi.id}`,
          );
          break;
        }
        const { error } = await supabase
          .from("contracts")
          .update({ escrow_captured_at: new Date().toISOString() })
          .eq("id", contractId);
        if (error) throw error;
        console.log(`Escrow captured for contract: contract_id=${contractId} pi=${pi.id}`);
        break;
      }

      // ── payment_intent.payment_failed ────────────────────────────────────
      // No database mutation needed yet — log the failure for ops visibility.
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const contractId = pi.metadata?.contract_id ?? "unknown";
        console.warn(
          `Payment failed: pi=${pi.id} contract_id=${contractId} ` +
            `reason="${pi.last_payment_error?.message ?? "n/a"}"`,
        );
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Handler error:", err);
    return new Response("Internal error", { status: 500 });
  }
});
