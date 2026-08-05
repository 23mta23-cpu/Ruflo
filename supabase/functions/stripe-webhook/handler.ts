// Eventverarbeitung des Stripe-Webhooks — ausführbar testbar.
//
// Diese Datei enthält die VOLLSTÄNDIGE Geschäftslogik. `index.ts` erzeugt nur
// noch die realen Abhängigkeiten, prüft die Signatur und delegiert hierher.
// Produktion und Tests importieren dieselbe `handleStripeEvent`-Funktion; im
// Test wird keine zweite Version dieser Logik implementiert.
//
// Der Inhalt von `handleStripeEvent` ab `try {` ist eine WORTGLEICHE Übernahme
// aus index.ts (dort Z. 60–633 vor der Extraktion). Bei der Verschiebung wurde
// keine Bedingung, kein Eventtyp, kein Payload, kein Rückgabecode und kein
// Fehlerpfad geändert.
import type Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

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
};

/**
 * Signaturprüfung — unveränderte Übernahme aus index.ts (Z. 46–58).
 * Wirft NICHT: liefert bei ungültiger Signatur `null`, damit der Aufrufer
 * exakt wie zuvor mit 400 antwortet.
 */
export async function constructStripeEvent(
  stripe: Stripe,
  cryptoProvider: unknown,
  body: string,
  signature: string | null,
  webhookSecret: string,
): Promise<Stripe.Event | null> {
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature ?? "",
      webhookSecret,
      undefined,
      // deno-lint-ignore no-explicit-any
      cryptoProvider as any,
    );
  } catch (err) {
    // EINZIGE nicht-wortgleiche Stelle der Extraktion: statt hier direkt die
    // 400er-Response zu bauen, wird `null` geliefert. index.ts erzeugt daraus
    // dieselbe Antwort (gleicher Status, gleicher Body). Grund: nur so ist die
    // Signaturpruefung testbar, ohne index.ts zu importieren (das ruft serve()
    // beim Laden auf).
    console.error("Webhook signature verification failed:", err);
    return null;
  }
  return event;
}

export async function handleStripeEvent(
  event: Stripe.Event,
  deps: Deps,
): Promise<Response> {
  const { supabase, stripe, sendPush } = deps;

  async function getPushToken(userId: string): Promise<string[]> {
    const { data } = await supabase
      .from("profiles")
      .select("push_token")
      .eq("id", userId)
      .single<{ push_token: string | null }>();
    return data?.push_token ? [data.push_token] : [];
  }

  /**
   * Findet den Vertrag zu einem PaymentIntent — auch zu einem NICHT MEHR
   * AKTUELLEN (Migration 0660).
   *
   * Vorher filterte jeder Zweig direkt auf `contracts.stripe_payment_intent`.
   * Diese Spalte haelt nur den LETZTEN Intent; ein Ereignis zu einem aelteren —
   * eine Erstattung, eine Rueckbuchung, eine Betrugs-Fruehwarnung — fand keine
   * Zeile und hinterliess weder Spur noch Alarm.
   *
   * Rueckgabe `null` heisst wirklich "kein Vertrag", nicht "nur nicht der
   * aktuelle". Der Aufrufer erfaehrt ueber `istAktuell`, ob das Ereignis den
   * aktuellen Intent betrifft — ein alter ist bei Erstattungen der Normalfall
   * und kein Fehler, aber er gehoert protokolliert.
   */
  async function vertragZuIntent(
    piId: string,
  ): Promise<{ id: string; istAktuell: boolean } | null> {
    const { data, error } = await supabase
      .rpc("contract_for_payment_intent", { p_intent_id: piId })
      .maybeSingle<{ contract_id: string; is_current: boolean }>();
    if (error) {
      console.error(`Vertrag zu PaymentIntent nicht aufloesbar: pi=${piId}`, error);
      throw error;
    }
    if (!data) return null;
    if (!data.is_current) {
      console.warn(`Ereignis betrifft einen aelteren PaymentIntent: pi=${piId} contract_id=${data.contract_id}`);
    }
    return { id: data.contract_id, istAktuell: data.is_current };
  }

  try {
    switch (event.type) {
      // ── account.updated ──────────────────────────────────────────────────
      // The only permitted write path for stripe_onboarded (ADR-0004 C-1).
      // Both charges_enabled AND payouts_enabled must be true before we
      // consider a Connect account fully operational.
      case "account.updated": {
        const account = event.data.object as Stripe.Account;

        // `stripe_onboarded` ist als SPIEGEL des Connect-Zustands dokumentiert.
        // Bis hierher folgte der Spiegel nur nach oben: einmal true, immer true.
        // Sperrt Stripe ein Konto nachtraeglich (charges_enabled oder
        // payouts_enabled fallen auf false — Identitaetspruefung ueberfaellig,
        // Risikopruefung, Rueckbuchungsquote), blieb der Anbieter in der App
        // unveraendert als voll onboardet gefuehrt: sichtbar auf der Startseite
        // (app/(tabs)/index.tsx), in der Nachbarschaftsliste und mit dem
        // "verifiziert"-Abzeichen in der Suche (app/suche.tsx).
        //
        // Ein Spiegel, der nur in eine Richtung folgt, ist kein Spiegel.
        // AUTORITATIVER ZUSTAND STATT EVENT-SNAPSHOT.
        //
        // Erst dadurch, dass hier jetzt auch `false` geschrieben wird, entsteht
        // eine neue Fehlermoeglichkeit: Stripe garantiert keine Zustellreihenfolge.
        // Ein verspaetetes ALTES account.updated (Konto damals gesperrt), das nach
        // einem neueren (Konto wieder frei) eintrifft, wuerde einen aktiven
        // Anbieter unsichtbar machen — und zwar dauerhaft, bis Stripe von sich aus
        // das naechste account.updated schickt. Dieselbe Klasse wie der
        // Erstattungsstand-Fehler im Zweig `charge.refunded`, deshalb dieselbe
        // Loesung: den massgeblichen Zustand frisch erfragen.
        let kontoStand: Stripe.Account;
        try {
          kontoStand = await stripe.accounts.retrieve(account.id);
        } catch (err) {
          // Ohne autoritativen Zustand wird NICHT geschrieben. 500 => Stripe
          // wiederholt. Lieber unverarbeitet als falsch gespiegelt.
          console.error(`Connect-Kontostand nicht abrufbar, keine DB-Aenderung: acct=${account.id}`, err);
          return new Response("Account state unavailable", { status: 500 });
        }
        const vollFreigeschaltet = Boolean(kontoStand.charges_enabled && kontoStand.payouts_enabled);

        const { error } = await supabase
          .from("provider_profiles")
          .update({ stripe_onboarded: vollFreigeschaltet })
          .eq("stripe_account_id", account.id);
        if (error) throw error;

        if (vollFreigeschaltet) {
          console.log(`Provider onboarded: stripe_account_id=${account.id}`);
        } else {
          // Fehler-Ebene, nicht Log: ein Anbieter verliert die Auszahlbarkeit.
          // Das ist ein Betriebsereignis, kein Rauschen.
          console.error(
            `Connect-Konto nicht mehr voll freigeschaltet — Anbieter ausgeblendet: ` +
              `stripe_account_id=${account.id} ` +
              `charges_enabled=${kontoStand.charges_enabled} ` +
              `payouts_enabled=${kontoStand.payouts_enabled}`,
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
        // AUTORITATIVER STAND STATT EVENT-SNAPSHOT (Befund P0-2).
        //
        // `charge.amount_refunded` im Event ist ein Snapshot des Zeitpunkts, zu
        // dem das Event ENTSTAND — nicht des Zeitpunkts, zu dem es zugestellt
        // wird. Stripe garantiert keine Zustellreihenfolge und wiederholt bis zu
        // drei Tage lang. Aus dem Snapshet zu schreiben hatte zwei belegte
        // Fehler zur Folge (supabase/tests/stripe-webhook_test.ts, Szenario 9/10):
        //
        //   (a) Zwei Teilerstattungen in umgekehrter Zustellreihenfolge senkten
        //       den verbuchten Stand von 50 auf 30 — Buchhaltung und
        //       DAC7-Meldegrundlage zu niedrig.
        //   (b) Nach einem berechtigten Reset auf 0 durch `charge.refund.updated`
        //       (Bank hat die Erstattung abgewiesen) hob eine verspaetete
        //       Wiederholung des alten Events den Betrag wieder auf 100. Der
        //       Guard in release-escrow (`customer_refunded_amount > 0`) sperrt
        //       daraufhin dauerhaft: Kunde ohne Geld, Anbieter nie auszahlbar.
        //
        // `max(alt, neu)` loest (b) NICHT — 100 ist groesser als die korrekte 0.
        // Deshalb wird der Stand bei Stripe frisch erfragt, genau wie es der
        // Zweig `charge.refund.updated` unten bereits tut.
        const chargeId = charge.id;

        // Schleife = optimistische Nebenlaeufigkeitskontrolle. Ohne sie bliebe
        // eine Schreibinversion moeglich: holen zwei Handler gleichzeitig den
        // autoritativen Stand und schreibt der mit dem AELTEREN Wert zuletzt,
        // stuende wieder der falsche Betrag in der Zeile. Die CAS-Bedingung auf
        // den vorgefundenen Wert laesst das fehlschlagen; der naechste Durchlauf
        // holt den Stand erneut und konvergiert auf die Wahrheit.
        let verbucht = false;
        let vertragFehlt = false;
        let refundedEur = 0;
        for (let versuch = 0; versuch < 3 && !verbucht; versuch++) {
          let autoritativ: Stripe.Charge;
          try {
            autoritativ = await stripe.charges.retrieve(chargeId);
          } catch (err) {
            // Ohne autoritativen Stand wird NICHT geschrieben. 500 => Stripe
            // wiederholt. Ein stilles 200 mit veraltetem Snapshot waere genau
            // der Fehler, den dieser Block beseitigt.
            console.error(`Erstattungsstand nicht abrufbar, keine DB-Aenderung: charge=${chargeId} pi=${piId}`, err);
            return new Response("Refund state unavailable", { status: 500 });
          }
          refundedEur = Math.round(autoritativ.amount_refunded ?? 0) / 100;

          // Die Bearbeitungsgebuehr des urspruenglichen Charge behaelt Stripe auch
          // bei voller Erstattung. Sie steht nur in der Balance-Transaction und
          // ist im Event nicht mit ausgeliefert — ein Fehlschlag hier darf die
          // Verbuchung der Erstattung nicht verhindern.
          let stripeFeeLost = 0;
          const btId = typeof autoritativ.balance_transaction === "string"
            ? autoritativ.balance_transaction
            : autoritativ.balance_transaction?.id;
          if (btId) {
            try {
              const bt = await stripe.balanceTransactions.retrieve(btId);
              stripeFeeLost = Math.round(bt.fee) / 100;
            } catch (err) {
              console.warn(`Balance-Transaction nicht lesbar, Gebuehr nicht verbucht: bt=${btId}`, err);
            }
          }

          const vertrag = await vertragZuIntent(piId);
          if (!vertrag) {
            vertragFehlt = true;
            console.error(`charge.refunded ohne zugehoerigen Vertrag — manuell pruefen: pi=${piId} charge=${chargeId}`);
            break;
          }
          const { data: bestehend } = await supabase
            .from("contracts")
            .select("customer_refunded_amount, refunded_at")
            .eq("id", vertrag.id)
            .maybeSingle<{ customer_refunded_amount: number; refunded_at: string | null }>();
          if (!bestehend) {
            // Kein Vertrag zu diesem PaymentIntent. Wiederholen hilft nicht —
            // 200, sonst wiederholt Stripe drei Tage lang vergeblich.
            vertragFehlt = true;
            console.error(`charge.refunded ohne zugehoerigen Vertrag — manuell pruefen: pi=${piId} charge=${chargeId}`);
            break;
          }

          // Steht autoritativ 0, muessen Zeitpunkt und Gebuehren-Verlust mit
          // zurueck — sonst bliebe ein Vertrag mit Erstattungsdatum und 0 EUR
          // Erstattung stehen (derselbe Abgleichfehler, den 0630 beseitigt hat).
          // Sonst gilt weiter: `refunded_at` nur beim ERSTEN Mal setzen, damit
          // eine Wiederholung ueber den Jahreswechsel das Datum nicht ins
          // falsche Geschaeftsjahr schiebt.
          const refundZeitpunkt = refundedEur === 0
            ? null
            : (bestehend.refunded_at
              ?? (charge.created ? new Date(charge.created * 1000).toISOString() : new Date().toISOString()));

          const { data: updated, error: refundErr } = await supabase
            .from("contracts")
            .update({
              customer_refunded_amount: refundedEur,
              refunded_at: refundZeitpunkt,
              stripe_fee_lost: refundedEur === 0 ? 0 : stripeFeeLost,
            })
            .eq("id", vertrag.id)
            // CAS: nur schreiben, wenn der Wert seit dem Lesen unveraendert ist.
            .eq("customer_refunded_amount", bestehend.customer_refunded_amount)
            .select("id, status, escrow_released_at, provider_id, provider_payout")
            .maybeSingle<{
              id: string; status: string; escrow_released_at: string | null;
              provider_id: string; provider_payout: number;
            }>();
          if (refundErr) throw refundErr;
          if (!updated) {
            // Zwei Ursachen sind moeglich und beide sind hier richtig behandelt:
            // (1) nebenlaeufige Aenderung => naechster Durchlauf holt neu.
            // (2) Vertrag existiert nicht mehr => `bestehend` waere oben schon
            //     null gewesen, dieser Fall kommt hier nicht an.
            console.warn(
              `Erstattung: nebenlaeufige Aenderung, erneuter Versuch ${versuch + 1}/3: pi=${piId}`,
            );
            continue;
          }
          verbucht = true;

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
        }
        if (!verbucht && !vertragFehlt) {
          // Drei Versuche am CAS gescheitert. Hier NICHT stillschweigend 200
          // antworten: Stripe wertet das als erledigt und wiederholt nicht mehr,
          // der Erstattungsstand bliebe dauerhaft veraltet. 500 haelt den Vorgang
          // in Stripes Wiederholung. (Befund des Security-Reviews — der Kommentar
          // stand hier vorher schon, der Code tat aber das Gegenteil.)
          console.error(`Erstattung konnte nicht verbucht werden: pi=${piId} charge=${chargeId}`);
          return new Response("Refund not recorded", { status: 500 });
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

        // Ein 'open' darf einen bereits abgeschlossenen Vorgang NICHT
        // zurueckdrehen. Stripe garantiert keine Zustellreihenfolge: traf ein
        // verspaetetes `created` nach einem verarbeiteten `closed` ein, stand
        // die Rueckbuchung wieder auf 'open' — und `release-escrow` sperrt die
        // Auszahlung, solange dieser Zustand offen ist. Ein gewonnener Dispute
        // haette den Anbieter damit dauerhaft blockiert.
        //
        // Endzustaende (won/lost/closed_other) duerfen ein 'open' sehr wohl
        // ueberschreiben — das ist der normale Verlauf.
        const dVertrag = await vertragZuIntent(piId);
        if (!dVertrag) {
          console.warn(`charge.dispute ohne zugehoerigen Vertrag: pi=${piId}`);
          break;
        }
        let dq = supabase
          .from("contracts")
          .update({
            dispute_state: state,
            ...(disputeFee > 0 ? { dispute_fee: Math.round(disputeFee) / 100 } : {}),
          })
          .eq("id", dVertrag.id);
        if (state === "open") {
          dq = dq.or("dispute_state.is.null,dispute_state.eq.open");
        }
        const { data: updated, error: dErr } = await dq
          .select("id, escrow_released_at")
          .maybeSingle<{ id: string; escrow_released_at: string | null }>();
        if (dErr) throw dErr;
        if (!updated) {
          if (state === "open") {
            // Zwei Ursachen. Existiert der Vertrag, war der Vorgang bereits
            // abgeschlossen — dann ist das Verwerfen richtig und Wiederholen
            // sinnlos.
            const { data: vorhanden } = await supabase
              .from("contracts")
              .select("id, dispute_state")
              .eq("id", dVertrag.id)
              .maybeSingle<{ id: string; dispute_state: string | null }>();
            if (vorhanden) {
              console.warn(
                `Verspaetetes 'created' nach Abschluss verworfen: contract_id=${vorhanden.id} ` +
                  `zustand=${vorhanden.dispute_state} dispute=${dispute.id}`,
              );
              break;
            }
          }
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

        const fVertrag = await vertragZuIntent(piId);
        if (!fVertrag) {
          console.error(`Fruehwarnung ohne zugehoerigen Vertrag — manuell pruefen: pi=${piId}`);
          break;
        }
        const { data: c, error: cErr } = await supabase
          .from("contracts")
          .select("id, status, escrow_released_at, customer_total, provider_payout, customer_refunded_amount, dispute_state")
          .eq("id", fVertrag.id)
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
        // VOLLstaendig erstattet, nicht "irgendwas erstattet": die AGB kennen
        // eine 50-%-Stufe (§ 4 Abs. 6). Bei halber Erstattung ist der Rest
        // weiterhin rueckbuchbar — das als "Chargeback abgewendet" zu
        // verbuchen waere falsch, und mit Automatik wuerde es zusaetzlich die
        // Erstattung unterdruecken, die ihn abgewendet haette.
        const vollErstattet = Number(c.customer_refunded_amount) >= Number(c.customer_total);
        const schonInRueckbuchung = c.dispute_state === "open" || c.dispute_state === "lost";

        // Reihenfolge ist wichtig: `bereits erstattet` wird ZUERST geprueft.
        // Erstattung und Rueckbuchung laufen in der Praxis gegeneinander —
        // kommt der Dispute trotz Erstattung, haette die umgekehrte Reihenfolge
        // bei der naechsten Zustellung 'erstattet' mit 'zu_spaet' ueberschrieben.
        // Dann staende in der Datenbank, man habe nichts getan, obwohl erstattet
        // wurde.
        let aktion: "erstattet" | "offen" | "zu_spaet" = "offen";
        if (vollErstattet) {
          aktion = "erstattet";
        } else if (schonInRueckbuchung) {
          // Die Rueckbuchung laeuft bereits — jetzt zu erstatten kostet den
          // Betrag doppelt und wendet nichts mehr ab.
          aktion = "zu_spaet";
        } else if (autoRefund) {
          try {
            await stripe.refunds.create(
              { payment_intent: piId, reason: "fraudulent" },
              // Key auf den PaymentIntent, nicht auf den Vertrag: es kann zwei
              // PaymentIntents zu einem Vertrag geben (siehe Kommentar im
              // payment_intent.succeeded-Zweig). Mit Vertrags-Key haette Stripe
              // die zweite Erstattung mit "same key, different parameters"
              // abgelehnt — das Verhalten waere zufaellig richtig gewesen, die
              // Diagnose im Log aber irrefuehrend.
              { idempotencyKey: `fraud-warning-refund-${piId}` },
            );
            aktion = "erstattet";
          } catch (err) {
            console.error(`Proaktive Erstattung nach Fruehwarnung fehlgeschlagen: contract_id=${c.id}`, err);
          }
        }

        // Wie bei refunded_at: den Zeitpunkt nur beim ERSTEN Mal setzen. Stripe
        // wiederholt bis zu drei Tage; faellt eine Wiederholung ueber den
        // Jahreswechsel, laege der Vermerk sonst im falschen Geschaeftsjahr.
        const { data: vorher } = await supabase
          .from("contracts")
          .select("fraud_warning_at")
          .eq("id", c.id)
          .maybeSingle<{ fraud_warning_at: string | null }>();
        await supabase
          .from("contracts")
          .update({
            fraud_warning_at: vorher?.fraud_warning_at ?? new Date().toISOString(),
            fraud_warning_action: aktion,
          })
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

        // Nicht schaetzen: den kumulierten Stand direkt bei Stripe nachfragen —
        // und zwar am Charge, ZU DEM die fehlgeschlagene Erstattung gehoert.
        // `pi.latest_charge` waere bei mehreren Charges auf einem PaymentIntent
        // nicht zwingend derselbe.
        const chargeId = typeof refund.charge === "string" ? refund.charge : refund.charge?.id;
        let stand = 0;
        try {
          if (chargeId) {
            const ch = await stripe.charges.retrieve(chargeId);
            stand = Math.round(ch.amount_refunded ?? 0) / 100;
          } else {
            const pi = await stripe.paymentIntents.retrieve(piId, { expand: ["latest_charge"] });
            const ch = pi.latest_charge as Stripe.Charge | null;
            stand = Math.round(ch?.amount_refunded ?? 0) / 100;
          }
        } catch (err) {
          console.error(`Erstattungsstand nach Fehlschlag nicht abrufbar: pi=${piId}`, err);
          break;
        }

        // Faellt der Stand auf 0 zurueck, muessen Zeitpunkt und Gebuehren-Verlust
        // mit. Sonst staende dort ein Vertrag mit Erstattungsdatum und 0 EUR
        // Erstattung — genau der Abgleichfehler, den 0630 beseitigen sollte.
        // CAS wie im Zweig `charge.refunded`. Ohne sie konnte dieser
        // unconditional-Schreibvorgang einen frischeren, dort gerade
        // CAS-geschuetzt verbuchten Wert wieder ueberschreiben — dieselbe
        // Schreibinversion, die fuer `charge.refunded` behoben wurde, nur ueber
        // den Nachbarzweig. (Befund des Security-Reviews.)
        const uVertrag = await vertragZuIntent(piId);
        if (!uVertrag) {
          console.error(`charge.refund.updated ohne zugehoerigen Vertrag: pi=${piId}`);
          break;
        }
        const { data: vorher } = await supabase
          .from("contracts")
          .select("customer_refunded_amount")
          .eq("id", uVertrag.id)
          .maybeSingle<{ customer_refunded_amount: number }>();
        const { data: korrigiert } = await supabase
          .from("contracts")
          .update(
            stand === 0
              ? { customer_refunded_amount: 0, refunded_at: null, stripe_fee_lost: 0 }
              : { customer_refunded_amount: stand },
          )
          .eq("id", uVertrag.id)
          .eq("customer_refunded_amount", vorher?.customer_refunded_amount ?? 0)
          .select("id")
          .maybeSingle<{ id: string }>();
        if (!korrigiert) {
          // CAS verfehlt: ein anderer Zweig hat zwischenzeitlich geschrieben.
          // 500 => Stripe wiederholt, der naechste Lauf liest den neuen Stand.
          console.error(
            `Erstattungskorrektur verfehlt (nebenlaeufige Aenderung): pi=${piId} refund=${refund.id}`,
          );
          return new Response("Refund correction conflicted", { status: 500 });
        }
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
        const cashVertrag = await vertragZuIntent(piId);
        if (!cashVertrag) {
          console.error(
            `Rueckbuchungs-Cashbewegung ohne zugehoerigen Vertrag — manuell pruefen: ` +
              `pi=${piId} dispute=${dispute.id} betrag=${Math.round(dispute.amount) / 100}`,
          );
          break;
        }
        const { data: c, error: cashErr } = await supabase
          .from("contracts")
          .update({ dispute_funds_withdrawn: abgezogen })
          .eq("id", cashVertrag.id)
          .select("id")
          .maybeSingle<{ id: string }>();
        if (cashErr) {
          // Das Ergebnis wurde hier frueher gar nicht geprueft. Es ging ein 200
          // hinaus, und Stripe wiederholte NIE. Geld hatte den Plattform-Saldo
          // real verlassen oder war ihm gutgeschrieben worden, die Datenbank
          // wusste nichts davon — Bankauszug und Buchfuehrung drifteten
          // dauerhaft und lautlos auseinander.
          console.error(`Rueckbuchungs-Cashbewegung nicht gespeichert: pi=${piId} dispute=${dispute.id}`, cashErr);
          return new Response("Dispute cash movement not recorded", { status: 500 });
        }
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

        // Beide Schreibvorgaenge werden geprueft. Frueher ging der Fehler
        // verloren und es folgte trotzdem ein 200 — Stripe wiederholte nie, und
        // der Billing-Zustand lief dauerhaft auseinander: der Kunde zahlt, die
        // App zeigt "nicht Pro", oder umgekehrt.
        const { error: subErr } = await supabase
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
        if (subErr) {
          console.error(`Abo-Zustand nicht gespeichert: provider=${profile.id} sub=${sub.id}`, subErr);
          return new Response("Subscription not recorded", { status: 500 });
        }

        // Mirror is_pro on provider_profiles for fast reads
        const { error: proErr } = await supabase
          .from("provider_profiles")
          .update({
            is_pro:         mappedStatus === "active" || mappedStatus === "trialing",
            pro_expires_at: periodEnd,
          })
          .eq("id", profile.id);
        if (proErr) {
          console.error(`is_pro-Spiegel nicht gesetzt: provider=${profile.id}`, proErr);
          return new Response("Subscription mirror not recorded", { status: 500 });
        }

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

        const { error: delErr } = await supabase
          .from("pro_subscriptions")
          .update({ status: "cancelled", stripe_sub_id: sub.id, updated_at: new Date().toISOString() })
          .eq("provider_id", profile.id);
        if (delErr) {
          console.error(`Abo-Kuendigung nicht gespeichert: provider=${profile.id} sub=${sub.id}`, delErr);
          return new Response("Subscription cancellation not recorded", { status: 500 });
        }

        const { error: delProErr } = await supabase
          .from("provider_profiles")
          .update({ is_pro: false, pro_expires_at: null })
          .eq("id", profile.id);
        if (delProErr) {
          console.error(`is_pro-Spiegel nach Kuendigung nicht gesetzt: provider=${profile.id}`, delProErr);
          return new Response("Subscription mirror not recorded", { status: 500 });
        }

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
}
