// deploy-touch 2026-07-13: GitHub-Integration deployt nur geänderte Functions — dieser Kommentar stößt den Erst-Deploy aller Functions an.
// verify-email — eigenes Double-Opt-in für Konto-Verifikation.
//
// POST (JWT)      → erzeugt/erneuert Token, schickt Bestätigungs-Mail (Resend).
// GET  ?token=... → setzt profiles.email_verified_at, löscht Token, zeigt
//                   eine kleine Erfolgsseite.
//
// Hintergrund: "Confirm email" ist im Supabase-Dashboard deaktiviert (Free-
// Tier-SMTP-Limit) — Nutzer sind sofort eingeloggt. Transaktionales gated
// die DB über auth_email_confirmed() (Migration 0400), die diesen Stempel liest.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Rate-Limiting inline statt aus dem Shared-Modul — diese Function wird
// ueber den Dashboard-Editor deployed, der nur Einzeldateien buendelt.
// Logik identisch zu rateLimit.ts (rate_limits-Tabelle + check_rate_limit-RPC).

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? "unknown";
}

async function enforceRateLimit(
  // deno-lint-ignore no-explicit-any
  client: any,
  identifier: string,
  { limit, windowSeconds }: { limit: number; windowSeconds: number },
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const { data: allowed, error } = await client.rpc("check_rate_limit", {
    p_key: identifier,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("Rate limit check failed, allowing request:", error);
    return null;
  }
  if (!allowed) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(windowSeconds) },
    });
  }
  return null;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function htmlPage(title: string, body: string, ok: boolean): Response {
  return new Response(
    `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:sans-serif;background:#F9F8F5;color:#1A1917;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
<div style="max-width:420px;padding:32px;text-align:center">
<div style="font-size:40px;margin-bottom:12px">${ok ? "✓" : "✕"}</div>
<h2 style="color:${ok ? "#1B5C40" : "#B91C1C"};margin:0 0 10px">${title}</h2>
<p style="color:#6C6862;line-height:1.5">${body}</p>
</div></body></html>`,
    { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  // ── GET: Token bestätigen ────────────────────────────────────────────────
  if (req.method === "GET") {
    const token = new URL(req.url).searchParams.get("token") ?? "";
    if (!UUID_RE.test(token)) {
      return htmlPage("Ungültiger Link", "Dieser Bestätigungslink ist ungültig oder unvollständig.", false);
    }

    const ipLimited = await enforceRateLimit(
      supabase,
      `ip:${getClientIp(req)}:verify-email-confirm`,
      { limit: 20, windowSeconds: 3600 },
      CORS,
    );
    if (ipLimited) return htmlPage("Zu viele Versuche", "Bitte versuche es in einer Stunde erneut.", false);

    const { data: row } = await supabase
      .from("email_verifications")
      .select("user_id")
      .eq("token", token)
      .maybeSingle<{ user_id: string }>();

    if (!row) {
      return htmlPage("Link abgelaufen", "Dieser Bestätigungslink wurde bereits verwendet oder ist abgelaufen. Fordere in der App einfach eine neue Mail an.", false);
    }

    const { error: updErr } = await supabase
      .from("profiles")
      .update({ email_verified_at: new Date().toISOString() })
      .eq("id", row.user_id);
    if (updErr) {
      console.error("verify-email: profile update failed:", updErr);
      return htmlPage("Fehler", "Bestätigung fehlgeschlagen — bitte in der App erneut versuchen.", false);
    }

    await supabase.from("email_verifications").delete().eq("user_id", row.user_id);

    return htmlPage("E-Mail bestätigt", "Dein Werkant-Konto ist verifiziert. Du kannst dieses Fenster schließen und in der App loslegen.", true);
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // ── POST: Bestätigungs-Mail (erneut) senden ──────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
  const jwt = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user || !user.email) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const rateLimited = await enforceRateLimit(
    supabase,
    `user:${user.id}:verify-email-send`,
    { limit: 3, windowSeconds: 3600 },
    CORS,
  ) ?? await enforceRateLimit(
    supabase,
    `ip:${getClientIp(req)}:verify-email-send`,
    { limit: 10, windowSeconds: 3600 },
    CORS,
  );
  if (rateLimited) return rateLimited;

  // Schon verifiziert? Dann ist nichts zu tun.
  const { data: profile } = await supabase
    .from("profiles")
    .select("email_verified_at")
    .eq("id", user.id)
    .maybeSingle<{ email_verified_at: string | null }>();
  if (profile?.email_verified_at) {
    return new Response(JSON.stringify({ success: true, already_verified: true }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const { data: tokenRow, error: upsertErr } = await supabase
    .from("email_verifications")
    .upsert({ user_id: user.id, email: user.email, token: crypto.randomUUID(), sent_at: new Date().toISOString() })
    .select("token")
    .single<{ token: string }>();
  if (upsertErr || !tokenRow) {
    console.error("verify-email: token upsert failed:", upsertErr);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.error("RESEND_API_KEY not configured — verification mail not sent");
    return new Response(JSON.stringify({ error: "Mail service not configured" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const confirmUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/verify-email?token=${tokenRow.token}`;
  const from = Deno.env.get("WAITLIST_FROM_EMAIL") ?? "Werkant <onboarding@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [user.email],
      subject: "Bitte bestätigen: Dein Werkant-Konto",
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1A1917"><h2 style="color:#1B5C40">Willkommen bei Werkant!</h2><p>Bitte bestätige deine E-Mail-Adresse, um Aufträge aufzugeben oder Angebote abzugeben und anzunehmen:</p><p style="margin:28px 0"><a href="${confirmUrl}" style="background:#1B5C40;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:bold">E-Mail bestätigen</a></p><p style="color:#6C6862;font-size:13px">Falls du dich nicht bei Werkant registriert hast, ignoriere diese E-Mail einfach.</p></div>`,
    }),
  });
  if (!res.ok) {
    console.error("Resend API error:", res.status, await res.text().catch(() => ""));
    return new Response(JSON.stringify({ error: "Mail delivery failed" }), {
      status: 502,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
