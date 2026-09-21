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
import { istOk, statusFuer } from "./bewertung.ts";

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
  //
  // Der Stau allein genuegt nicht: er wird erst sichtbar, wenn schon eine
  // Pflichtmitteilung offen und 24 Stunden alt ist. Passiert wochenlang kein
  // Strike, bliebe ein nie eingerichteter Zeitplan unbemerkt, und der erste
  // echte Fall liefe in eine Frist, die Werkant schuldet. Deshalb seit 0880
  // auch die Existenz des Zeitplans (wie bei abnahme_lauf).
  let zustellung_stau = false;
  let zustellung_lauf = false;
  try {
    const { data, error } = await supabase.rpc("zustellung_status");
    const zeile = Array.isArray(data) ? data[0] : data;
    if (!error && zeile) {
      zustellung_stau = zeile.stau === true;
      zustellung_lauf = zeile.zeitplan_vorhanden === true;
    }
  } catch {
    // wie oben
  }

  // Wartende Anbieter-Verifizierungen.
  //
  // ANLASS (Founder-Frage 14.09.2026): Bis dahin sagte NIEMAND, dass etwas
  // wartet. Ein Betrieb, der sich Sonntagabend anmeldet, wartete, bis dem
  // Betreiber einfiel, ins Dashboard zu sehen. Das ist die Klasse Luecke, die
  // einem Marktplatz die Angebotsseite kostet, bevor sie je einen Auftrag
  // gesehen hat.
  //
  // Der Zaehler ist kein Ersatz fuer eine Benachrichtigung, er macht den
  // Rueckstand nur SICHTBAR. Der Weg dorthin ist das Pruef-Postfach
  // (app/pruefung.tsx, Edge Function `pruefung`).
  let pruef_offen = 0;
  let pruef_stau = false;
  try {
    const { count } = await supabase
      .from("provider_profiles")
      .select("id", { count: "exact", head: true })
      .eq("kyc_status", "in_review");
    pruef_offen = count ?? 0;

    // Stau = etwas wartet laenger als 24 Stunden. Dieselbe Schwelle wie bei
    // den Pflichtmitteilungen, damit im Betrieb nur EINE Zahl im Kopf ist.
    const gestern = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count: alt } = await supabase
      .from("provider_profiles")
      .select("id", { count: "exact", head: true })
      .eq("kyc_status", "in_review")
      .lt("kyc_submitted_at", gestern);
    pruef_stau = (alt ?? 0) > 0;
  } catch {
    // wie oben: eine fehlende Auskunft darf den Endpunkt nicht umwerfen.
  }

  // ── Warteschlangen, die auf einen Menschen warten ──────────────────────
  //
  // ANLASS (21.09.2026): Beim Auszaehlen aller Tabellen, in denen etwas auf
  // eine Entscheidung wartet, kam heraus, dass DREI davon niemand liest:
  //
  //   disputes            geschrieben von app/reklamation.tsx, gelesen nur
  //                       vom Datenexport des Betroffenen
  //   inhalts_meldungen   geschrieben von der Edge Function, ebenso
  //   chat_reports        geschrieben von lib/chatReport.ts, von NIEMANDEM
  //
  // Bei den Reklamationen ist das nicht bloss unhoeflich: 0770 bricht die
  // automatische Auszahlung mit `dispute_open` ab und laesst auch den
  // Abnahme-Lauf aus. Eine offene Reklamation FRIERT also den Treuhandbetrag
  // ein -- und der Bildschirm sagt dem Kunden dabei zu, Werkant pruefe den
  // Fall innerhalb von zwei Werktagen.
  //
  // Bei den Inhalts-Meldungen ist es Art. 16 DSA: eine Meldung entgegennehmen
  // und nicht bearbeiten ist kein Versaeumnis im Ton, sondern eines im Gesetz.
  //
  // Dieselbe Klasse wie `pruef_offen` (14.09.). Der Zaehler ersetzt keine
  // Entscheidung, er macht den Rueckstand SICHTBAR -- und
  // .github/workflows/wartet-jemand.yml macht daraus eine Meldung.
  //
  // `chat_reports` steht bewusst NICHT hier: die Tabelle hat keinen
  // Erledigt-Zustand (0700, sie ist ein Pruefsignal ohne Auto-Strike). Ein
  // Zaehler, der nur wachsen kann, wird nach zwei Wochen weggeklickt.
  let reklamationen_offen = 0;
  let reklamationen_stau = false;
  let meldungen_offen = 0;
  let meldungen_stau = false;
  try {
    const { count } = await supabase
      .from("disputes")
      .select("id", { count: "exact", head: true })
      .neq("status", "resolved");
    reklamationen_offen = count ?? 0;

    // Zwei Werktage sind zugesagt (REKLAMATION_FRIST_WERKTAGE in
    // constants/legal.ts). Gerechnet wird grob in 48 Stunden: der Zaehler soll
    // einen Rueckstand melden, keinen Feiertagskalender fuehren.
    const vorgestern = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    const { count: alt } = await supabase
      .from("disputes")
      .select("id", { count: "exact", head: true })
      .neq("status", "resolved")
      .lt("created_at", vorgestern);
    reklamationen_stau = (alt ?? 0) > 0;
  } catch {
    // wie oben: eine fehlende Auskunft darf den Endpunkt nicht umwerfen.
  }
  try {
    const { count } = await supabase
      .from("inhalts_meldungen")
      .select("id", { count: "exact", head: true })
      .is("entscheidung", null);
    meldungen_offen = count ?? 0;

    const gestern = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count: alt } = await supabase
      .from("inhalts_meldungen")
      .select("id", { count: "exact", head: true })
      .is("entscheidung", null)
      .lt("eingegangen_am", gestern);
    meldungen_stau = (alt ?? 0) > 0;
  } catch {
    // wie oben
  }

  // Begruendung und Tests in bewertung.ts: `ok` bedeutet "die Secrets sitzen",
  // nicht "alles in Ordnung". Ein Stau ist ein Betriebsproblem und steht
  // einzeln im Rumpf.
  const ok = istOk(checks);

  return new Response(
    JSON.stringify({ ok, ...checks, abnahme_lauf, abnahme_stau, zustellung_lauf, zustellung_stau,
      pruef_offen, pruef_stau,
      reklamationen_offen, reklamationen_stau, meldungen_offen, meldungen_stau }),
    {
    // 503 wenn ein kritisches Secret fehlt — so kann ein Cron-Job ohne
    // JSON-Parsing allein am Status-Code alarmieren.
      status: statusFuer(ok),
      headers: { ...CORS, "Content-Type": "application/json" },
    },
  );
});
