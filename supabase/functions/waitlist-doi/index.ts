// waitlist-doi — Double-Opt-In for waitlist signups (UWG §7).
//
// POST { email }        → emails a confirm link for the newest unconfirmed
//                         waitlist entry of that address (via Resend API).
//                         Always answers 200 to prevent email enumeration.
// GET  ?token=<uuid>    → confirms the entry, returns a small HTML page.
//
// No JWT (landing-page signup is anonymous) — abuse is limited by per-IP
// and per-email rate limits. Requires secrets: RESEND_API_KEY, optionally
// WAITLIST_FROM_EMAIL (defaults to Resend's shared test sender).

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enforceRateLimit, getClientIp } from "../_shared/rateLimit.ts";
import { assertOnlyFields, assertString, parseJsonObject, validationErrorResponse } from "../_shared/validate.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function htmlPage(title: string, body: string): Response {
  return new Response(
    `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} — WERKR</title><style>body{font-family:-apple-system,system-ui,sans-serif;background:#F9F8F5;color:#1A1917;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px}main{max-width:420px;text-align:center}h1{font-size:22px;color:#1B5C40}p{line-height:1.6;color:#6C6862}</style></head><body><main><h1>${title}</h1><p>${body}</p></main></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const ipLimited = await enforceRateLimit(
    supabase,
    `ip:${getClientIp(req)}:waitlist-doi`,
    { limit: 10, windowSeconds: 3600 },
    CORS,
  );
  if (ipLimited) return ipLimited;

  // ── GET: confirm ────────────────────────────────────────────────────────
  if (req.method === "GET") {
    const token = new URL(req.url).searchParams.get("token") ?? "";
    if (!UUID_RE.test(token)) {
      return htmlPage("Link ungültig", "Dieser Bestätigungslink ist ungültig oder abgelaufen.");
    }
    const { data } = await supabase
      .from("waitlist")
      .update({ confirmed_at: new Date().toISOString() })
      .eq("confirm_token", token)
      .is("confirmed_at", null)
      .select("id")
      .maybeSingle();
    return data
      ? htmlPage("Bestätigt! 🎉", "Ihre E-Mail-Adresse ist bestätigt. Wir melden uns, sobald WERKR in Ihrer Stadt startet.")
      : htmlPage("Bereits bestätigt", "Dieser Link wurde bereits verwendet oder ist ungültig. Sie müssen nichts weiter tun.");
  }

  // ── POST: send confirmation mail ────────────────────────────────────────
  let email: string;
  try {
    const body = await parseJsonObject(req);
    assertOnlyFields(body, ["email"]);
    email = assertString(body.email, "email", { maxLength: 254 }).trim().toLowerCase();
    if (!EMAIL_RE.test(email)) throw new Error("invalid email");
  } catch (err) {
    return validationErrorResponse(err, CORS);
  }

  const emailLimited = await enforceRateLimit(
    supabase,
    `email:${email}:waitlist-doi`,
    { limit: 3, windowSeconds: 3600 },
    CORS,
  );
  if (emailLimited) return emailLimited;

  // Identical response whether or not the address exists (no enumeration).
  const ok = new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

  const { data: entry } = await supabase
    .from("waitlist")
    .select("confirm_token, city")
    .eq("email", email)
    .is("confirmed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!entry) return ok;

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.error("RESEND_API_KEY not configured — DOI mail not sent");
    return ok;
  }

  const confirmUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/waitlist-doi?token=${entry.confirm_token}`;
  const from = Deno.env.get("WAITLIST_FROM_EMAIL") ?? "WERKR <onboarding@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Bitte bestätigen: Ihre WERKR-Warteliste",
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1A1917"><h2 style="color:#1B5C40">Fast geschafft!</h2><p>Sie haben sich auf die WERKR-Warteliste für <strong>${entry.city}</strong> eingetragen. Bitte bestätigen Sie Ihre E-Mail-Adresse:</p><p style="margin:28px 0"><a href="${confirmUrl}" style="background:#1B5C40;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:bold">E-Mail bestätigen</a></p><p style="color:#6C6862;font-size:13px">Falls Sie sich nicht eingetragen haben, ignorieren Sie diese E-Mail einfach — es passiert nichts weiter.</p></div>`,
    }),
  });
  if (!res.ok) console.error("Resend API error:", res.status, await res.text().catch(() => ""));

  return ok;
});
