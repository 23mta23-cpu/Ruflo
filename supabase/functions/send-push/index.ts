import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enforceRateLimit, getClientIp } from "../_shared/rateLimit.ts";
import { assertOnlyFields, assertString, assertUuid, parseJsonObject, ValidationError, validationErrorResponse } from "../_shared/validate.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // ── Auth: verify caller is authenticated ─────────────────────────────────
    const authHeader = req.headers.get("authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { data: { user: caller }, error: authErr } = await supabase.auth.getUser(jwt);
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const rateLimited = await enforceRateLimit(
      supabase,
      `user:${caller.id}:send-push`,
      { limit: 20, windowSeconds: 60 },
      CORS,
    ) ?? await enforceRateLimit(
      supabase,
      `ip:${getClientIp(req)}:send-push`,
      { limit: 60, windowSeconds: 60 },
      CORS,
    );
    if (rateLimited) return rateLimited;

    let to_user_id: string, title: string, body: string, extraData: Record<string, string> | undefined;
    try {
      const parsedBody = await parseJsonObject(req);
      assertOnlyFields(parsedBody, ["to_user_id", "title", "body", "data"]);
      to_user_id = assertUuid(parsedBody.to_user_id, "to_user_id");
      title = assertString(parsedBody.title, "title", { maxLength: 100 });
      body = assertString(parsedBody.body, "body", { maxLength: 500 });
      if (parsedBody.data !== undefined) {
        if (typeof parsedBody.data !== "object" || parsedBody.data === null || Array.isArray(parsedBody.data)) {
          throw new ValidationError("data must be an object");
        }
        extraData = parsedBody.data as Record<string, string>;
      }
    } catch (e) {
      return validationErrorResponse(e, CORS);
    }

    // ── Authorization: verify caller shares a job or contract with target ────
    // Checks both directions (caller as customer or provider).
    const { count: sharedJobCount } = await supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .or(
        `and(customer_id.eq.${caller.id},provider_id.eq.${to_user_id}),and(customer_id.eq.${to_user_id},provider_id.eq.${caller.id})`
      );

    const { count: sharedContractCount } = await supabase
      .from("contracts")
      .select("id", { count: "exact", head: true })
      .or(
        `and(customer_id.eq.${caller.id},provider_id.eq.${to_user_id}),and(customer_id.eq.${to_user_id},provider_id.eq.${caller.id})`
      );

    if ((sharedJobCount ?? 0) === 0 && (sharedContractCount ?? 0) === 0) {
      return new Response(JSON.stringify({ error: "Forbidden: no shared job or contract" }), {
        status: 403, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ── Fetch target push token via service_role (bypasses RLS) ─────────────
    const { data: profile } = await supabase
      .from("profiles")
      .select("push_token")
      .eq("id", to_user_id)
      .maybeSingle<{ push_token: string | null }>();

    const token = profile?.push_token;
    if (!token) {
      // Target has no push token registered — not an error, just a no-op.
      return new Response(JSON.stringify({ sent: false, reason: "no_token" }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ── Send via Expo push service ───────────────────────────────────────────
    const pushRes = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ to: token, title, body, data: extraData ?? {}, sound: "default" }),
    });

    if (!pushRes.ok) {
      console.warn("Expo push error:", pushRes.status, await pushRes.text());
    }

    return new Response(JSON.stringify({ sent: true }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("send-push error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
