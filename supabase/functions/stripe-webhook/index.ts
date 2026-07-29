// deploy-touch 2026-07-13: GitHub-Integration deployt nur geänderte Functions — dieser Kommentar stößt den Erst-Deploy aller Functions an.
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Service role client bypasses RLS and the guard trigger that blocks
// client-side writes to stripe_onboarded (ADR-0004 C-1 / migration 005).
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});
// Deno's Web Crypto only exposes the async subtle API, so the sync
// constructEvent() throws on Supabase Edge Runtime. Must use the async variant.
const cryptoProvider = Stripe.createSubtleCryptoProvider();

async function sendPush(tokens: string[], title: string, body: string, data: Record<string, string> = {}) {
  if (!tokens.length) return;
  const messages = tokens.map((to) => ({ to, title, body, data, sound: "default" }));
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(messages),
  }).catch((e) => console.warn("Push delivery error:", e));
}

async function getPushToken(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from("profiles")
    .select("push_token")
    .eq("id", userId)
    .single<{ push_token: string | null }>();
  return data?.push_token ? [data.push_token] : [];
}

serve(async (req: Request) => {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
  const body = await req.text();

  // Verify webhook signature before processing anything.
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature ?? "",
      webhookSecret,
      undefined,
      cryptoProvider,
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      // ── account.updated ──────────────────────────────────────────────────
      // The only permitted write path for stripe_onboarded (ADR-0004 C-1).
      // Both charges_enabled AND payouts_enabled must be true before we
      // consider a Connect account fully operational.
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        if (account.charges_enabled && account.payouts_enabled) {
          const { error } = await supabase
            .from("provider_profiles")
            .update({ stripe_onboarded: true })
            .eq("stripe_account_id", account.id);
          if (error) throw error;
          console.log(`Provider onboarded: stripe_account_id=${account.id}`);
        } else {
          // Log partial state changes for observability without mutating the row.
          console.log(
            `account.updated received but not fully enabled: ` +
              `stripe_account_id=${account.id} ` +
              `charges_enabled=${account.charges_enabled} ` +
              `payouts_enabled=${account.payouts_enabled}`,
          );
        }
        break;
      }

      // ── payment_intent.succeeded ─────────────────────────────────────────
      // Records escrow capture time on the matching contract row.
      // contract_id is stored in the PaymentIntent metadata at creation time.
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const contractId = pi.metadata?.contract_id;
        if (!contractId) {
          console.warn(
            `payment_intent.succeeded missing contract_id metadata: pi=${pi.id}`,
          );
          break;
        }
        // Transition contract pending → active on successful escrow capture.
        // Without this, release-escrow and cancel-contract (both require status='active')
        // can never run — money would be captured but never releasable or refundable.
        //
        // Der Übergang ist bewusst ein Compare-and-Swap: nur aus 'pending' und
        // nur solange escrow_captured_at leer ist. Stripe stellt dasselbe Event
        // ausdrücklich mehrfach zu und wiederholt bis zu drei Tage lang, wenn
        // wir je 500 antworten. Ohne die Bedingungen setzte eine solche zweite
        // Zustellung den Vertrag bedingungslos zurück auf 'active' — auch einen
        // längst stornierten. cancel-contract hat dann bereits erstattet, aber
        // escrow_released_at ist noch leer, also passieren ALLE drei
        // Vorbedingungen von release-escrow und wir überweisen dem Anbieter
        // Geld, das der Kunde schon zurückbekommen hat. Zusätzlich stempelte
        // jede Zustellung einen neuen escrow_captured_at-Zeitstempel und legte
        // eine weitere "Zahlung hinterlegt"-Systemnachricht in den Chat.
        const { data: contract, error } = await supabase
          .from("contracts")
          .update({ escrow_captured_at: new Date().toISOString(), status: "active" })
          .eq("id", contractId)
          .eq("status", "pending")
          .is("escrow_captured_at", null)
          .select("job_id, provider_id, customer_id, jobs(title)")
          .maybeSingle<{ job_id: string; provider_id: string; customer_id: string; jobs: { title: string } | null }>();
        if (error) throw error;
        if (!contract) {
          // Keine Zeile getroffen. Das sind ZWEI grundverschiedene Fälle, und
          // sie hier gleich zu behandeln war der Fehler: eine harmlose
          // Doppelzustellung sieht identisch aus wie Geld, das nach einer
          // Stornierung eingezogen wurde.
          const { data: existing } = await supabase
            .from("contracts")
            .select("status, escrow_captured_at, stripe_payment_intent, customer_total")
            .eq("id", contractId)
            .maybeSingle<{
              status: string;
              escrow_captured_at: string | null;
              stripe_payment_intent: string | null;
              customer_total: number;
            }>();

          if (existing?.status === "cancelled" && !existing.escrow_captured_at) {
            // Der Vertrag wurde storniert, bevor wir von der Zahlung wussten —
            // cancel-contract hat daher nicht erstattet. Das Geld liegt jetzt
            // beim Kunden abgebucht und bei uns im Guthaben. Voll erstatten;
            // die Stornoquote greift hier nicht, weil zum Zeitpunkt des Stornos
            // aus Sicht beider Seiten noch keine Zahlung vorlag.
            console.error(
              `Zahlung nach Stornierung eingegangen — erstatte vollständig: ` +
                `contract_id=${contractId} pi=${pi.id}`,
            );
            try {
              await stripe.refunds.create(
                { payment_intent: pi.id, reason: "requested_by_customer" },
                { idempotencyKey: `late-capture-refund-${contractId}` },
              );
            } catch (err) {
              // 500 → Stripe wiederholt. Erst wenn die Erstattung durch ist,
              // darf dieser Event als erledigt gelten.
              console.error("Erstattung nach Stornierung fehlgeschlagen:", err);
              return new Response("Refund failed", { status: 500 });
            }
            break;
          }

          if (existing?.stripe_payment_intent && existing.stripe_payment_intent !== pi.id) {
            // Zweite echte Zahlung auf denselben Vertrag, nicht dieselbe zweimal
            // zugestellt: der Kunde ist doppelt belastet. Kein Automatismus —
            // welcher Intent erstattet gehört, ist nicht eindeutig entscheidbar.
            console.error(
              `Zweiter PaymentIntent auf denselben Vertrag — mögliche Doppelbelastung, manuell prüfen: ` +
                `contract_id=${contractId} pi=${pi.id} vermerkt=${existing.stripe_payment_intent}`,
            );
            break;
          }

          // Echte Doppelzustellung desselben Events. 200 antworten, damit
          // Stripe aufhört zu wiederholen, keine Folgewirkung auslösen.
          console.log(
            `payment_intent.succeeded erneut zugestellt, bereits verarbeitet: ` +
              `contract_id=${contractId} pi=${pi.id} status=${existing?.status ?? "unbekannt"}`,
          );
          break;
        }
        console.log(`Escrow captured for contract: contract_id=${contractId} pi=${pi.id}`);
        // Notify provider that payment is secured and work can begin
        if (contract?.provider_id) {
          const tokens = await getPushToken(contract.provider_id);
          const jobTitle = contract.jobs?.title ?? "Auftrag";
          await sendPush(tokens, "Zahlung gesichert", `Escrow für „${jobTitle}" hinterlegt — Arbeit kann beginnen.`, { screen: "/(provider)/auftraege" });
          // System-Nachricht in den (job, provider)-Thread: Zahlung ist im Escrow.
          await supabase.from("messages").insert({
            job_id: contract.job_id,
            sender_id: contract.customer_id,
            sender_role: "customer",
            body: "Zahlung hinterlegt — sicher verwahrt bis zum Abschluss (Escrow).",
            provider_id: contract.provider_id,
            type: "system",
          });
        }
        break;
      }

      // ── payment_intent.payment_failed ────────────────────────────────────
      // No database mutation needed yet — log the failure for ops visibility.
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const contractId = pi.metadata?.contract_id ?? "unknown";
        console.warn(
          `Payment failed: pi=${pi.id} contract_id=${contractId} ` +
            `reason="${pi.last_payment_error?.message ?? "n/a"}"`,
        );
        break;
      }

      // ── charge.refunded ──────────────────────────────────────────────────
      // Support-Erstattung aus dem Stripe-Dashboard oder Teilerstattung. Ohne
      // diesen Zweig blieb der Vorgang in der Datenbank unsichtbar: status
      // 'completed', alle Betraege unveraendert, kein Hinweis darauf, dass Geld
      // zurueckgeflossen ist (Migration 0630).
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const piId = typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id;
        if (!piId) {
          console.warn(`charge.refunded ohne payment_intent: charge=${charge.id}`);
          break;
        }
        // `amount_refunded` ist KUMULIERT — Setzen (nicht Addieren) ist damit
        // idempotent gegen Doppelzustellung und deckt Teilerstattungen ab.
        const refundedEur = Math.round(charge.amount_refunded) / 100;

        // Die Bearbeitungsgebuehr des urspruenglichen Charge behaelt Stripe auch
        // bei voller Erstattung. Sie steht nur in der Balance-Transaction und
        // ist im Event nicht mit ausgeliefert — ein Fehlschlag hier darf die
        // Verbuchung der Erstattung nicht verhindern.
        let stripeFeeLost = 0;
        const btId = typeof charge.balance_transaction === "string"
          ? charge.balance_transaction
          : charge.balance_transaction?.id;
        if (btId) {
          try {
            const bt = await stripe.balanceTransactions.retrieve(btId);
            stripeFeeLost = Math.round(bt.fee) / 100;
          } catch (err) {
            console.warn(`Balance-Transaction nicht lesbar, Gebuehr nicht verbucht: bt=${btId}`, err);
          }
        }

        // `refunded_at` bewusst nur beim ERSTEN Mal setzen: Stripe wiederholt bis
        // zu drei Tage lang, und faellt eine Wiederholung ueber den
        // Jahreswechsel, laege das Erstattungsdatum sonst im falschen
        // Geschaeftsjahr.
        const { data: bestehend } = await supabase
          .from("contracts")
          .select("refunded_at")
          .eq("stripe_payment_intent", piId)
          .maybeSingle<{ refunded_at: string | null }>();
        const refundZeitpunkt = bestehend?.refunded_at
          ?? (charge.created ? new Date(charge.created * 1000).toISOString() : new Date().toISOString());

        const { data: updated, error: refundErr } = await supabase
          .from("contracts")
          .update({
            customer_refunded_amount: refundedEur,
            refunded_at: refundZeitpunkt,
            stripe_fee_lost: stripeFeeLost,
          })
          .eq("stripe_payment_intent", piId)
          .select("id, status, escrow_released_at, provider_id, provider_payout")
          .maybeSingle<{
            id: string; status: string; escrow_released_at: string | null;
            provider_id: string; provider_payout: number;
          }>();
        if (refundErr) throw refundErr;
        if (!updated) {
          // Fehler-Ebene, nicht Warnung: der bekannte Fall dahinter ist ein
          // ZWEITER PaymentIntent auf denselben Vertrag (contracts speichert nur
          // den letzten). Dann findet die Erstattung des ersten keinen Vertrag —
          // und ein Geldvorgang bliebe wieder unsichtbar, also genau das, was
          // dieser Zweig verhindern soll. Gehoert in den Alarmkanal.
          console.error(`charge.refunded ohne zugehoerigen Vertrag — manuell pruefen: pi=${piId} charge=${charge.id}`);
          break;
        }
        if (updated.escrow_released_at) {
          // Der Anbieter hat sein Geld bereits erhalten, und es gibt keine
          // Rueckabwicklung (kein transfers.createReversal im Code). Die
          // Erstattung geht damit zu Lasten von Werkant. Das ist ein echter
          // Verlust und keine Routine — deshalb Fehler-Ebene.
          console.error(
            `Erstattung NACH Auszahlung — Betrag geht zu Lasten von Werkant, ` +
              `Rueckholung nur manuell: contract_id=${updated.id} ` +
              `erstattet=${refundedEur} an_anbieter_ausgezahlt=${updated.provider_payout} ` +
              `provider=${updated.provider_id}`,
          );
        } else {
          console.log(`Erstattung vor Auszahlung verbucht: contract_id=${updated.id} betrag=${refundedEur}`);
        }
        break;
      }

      // ── charge.dispute.* ─────────────────────────────────────────────────
      // Rueckbuchung durch die Bank des Kunden. Stripe zieht den Betrag
      // sofort ein; gewonnen wird er zurueckgebucht. Wir halten nur den
      // Zustand fest — eine automatische Reaktion waere hier gefaehrlich.
      case "charge.dispute.created":
      case "charge.dispute.closed": {
        const dispute = event.data.object as Stripe.Dispute;
        const piId = typeof dispute.payment_intent === "string"
          ? dispute.payment_intent
          : dispute.payment_intent?.id;
        if (!piId) {
          console.warn(`charge.dispute ohne payment_intent: dispute=${dispute.id}`);
          break;
        }
        // Nur `won` und `lost` sind echte Ausgaenge. `warning_closed` (eine
        // Fruehwarnung ist folgenlos ausgelaufen) und `charge_refunded`
        // (erstattet, um die Sache zu beenden — der Verlust steht schon in
        // customer_refunded_amount) als 'lost' zu verbuchen treibt die
        // ausgewiesene Rueckbuchungsquote nach oben. Stripe nimmt genau die ab
        // 0,75 % zum Anlass fuer Reserven oder eine Kontosperrung.
        const state = event.type === "charge.dispute.created"
          ? "open"
          : dispute.status === "won"
            ? "won"
            : dispute.status === "lost"
              ? "lost"
              : "closed_other";

        // Die Dispute-Fee steht direkt im Event (anders als bei Refunds).
        const disputeFee = (dispute.balance_transactions ?? [])
          .reduce((summe: number, bt: Stripe.BalanceTransaction) => summe + (bt.fee ?? 0), 0);

        const { data: updated, error: dErr } = await supabase
          .from("contracts")
          .update({
            dispute_state: state,
            ...(disputeFee > 0 ? { dispute_fee: Math.round(disputeFee) / 100 } : {}),
          })
          .eq("stripe_payment_intent", piId)
          .select("id, escrow_released_at")
          .maybeSingle<{ id: string; escrow_released_at: string | null }>();
        if (dErr) throw dErr;
        if (!updated) {
          console.warn(`charge.dispute ohne zugehoerigen Vertrag: pi=${piId}`);
          break;
        }
        const meldung =
          `Rueckbuchung ${state} (stripe-status=${dispute.status}): contract_id=${updated.id} ` +
          `dispute=${dispute.id} betrag=${Math.round(dispute.amount) / 100} ` +
          `gebuehr=${Math.round(disputeFee) / 100} ` +
          `bereits_ausgezahlt=${updated.escrow_released_at ? "ja" : "nein"}`;
        // 'closed_other' ist der folgenlose Ausgang — der gehoert nicht in den
        // Alarmkanal, sonst stumpft er ab.
        if (state === "closed_other") console.log(meldung);
        else console.error(meldung);
        break;
      }

      // ── radar.early_fraud_warning.created ────────────────────────────────
      // Das Kartennetz meldet, dass diese Zahlung mit hoher Wahrscheinlichkeit
      // als Betrug zurueckgebucht wird. Das ist der einzige Punkt im gesamten
      // Geldpfad, an dem sich ein Chargeback noch abwenden laesst: wer jetzt
      // von sich aus erstattet, zahlt zwar den Betrag zurueck, spart aber die
      // Dispute-Fee und — wichtiger — den Zaehler auf der Rueckbuchungsquote.
      // Stripe nimmt die ab 0,75 % zum Anlass fuer Reserven oder Kontosperrung.
      //
      // BEWUSST NICHT STANDARDMAESSIG AUTOMATISCH: eine Fruehwarnung ist eine
      // Wahrscheinlichkeitsaussage, keine Feststellung. Automatisch zu
      // erstatten hiesse, einem womoeglich ehrlichen Kunden unaufgefordert den
      // Auftrag zu stornieren und dem Anbieter die Arbeit zu entziehen — eine
      // Geldbewegung ohne menschliche Pruefung. Diese Entscheidung gehoert dem
      // Founder, nicht diesem Code.
      //
      // Der Mechanismus ist gebaut und wird durch EIN Secret scharf geschaltet:
      //   STRIPE_AUTO_REFUND_ON_FRAUD_WARNING=true
      // Solange es fehlt, wird die Warnung nur protokolliert und vermerkt —
      // mit allen Zahlen, die fuer eine Entscheidung von Hand noetig sind.
      case "radar.early_fraud_warning.created": {
        const efw = event.data.object as { charge?: string | { id: string }; payment_intent?: string | { id: string }; fraud_type?: string };
        const piId = typeof efw.payment_intent === "string" ? efw.payment_intent : efw.payment_intent?.id;
        const chargeId = typeof efw.charge === "string" ? efw.charge : efw.charge?.id;
        if (!piId) {
          console.error(`Fruehwarnung ohne payment_intent — manuell pruefen: charge=${chargeId ?? "?"}`);
          break;
        }

        const { data: c, error: cErr } = await supabase
          .from("contracts")
          .select("id, status, escrow_released_at, customer_total, provider_payout, customer_refunded_amount, dispute_state")
          .eq("stripe_payment_intent", piId)
          .maybeSingle<{
            id: string; status: string; escrow_released_at: string | null;
            customer_total: number; provider_payout: number;
            customer_refunded_amount: number; dispute_state: string | null;
          }>();
        if (cErr) throw cErr;
        if (!c) {
          console.error(`Fruehwarnung ohne zugehoerigen Vertrag — manuell pruefen: pi=${piId}`);
          break;
        }

        const autoRefund = Deno.env.get("STRIPE_AUTO_REFUND_ON_FRAUD_WARNING") === "true";
        const bereitsErstattet = Number(c.customer_refunded_amount) > 0;
        const schonInRueckbuchung = c.dispute_state === "open" || c.dispute_state === "lost";

        let aktion: "erstattet" | "offen" | "zu_spaet" = "offen";
        if (schonInRueckbuchung) {
          // Die Rueckbuchung laeuft bereits — jetzt zu erstatten kostet den
          // Betrag doppelt und wendet nichts mehr ab.
          aktion = "zu_spaet";
        } else if (bereitsErstattet) {
          aktion = "erstattet";
        } else if (autoRefund) {
          try {
            await stripe.refunds.create(
              { payment_intent: piId, reason: "fraudulent" },
              { idempotencyKey: `fraud-warning-refund-${c.id}` },
            );
            aktion = "erstattet";
          } catch (err) {
            console.error(`Proaktive Erstattung nach Fruehwarnung fehlgeschlagen: contract_id=${c.id}`, err);
          }
        }

        await supabase
          .from("contracts")
          .update({ fraud_warning_at: new Date().toISOString(), fraud_warning_action: aktion })
          .eq("id", c.id);

        console.error(
          `Betrugs-Fruehwarnung (${efw.fraud_type ?? "unbekannt"}): contract_id=${c.id} ` +
            `aktion=${aktion} automatik=${autoRefund ? "an" : "aus"} ` +
            `betrag=${c.customer_total} an_anbieter_ausgezahlt=${c.escrow_released_at ? c.provider_payout : 0} ` +
            (aktion === "offen"
              ? "— OHNE Erstattung folgt voraussichtlich ein Chargeback samt Gebuehr; " +
                "Erstattung von Hand im Stripe-Dashboard wendet das ab."
              : ""),
        );
        break;
      }

      // ── charge.refund.updated ────────────────────────────────────────────
      // Eine Erstattung kann nachtraeglich fehlschlagen (Bank weist zurueck).
      // Ohne diesen Zweig bliebe customer_refunded_amount stehen, obwohl das
      // Geld wieder bei Werkant liegt.
      case "charge.refund.updated": {
        const refund = event.data.object as Stripe.Refund;
        if (refund.status !== "failed" && refund.status !== "canceled") break;
        const piId = typeof refund.payment_intent === "string"
          ? refund.payment_intent
          : refund.payment_intent?.id;
        if (!piId) break;

        // Nicht schaetzen: den kumulierten Stand direkt bei Stripe nachfragen.
        let stand = 0;
        try {
          const pi = await stripe.paymentIntents.retrieve(piId, { expand: ["latest_charge"] });
          const ch = pi.latest_charge as Stripe.Charge | null;
          stand = Math.round(ch?.amount_refunded ?? 0) / 100;
        } catch (err) {
          console.error(`Erstattungsstand nach Fehlschlag nicht abrufbar: pi=${piId}`, err);
          break;
        }

        const { data: korrigiert } = await supabase
          .from("contracts")
          .update({ customer_refunded_amount: stand })
          .eq("stripe_payment_intent", piId)
          .select("id")
          .maybeSingle<{ id: string }>();
        console.error(
          `Erstattung ${refund.status} — Stand korrigiert auf ${stand}: ` +
            `contract_id=${korrigiert?.id ?? "unbekannt"} refund=${refund.id}`,
        );
        break;
      }

      // ── charge.dispute.funds_withdrawn / funds_reinstated ────────────────
      // Die tatsaechlichen Cash-Bewegungen. created/closed sind nur
      // Statusmeldungen — ohne diese beiden laesst sich der Bankauszug nicht
      // gegen die eigene Buchfuehrung abgleichen.
      case "charge.dispute.funds_withdrawn":
      case "charge.dispute.funds_reinstated": {
        const dispute = event.data.object as Stripe.Dispute;
        const piId = typeof dispute.payment_intent === "string"
          ? dispute.payment_intent
          : dispute.payment_intent?.id;
        if (!piId) break;
        const abgezogen = event.type === "charge.dispute.funds_withdrawn";
        const { data: c } = await supabase
          .from("contracts")
          .update({ dispute_funds_withdrawn: abgezogen })
          .eq("stripe_payment_intent", piId)
          .select("id")
          .maybeSingle<{ id: string }>();
        console.error(
          `Rueckbuchung: Betrag ${abgezogen ? "vom Plattform-Saldo eingezogen" : "wieder gutgeschrieben"} ` +
            `(${Math.round(dispute.amount) / 100}): contract_id=${c?.id ?? "unbekannt"} dispute=${dispute.id}`,
        );
        break;
      }

      // ── customer.subscription.* ──────────────────────────────────────────
      // Keeps pro_subscriptions in sync with Stripe Billing.
      // stripe_sub_id is ONLY written here (ADR-0004).
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        // Resolve provider_id via stripe_customer_id stored in profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", sub.customer as string)
          .maybeSingle<{ id: string }>();
        if (!profile?.id) {
          console.warn(`subscription event: no profile for customer ${sub.customer}`);
          break;
        }
        const periodEnd = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null;
        const stripeStatus = sub.status; // trialing | active | past_due | canceled | etc.
        const mappedStatus =
          stripeStatus === "trialing"              ? "trialing"          :
          stripeStatus === "active"                ? "active"            :
          stripeStatus === "canceled"              ? "cancelled"         :
          sub.cancel_at_period_end                 ? "cancel_scheduled"  : "active";

        await supabase
          .from("pro_subscriptions")
          .upsert({
            provider_id:  profile.id,
            stripe_sub_id: sub.id,
            status:        mappedStatus,
            period_start:  sub.current_period_start
              ? new Date(sub.current_period_start * 1000).toISOString()
              : null,
            period_end:    periodEnd,
            trial_used:    sub.status === "trialing" || (sub as any).trial_end !== null,
            updated_at:    new Date().toISOString(),
          }, { onConflict: "provider_id" });

        // Mirror is_pro on provider_profiles for fast reads
        await supabase
          .from("provider_profiles")
          .update({
            is_pro:         mappedStatus === "active" || mappedStatus === "trialing",
            pro_expires_at: periodEnd,
          })
          .eq("id", profile.id);

        console.log(`Pro subscription ${event.type}: provider=${profile.id} status=${mappedStatus}`);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", sub.customer as string)
          .maybeSingle<{ id: string }>();
        if (!profile?.id) break;

        await supabase
          .from("pro_subscriptions")
          .update({ status: "cancelled", stripe_sub_id: sub.id, updated_at: new Date().toISOString() })
          .eq("provider_id", profile.id);

        await supabase
          .from("provider_profiles")
          .update({ is_pro: false, pro_expires_at: null })
          .eq("id", profile.id);

        console.log(`Pro subscription cancelled: provider=${profile.id}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Handler error:", err);
    return new Response("Internal error", { status: 500 });
  }
});
