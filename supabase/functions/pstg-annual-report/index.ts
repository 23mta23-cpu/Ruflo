// deploy-touch 2026-07-13: GitHub-Integration deployt nur geänderte Functions — dieser Kommentar stößt den Erst-Deploy aller Functions an.
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
 * Security: requires Werkant_ADMIN_SECRET header (not user JWT).
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

  // Slow brute-forcing of Werkant_ADMIN_SECRET before even checking it.
  const rateLimited = await enforceRateLimit(
    supabase,
    `ip:${getClientIp(req)}:pstg-annual-report`,
    { limit: 5, windowSeconds: 60 },
    CORS,
  );
  if (rateLimited) return rateLimited;

  // ── Admin-only gate ────────────────────────────────────────────────────────
  // Konstantzeit-Vergleich, damit die Response-Zeit nicht zeichenweise das
  // Secret verrät (Security-Befund L4). Rate-Limit deckelt Brute-Force zusätzlich.
  const secret = req.headers.get("x-admin-secret");
  const expected = Deno.env.get("Werkant_ADMIN_SECRET");
  const secretOk = (() => {
    if (!expected || !secret || secret.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= secret.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
  })();
  if (!secretOk) {
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
    // Quelle sind die abgeschlossenen Vertraege, NICHT der laufende Zaehler in
    // profiles (Migration 0620). Der Zaehler wird von pstg_record_transaction
    // bei der ersten Auszahlung des neuen Jahres zurueckgestellt — lief dieser
    // Bericht danach, fehlten genau die aktivsten Anbieter des Vorjahres
    // (gegen echtes Postgres nachgestellt: 35 Transaktionen / 4200 EUR fuer
    // 2026 verschwanden durch EINE Auszahlung am 2. Januar 2027 vollstaendig
    // aus der Meldung). Aus contracts abgeleitet sind die Zahlen fuer 2026
    // auch 2028 noch dieselben.
    // Schwelle wird MITGEGEBEN, nicht erst hinter dem Aufruf angewandt: sonst
    // liefert die RPC eine Zeile pro Anbieter mit irgendeiner Auszahlung, und
    // PostgREST kappt bei max_rows = 1000 still ab.
    const { data: totals, error: fetchErr } = await supabase
      .rpc("pstg_year_totals", {
        p_year: reportYear,
        p_min_tx: PSTG_TX_THRESHOLD,
        p_min_revenue: PSTG_REV_THRESHOLD,
      });

    if (fetchErr) {
      throw new Error(`Failed to query qualifying providers: ${fetchErr.message}`);
    }

    type YearTotal = { provider_id: string; tx_count: number; revenue: number };
    // Die Schwelle hat bereits die Datenbank angewandt; hier nur noch die
    // Typkonvertierung.
    const qualifyingTotals = (totals ?? []) as YearTotal[];

    // Kontaktdaten getrennt nachladen — die Meldegrundlage kommt aus den
    // Vertraegen, Mailadresse und Push-Token stehen weiterhin am Profil.
    let providers: { id: string; email: string | null; push_token: string | null; tx_count: number; revenue: number }[] = [];
    if (qualifyingTotals.length > 0) {
      // In Bloecken laden: `.in()` mit vielen UUIDs wird zu einer sehr langen
      // GET-URL und stirbt an einem 414, bevor irgendein Zeilenlimit greift.
      const CHUNK = 200;
      const ids = qualifyingTotals.map((t) => t.provider_id);
      const profileRows: { id: string; email: string | null; push_token: string | null }[] = [];
      for (let i = 0; i < ids.length; i += CHUNK) {
        const { data: chunk, error: profErr } = await supabase
          .from("profiles")
          .select("id, email, push_token")
          .in("id", ids.slice(i, i + CHUNK));
        if (profErr) {
          throw new Error(`Failed to load provider contacts: ${profErr.message}`);
        }
        profileRows.push(...(chunk ?? []));
      }
      const byId = new Map(profileRows.map((p) => [p.id, p]));
      providers = qualifyingTotals.map((t) => ({
        id: t.provider_id,
        email: byId.get(t.provider_id)?.email ?? null,
        push_token: byId.get(t.provider_id)?.push_token ?? null,
        tx_count: t.tx_count,
        revenue: Number(t.revenue),
      }));
    }

    // ── 2. Upsert pstg_reports rows ────────────────────────────────────────
    if (providers.length > 0) {
      const reportRows = providers.map((p) => ({
        report_year: reportYear,
        provider_id: p.id,
        tx_count: p.tx_count,
        revenue: p.revenue,
        // Bemessungsgrundlage ist provider_payout, also die Verguetung nach
        // Abzug der einbehaltenen Gebuehren (§ 3 Abs. 5 PStTG) — revenue und
        // payout sind hier bewusst derselbe Wert.
        payout: p.revenue,
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
        "PStTG-Meldeschwelle erreicht",
        `Sie haben die PStTG-Meldeschwelle für ${reportYear} erreicht. Ihre Daten wurden für die BZSt-Meldung vorbereitet.`,
        // /betrieb/steuer hat es NIE gegeben -- der Deeplink dieser
        // Benachrichtigung zeigte seit jeher ins Leere. Die PStTG-/DAC7-Daten
        // liegen unter /einstellungen (Zeile "PStTG / DAC7 Info",
        // "Jahresbericht herunterladen"). Beim Routen-Umbau aufgefallen.
        { screen: "/einstellungen" },
      );
    }

    // ── 4. Reset all provider counters to new year ─────────────────────────
    // Betrifft seit Migration 0620 nur noch den ANZEIGE- und Sperr-Cache in
    // profiles. Die Meldung selbst haengt nicht mehr daran — ein ausgefallener
    // oder verspaeteter Lauf kann keine Meldedaten mehr verlieren.
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
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
