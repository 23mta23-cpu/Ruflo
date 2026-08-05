// deploy-touch 2026-07-13: GitHub-Integration deployt nur geänderte Functions — dieser Kommentar stößt den Erst-Deploy aller Functions an.
//
// Diese Datei enthält BEWUSST keine Logik mehr — sie erzeugt die realen
// Abhängigkeiten und delegiert an `handleCreatePaymentIntent` in handler.ts.
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CORS, handleCreatePaymentIntent } from "./handler.ts";

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
  return await handleCreatePaymentIntent(req, { supabase, stripe, stripeSecretKey: STRIPE_SECRET_KEY });
});
