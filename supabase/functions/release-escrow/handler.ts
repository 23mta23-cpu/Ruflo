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

/** Zeile aus public.payout_operations (Migration 0650). */
export type PayoutOperation = {
  id: string;
  contract_id: string;
  status: "claimed" | "transferred" | "finalized" | "manual_review";
  amount_cents: number;
  currency: string;
  destination_account_id: string;
  idempotency_key: string;
  transfer_group: string;
  stripe_transfer_id: string | null;
  last_error: string | null;
};

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

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

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

  // ── Schritt 1: atomar beanspruchen ───────────────────────────────────────
  // Legt die Auszahlungs-Operation an, BEVOR irgendein externer Aufruf
  // stattfindet. Nur so gibt es nach einem Absturz zwischen Transfer und
  // DB-Schreibvorgang einen Anker, an dem der naechste Versuch erkennt, dass
  // bereits etwas begonnen wurde. Die RPC prueft alle Vertragsbedingungen
  // erneut innerhalb der Transaktion und liefert genau eine Operation je
  // Vertrag (unique auf contract_id).
  const { data: op, error: claimError } = await supabase.rpc("payout_claim", {
    p_contract_id: contract_id,
    p_caller: user.id,
  }).single<PayoutOperation>();

  if (claimError || !op) {
    console.error("payout_claim fehlgeschlagen:", claimError);
    return json({ error: "Auszahlung konnte nicht beansprucht werden" }, 409);
  }
  if (op.status === "manual_review") {
    console.error(`Auszahlung gesperrt, manuelle Pruefung noetig: operation=${op.id} grund=${op.last_error ?? "?"}`);
    return json({ error: "Diese Auszahlung wird derzeit manuell geprüft. Bitte wenden Sie sich an den Support." }, 409);
  }

  // ── Schritt 2: vor jedem Transfer bei Stripe abgleichen ──────────────────
  // Der Kern der Wiederaufnahme. Ist ein Transfer bereits gelaufen, wir haben
  // ihn aber nie vermerkt (Absturz nach dem externen Aufruf), darf hier KEIN
  // zweiter entstehen. Der Stripe-Idempotency-Key allein reicht nicht: Stripe
  // verwirft ihn nach 24 Stunden (ANNAHME, offizielle Semantik, hier nicht
  // verifiziert), und genau danach entstuende der zweite echte Transfer.
  let transfer: { id: string };

  if (op.stripe_transfer_id) {
    // Bereits vermerkt — nichts Neues erzeugen, direkt finalisieren.
    transfer = { id: op.stripe_transfer_id };
  } else {
    let vorhandene: Stripe.Transfer[];
    let mehrdeutig: string | null = null;
    try {
      const liste = await stripe.transfers.list({ transfer_group: op.transfer_group, limit: 100 });
      vorhandene = liste.data ?? [];
      if (liste.has_more === true) {
        // Mehr Eintraege als eine Seite fasst. Ein bestehender Transfer koennte
        // auf einer Folgeseite liegen und beim Abgleich uebersehen werden --
        // das waere eine doppelte Auszahlung. Fail-closed statt blaettern:
        // mehr als 100 Transfers in EINER Gruppe ist selbst schon ein Befund.
        mehrdeutig = `mehr als 100 Transfers in der Gruppe ${op.transfer_group}`;
      }
    } catch (err) {
      // FAIL-CLOSED: ohne belastbaren Abgleich wird nicht ueberwiesen.
      console.error(`Stripe-Abgleich fehlgeschlagen, kein Transfer: operation=${op.id}`, err);
      return json({ error: "Zahlungsdienst nicht erreichbar. Bitte später erneut versuchen." }, 503);
    }

    // transfer_group ist NICHT automatisch eindeutig — Stripe erzwingt das
    // nicht. Die Eindeutigkeit muss hier geprueft werden.
    // `reversed`/`amount_reversed` MUESSEN mitgeprueft werden: ein
    // rueckabgewickelter Transfer (Stripe-Reversal wegen negativem
    // Connect-Saldo, oder eine Ruecknahme von Hand im Dashboard) hat exakt
    // dieselben Werte fuer Betrag, Waehrung und Ziel. Ohne diese Bedingung
    // galte er als "passend", der Vertrag wuerde als bezahlt abgeschlossen --
    // und der Anbieter haette nichts bekommen. (Befund des
    // Architektur-Reviews.)
    const passend = vorhandene.filter((t) =>
      t.amount === op.amount_cents &&
      t.currency === op.currency &&
      (typeof t.destination === "string" ? t.destination : t.destination?.id) === op.destination_account_id &&
      t.reversed !== true &&
      (t.amount_reversed ?? 0) === 0
    );
    const abweichend = vorhandene.filter((t) => !passend.includes(t));

    if (passend.length > 1 || abweichend.length > 0) {
      mehrdeutig = `${passend.length} passend, ${abweichend.length} abweichend`;
    }
    if (mehrdeutig) {
      // Mehrere Transfers oder widerspruechliche Daten in derselben Gruppe.
      // Kein neuer Transfer, kein Rateschluss — sperren und sichtbar melden.
      // Fehlerpruefung ist hier wesentlich: schlaegt genau dieser Schreibvorgang
      // fehl, bliebe die Operation auf 'claimed' stehen. Der Kunde versuchte es
      // erneut, liefe in dieselbe Mehrdeutigkeit, und es entstuende NIE ein
      // Datensatz, den der Support finden koennte. (Befund des
      // Architektur-Reviews.)
      const { error: sperrError } = await supabase.from("payout_operations").update({
        status: "manual_review",
        last_error: `Abgleich unklar: ${mehrdeutig}`,
        updated_at: new Date().toISOString(),
      }).eq("id", op.id);
      console.error(
        `Stripe-Abgleich mehrdeutig — KEIN Transfer, manuelle Pruefung: operation=${op.id} ` +
          `grund="${mehrdeutig}" gruppe=${op.transfer_group}`,
      );
      if (sperrError) {
        console.error(`Sperre konnte NICHT gespeichert werden — Operation bleibt offen: operation=${op.id}`, sperrError);
        return json({ error: "Auszahlung blockiert, Vermerk fehlgeschlagen. Bitte den Support kontaktieren." }, 500);
      }
      return json({ error: "Diese Auszahlung muss manuell geprüft werden. Der Support wurde informiert." }, 409);
    }

    if (passend.length === 1) {
      // Genau ein vollstaendig passender Transfer existiert schon.
      console.warn(`Bestehender Transfer wiedergefunden, kein neuer erzeugt: operation=${op.id} transfer=${passend[0].id}`);
      transfer = { id: passend[0].id };
    } else {
      // Kein passender Transfer — also wirklich neu ueberweisen.
      //
      // ZUVOR der autoritative Kontostatus. Der lokale Cache
      // `stripe_onboarded` reicht dafuer nicht: er wird nur von
      // account.updated gepflegt und kann veraltet sein.
      //
      // Verlangt wird ausschliesslich `payouts_enabled`. Begruendung: das
      // Connect-Modell hier ist "Plattform belastet, danach Transfer" — der
      // Kunde zahlt auf das Werkant-Konto (create-payment-intent setzt weder
      // on_behalf_of noch transfer_data), erst danach geht ein separater
      // Transfer an das verbundene Konto. Das verbundene Konto stellt selbst
      // nie eine Belastung; `charges_enabled` beschreibt genau diese Faehigkeit
      // und ist fuer den Empfang eines Transfers ohne Belang. ANNAHME, mit
      // Test-Doubles geprueft, nicht gegen echtes Stripe verifiziert.
      let konto: Stripe.Account;
      try {
        konto = await stripe.accounts.retrieve(op.destination_account_id);
      } catch (err) {
        console.error(`Connect-Kontostatus nicht abrufbar, kein Transfer: acct=${op.destination_account_id}`, err);
        return json({ error: "Kontostatus konnte nicht geprüft werden. Bitte später erneut versuchen." }, 503);
      }
      if (konto.payouts_enabled !== true) {
        // Kein Transfer — aber der Vertrag bleibt unberuehrt und stornierbar.
        console.error(`Connect-Konto nicht auszahlungsfaehig, kein Transfer: acct=${op.destination_account_id}`);
        return json({ error: "Das Konto des Anbieters ist derzeit nicht auszahlungsfähig. Die Auszahlung bleibt offen." }, 409);
      }

      try {
        const neu = await stripe.transfers.create(
          {
            amount: op.amount_cents,
            currency: op.currency,
            destination: op.destination_account_id,
            transfer_group: op.transfer_group,
            // Keine personenbezogenen Daten — nur die beiden Kennungen, die
            // eine spaetere Zuordnung im Stripe-Dashboard ermoeglichen.
            metadata: { payout_operation_id: op.id, contract_id },
          },
          { idempotencyKey: op.idempotency_key },
        );
        transfer = { id: neu.id };
      } catch (err) {
        console.error("Stripe transfers.create failed:", err);
        return json({ error: "Payment provider error" }, 500);
      }
    }

    // ── Schritt 3a: Transfer-ID festhalten ─────────────────────────────────
    // Schlaegt das fehl, ist das Geld weg und die Zeile leer — genau der
    // Zustand, fuer den Schritt 2 gebaut ist: der naechste Versuch findet den
    // Transfer ueber die transfer_group wieder.
    // `.neq("status","manual_review")`: hat eine gleichzeitige Anfrage die
    // Operation zwischenzeitlich gesperrt, darf dieser Schreibvorgang die Sperre
    // NICHT stillschweigend zurueckdrehen -- sonst wuerde eine bei Stripe
    // mehrdeutige Lage doch noch finalisiert. (Befund des Security-Reviews.)
    const { error: merkError } = await supabase.from("payout_operations").update({
      stripe_transfer_id: transfer.id,
      status: "transferred",
      transferred_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", op.id).neq("status", "manual_review");
    if (merkError) {
      console.error(
        `Transfer gelaufen, ID nicht gespeichert — naechster Versuch findet ihn ueber die Gruppe wieder: ` +
          `operation=${op.id} transfer=${transfer.id}`, merkError,
      );
      return json({ error: "Auszahlung angestossen, Abschluss unvollständig. Bitte erneut versuchen." }, 500);
    }
  }

  // ── Schritt 3b: atomar finalisieren ──────────────────────────────────────
  // Operation, Vertrag, Auftrag und PStTG-Jahreszaehler in EINER Transaktion.
  // Der Zaehler steigt ausschliesslich beim ersten Uebergang.
  const { data: finalisiert, error: finalError } = await supabase.rpc("payout_finalize", {
    p_operation_id: op.id,
    p_transfer_id: transfer.id,
  }).single<PayoutOperation>();

  if (finalError || !finalisiert) {
    console.error(`Finalisierung fehlgeschlagen — Transfer ist gelaufen: operation=${op.id} transfer=${transfer.id}`, finalError);
    return json({ error: "Auszahlung angestossen, Abschluss unvollständig. Bitte erneut versuchen." }, 500);
  }
  if (finalisiert.status === "manual_review") {
    console.error(`Finalisierung gesperrt: operation=${op.id} grund=${finalisiert.last_error ?? "?"}`);
    return json({ error: "Diese Auszahlung muss manuell geprüft werden. Der Support wurde informiert." }, 409);
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
