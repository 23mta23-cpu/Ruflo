// export-my-data — DSGVO Art. 20 (Datenübertragbarkeit): liefert alle
// personenbezogenen Daten des angemeldeten Nutzers als JSON.
//
// Security (Standing Rules): User-JWT-Pflicht; ausschließlich EIGENE Daten
// (jede Query ist auf die User-ID gescopet); Rate-Limit 3/h pro User
// (Export ist teuer und selten legitim häufig); kein Request-Body.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enforceRateLimit, getClientIp } from "../_shared/rateLimit.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST" && req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing authorization" }, 401);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  const rateLimited = await enforceRateLimit(
    supabase, `user:${user.id}:export-data`, { limit: 3, windowSeconds: 3600 }, CORS,
  ) ?? await enforceRateLimit(
    supabase, `ip:${getClientIp(req)}:export-data`, { limit: 6, windowSeconds: 3600 }, CORS,
  );
  if (rateLimited) return rateLimited;

  const uid = user.id;
  const [profile, providerProfile, jobs, offers, contracts, reviews] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
    supabase.from("provider_profiles").select("*").eq("id", uid).maybeSingle(),
    supabase.from("jobs").select("*").or(`customer_id.eq.${uid},provider_id.eq.${uid}`),
    supabase.from("offers").select("*").eq("provider_id", uid),
    supabase.from("contracts").select("*").or(`customer_id.eq.${uid},provider_id.eq.${uid}`),
    supabase.from("reviews").select("*").or(`author_id.eq.${uid},provider_id.eq.${uid}`),
  ]);

  // Nachrichten über die eigenen Jobs (Partei-Prinzip wie RLS)
  const jobIds = (jobs.data ?? []).map((j: { id: string }) => j.id);
  const messages = jobIds.length
    ? await supabase.from("messages").select("*").in("job_id", jobIds)
    : { data: [] };

  return json({
    exported_at: new Date().toISOString(),
    format: "DSGVO Art. 20 — maschinenlesbar (JSON)",
    user: { id: uid, email: user.email },
    profile: profile.data ?? null,
    provider_profile: providerProfile.data ?? null,
    jobs: jobs.data ?? [],
    offers: offers.data ?? [],
    contracts: contracts.data ?? [],
    reviews: reviews.data ?? [],
    messages: messages.data ?? [],
  });
});
