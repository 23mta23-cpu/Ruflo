// export-my-data — DSGVO Art. 15/20: liefert alle personenbezogenen Daten des
// angemeldeten Nutzers als JSON.
//
// Security (Standing Rules): User-JWT-Pflicht; ausschließlich EIGENE Daten
// (jede Query ist auf die User-ID gescopet); Rate-Limit 3/h pro User
// (Export ist teuer und selten legitim häufig); kein Request-Body.
//
// Fehlerverhalten: Schlägt EINE Kategorie fehl, schlägt der GANZE Export fehl
// (500 + Liste der betroffenen Kategorien). Vorher wurden Query-Fehler mit
// `?? []` verschluckt — der Nutzer bekam dann eine Datei, die aussah wie ein
// vollständiger Auskunftsdatensatz, aber Kategorien stillschweigend ausließ.
// Ein stiller Teil-Export ist bei einem Auskunftsersuchen schlimmer als ein
// klarer Fehler, und er macht Betriebsfehler unsichtbar (der Grund, warum die
// Ursache des Founder-Befunds „Datenexport fehlgeschlagen" offen blieb).

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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

type Result = { data: unknown; error: { message: string; code?: string } | null };

/**
 * Vertragsfelder im Auskunftsdatensatz. Bewusst ausgeschrieben statt `*`:
 * so faellt bei jeder neuen Spalte auf, ob sie in den Export gehoert — und in
 * WESSEN Export. Der Anbieter bekommt dieselben Felder ohne die
 * Betrugsvermerke, die den Kunden betreffen.
 */
const CONTRACT_FELDER_GEMEINSAM =
  "id, job_id, offer_id, customer_id, provider_id, customer_signed_at, provider_signed_at, " +
  "escrow_captured_at, escrow_released_at, price_gross, werkr_schutz_fee, customer_service_fee, " +
  "provider_commission, customer_total, provider_payout, track, status, completed_at, " +
  "cancelled_at, cancellation_reason, created_at, customer_refunded_amount, refunded_at, " +
  "dispute_state, dispute_fee, stripe_fee_lost, provider_clawback_amount, dispute_funds_withdrawn, " +
  // 0670: Betrag, Zeitpunkt und Vorgangs-ID der Rueckbuchung sind Daten
  // ueber die betroffene Person und gehoeren damit in die Auskunft nach
  // Art. 15 / Datenuebertragbarkeit nach Art. 20 DSGVO -- genauso wie das
  // bereits gelistete dispute_funds_withdrawn.
  "dispute_amount_cents, dispute_funds_moved_at, stripe_dispute_id";
const CONTRACT_FELDER_KUNDE = `${CONTRACT_FELDER_GEMEINSAM}, fraud_warning_at, fraud_warning_action`;
const CONTRACT_FELDER_ANBIETER = CONTRACT_FELDER_GEMEINSAM;

/** Sammelt Query-Fehler pro Kategorie, statt sie zu verschlucken. */
class Collector {
  readonly failed: string[] = [];

  take(category: string, res: Result): unknown {
    if (res.error) {
      // Server-Log nennt die Ursache (Spalte/Policy); die Antwort an den
      // Client nennt nur die Kategorie — keine Schema-Details nach außen.
      console.error(`export-my-data: Kategorie "${category}" fehlgeschlagen:`, res.error);
      this.failed.push(category);
      return null;
    }
    return res.data;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST" && req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing authorization" }, 401);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  const rateLimited = await enforceRateLimit(
    supabase, `user:${user.id}:export-data`, { limit: 3, windowSeconds: 3600 }, CORS,
  ) ?? await enforceRateLimit(
    supabase, `ip:${getClientIp(req)}:export-data`, { limit: 6, windowSeconds: 3600 }, CORS,
  );
  if (rateLimited) return rateLimited;

  const uid = user.id;
  const c = new Collector();

  const [profileR, providerR, jobsR, offersR, contractsKundeR, contractsAnbieterR, reviewsR, disputesR, proR, pstgR, waitlistR] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("provider_profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("jobs").select("*").or(`customer_id.eq.${uid},provider_id.eq.${uid}`),
      supabase.from("offers").select("*").eq("provider_id", uid),
      // KEIN `select("*")` mehr auf contracts. Seit Migration 0640 stehen dort
      // `fraud_warning_at` und `fraud_warning_action` — eine vom Kartennetz
      // gemeldete Betrugswahrscheinlichkeit zur Zahlung des KUNDEN. Mit `*`
      // waere dieses belastende Personendatum ueber einen Dritten im
      // Art.-15-Export des ANBIETERS gelandet (Art. 15 Abs. 4 DSGVO: das
      // Auskunftsrecht darf Rechte anderer nicht beeintraechtigen).
      //
      // `*` erbt dieses Problem bei jeder kuenftigen Spalte automatisch —
      // deshalb ab hier eine ausdrueckliche Liste. Die Vertraege werden
      // getrennt geholt: der Kunde bekommt die Betrugsfelder (es ist eine
      // Bewertung ueber ihn, Art. 15 Abs. 1 lit. h), der Anbieter nicht.
      supabase.from("contracts").select(CONTRACT_FELDER_KUNDE).eq("customer_id", uid),
      supabase.from("contracts").select(CONTRACT_FELDER_ANBIETER).eq("provider_id", uid),
      supabase.from("reviews").select("*").or(`reviewer_id.eq.${uid},reviewed_id.eq.${uid}`),
      // Nur selbst gemeldete Fälle: die Beschreibung einer Meldung GEGEN den
      // Nutzer ist der Text des Melders (gleiches Prinzip wie Befund L1).
      supabase.from("disputes").select("*").eq("reporter_id", uid),
      supabase.from("pro_subscriptions").select("*").eq("provider_id", uid),
      supabase.from("pstg_reports").select("*").eq("provider_id", uid),
      // Eintrag kann vor der Registrierung entstanden sein (dann nur per E-Mail
      // zuordenbar). Ohne E-Mail am Konto nur über user_id filtern — ein leeres
      // `email.eq.` wäre kein gültiger PostgREST-Filter.
      user.email
        ? supabase.from("waitlist").select("*").or(`user_id.eq.${uid},email.eq.${user.email}`)
        : supabase.from("waitlist").select("*").eq("user_id", uid),
    ]);

  const profile = c.take("profil", profileR as Result);
  const providerProfile = c.take("anbieterprofil", providerR as Result);
  const jobs = (c.take("auftraege", jobsR as Result) ?? []) as { id: string; customer_id: string }[];
  const offers = c.take("angebote", offersR as Result) ?? [];
  const contractsKunde = (c.take("vertraege_als_kunde", contractsKundeR as Result) ?? []) as unknown[];
  const contractsAnbieter = (c.take("vertraege_als_anbieter", contractsAnbieterR as Result) ?? []) as unknown[];
  const contracts = [...contractsKunde, ...contractsAnbieter];
  const reviews = c.take("bewertungen", reviewsR as Result) ?? [];
  const disputes = c.take("meldungen", disputesR as Result) ?? [];
  const proSubs = c.take("pro_mitgliedschaft", proR as Result) ?? [];
  const pstgReports = c.take("psttg_meldungen", pstgR as Result) ?? [];
  const waitlist = c.take("warteliste", waitlistR as Result) ?? [];

  // Partei-Prinzip wie in den RLS-Policies: als Kunde alle Threads der eigenen
  // Aufträge, als Anbieter NUR der eigene (job, provider)-Thread — sonst würden
  // konkurrierende Vor-Vertrags-Rückfragen anderer Anbieter mit exportiert
  // (Security-Befund L1).
  const custJobIds = jobs.filter((j) => j.customer_id === uid).map((j) => j.id);
  const threadFilter = custJobIds.length
    ? `provider_id.eq.${uid},job_id.in.(${custJobIds.join(",")})`
    : `provider_id.eq.${uid}`;

  // Kein zusätzliches `.in("job_id", jobIds)` mehr davor: das war eine Lücke.
  // `jobs` enthält nur Aufträge, bei denen der Nutzer Kunde ODER zugewiesener
  // Anbieter ist. Ein Anbieter, der eine Rückfrage zu einem offenen Auftrag
  // gestellt hat und den Zuschlag NICHT bekommen hat, ist beides nicht — sein
  // eigener Gesprächsfaden fiel damit aus dem Export, obwohl es seine eigenen
  // Nachrichten sind (Art. 15 DSGVO). Der Thread-Filter allein ist bereits
  // vollständig eigen-gescoped: `provider_id = uid` sind ausschliesslich eigene
  // Threads, `job_id in custJobIds` ausschliesslich eigene Aufträge.
  const [messagesR, apptR, addressR] = await Promise.all([
    supabase.from("messages").select("*").or(threadFilter),
    supabase.from("appointment_proposals").select("*").or(threadFilter),
    // Die Auftragsadresse (0570) ist die Adresse des KUNDEN — beim Anbieter ist
    // sie fremdes Personendatum, nicht sein eigenes.
    custJobIds.length
      ? supabase.from("job_addresses").select("*").in("job_id", custJobIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const messages = c.take("nachrichten", messagesR as Result) ?? [];
  const appointments = c.take("termine", apptR as Result) ?? [];
  const jobAddresses = c.take("auftragsadressen", addressR as Result) ?? [];

  if (c.failed.length) {
    return json({
      error: "Export unvollständig",
      failed_categories: c.failed,
      hint: "Der Export wurde abgebrochen, damit keine unvollständige Auskunft als vollständig erscheint.",
    }, 500);
  }

  return json({
    exported_at: new Date().toISOString(),
    format: "DSGVO Art. 15/20 — maschinenlesbar (JSON)",
    user: { id: uid, email: user.email },
    profile,
    provider_profile: providerProfile,
    jobs,
    job_addresses: jobAddresses,
    offers,
    contracts,
    reviews,
    messages,
    appointments,
    disputes,
    pro_subscriptions: proSubs,
    psttg_reports: pstgReports,
    waitlist,
    // Art. 15 Abs. 1 verlangt Transparenz darüber, WAS verarbeitet wird —
    // deshalb werden die zwei bewusst ausgelassenen Kategorien benannt.
    nicht_enthalten: {
      email_verifications:
        "Enthält einen gültigen Bestätigungs-Token (Zugangsmittel). Eine Herausgabe würde ein Sicherheitsmerkmal exportieren; der Inhalt (E-Mail-Adresse, Zeitpunkt) steht im Profil.",
      chat_leak_flags:
        "Abgeleitete Missbrauchserkennung, nicht vom Nutzer bereitgestellt (Art. 20 Abs. 1). Auskunft nach Art. 15 auf Anfrage über den Support.",
    },
  });
});
