// deploy-touch 2026-07-13: GitHub-Integration deployt nur geänderte Functions — dieser Kommentar stößt den Erst-Deploy aller Functions an.
//
// Diese Datei enthaelt BEWUSST keine Eventverarbeitung mehr. Sie erzeugt die
// realen Abhaengigkeiten, liest den Request, prueft die Signatur und delegiert
// an `handleStripeEvent` in handler.ts — dieselbe Funktion, die der Testharness
// unter supabase/tests/ aufruft. Wer hier wieder ein `case` einfuegt, hat die
// Logik aus dem Testbereich herausgeloest.
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { constructStripeEvent, handleStripeEvent } from "./handler.ts";

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

serve(async (req: Request) => {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
  const body = await req.text();

  // Verify webhook signature before processing anything.
  const event = await constructStripeEvent(
    stripe,
    cryptoProvider,
    body,
    signature,
    webhookSecret,
  );
  if (!event) {
    return new Response("Invalid signature", { status: 400 });
  }

  return await handleStripeEvent(event, { supabase, stripe, sendPush });
});
