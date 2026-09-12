// deploy-touch 2026-07-13: GitHub-Integration deployt nur geänderte Functions — dieser Kommentar stößt den Erst-Deploy aller Functions an.
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { kanalWaehlen, escapeHtml } from "./kanal.ts";
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

    // ── Empfaenger holen (service_role, umgeht RLS) ─────────────────────────
    const { data: profile } = await supabase
      .from("profiles")
      .select("push_token, email, mail_benachrichtigungen")
      .eq("id", to_user_id)
      .maybeSingle<{
        push_token: string | null;
        email: string | null;
        mail_benachrichtigungen: boolean | null;
      }>();

    const token = profile?.push_token;

    // ── Rueckfall auf E-Mail ────────────────────────────────────────────────
    //
    // Hier stand bis zum 12.09.2026:
    //
    //     if (!token) return { sent: false, reason: "no_token" };
    //
    // Das sah nach einem harmlosen Sonderfall aus und war der Normalfall:
    // lib/notifications.ts registriert auf dem Web ueberhaupt keinen Token.
    // Fuer JEDEN Nutzer der live stehenden Web-App endeten damit ALLE neun
    // Benachrichtigungs-Ausloeser hier -- still, ohne Fehler, ohne Zustellung.
    //
    // „Kein Token" heisst zweierlei: Web-Nutzer oder bewusst abgeschaltet
    // (unregisterPushToken setzt die Spalte auf null). Deshalb entscheidet
    // profiles.mail_benachrichtigungen, nicht das blosse Fehlen des Tokens.
    const apiKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("WAITLIST_FROM_EMAIL");
    const wahl = kanalWaehlen({
      token,
      email: profile?.email,
      mailErlaubt: profile?.mail_benachrichtigungen,
      mailEingerichtet: Boolean(apiKey && from),
    });

    if (wahl.kanal === "keiner") {
      return new Response(JSON.stringify({ sent: false, reason: wahl.grund }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    if (wahl.kanal === "e-mail") {
      const email = (profile?.email ?? "").trim();

      const mailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: [email],
          subject: title,
          html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1A1917;line-height:1.6">`
            + `<h2 style="color:#1B5C40;font-size:18px">${escapeHtml(title)}</h2>`
            + `<p>${escapeHtml(body)}</p>`
            + `<p style="color:#6C6862;font-size:13px;margin-top:24px">`
            + `Sie erhalten diese E-Mail zu einem Ihrer Werkant-Vorgänge. `
            + `In den Einstellungen können Sie Vorgangsmails abbestellen.`
            + `</p></div>`,
        }),
      });

      if (!mailRes.ok) {
        console.warn("send-push: Resend", mailRes.status, await mailRes.text());
        return new Response(JSON.stringify({ sent: false, reason: "mail_fehlgeschlagen" }), {
          status: 502, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ sent: true, kanal: "e-mail" }), {
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

    return new Response(JSON.stringify({ sent: true, kanal: "push" }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("send-push error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
