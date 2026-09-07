// inhalts-meldung — Melde- und Abhilfeverfahren nach Art. 16 DSA.
//
// POST { inhaltArt, fundstelle, begruendung, melderName, melderEmail,
//        treuUndGlauben, straftatVerdacht?, inhaltId? }
//   -> 201 { id, eingegangenAm }
//
// KEIN JWT. Art. 16 Abs. 1 richtet sich an "Personen und Einrichtungen", nicht
// an Nutzer der Plattform — ein Meldeweg, der ein Konto verlangt, ist keiner.
// Wer angemeldet ist, schickt trotzdem sein Token mit: dann wird melder_id
// gesetzt und die Person sieht ihre Meldung spaeter in der App wieder.
//
// Missbrauch wird ueber Rate-Limits begrenzt (pro IP und pro E-Mail), nicht
// ueber eine Anmeldepflicht. Geschrieben wird mit service_role, weil die
// Tabelle bewusst kein Insert-Recht fuer anon/authenticated hat (0810).
//
// Art. 16 Abs. 4 verlangt eine unverzuegliche Eingangsbestaetigung. Sie wird
// hier VERMERKT (bestaetigt_am) und im Antworttext gegeben; der Mailversand
// haengt am Postfach, das es noch nicht gibt — siehe Grenze unten.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enforceRateLimit, getClientIp } from "../_shared/rateLimit.ts";
import {
  assertOnlyFields,
  assertString,
  parseJsonObject,
  validationErrorResponse,
} from "../_shared/validate.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Muss mit dem CHECK in 0810 uebereinstimmen. Steht hier noch einmal, damit ein
// falscher Wert eine saubere 400 ergibt statt eines 500 aus der Datenbank.
const INHALT_ARTEN = ["auftrag", "profil", "nachricht", "bewertung", "nachweis", "sonstiges"];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ipLimited = await enforceRateLimit(
    admin,
    `ip:${getClientIp(req)}:inhalts-meldung`,
    { limit: 5, windowSeconds: 3600 },
    CORS,
  );
  if (ipLimited) return ipLimited;

  let body: Record<string, unknown>;
  try {
    body = await parseJsonObject(req);
    assertOnlyFields(body, [
      "inhaltArt", "inhaltId", "fundstelle", "begruendung",
      "melderName", "melderEmail", "treuUndGlauben", "straftatVerdacht",
    ]);
  } catch (err) {
    return validationErrorResponse(err, CORS);
  }

  let inhaltArt: string, fundstelle: string, begruendung: string;
  let melderName: string, melderEmail: string;
  try {
    inhaltArt = assertString(body.inhaltArt, "inhaltArt", { maxLength: 20 });
    if (!INHALT_ARTEN.includes(inhaltArt)) {
      return json({ error: `inhaltArt must be one of ${INHALT_ARTEN.join(", ")}` }, 400);
    }
    fundstelle = assertString(body.fundstelle, "fundstelle", { minLength: 3, maxLength: 500 });
    // Die Untergrenze ist keine Schikane: Art. 16 Abs. 2 lit. a verlangt eine
    // "hinreichend begruendete Erlaeuterung", und Abs. 6 eine sorgfaeltige
    // Pruefung. Beides ist bei "ist illegal" nicht moeglich.
    begruendung = assertString(body.begruendung, "begruendung", { minLength: 30, maxLength: 5000 });
    melderName = assertString(body.melderName, "melderName", { minLength: 2, maxLength: 120 });
    melderEmail = assertString(body.melderEmail, "melderEmail", { maxLength: 200 });
  } catch (err) {
    return validationErrorResponse(err, CORS);
  }

  if (!EMAIL_RE.test(melderEmail)) return json({ error: "melderEmail is not a valid address" }, 400);

  // Art. 16 Abs. 2 lit. d — ohne diese Erklaerung ist die Meldung unvollstaendig.
  if (body.treuUndGlauben !== true) {
    return json({ error: "treuUndGlauben must be true (Art. 16(2)(d) DSA)" }, 400);
  }

  const inhaltId = body.inhaltId === undefined || body.inhaltId === null ? null : String(body.inhaltId);
  if (inhaltId !== null && !UUID_RE.test(inhaltId)) {
    return json({ error: "inhaltId must be a UUID" }, 400);
  }
  const straftatVerdacht = body.straftatVerdacht === true;

  const mailLimited = await enforceRateLimit(
    admin,
    `mail:${melderEmail.toLowerCase()}:inhalts-meldung`,
    { limit: 10, windowSeconds: 86400 },
    CORS,
  );
  if (mailLimited) return mailLimited;

  // Wer angemeldet ist, wird zugeordnet — wer nicht, meldet trotzdem.
  // Ein ungueltiges Token darf die Meldung NICHT scheitern lassen: sonst
  // haengt der Meldeweg an einer abgelaufenen Sitzung.
  let melderId: string | null = null;
  const auth = req.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) {
    const { data } = await admin.auth.getUser(auth.slice(7));
    melderId = data?.user?.id ?? null;
  }

  const { data, error } = await admin
    .from("inhalts_meldungen")
    .insert({
      inhalt_art: inhaltArt,
      inhalt_id: inhaltId,
      fundstelle,
      begruendung,
      melder_name: melderName,
      melder_email: melderEmail,
      melder_id: melderId,
      treu_und_glauben: true,
      straftat_verdacht: straftatVerdacht,
      // Art. 16 Abs. 4: der Eingang ist mit dem Speichern bestaetigt und wird
      // in der Antwort quittiert.
      bestaetigt_am: new Date().toISOString(),
      // Art. 16 Abs. 6: solange von Hand geprueft wird, bleibt das false.
      automatisiert: false,
    })
    .select("id, eingegangen_am")
    .single();

  if (error) {
    console.error("inhalts-meldung insert failed:", error);
    return json({ error: "Could not store the notice" }, 500);
  }

  console.log(
    `inhalts-meldung: id=${data.id} art=${inhaltArt} straftat=${straftatVerdacht} angemeldet=${melderId !== null}`,
  );

  return json({ id: data.id, eingegangenAm: data.eingegangen_am }, 201);
});

// GRENZE, ausdruecklich und nicht wegzudenken:
// Art. 16 Abs. 5 verlangt, dem Melder die ENTSCHEIDUNG mitzuteilen, samt
// Rechtsbehelfsbelehrung. Das geschieht heute NICHT automatisch — es gibt kein
// versendendes Postfach (health meldet mail:false). Die Entscheidung wird ueber
// meldung_entscheiden() festgehalten und muss von Hand zugestellt werden.
// Der Ablauf steht in docs/betrieb/dsa-meldungen.md. Sobald der Mailweg steht,
// gehoert der Versand hierher.
