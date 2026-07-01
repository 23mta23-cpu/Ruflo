/**
 * pstg-annual-report — PStTG (DAC7) Annual Compliance Function
 *
 * Triggered: manually by admin POST, or via Supabase scheduled function (cron)
 *            on Jan 1 of each year, reporting for the PREVIOUS year.
 *
 * What it does:
 *  1. Queries all providers whose pstg_tx_count >= 30 OR pstg_revenue >= 2000
 *     in the target report year.
 *  2. Inserts/upserts rows into pstg_reports for audit trail.
 *  3. Sends push notification to each qualifying provider.
 *  4. Resets counters for all providers to 0 with the new pstg_year.
 *
 * Security: requires WERKR_ADMIN_SECRET header (not user JWT).
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enforceRateLimit, getClientIp } from "../_shared/rateLimit.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-admin-secret",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

// Keep in sync with lib/pstTgThresholds.ts (Deno Edge Functions can't import
// from lib/, so these are duplicated as plain numbers — same values, same source of truth).
const PSTG_TX_THRESHOLD  = 30;
const PSTG_REV_THRESHOLD = 2000;

async function sendPush(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string> = {},
): Promise<void> {
  if (!tokens.length) return;
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(tokens.map((to) => ({ to, title, body, data, sound: "default" }))),
  }).catch((e) => console.warn("Push delivery error:", e));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // Slow brute-forcing of WERKR_ADMIN_SECRET before even checking it.
  const rateLimited = await enforceRateLimit(
    supabase,
    `ip:${getClientIp(req)}:pstg-annual-report`,
    { limit: 5, windowSeconds: 60 },
    CORS,
  );
  if (rateLimited) return rateLimited;

  // ── Admin-only gate ────────────────────────────────────────────────────────
  const secret = req.headers.get("x-admin-secret");
  const expected = Deno.env.get("WERKR_ADMIN_SECRET");
  if (!expected || secret !== expected) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    if (body.year !== undefined && (typeof body.year !== "number" || !Number.isInteger(body.year) || body.year < 2020 || body.year > 2100)) {
      return new Response(JSON.stringify({ error: "year must be an integer between 2020 and 2100" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    // Allow caller to specify year; default = previous year (normal use case)
    const reportYear: number = body.year ?? (new Date().getFullYear() - 1);
    const newYear = reportYear + 1;

    // ── 1. Find qualifying providers for reportYear ────────────────────────
    const { data: qualifying, error: fetchErr } = await supabase
      .from("profiles")
      .select("id, email, pstg_tx_count, pstg_revenue, push_token")
      .eq("pstg_year", reportYear)
      .or(`pstg_tx_count.gte.${PSTG_TX_THRESHOLD},pstg_revenue.gte.${PSTG_REV_THRESHOLD}`)
      .eq("role", "provider");

    if (fetchErr) {
      throw new Error(`Failed to query qualifying providers: ${fetchErr.message}`);
    }

    const providers = qualifying ?? [];

    // ── 2. Upsert pstg_reports rows ────────────────────────────────────────
    if (providers.length > 0) {
      const reportRows = providers.map((p) => ({
        report_year: reportYear,
        provider_id: p.id,
        tx_count: p.pstg_tx_count ?? 0,
        revenue: Number(p.pstg_revenue ?? 0),
        payout: Number(p.pstg_revenue ?? 0), // gross payout = pstg_revenue
        notified_at: new Date().toISOString(),
      }));

      const { error: insertErr } = await supabase
        .from("pstg_reports")
        .upsert(reportRows, { onConflict: "report_year,provider_id" });

      if (insertErr) {
        console.error("pstg_reports upsert error:", insertErr);
      }
    }

    // ── 3. Push-notify qualifying providers ───────────────────────────────
    const tokens = providers.map((p) => p.push_token).filter(Boolean) as string[];
    if (tokens.length > 0) {
      await sendPush(
        tokens,
        "PStTG-Meldung erstellt",
        `Ihr DAC7-Jahresbericht ${reportYear} wurde erstellt. WERKR übermittelt die Daten an das BZSt.`,
        { screen: "/(provider)/steuer" },
      );
    }

    // ── 4. Reset all provider counters to new year ─────────────────────────
    // Any provider still on reportYear gets reset to 0 for newYear.
    const { error: resetErr } = await supabase
      .from("profiles")
      .update({
        pstg_tx_count: 0,
        pstg_revenue: 0,
        pstg_year: newYear,
        pstg_locked: false,
      })
      .eq("pstg_year", reportYear)
      .eq("role", "provider");

    if (resetErr) {
      console.error("PStTG counter reset error:", resetErr);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        report_year: reportYear,
        qualifying_count: providers.length,
        notified_count: tokens.length,
        providers_reset: true,
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );

  } catch (err) {
    console.error("pstg-annual-report error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
