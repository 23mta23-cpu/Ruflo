// deploy-touch 2026-07-13: GitHub-Integration deployt nur geänderte Functions — dieser Kommentar stößt den Erst-Deploy aller Functions an.
//
// Diese Datei enthält BEWUSST keine Auszahlungslogik mehr. Sie erzeugt die
// realen Abhängigkeiten und delegiert an `handleReleaseEscrow` in handler.ts —
// dieselbe Funktion, die der Testharness unter supabase/tests/ aufruft.
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CORS, handleReleaseEscrow } from "./handler.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

async function sendPush(tokens: string[], title: string, body: string, data: Record<string, string> = {}) {
  if (!tokens.length) return;
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(tokens.map((to) => ({ to, title, body, data, sound: "default" }))),
  }).catch((e) => console.warn("Push delivery error:", e));
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  return await handleReleaseEscrow(req, { supabase, stripe, sendPush, stripeSecretKey: STRIPE_SECRET_KEY });
});
