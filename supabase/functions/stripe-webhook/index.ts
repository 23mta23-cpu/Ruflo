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
// Deno's Web Crypto only exposes the async subtle API, so the sync
// constructEvent() throws on Supabase Edge Runtime. Must use the async variant.
const cryptoProvider = Stripe.createSubtleCryptoProvider();

async function sendPush(tokens: string[], title: string, body: string, data: Record<string, string> = {}) {
  if (!tokens.length) return;
  const messages = tokens.map((to) => ({ to, title, body, data, sound: "default" }));
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(messages),
  }).catch((e) => console.warn("Push delivery error:", e));
}

async function getPushToken(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from("profiles")
    .select("push_token")
    .eq("id", userId)
    .single<{ push_token: string | null }>();
  return data?.push_token ? [data.push_token] : [];
}

serve(async (req: Request) => {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
  const body = await req.text();

  // Verify webhook signature before processing anything.
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature ?? "",
      webhookSecret,
      undefined,
      cryptoProvider,
    );
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
        // Transition contract pending → active on successful escrow capture.
        // Without this, release-escrow and cancel-contract (both require status='active')
        // can never run — money would be captured but never releasable or refundable.
        const { data: contract, error } = await supabase
          .from("contracts")
          .update({ escrow_captured_at: new Date().toISOString(), status: "active" })
          .eq("id", contractId)
          .select("provider_id, customer_id, jobs(title)")
          .single<{ provider_id: string; customer_id: string; jobs: { title: string } | null }>();
        if (error) throw error;
        console.log(`Escrow captured for contract: contract_id=${contractId} pi=${pi.id}`);
        // Notify provider that payment is secured and work can begin
        if (contract?.provider_id) {
          const tokens = await getPushToken(contract.provider_id);
          const jobTitle = contract.jobs?.title ?? "Auftrag";
          await sendPush(tokens, "Zahlung gesichert", `Escrow für „${jobTitle}" hinterlegt — Arbeit kann beginnen.`, { screen: "/(provider)/auftraege" });
        }
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

      // ── customer.subscription.* ──────────────────────────────────────────
      // Keeps pro_subscriptions in sync with Stripe Billing.
      // stripe_sub_id is ONLY written here (ADR-0004).
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        // Resolve provider_id via stripe_customer_id stored in profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", sub.customer as string)
          .maybeSingle<{ id: string }>();
        if (!profile?.id) {
          console.warn(`subscription event: no profile for customer ${sub.customer}`);
          break;
        }
        const periodEnd = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null;
        const stripeStatus = sub.status; // trialing | active | past_due | canceled | etc.
        const mappedStatus =
          stripeStatus === "trialing"              ? "trialing"          :
          stripeStatus === "active"                ? "active"            :
          stripeStatus === "canceled"              ? "cancelled"         :
          sub.cancel_at_period_end                 ? "cancel_scheduled"  : "active";

        await supabase
          .from("pro_subscriptions")
          .upsert({
            provider_id:  profile.id,
            stripe_sub_id: sub.id,
            status:        mappedStatus,
            period_start:  sub.current_period_start
              ? new Date(sub.current_period_start * 1000).toISOString()
              : null,
            period_end:    periodEnd,
            trial_used:    sub.status === "trialing" || (sub as any).trial_end !== null,
            updated_at:    new Date().toISOString(),
          }, { onConflict: "provider_id" });

        // Mirror is_pro on provider_profiles for fast reads
        await supabase
          .from("provider_profiles")
          .update({
            is_pro:         mappedStatus === "active" || mappedStatus === "trialing",
            pro_expires_at: periodEnd,
          })
          .eq("id", profile.id);

        console.log(`Pro subscription ${event.type}: provider=${profile.id} status=${mappedStatus}`);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", sub.customer as string)
          .maybeSingle<{ id: string }>();
        if (!profile?.id) break;

        await supabase
          .from("pro_subscriptions")
          .update({ status: "cancelled", stripe_sub_id: sub.id, updated_at: new Date().toISOString() })
          .eq("provider_id", profile.id);

        await supabase
          .from("provider_profiles")
          .update({ is_pro: false, pro_expires_at: null })
          .eq("id", profile.id);

        console.log(`Pro subscription cancelled: provider=${profile.id}`);
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
