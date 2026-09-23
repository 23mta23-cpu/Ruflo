// Zahlungsmethoden LESEN — ausfuehrbar testbar.
//
// Diese Datei enthaelt die VOLLSTAENDIGE Logik; `index.ts` erzeugt nur die
// realen Abhaengigkeiten und delegiert hierher. Dasselbe Muster wie bei
// create-payment-intent, und aus demselben Grund: eine Funktion, die im Test
// nicht importierbar ist, ist ein Grund zum Aufteilen, kein Grund zum
// Abschreiben.
//
// Die wichtigste Zusicherung dieser Datei ist eine NEGATIVE: wer noch keinen
// Stripe-Kunden hat, bekommt eine leere Liste und es wird KEINER angelegt.
// Frueher legte das blosse Oeffnen des Bildschirms einen Kunden bei Stripe an
// und schrieb `stripe_customer_id` — ein Schreibvorgang im Lesepfad, fuer
// jeden Angemeldeten, der vielleicht nie zahlt (Art. 5 Abs. 1 lit. c DSGVO).
import type Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enforceRateLimit, getClientIp } from "../_shared/rateLimit.ts";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

export type Deps = {
  supabase: SupabaseClient;
  stripe: Stripe;
};

export async function handleListPaymentMethods(
  req: Request,
  deps: Deps,
): Promise<Response> {
  const { supabase, stripe } = deps;

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
    `user:${user.id}:list-payment-methods`,
    { limit: 30, windowSeconds: 60 },
    CORS,
  ) ?? await enforceRateLimit(
    supabase,
    `ip:${getClientIp(req)}:list-payment-methods`,
    { limit: 60, windowSeconds: 60 },
    CORS,
  );
  if (rateLimited) return rateLimited;

  // Fetch or lazily create Stripe customer
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, display_name, email")
    .eq("id", user.id)
    .single<{ stripe_customer_id: string | null; display_name: string | null; email: string | null }>();

  const customerId = profile?.stripe_customer_id ?? null;

  // FRUEHER wurde hier beim blossen OEFFNEN des Bildschirms ein Stripe-Kunde
  // angelegt und `stripe_customer_id` geschrieben. Ein Lesevorgang legte damit
  // einen Datensatz bei einem Zahlungsdienstleister an -- fuer jeden
  // Angemeldeten, der die Einstellungen durchblaettert und vielleicht nie
  // zahlt. Das widerspricht der Datenminimierung (Art. 5 Abs. 1 lit. c DSGVO)
  // und ist ausserdem ein Schreibvorgang in einem Abfragepfad.
  //
  // Wer noch keinen Kunden hat, hat auch keine Zahlungsmethode. Die ehrliche
  // Antwort darauf ist eine leere Liste, nicht ein neuer Kunde.
  if (!customerId) {
    return new Response(JSON.stringify({ methods: [] }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
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
    ...methods.data.map((pm: Stripe.PaymentMethod) => ({
      id: pm.id,
      brand: pm.card?.brand ?? "card",
      last4: pm.card?.last4 ?? "****",
      expiry: pm.card ? `${String(pm.card.exp_month).padStart(2, "0")}/${String(pm.card.exp_year).slice(-2)}` : "",
      type: "card",
      isDefault: pm.id === defaultSource,
    })),
    ...sepa.data.map((pm: Stripe.PaymentMethod) => ({
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
}
