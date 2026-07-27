// deploy-touch 2026-07-13: GitHub-Integration deployt nur geänderte Functions — dieser Kommentar stößt den Erst-Deploy aller Functions an.
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
    `user:${user.id}:release-escrow`,
    { limit: 10, windowSeconds: 60 },
    CORS,
  ) ?? await enforceRateLimit(
    supabase,
    `ip:${getClientIp(req)}:release-escrow`,
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
    transfer = await stripe.transfers.create(
      {
        amount: Math.round(contract.provider_payout * 100),
        currency: "eur",
        destination: providerProfile.stripe_account_id,
        transfer_group: contract_id,
      },
      { idempotencyKey: `release-escrow-${contract_id}` },
    );
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

  // PStTG compliance: Jahresstand des Anbieters fortschreiben.
  //
  // Das lief früher hier als Lesen-Rechnen-Schreiben (`newCount = baseCount + 1`
  // über zwei Roundtrips). Werden zwei verschiedene Verträge gleichzeitig
  // freigegeben, lesen beide denselben Ausgangswert und schreiben denselben
  // Endwert — eine Transaktion geht verloren. Zu niedrig gezählt heisst: ein
  // Anbieter, der ans BZSt gemeldet werden müsste, wird es womöglich nicht,
  // und die Meldepflicht trifft die Plattform (§ 13 PStTG).
  //
  // Jahreswechsel, Hochzählen, Schwellenprüfung und Sperre passieren jetzt in
  // EINER atomaren Anweisung in pstg_record_transaction (Migration 0610).
  const { error: pstgError } = await supabase.rpc("pstg_record_transaction", {
    p_provider_id: contract.provider_id,
    p_payout: Number(contract.provider_payout),
  });

  if (pstgError) {
    // Die Auszahlung ist zu diesem Zeitpunkt bereits erfolgt — ein Fehler hier
    // darf sie nicht zurückrollen, muss aber sichtbar sein: der Jahresstand
    // wäre dann zu niedrig und die DAC7-Meldung unvollständig.
    console.error("PStTG counter update failed:", pstgError);
  }

  // Notify provider of payout
  const [providerTokens, customerTokens] = await Promise.all([
    getPushToken(contract.provider_id),
    getPushToken(contract.customer_id),
  ]);
  const { data: job } = await supabase.from("jobs").select("title").eq("id", contract.job_id).single<{ title: string }>();
  const jobTitle = job?.title ?? "Auftrag";
  await Promise.all([
    sendPush(providerTokens, "Zahlung erhalten", `€${contract.provider_payout.toFixed(2)} für „${jobTitle}" wurden ausgezahlt.`, { screen: "/(provider)/auftraege" }),
    sendPush(customerTokens, "Auftrag abgeschlossen", `„${jobTitle}" ist abgeschlossen. Bewertung jetzt abgeben?`, { screen: "/(tabs)/auftraege" }),
  ]);

  return new Response(JSON.stringify({ success: true, transfer_id: transfer.id }), {
    status: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
