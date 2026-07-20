// notify-matching-providers — informiert passende Anbieter über einen neuen
// offenen Auftrag (BUG 9, 19.07.): Push (Expo) + optional E-Mail (Resend).
//
// Matching: verfügbare Anbieter, deren category_ids die Auftrags-Kategorie
// enthalten und deren Profil-PLZ im selben PLZ-Leitbereich liegt (erste
// 2 Ziffern — pragmatischer Radius-Proxy ohne Geodaten).
//
// Security (Standing Rules): User-JWT-Pflicht, Aufrufer muss Auftrags-Owner
// sein, Rate-Limit pro User+IP, strikte Input-Validierung. Kein neuer
// Datenzugang: Anbieter sehen offene Aufträge ohnehin im Dashboard — die
// Benachrichtigung enthält nur Titel + Stadt.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enforceRateLimit, getClientIp } from "../_shared/rateLimit.ts";
import {
  parseJsonObject, assertOnlyFields, assertUuid, ValidationError,
} from "../_shared/validate.ts";

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
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing authorization" }, 401);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  const rateLimited = await enforceRateLimit(
    supabase, `user:${user.id}:notify-providers`, { limit: 10, windowSeconds: 3600 }, CORS,
  ) ?? await enforceRateLimit(
    supabase, `ip:${getClientIp(req)}:notify-providers`, { limit: 20, windowSeconds: 3600 }, CORS,
  );
  if (rateLimited) return rateLimited;

  let jobId: string;
  try {
    const body = await parseJsonObject(req);
    assertOnlyFields(body, ["job_id"]);
    jobId = assertUuid(body.job_id, "job_id");
  } catch (e) {
    if (e instanceof ValidationError) return json({ error: e.message }, 400);
    return json({ error: "Invalid request" }, 400);
  }

  // Ownership + Status: nur der Auftrags-Owner darf für seinen frischen,
  // offenen Auftrag Benachrichtigungen auslösen.
  const { data: job } = await supabase
    .from("jobs")
    .select("id, customer_id, title, category_id, address_plz, address_city, status, track, created_at")
    .eq("id", jobId)
    .maybeSingle();
  if (!job || job.customer_id !== user.id) return json({ error: "Not the job owner" }, 403);
  if (job.status !== "open") return json({ error: "Job is not open" }, 409);

  // Passende Anbieter: verfügbar + Kategorie-Match; Region über profiles.plz.
  let query = supabase
    .from("provider_profiles")
    .select("id, is_nachbarschaft, profile:profiles!id(plz, email, push_token, display_name)")
    .eq("available", true)
    .limit(50);
  if (job.category_id) query = query.contains("category_ids", [job.category_id]);
  const { data: providers, error: provErr } = await query;
  if (provErr) {
    console.error("provider query failed:", provErr.message);
    return json({ error: "Lookup failed" }, 500);
  }

  const plzPrefix = (job.address_plz ?? "").slice(0, 2);
  const jobIsNb = (job as { track?: string }).track === "nachbarschaft";
  const matches = (providers ?? []).filter((p) => {
    // Track-Trennung: Nachbarschaftshelfer nur fuer Nachbarschafts-Auftraege
    if (Boolean((p as { is_nachbarschaft?: boolean }).is_nachbarschaft) !== jobIsNb) return false;
    const plz = (p.profile as { plz?: string } | null)?.plz ?? "";
    return plzPrefix.length === 2 && plz.startsWith(plzPrefix);
  });

  const title = "Neuer Auftrag in Ihrer Nähe";
  const bodyText = `${job.title} in ${job.address_city ?? "Ihrer Region"} — jetzt Angebot abgeben.`;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("WAITLIST_FROM_EMAIL") ?? "Werkant <onboarding@resend.dev>";

  let pushed = 0, mailed = 0;
  for (const p of matches) {
    const profile = p.profile as { email?: string; push_token?: string } | null;
    if (profile?.push_token) {
      try {
        const res = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({
            to: profile.push_token, title, body: bodyText,
            data: { screen: "/(provider)/auftraege" }, sound: "default",
          }),
        });
        if (res.ok) pushed++;
      } catch (e) { console.warn("push failed:", e); }
    }
    if (resendKey && profile?.email) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from,
            to: [profile.email],
            subject: `Neuer Auftrag: ${job.title}`,
            html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1A1917"><h2 style="color:#1B5C40">Neuer Auftrag in Ihrer Nähe</h2><p><strong>${job.title}</strong> in ${job.address_city ?? "Ihrer Region"}.</p><p>Melden Sie sich in Werkant an und geben Sie jetzt Ihr Angebot ab — der Auftrag wird nach Eingangsreihenfolge vergeben.</p><p style="color:#6C6862;font-size:13px">Sie erhalten diese E-Mail, weil Ihr Werkant-Anbieterprofil zu diesem Auftrag passt (Gewerk + Region). Verfügbarkeit lässt sich im Anbieter-Profil abschalten.</p></div>`,
          }),
        });
        if (res.ok) mailed++;
      } catch (e) { console.warn("mail failed:", e); }
    }
  }

  console.log(`notify-matching-providers: job=${jobId} matches=${matches.length} pushed=${pushed} mailed=${mailed}`);
  return json({ matched: matches.length, pushed, mailed });
});
