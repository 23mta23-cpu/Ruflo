// Stornierungslogik — ausführbar testbar.
//
// Diese Datei enthält die VOLLSTÄNDIGE Geschäftslogik. `index.ts` erzeugt nur
// noch die realen Abhängigkeiten und delegiert hierher. Produktion und Tests
// importieren dieselbe `handleCancelContract`-Funktion; im Test wird KEINE
// zweite Version dieser Logik implementiert.
//
// Der Inhalt ist eine wortgleiche Übernahme aus index.ts (dort Z. 35–221 vor
// der Extraktion) mit EINER Ausnahme: der inline-`fetch` an den Expo-Push-Dienst
// ist durch den injizierten `sendPush` ersetzt. Ohne das löste jeder Testlauf
// eine echte Netzanfrage aus. Verhalten unverändert — der Aufruf war schon
// vorher mit `.catch(() => {})` abgesichert und nicht fehlerkritisch.
//
// FACHLICHE GRENZE: Die Erstattungsquoten (100 % / 50 % / 0 %), die Stornofristen
// und die Frage, wem das bei einer Null-Erstattung nicht zurückgezahlte Geld
// zusteht, sind NICHT entschieden und hier NICHT verändert. Die Tests halten den
// Ist-Zustand fest, ohne ihn als rechtlich oder geschäftlich bestätigt zu erklären.
import type Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enforceRateLimit, getClientIp } from "../_shared/rateLimit.ts";
import { assertOnlyFields, assertOptionalString, assertUuid, parseJsonObject, validationErrorResponse } from "../_shared/validate.ts";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

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
};

export async function handleCancelContract(
  req: Request,
  deps: Deps,
): Promise<Response> {
  const { supabase, stripe, sendPush } = deps;

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing authorization" }, 401);

  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  const rateLimited = await enforceRateLimit(
    supabase,
    `user:${user.id}:cancel-contract`,
    { limit: 10, windowSeconds: 60 },
    CORS,
  ) ?? await enforceRateLimit(
    supabase,
    `ip:${getClientIp(req)}:cancel-contract`,
    { limit: 30, windowSeconds: 60 },
    CORS,
  );
  if (rateLimited) return rateLimited;

  // ── Input ─────────────────────────────────────────────────────────────────
  let contract_id: string, reason: string;
  try {
    const body = await parseJsonObject(req);
    assertOnlyFields(body, ["contract_id", "reason"]);
    contract_id = assertUuid(body.contract_id, "contract_id");
    reason = assertOptionalString(body.reason, "reason", { maxLength: 500 }) ?? "Keine Angabe";
  } catch (e: unknown) {
    return validationErrorResponse(e, CORS);
  }

  // ── Load contract ─────────────────────────────────────────────────────────
  const { data: contract, error: fetchErr } = await supabase
    .from("contracts")
    .select("id, job_id, customer_id, provider_id, status, stripe_payment_intent, escrow_captured_at, customer_total, jobs(title, scheduled_at)")
    .eq("id", contract_id)
    .single();

  if (fetchErr || !contract) return json({ error: "Vertrag nicht gefunden" }, 404);

  const isCustomer = contract.customer_id === user.id;
  const isProvider = contract.provider_id === user.id;
  if (!isCustomer && !isProvider) return json({ error: "Nicht autorisiert" }, 403);

  if (contract.status !== "active" && contract.status !== "pending") {
    return json({ error: `Stornierung nicht möglich (Status: ${contract.status})` }, 409);
  }

  // ── Refund calculation ────────────────────────────────────────────────────
  // Provider cancels → always 100% refund (provider broke deal).
  // Customer cancels → tiered: >48h=100%, 24–48h=50%, <24h=0%.
  // Keep in sync with lib/cancellationRefund.ts (Deno Edge Functions can't
  // import from lib/, so this is duplicated as plain logic — same values, same source of truth).
  let refundPct: number;
  if (isProvider) {
    refundPct = 1.0;
  } else {
    const scheduledAt = (contract.jobs as any)?.scheduled_at;
    const hoursUntil = scheduledAt
      ? (new Date(scheduledAt).getTime() - Date.now()) / 3_600_000
      : 72;
    refundPct = hoursUntil > 48 ? 1.0 : hoursUntil > 24 ? 0.5 : 0;
  }

  // ── Zahlung, von der die Datenbank nichts weiss ───────────────────────────
  // `escrow_captured_at` wird ausschliesslich vom stripe-webhook gesetzt.
  // Zwischen der Zahlung des Kunden und der Zustellung des Events liegt ein
  // Fenster — bei einer fehlgeschlagenen Zustellung wiederholt Stripe bis zu
  // drei Tage lang. In diesem Fenster steht der Vertrag auf 'pending', und
  // eine Stornierung ist hier ausdruecklich erlaubt (Zeile 81).
  //
  // Ohne den folgenden Block endete das so: der Kunde hat gezahlt, es wird
  // nicht erstattet (weil escrow_captured_at leer ist), der offene
  // PaymentIntent wird nicht storniert, und die spaetere Webhook-Wiederholung
  // trifft die CAS-Bedingung nicht mehr. Ergebnis: echtes Kundengeld im
  // Plattform-Guthaben, ohne jede Spur in der Datenbank.
  //
  // Deshalb wird der wahre Zustand bei Stripe erfragt, statt der eigenen
  // Zeile zu glauben.
  let unrecordedCapture = false;
  if (!contract.escrow_captured_at && contract.stripe_payment_intent) {
    try {
      const pi = await stripe.paymentIntents.retrieve(contract.stripe_payment_intent);
      if (pi.status === "succeeded") {
        // Der Kunde hat bezahlt, nur wussten wir es noch nicht. Ab hier wie
        // ein regulaer erfasster Escrow behandeln (gleiche Erstattungsquote).
        unrecordedCapture = true;
        console.error(
          `Zahlung war erfasst, aber nicht in der DB vermerkt — Storno erstattet regulaer: ` +
            `contract_id=${contract_id} pi=${pi.id}`,
        );
      } else if (pi.status !== "canceled") {
        // Noch nicht abgeschlossen: den Intent schliessen, damit er nach dem
        // Storno nicht doch noch einzieht. 'processing' laesst sich nicht
        // stornieren — dann bleibt es beim Protokolleintrag.
        await stripe.paymentIntents.cancel(contract.stripe_payment_intent)
          .catch((e: unknown) => {
            console.error(`PaymentIntent konnte nicht storniert werden: pi=${contract.stripe_payment_intent}`, e);
          });
      }
    } catch (err) {
      // Stripe nicht erreichbar: lieber abbrechen als blind stornieren und
      // eine moegliche Zahlung im Nichts stehen lassen.
      console.error("PaymentIntent-Abfrage fehlgeschlagen:", err);
      return json({ error: "Zahlungsstatus konnte nicht geprüft werden. Bitte später erneut versuchen." }, 503);
    }
  }

  // ── Stripe refund (if escrow was captured) ────────────────────────────────
  //
  // ABGLEICH VOR DER ERSTATTUNG.
  //
  // Der Handler las bisher NICHT, ob bereits Geld zurueckgeflossen ist -- weder
  // aus der Datenbank noch von Stripe. Der Idempotency-Key schuetzte nur gegen
  // eine Wiederholung DESSELBEN Storno-Aufrufs, und auch das nur 24 Stunden lang.
  //
  // Damit gab es einen echten Doppelerstattungs-Pfad: eine Erstattung aus dem
  // Stripe-Dashboard, eine Support-Erstattung oder die proaktive Erstattung nach
  // einer Betrugs-Fruehwarnung fanden hier nicht statt -- die anschliessende
  // Stornierung erstattete den vollen Quotenbetrag ein ZWEITES Mal. Ebenso nach
  // einem geglueckten Refund mit anschliessend gescheitertem DB-Update: der
  // naechste Versuch kannte den ersten nicht.
  //
  // Dieselbe Loesung wie beim Auszahlungspfad (PR #162): den massgeblichen Stand
  // bei Stripe erfragen und nur die DIFFERENZ erstatten. Die Quote selbst
  // (refundPct) bleibt unveraendert -- das ist eine fachliche Regel und wird
  // hier NICHT angefasst.
  let refundAmount = 0;
  if ((contract.escrow_captured_at || unrecordedCapture) && contract.stripe_payment_intent && refundPct > 0) {
    refundAmount = Math.round(contract.customer_total * refundPct * 100); // cents

    // ALLE PaymentIntents des Vertrags, nicht nur der aktuelle (Migration 0660).
    //
    // ENTSCHEIDUNG, hier notiert und umkehrbar: Hat der Kunde auf einem
    // ÄLTEREN Intent bereits Geld zurückbekommen, hat er es für DIESEN Vertrag
    // bekommen. Es mitzuzählen macht die noch offene Differenz kleiner — die
    // sichere Richtung, weil sie eine Doppelerstattung verhindert. Die Quote
    // selbst (refundPct) bleibt unverändert; nur der bereits zurückgeflossene
    // Betrag wird vollständiger erfasst als vorher.
    //
    // Zählte man alte Intents NICHT mit, erstattete eine Stornierung nach einer
    // Erstattung auf einem ersetzten Intent erneut den vollen Quotenbetrag —
    // genau der Fehler, den der Abgleich beseitigen soll, nur eine Ebene tiefer.
    let intents: string[] = [contract.stripe_payment_intent];
    const { data: historie, error: histErr } = await supabase
      .from("contract_payment_intents")
      .select("payment_intent_id")
      .eq("contract_id", contract_id);
    if (histErr) {
      console.error(`PaymentIntent-Historie nicht lesbar, keine Erstattung: contract_id=${contract_id}`, histErr);
      return json({ error: "Zahlungsstatus konnte nicht geprüft werden. Bitte später erneut versuchen." }, 503);
    }
    if (historie && historie.length > 0) {
      intents = [...new Set(
        (historie as Array<{ payment_intent_id: string }>).map((h) => h.payment_intent_id),
      )];
    }

    let bereitsErstattet = 0;
    try {
      for (const pi of intents) {
      const liste = await stripe.refunds.list({
        payment_intent: pi,
        limit: 100,
      });
      if (liste.has_more === true) {
        // Mehr Erstattungen als eine Seite fasst. Blaettern statt fail-closed
        // hiesse, moeglicherweise eine zu uebersehen und doppelt zu erstatten.
        console.error(`Mehr als 100 Erstattungen auf einem PaymentIntent — manuell pruefen: pi=${pi}`);
        return json({ error: "Erstattungsstand konnte nicht eindeutig geprüft werden. Bitte den Support kontaktieren." }, 409);
      }
      // `failed` und `canceled` haben KEIN Geld bewegt und duerfen nicht als
      // erstattet zaehlen -- sonst bliebe der Kunde ohne sein Geld.
      bereitsErstattet += (liste.data ?? [])
        .filter((rf: Stripe.Refund) => rf.status !== "failed" && rf.status !== "canceled")
        .reduce((summe: number, rf: Stripe.Refund) => summe + (rf.amount ?? 0), 0);
      }
    } catch (err) {
      // FAIL-CLOSED: ohne belastbaren Abgleich wird nicht erstattet und der
      // Vertrag nicht angefasst. Ein stilles 200 waere hier der teure Fehler.
      console.error(`Erstattungsstand nicht abrufbar, keine Erstattung: contract_id=${contract_id}`, err);
      return json({ error: "Zahlungsstatus konnte nicht geprüft werden. Bitte später erneut versuchen." }, 503);
    }

    const nochOffen = refundAmount - bereitsErstattet;
    if (nochOffen <= 0) {
      // Der Kunde hat sein Geld ganz oder mehr als die Quote bereits zurueck.
      // Die Stornierung wird trotzdem sauber abgeschlossen.
      console.warn(
        `Erstattung bereits vorhanden, keine weitere ausgeloest: contract_id=${contract_id} ` +
          `quote=${refundAmount} bereits=${bereitsErstattet}`,
      );
    } else {
      try {
        await stripe.refunds.create({
          payment_intent: contract.stripe_payment_intent,
          amount: nochOffen,
          reason: "requested_by_customer",
        }, {
          // Der Schluessel ist BEWUSST vertragsweit und enthaelt NICHT den
          // Betrag. Zwischenzeitlich stand hier der Differenzbetrag mit drin --
          // das war eine Verschlechterung, gefunden im Security-Review:
          //
          // Kunde und Anbieter haben unterschiedliche Stornoquoten. Stornieren
          // beide gleichzeitig, sehen beide Anfragen den Vertrag noch als aktiv
          // und beide Abgleiche noch 0 EUR erstattet. Mit dem Betrag im
          // Schluessel waeren es ZWEI verschiedene Schluessel, Stripe wuerde
          // nicht deduplizieren, und es floessen 100 % + 50 % zurueck.
          //
          // Vertragsweit gilt: die zweite Anfrage trifft denselben Schluessel
          // mit anderen Parametern, Stripe weist sie ab, der Aufrufer bekommt
          // 500. Das ist die richtige Reihenfolge der Uebel -- eine
          // Fehlermeldung statt 150 % Auszahlung.
          //
          // Ein legitimer zweiter Aufruf mit anderem Betrag kann nicht
          // entstehen: nach einer erfolgreichen Erstattung ergibt der Abgleich
          // beim naechsten Lauf `nochOffen <= 0`, es wird also gar kein
          // create mehr abgesetzt.
          idempotencyKey: `cancel-refund-${contract_id}`,
        });
      } catch (err) {
        console.error("Stripe refund failed:", err);
        return json({ error: "Rückerstattung fehlgeschlagen" }, 500);
      }
    }
  }

  // ── Update contract ───────────────────────────────────────────────────────
  // `escrow_captured_at` wird mitgeschrieben, wenn die Zahlung ueber Stripe
  // nachweislich erfasst war, die Datenbank davon aber nichts wusste
  // (unrecordedCapture). Ohne diesen Vermerk entstand eine DOPPELERSTATTUNG:
  //
  // stripe-webhook/handler.ts:191 erstattet bei einem verspaeteten
  // `payment_intent.succeeded` vollstaendig, wenn `status='cancelled'` UND
  // `escrow_captured_at` leer ist -- unter einem eigenen Idempotency-Key
  // (`late-capture-refund-...`), der mit dem hiesigen nicht dedupliziert.
  // Genau diese Bedingung liess der unrecordedCapture-Zweig bisher stehen,
  // obwohl hier bereits erstattet wurde. Der Kommentar im Webhook
  // ("cancel-contract hat daher nicht erstattet") war damit unzutreffend
  // geworden. (Befund des Architektur-Reviews.)
  const { error: updateErr } = await supabase
    .from("contracts")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason,
      ...(unrecordedCapture ? { escrow_captured_at: new Date().toISOString() } : {}),
    })
    .eq("id", contract_id);

  if (updateErr) return json({ error: "Datenbankfehler beim Stornieren" }, 500);

  // ── Reopen job ────────────────────────────────────────────────────────────
  if (contract.job_id) {
    await supabase
      .from("jobs")
      .update({ status: "open", provider_id: null })
      .eq("id", contract.job_id);
  }

  // ── Push-notify the OTHER party ───────────────────────────────────────────
  const jobTitle = (contract.jobs as any)?.title ?? "Auftrag";
  const notifyUserId = isProvider ? contract.customer_id : contract.provider_id;
  const notifyScreen = isProvider ? "/(tabs)/auftraege" : "/betrieb/auftraege";
  const notifyTitle = isProvider ? "Anbieter hat storniert" : "Auftrag storniert";
  const notifyBody = isProvider
    ? `Ihr Anbieter hat „${jobTitle}" storniert. Sie erhalten eine vollständige Rückerstattung.`
    : `Kunde hat „${jobTitle}" storniert. ${refundPct === 1 ? "Vollständige Rückerstattung." : refundPct === 0.5 ? "50% Rückerstattung." : "Keine Rückerstattung."}`;

  if (notifyUserId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("push_token")
      .eq("id", notifyUserId)
      .single<{ push_token: string | null }>();
    if (profile?.push_token) {
      await sendPush([profile.push_token], notifyTitle, notifyBody, { screen: notifyScreen });
    }
  }

  return json({
    cancelled: true,
    cancelled_by: isProvider ? "provider" : "customer",
    refund_pct: refundPct * 100,
    refund_amount_eur: (refundAmount / 100).toFixed(2),
  });
}
