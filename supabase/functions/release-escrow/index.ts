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

async function sendPush(tokens: string[], title: string, body: string, data: Record<string, string> = {}) {
  if (!tokens.length) return;
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(tokens.map((to) => ({ to, title, body, data, sound: "default" }))),
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

  let contract_id: string;
  try {
    ({ contract_id } = await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const { data: contract, error: contractError } = await supabase
    .from("contracts")
    .select("id, job_id, customer_id, provider_id, status, escrow_captured_at, escrow_released_at, provider_payout")
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

  if (contract.status !== "active") {
    return new Response(JSON.stringify({ error: "Contract is not active" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (!contract.escrow_captured_at) {
    return new Response(JSON.stringify({ error: "Escrow has not been captured" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (contract.escrow_released_at) {
    return new Response(JSON.stringify({ error: "Escrow already released" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const { data: providerProfile, error: profileError } = await supabase
    .from("provider_profiles")
    .select("stripe_account_id")
    .eq("id", contract.provider_id)
    .single();

  if (profileError || !providerProfile?.stripe_account_id) {
    return new Response(JSON.stringify({ error: "Provider Stripe account not found" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  let transfer: Stripe.Transfer;
  try {
    transfer = await stripe.transfers.create({
      amount: Math.round(contract.provider_payout * 100),
      currency: "eur",
      destination: providerProfile.stripe_account_id,
      transfer_group: contract_id,
    });
  } catch (err) {
    console.error("Stripe transfers.create failed:", err);
    return new Response(JSON.stringify({ error: "Payment provider error" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const now = new Date().toISOString();

  const { error: contractUpdateError } = await supabase
    .from("contracts")
    .update({
      escrow_released_at: now,
      status: "completed",
      completed_at: now,
    })
    .eq("id", contract_id);

  if (contractUpdateError) {
    console.error("Failed to update contract:", contractUpdateError);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const { error: jobUpdateError } = await supabase
    .from("jobs")
    .update({ status: "completed", completed_at: now })
    .eq("id", contract.job_id);

  if (jobUpdateError) {
    console.error("Failed to update job:", jobUpdateError);
  }

  // PStTG compliance: increment counters on profiles row (provider).
  // guard_profile_sensitive_cols trigger blocks pstg_locked from client-side
  // changes; service_role writes still trigger it — a future migration must
  // add `if current_setting('request.jwt.claims', true)::json->>'role' = 'service_role' then return new; end if;`
  // to the trigger body before this lock path can execute in production.
  const { data: providerRow, error: pstgFetchError } = await supabase
    .from("profiles")
    .select("pstg_tx_count, pstg_revenue, pstg_locked")
    .eq("id", contract.provider_id)
    .single();

  if (!pstgFetchError && providerRow) {
    const newCount = (providerRow.pstg_tx_count ?? 0) + 1;
    const newRevenue = Number(providerRow.pstg_revenue ?? 0) + Number(contract.provider_payout);
    const shouldLock = newCount >= 30 || newRevenue >= 2000;

    const pstgUpdate: Record<string, unknown> = {
      pstg_tx_count: newCount,
      pstg_revenue: newRevenue,
    };
    if (shouldLock && !providerRow.pstg_locked) {
      pstgUpdate.pstg_locked = true;
    }

    const { error: pstgUpdateError } = await supabase
      .from("profiles")
      .update(pstgUpdate)
      .eq("id", contract.provider_id);

    if (pstgUpdateError) {
      console.error("PStTG counter update failed:", pstgUpdateError);
    }
  }

  // Notify provider of payout
  const [providerTokens, customerTokens] = await Promise.all([
    getPushToken(contract.provider_id),
    getPushToken(contract.customer_id),
  ]);
  const { data: job } = await supabase.from("jobs").select("title").eq("id", contract.job_id).single<{ title: string }>();
  const jobTitle = job?.title ?? "Auftrag";
  await Promise.all([
    sendPush(providerTokens, "💰 Zahlung erhalten", `€${contract.provider_payout.toFixed(2)} für „${jobTitle}" wurden ausgezahlt.`, { screen: "/(provider)/auftraege" }),
    sendPush(customerTokens, "✅ Auftrag abgeschlossen", `„${jobTitle}" ist abgeschlossen. Bewertung jetzt abgeben?`, { screen: "/(tabs)/auftraege" }),
  ]);

  return new Response(JSON.stringify({ success: true, transfer_id: transfer.id }), {
    status: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
