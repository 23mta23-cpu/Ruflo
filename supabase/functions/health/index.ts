// health — Betriebs-Selbstauskunft: sind die Secrets gesetzt, von denen
// Kernfunktionen abhängen?
//
// Hintergrund: Ein fehlender RESEND_API_KEY hat die App unbemerkt für jedes
// nicht manuell freigeschaltete Konto funktionslos gemacht (kein
// Verifikations-Mail → kein DOI-Stempel → alle Schreibwege per RLS gesperrt).
// Es gab keine Stelle, an der das auffiel, bis ein Mensch darauf lief.
// Siehe docs/ops/RESEND-MAIL-GATE.md.
//
// Security (Standing Rules): Es werden AUSSCHLIESSLICH Booleans
// zurückgegeben — niemals Schlüssel, Präfixe, Längen oder Fehlertexte, aus
// denen sich ein Secret rekonstruieren liesse. Kein Auth nötig (die Antwort
// verrät nichts Vertrauliches), aber per IP rate-limited, damit der Endpunkt
// nicht als billiger Ping-Verstärker dient.

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

const isSet = (name: string): boolean => {
  const v = Deno.env.get(name);
  return typeof v === "string" && v.length > 0;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const limited = await enforceRateLimit(
    supabase,
    `ip:${getClientIp(req)}:health`,
    { limit: 60, windowSeconds: 3600 },
    CORS,
  );
  if (limited) return limited;

  // mail: Verifikations-Mails UND Anbieter-Benachrichtigungen hängen daran.
  // Ist das false, ist die App für Neuregistrierungen praktisch tot.
  const checks = {
    mail: isSet("RESEND_API_KEY"),
    mail_from: isSet("WAITLIST_FROM_EMAIL"),
    stripe: isSet("STRIPE_SECRET_KEY"),
    stripe_webhook: isSet("STRIPE_WEBHOOK_SECRET"),
    db: isSet("SUPABASE_SERVICE_ROLE_KEY"),
  };
  const ok = checks.mail && checks.db;

  return new Response(JSON.stringify({ ok, ...checks }), {
    // 503 wenn ein kritisches Secret fehlt — so kann ein Cron-Job ohne
    // JSON-Parsing allein am Status-Code alarmieren.
    status: ok ? 200 : 503,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
