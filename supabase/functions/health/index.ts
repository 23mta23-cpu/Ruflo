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
    admin_secret: isSet("Werkant_ADMIN_SECRET"),
  };

  // Der naechtliche Abnahmefrist-Lauf (docs/betrieb/abnahmefrist-lauf.md).
  //
  // Ohne ihn wird KEIN Escrow automatisch freigegeben: das Geld bleibt
  // liegen, der Betrieb wartet, und niemand merkt es. Die Anleitung benennt
  // die Luecke selbst -- ein vom Gateway mit 401 abgewiesener Aufruf laesst
  // den Auftrag "erfolgreich" aussehen.
  //
  // Deshalb wird hier das SYMPTOM gemeldet, nicht nur die Existenz des
  // Zeitplans: liegen faellige Vertraege laenger als zwei Tage, ist etwas
  // kaputt, egal was cron.job_run_details behauptet.
  //
  // Wie ueberall hier: nur Booleans nach aussen, keine Zahlen. Wie viele
  // Vertraege offen sind, ist Geschaeftszahl und geht niemanden an, der den
  // Endpunkt aufruft.
  let abnahme_lauf = false;
  let abnahme_stau = false;
  try {
    const { data, error } = await supabase.rpc("abnahme_lauf_status");
    const zeile = Array.isArray(data) ? data[0] : data;
    if (!error && zeile) {
      abnahme_lauf = zeile.zeitplan_vorhanden === true;
      abnahme_stau = zeile.stau === true;
    }
  } catch {
    // Fehlt die Funktion (aeltere Instanz), bleibt es bei false. Ein
    // Absturz des Endpunkts waere hier schlimmer als eine fehlende Angabe.
  }

  // Pflichtmitteilungen (0860): Strike nach AGB §7(4) / Art. 4 P2B-VO und
  // Beschraenkung nach DSA Art. 17. Geschuldet ist die UEBERMITTLUNG, nicht
  // nur der Text. Liegt eine laenger als 24 Stunden unzugestellt, ist das ein
  // Rechtsproblem und gehoert sichtbar, nicht in eine Spalte.
  let zustellung_stau = false;
  try {
    const { data, error } = await supabase.rpc("zustellung_status");
    const zeile = Array.isArray(data) ? data[0] : data;
    if (!error && zeile) zustellung_stau = zeile.stau === true;
  } catch {
    // wie oben
  }

  // `ok` bleibt bewusst an mail und db haengen: es bedeutet seit jeher
  // "die Secrets sitzen". Ein Stau ist ein Betriebsproblem, kein fehlendes
  // Secret, und wuerde die Bedeutung des Status-Codes verwaessern.
  const ok = checks.mail && checks.db;

  return new Response(
    JSON.stringify({ ok, ...checks, abnahme_lauf, abnahme_stau, zustellung_stau }),
    {
    // 503 wenn ein kritisches Secret fehlt — so kann ein Cron-Job ohne
    // JSON-Parsing allein am Status-Code alarmieren.
      status: ok ? 200 : 503,
      headers: { ...CORS, "Content-Type": "application/json" },
    },
  );
});
