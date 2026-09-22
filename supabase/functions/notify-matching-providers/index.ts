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
import { escapeHtml } from "../_shared/html.ts";
import { passendeAnbieter } from "./auswahl.ts";
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
    .select("id, customer_id, title, category, category_id, address_plz, address_city, status, track, created_at, requested_provider_id")
    .eq("id", jobId)
    .maybeSingle();
  if (!job || job.customer_id !== user.id) return json({ error: "Not the job owner" }, 403);
  if (job.status !== "open") return json({ error: "Job is not open" }, 409);

  // Passende Anbieter: verfügbar + Kategorie-Match; Region über profiles.plz.
  let query = supabase
    .from("provider_profiles")
    .select("id, is_nachbarschaft, meister_verified, profile:profiles!id(plz, email, push_token, display_name, mail_benachrichtigungen)")
    .eq("available", true)
    .limit(50);
  if (job.category_id) query = query.contains("category_ids", [job.category_id]);
  const { data: providers, error: provErr } = await query;
  if (provErr) {
    console.error("provider query failed:", provErr.message);
    return json({ error: "Lookup failed" }, 500);
  }

  // Wunschanbieter (1020) getrennt nachladen. Die Abfrage oben filtert auf
  // `available` und auf das Gewerk -- beides koennte genau den Betrieb
  // aussortieren, den der Kunde sich ausgesucht hat. Ein Kunde, der auf einem
  // Profil „Unverbindliche Anfrage stellen" drueckt, darf nicht daran
  // scheitern, dass der Betrieb seine Gewerkeliste unvollstaendig gepflegt
  // hat. Die RECHTSgrenzen bleiben: `passendeAnbieter` prueft Track und
  // Meisterpflicht auch fuer ihn.
  const alleAnbieter = [...(providers ?? [])];
  const wunschId = job.requested_provider_id as string | null;
  if (wunschId && !alleAnbieter.some((p) => (p as { id?: string }).id === wunschId)) {
    const { data: wunschZeile, error: wunschFehler } = await supabase
      .from("provider_profiles")
      .select("id, is_nachbarschaft, meister_verified, profile:profiles!id(plz, email, push_token, display_name, mail_benachrichtigungen)")
      .eq("id", wunschId)
      .maybeSingle();
    // Ein Fehler hier darf den Rest NICHT verhindern: die anderen Betriebe
    // sollen ihre Mitteilung trotzdem bekommen.
    if (wunschFehler) console.warn("Wunschanbieter nicht geladen:", wunschFehler.message);
    else if (wunschZeile) alleAnbieter.push(wunschZeile as typeof alleAnbieter[number]);
  }

  // Die Auswahl liegt in auswahl.ts, damit sie ausgefuehrt wird und nicht nur
  // typgeprueft: sie traegt die Trennung zwischen Handwerk und Nachbarschaft
  // (§1 HwO), und genau dort lag am 20.07.2026 ein Founder-Befund.
  // Die Gewerke der Anlage A kommen aus der Datenbank (0980), nicht aus einer
  // Kopie hier. Schlaegt die Abfrage fehl, bleibt die Liste leer -- dann wird
  // NICHT gefiltert, und die Mitteilung geht wie bisher hinaus. Das ist die
  // richtige Richtung: die Sperre selbst sitzt in der Angebots-Policy, hier
  // geht es nur darum, niemandem eine Mitteilung zu schicken, die in eine
  // Sperre fuehrt.
  const { data: meisterGewerke } = await supabase
    .from("meisterpflicht_gewerke").select("gewerk, name");

  const matches = passendeAnbieter(
    job,
    alleAnbieter as Parameters<typeof passendeAnbieter>[1],
    (meisterGewerke ?? []) as { gewerk: string; name: string }[],
  );

  const title = "Neuer Auftrag in Ihrer Nähe";
  const bodyText = `${job.title} in ${job.address_city ?? "Ihrer Region"}. Jetzt Angebot abgeben.`;
  // Wer direkt angefragt wurde, soll das auch lesen. Dieselbe Mitteilung fuer
  // „einer von zwanzig" und „ausdruecklich Sie" verschenkt genau die
  // Information, um derentwillen die Spalte ueberhaupt existiert.
  const titelDirekt = "Ein Kunde hat Sie direkt angefragt";
  const bodyDirekt = `${job.title} in ${job.address_city ?? "Ihrer Region"}. Der Kunde hat Ihr Profil ausgewählt.`;
  // Der Auftragstitel kommt vom Kunden und landet gleich in HTML.
  const titelHtml = escapeHtml(job.title ?? "");
  const stadtHtml = escapeHtml(job.address_city ?? "Ihrer Region");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("WAITLIST_FROM_EMAIL") ?? "Werkant <onboarding@resend.dev>";

  let pushed = 0, mailed = 0;
  for (const p of matches) {
    const profile = p.profile as
      { email?: string; push_token?: string; mail_benachrichtigungen?: boolean } | null;
    const direkt = Boolean(wunschId) && (p as { id?: string }).id === wunschId;
    // Beide Bausteine durch escapeHtml, obwohl es eigene Literale ohne
    // Nutzertext sind: `scripts/mailversand-check.py` prueft die
    // INTERPOLATION, nicht die Herkunft -- und das ist richtig so. Ein
    // Ausdruck, dessen Sicherheit man erst nachlesen muss, ist kein Beleg.
    const kopfHtml = escapeHtml(direkt ? titelDirekt : "Neuer Auftrag in Ihrer Nähe");
    const grundHtml = escapeHtml(direkt
      ? "Sie erhalten diese E-Mail, weil ein Kunde Ihr Profil ausgewählt hat. Die Anfrage ist unverbindlich."
      : "Sie erhalten diese E-Mail, weil Ihr Werkant-Anbieterprofil zu diesem Auftrag passt (Gewerk + Region).");
    if (profile?.push_token) {
      try {
        const res = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({
            to: profile.push_token,
            title: direkt ? titelDirekt : title,
            body: direkt ? bodyDirekt : bodyText,
            data: { screen: "/betrieb/auftraege" }, sound: "default",
          }),
        });
        if (res.ok) pushed++;
      } catch (e) { console.warn("push failed:", e); }
    }
    // Abbestellte Vorgangsmails gelten AUCH hier. Der Fussnotentext unten nennt
    // als Abschaltung die Verfuegbarkeit — die nimmt den Anbieter aber zugleich
    // aus Suche und Startseite, kostet ihn also Auftraege. "Unsichtbar werden
    // oder weiter Mails bekommen" ist keine Wahl. Deshalb zaehlt derselbe
    // Schalter wie in send-push (0870).
    //
    // BEWUSST NICHT kanalWaehlen(): das dort ist ein Entweder-oder (Push ODER
    // Mail). Hier ist es ein Faecher an viele Anbieter, und wer ein Geraet hat,
    // bekommt beides. Wer beide Stellen zusammenlegen will, muss zuerst diese
    // Frage entscheiden, nicht nur den Code teilen.
    if (resendKey && profile?.email && profile.mail_benachrichtigungen !== false) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from,
            to: [profile.email],
            subject: direkt ? `Direkte Anfrage: ${job.title}` : `Neuer Auftrag: ${job.title}`,
            html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1A1917"><h2 style="color:#1B5C40">${kopfHtml}</h2><p><strong>${titelHtml}</strong> in ${stadtHtml}.</p><p>Melden Sie sich in Werkant an und geben Sie jetzt Ihr Angebot ab. Der Auftrag wird nach Eingangsreihenfolge vergeben.</p><p style="color:#6C6862;font-size:13px">${grundHtml} Diese Mails lassen sich in den Einstellungen unter „Vorgangsmails" abschalten.</p></div>`,
          }),
        });
        if (res.ok) mailed++;
      } catch (e) { console.warn("mail failed:", e); }
    }
  }

  // Die Zahl an den Auftrag schreiben (0920). Bis hierher kannte sie nur der
  // Aufrufer, und der wirft sie weg. Fuer den Kunden ist sie das Einzige, was
  // den leeren Angebotszustand von Schweigen unterscheidet: 0 heisst "in
  // Ihrem Postleitzahlenbereich ist niemand fuer dieses Gewerk dabei", und das
  // erfaehrt er sonst erst nach Tagen.
  //
  // Ein Fehler hier darf die Antwort NICHT scheitern lassen: die
  // Benachrichtigungen sind bereits raus, und ein 500 wuerde den Aufrufer zu
  // einem zweiten Lauf verleiten. Also protokollieren und weitergeben, was
  // wirklich passiert ist.
  //
  // Seit 0950 wird zuerst festgehalten, WER informiert wurde, und die Zahl
  // danach daraus abgeleitet. Grund: der Trigger `betrieb_betritt_markt`
  // informiert spaeter dazukommende Betriebe ueber denselben Auftrag. Zwei
  // Stellen, die unabhaengig voneinander eine Zahl hochzaehlen, zaehlen
  // denselben Betrieb irgendwann doppelt -- ein Nachweis kann das nicht.
  if (matches.length > 0) {
    const { error: nachweisFehler } = await supabase
      .from("job_benachrichtigungen")
      .upsert(
        matches.map((p) => ({ job_id: jobId, provider_id: (p as { id: string }).id })),
        { onConflict: "job_id,provider_id", ignoreDuplicates: true },
      );
    if (nachweisFehler) console.error("Nachweis nicht geschrieben:", nachweisFehler.message);
  }
  // `benachrichtigte_betriebe_nachziehen` setzt die Zahl auf den Stand des
  // Nachweises. Bei 0 Treffern schreibt sie eine 0 -- und genau die 0 ist
  // fuer den Kunden die Nachricht, auf die es ankommt (0920).
  const { error: zaehlerFehler } = await supabase
    .rpc("benachrichtigte_betriebe_nachziehen", { p_job: jobId });
  if (zaehlerFehler) console.error("Zaehler nicht geschrieben:", zaehlerFehler.message);

  console.log(`notify-matching-providers: job=${jobId} matches=${matches.length} pushed=${pushed} mailed=${mailed} zaehler=${zaehlerFehler ? "FEHLER" : "ok"}`);
  return json({ matched: matches.length, pushed, mailed, zaehler_geschrieben: !zaehlerFehler });
});
