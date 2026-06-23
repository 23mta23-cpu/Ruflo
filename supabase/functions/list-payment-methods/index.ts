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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

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

  // Fetch or lazily create Stripe customer
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, display_name, email")
    .eq("id", user.id)
    .single<{ stripe_customer_id: string | null; display_name: string | null; email: string | null }>();

  let customerId = profile?.stripe_customer_id ?? null;

  if (!customerId) {
    // Create Stripe customer on first call
    const customer = await stripe.customers.create({
      email: user.email ?? profile?.email ?? undefined,
      name: profile?.display_name ?? undefined,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    await supabase
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  const methods = await stripe.paymentMethods.list({
    customer: customerId,
    type: "card",
  });

  // Also check for SEPA debit
  const sepa = await stripe.paymentMethods.list({
    customer: customerId,
    type: "sepa_debit",
  });

  const defaultSource = (await stripe.customers.retrieve(customerId) as Stripe.Customer)
    .invoice_settings?.default_payment_method as string | null ?? null;

  const result = [
    ...methods.data.map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand ?? "card",
      last4: pm.card?.last4 ?? "****",
      expiry: pm.card ? `${String(pm.card.exp_month).padStart(2, "0")}/${String(pm.card.exp_year).slice(-2)}` : "",
      type: "card",
      isDefault: pm.id === defaultSource,
    })),
    ...sepa.data.map((pm) => ({
      id: pm.id,
      brand: "SEPA",
      last4: pm.sepa_debit?.last4 ?? "****",
      expiry: "",
      type: "sepa_debit",
      isDefault: pm.id === defaultSource,
    })),
  ];

  return new Response(JSON.stringify({ methods: result }), {
    status: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
