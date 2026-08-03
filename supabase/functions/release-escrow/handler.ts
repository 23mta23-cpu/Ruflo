// Auszahlungslogik der Escrow-Freigabe — ausführbar testbar.
//
// Diese Datei enthält die VOLLSTÄNDIGE Geschäftslogik. `index.ts` erzeugt nur
// noch die realen Abhängigkeiten und delegiert hierher. Produktion und Tests
// importieren dieselbe `handleReleaseEscrow`-Funktion; im Test wird KEINE
// zweite Version dieser Logik implementiert.
//
// Der Inhalt ab `const zagBlocked` ist eine WORTGLEICHE Übernahme aus index.ts
// (dort Z. 49–255 vor der Extraktion). Bei der Verschiebung wurde keine
// Bedingung, kein Statuscode, kein Betrag und kein Fehlerpfad geändert.
import type Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enforceRateLimit, getClientIp } from "../_shared/rateLimit.ts";
import { assertOnlyFields, assertUuid, parseJsonObject, validationErrorResponse } from "../_shared/validate.ts";
import { assertZagSignoffForLiveMode } from "../_shared/zagGate.ts";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

/** Push-Versand — injizierbar, damit Tests den Nicht-Versand nachweisen können. */
export type PushSender = (
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
) => Promise<void>;

export type Deps = {
  supabase: SupabaseClient;
  stripe: Stripe;
  sendPush: PushSender;
  /** Nur für den ZAG-Gate-Check — sk_live_… blockiert ohne Rechtsfreigabe. */
  stripeSecretKey: string;
};

export async function handleReleaseEscrow(
  req: Request,
  deps: Deps,
): Promise<Response> {
  const { supabase, stripe, sendPush } = deps;
  const STRIPE_SECRET_KEY = deps.stripeSecretKey;

  async function getPushToken(userId: string): Promise<string[]> {
    const { data } = await supabase
      .from("profiles")
      .select("push_token")
      .eq("id", userId)
      .single<{ push_token: string | null }>();
    return data?.push_token ? [data.push_token] : [];
  }

  const zagBlocked = assertZagSignoffForLiveMode(STRIPE_SECRET_KEY);
  if (zagBlocked) return zagBlocked;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const jwt = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const rateLimited = await enforceRateLimit(
    supabase,
    `user:${user.id}:release-escrow`,
    { limit: 10, windowSeconds: 60 },
    CORS,
  ) ?? await enforceRateLimit(
    supabase,
    `ip:${getClientIp(req)}:release-escrow`,
    { limit: 30, windowSeconds: 60 },
    CORS,
  );
  if (rateLimited) return rateLimited;

  let contract_id: string;
  try {
    const body = await parseJsonObject(req);
    assertOnlyFields(body, ["contract_id"]);
    contract_id = assertUuid(body.contract_id, "contract_id");
  } catch (err) {
    return validationErrorResponse(err, CORS);
  }

  const { data: contract, error: contractError } = await supabase
    .from("contracts")
    .select("id, job_id, customer_id, provider_id, status, escrow_captured_at, escrow_released_at, provider_payout, customer_refunded_amount, dispute_state")
    .eq("id", contract_id)
    .single();

  if (contractError || !contract) {
    return new Response(JSON.stringify({ error: "Contract not found" }), {
      status: 404,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (contract.customer_id !== user.id) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (contract.status !== "active") {
    return new Response(JSON.stringify({ error: "Contract is not active" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (!contract.escrow_captured_at) {
    return new Response(JSON.stringify({ error: "Escrow has not been captured" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (contract.escrow_released_at) {
    return new Response(JSON.stringify({ error: "Escrow already released" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Ist das Geld bereits an den Kunden zurueckgeflossen, darf es nicht ein
  // zweites Mal an den Anbieter gehen. Das ist KEIN theoretischer Fall: die
  // heute empfohlene Reaktion auf eine Betrugs-Fruehwarnung ist eine
  // Erstattung von Hand im Stripe-Dashboard. Die setzt ueber `charge.refunded`
  // customer_refunded_amount — und ohne diesen Guard konnte der Kunde danach
  // trotzdem "Arbeit abgenommen" tippen, weil status weiterhin 'active' ist.
  // Werkant haette dann zweimal gezahlt: einmal an den Kunden zurueck, einmal
  // an den Anbieter aus eigenem Guthaben. Dieselbe Klasse wie #149/#152, hier
  // ueber einen neuen Pfad.
  if (Number(contract.customer_refunded_amount ?? 0) > 0) {
    return new Response(
      JSON.stringify({ error: "Für diesen Auftrag wurde bereits Geld an den Auftraggeber zurückerstattet. Bitte wenden Sie sich an den Support." }),
      { status: 409, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  // Waehrend einer laufenden Rueckbuchung wird nicht ausgezahlt — der Betrag
  // ist zu dem Zeitpunkt bereits vom Plattform-Saldo eingezogen.
  if (contract.dispute_state === "open") {
    return new Response(
      JSON.stringify({ error: "Zu diesem Auftrag läuft eine Zahlungsrückbuchung. Die Auszahlung ist bis zur Klärung ausgesetzt." }),
      { status: 409, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  const { data: providerProfile, error: profileError } = await supabase
    .from("provider_profiles")
    .select("stripe_account_id")
    .eq("id", contract.provider_id)
    .single();

  if (profileError || !providerProfile?.stripe_account_id) {
    return new Response(JSON.stringify({ error: "Provider Stripe account not found" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  let transfer: Stripe.Transfer;
  try {
    transfer = await stripe.transfers.create(
      {
        amount: Math.round(contract.provider_payout * 100),
        currency: "eur",
        destination: providerProfile.stripe_account_id,
        transfer_group: contract_id,
      },
      { idempotencyKey: `release-escrow-${contract_id}` },
    );
  } catch (err) {
    console.error("Stripe transfers.create failed:", err);
    return new Response(JSON.stringify({ error: "Payment provider error" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const now = new Date().toISOString();

  // Compare-and-Swap statt blindem Update: nur die Anfrage, die
  // `escrow_released_at` tatsaechlich von leer auf gesetzt dreht, hat die
  // Freigabe fuer sich beansprucht.
  //
  // Vorher war das ein bedingungsloses Update. Die Guards oben sind
  // Read-then-Act: zwei gleichzeitige Anfragen kommen beide durch. Der
  // Idempotency-Key schuetzt den Stripe-Transfer, aber NICHT den
  // PStTG-Jahreszaehler — der stieg zweimal fuer eine Auszahlung. Zu hoch
  // gezaehlt heisst: der Anbieter wird dem BZSt mit einer Verguetung gemeldet,
  // die er nie erhalten hat (§ 3 Abs. 5 PStTG). Migration 0620 hat denselben
  // Fehler in die andere Richtung beseitigt.
  const { data: beansprucht, error: contractUpdateError } = await supabase
    .from("contracts")
    .update({
      escrow_released_at: now,
      status: "completed",
      completed_at: now,
    })
    .eq("id", contract_id)
    .is("escrow_released_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (contractUpdateError) {
    console.error("Failed to update contract:", contractUpdateError);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (!beansprucht) {
    // Eine gleichzeitige Anfrage war schneller. Der Transfer ist durch den
    // Idempotency-Key derselbe, also ist kein Geld doppelt geflossen — aber
    // gezaehlt und benachrichtigt wird nur einmal.
    console.warn(`Escrow-Freigabe bereits durch eine gleichzeitige Anfrage erledigt: contract_id=${contract_id}`);
    return new Response(JSON.stringify({ success: true, transfer_id: transfer.id }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const { error: jobUpdateError } = await supabase
    .from("jobs")
    .update({ status: "completed", completed_at: now })
    .eq("id", contract.job_id);

  if (jobUpdateError) {
    console.error("Failed to update job:", jobUpdateError);
  }

  // PStTG compliance: Jahresstand des Anbieters fortschreiben.
  //
  // Das lief früher hier als Lesen-Rechnen-Schreiben (`newCount = baseCount + 1`
  // über zwei Roundtrips). Werden zwei verschiedene Verträge gleichzeitig
  // freigegeben, lesen beide denselben Ausgangswert und schreiben denselben
  // Endwert — eine Transaktion geht verloren. Zu niedrig gezählt heisst: ein
  // Anbieter, der ans BZSt gemeldet werden müsste, wird es womöglich nicht,
  // und die Meldepflicht trifft die Plattform (§ 13 PStTG).
  //
  // Jahreswechsel, Hochzählen, Schwellenprüfung und Sperre passieren jetzt in
  // EINER atomaren Anweisung in pstg_record_transaction (Migration 0610).
  const { error: pstgError } = await supabase.rpc("pstg_record_transaction", {
    p_provider_id: contract.provider_id,
    p_payout: Number(contract.provider_payout),
  });

  if (pstgError) {
    // Die Auszahlung ist zu diesem Zeitpunkt bereits erfolgt — ein Fehler hier
    // darf sie nicht zurückrollen, muss aber sichtbar sein: der Jahresstand
    // wäre dann zu niedrig und die DAC7-Meldung unvollständig.
    console.error("PStTG counter update failed:", pstgError);
  }

  // Notify provider of payout
  const [providerTokens, customerTokens] = await Promise.all([
    getPushToken(contract.provider_id),
    getPushToken(contract.customer_id),
  ]);
  const { data: job } = await supabase.from("jobs").select("title").eq("id", contract.job_id).single<{ title: string }>();
  const jobTitle = job?.title ?? "Auftrag";
  await Promise.all([
    sendPush(providerTokens, "Zahlung erhalten", `€${contract.provider_payout.toFixed(2)} für „${jobTitle}" wurden ausgezahlt.`, { screen: "/(provider)/auftraege" }),
    sendPush(customerTokens, "Auftrag abgeschlossen", `„${jobTitle}" ist abgeschlossen. Bewertung jetzt abgeben?`, { screen: "/(tabs)/auftraege" }),
  ]);

  return new Response(JSON.stringify({ success: true, transfer_id: transfer.id }), {
    status: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
