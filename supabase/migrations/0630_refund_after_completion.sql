-- Migration 0630: Erstattungen und Rueckbuchungen nach Abschluss festhalten
--
-- BEFUND (Vor-Merge-Review zu #154): stripe-webhook behandelt `charge.refunded`
-- und `charge.dispute.*` nicht. Eine Support-Erstattung aus dem
-- Stripe-Dashboard oder ein Chargeback NACH Abschluss laesst `contracts`
-- vollstaendig unberuehrt: status bleibt 'completed', die Betraege bleiben
-- stehen, und in der Datenbank steht nirgends, dass Geld zurueckgeflossen ist.
-- Dieselbe Klasse wie die "Zahlung ohne Spur" aus #152 — ein Geldvorgang, den
-- das System nicht kennt.
--
-- BEWUSSTE ABWEICHUNG vom urspruenglichen Vorschlag: Der Review schlug vor,
-- den erstatteten Betrag von der DAC7-Meldesumme abzuziehen
-- (`sum(provider_payout - refunded_amount)`). Das waere FALSCH, und zwar aus
-- einem konkreten Grund: es gibt im gesamten Code keine Transfer-Rueckabwicklung
-- (kein `transfers.createReversal`, keine Verrechnung mit kuenftigen
-- Auszahlungen). Sobald release-escrow gelaufen ist, liegt das Geld auf dem
-- Connect-Konto des Anbieters und bleibt dort. Eine Erstattung an den Kunden
-- zahlt Werkant aus eigener Tasche.
--
-- Die Verguetung des Anbieters im Sinne des § 3 Abs. 5 PStTG ist damit
-- unveraendert — "gezahlt oder gutgeschrieben" ist sie ihm ja. Wuerde man sie
-- abziehen, meldete man den Anbieter ZU NIEDRIG: derselbe Fehlertyp, den
-- Migration 0620 gerade beseitigt hat, nur in die andere Richtung.
--
-- WENN spaeter ein Rueckholmechanismus gebaut wird (Transfer-Reversal oder
-- Verrechnung), MUSS pstg_year_totals um genau diesen zurueckgeholten Betrag
-- vermindert werden. Dafuer ist unten `provider_clawback_amount` bereits
-- vorgesehen und bleibt bis dahin 0.

alter table public.contracts
  add column if not exists customer_refunded_amount numeric(10,2) not null default 0,
  add column if not exists refunded_at              timestamptz,
  add column if not exists dispute_state            text
    -- 'closed_other' ist wichtig: Stripe schliesst Dispute-Faelle auch mit
    -- `warning_closed` (Fruehwarnung folgenlos ausgelaufen, KEIN Geldverlust)
    -- und `charge_refunded` (erstattet, um die Sache zu beenden — der Verlust
    -- steckt dann bereits in customer_refunded_amount). Beides pauschal als
    -- 'lost' zu verbuchen treibt die ausgewiesene Rueckbuchungsquote nach oben,
    -- und genau die nimmt Stripe ab 0,75 % zum Anlass fuer Reserven oder eine
    -- Kontosperrung. Falsch nach oben zaehlen schadet hier doppelt.
    check (dispute_state is null or dispute_state in ('open','won','lost','closed_other')),
  -- Die beiden teuersten Positionen eines Erstattungsfalls, die sich spaeter
  -- NUR noch ueber einen Stripe-Balance-Export rekonstruieren lassen:
  -- die Bearbeitungsgebuehr des urspruenglichen Charge behaelt Stripe auch bei
  -- voller Erstattung, und ein verlorener Chargeback kostet zusaetzlich eine
  -- Dispute-Fee. An einem 300-EUR-Auftrag summiert sich ein verlorener Fall auf
  -- rund 296 EUR — etwa zwoelf profitable Auftraege. Fuer § 238 HGB (Ueberblick
  -- fuer einen sachverstaendigen Dritten) gehoeren sie in die eigene Buchfuehrung.
  add column if not exists stripe_fee_lost          numeric(10,2) not null default 0,
  add column if not exists dispute_fee              numeric(10,2) not null default 0,
  -- Reserviert: was dem ANBIETER wieder abgenommen wurde. Solange es keine
  -- Rueckabwicklung gibt, immer 0 — und nur dieser Wert duerfte je von der
  -- DAC7-Meldung abgezogen werden, nicht customer_refunded_amount.
  add column if not exists provider_clawback_amount numeric(10,2) not null default 0;

comment on column public.contracts.customer_refunded_amount is
  'Kumulierter Betrag, den der KUNDE zurueckerstattet bekommen hat (Stripe '
  'charge.amount_refunded). Zahlt Werkant; beruehrt die Verguetung des '
  'Anbieters NICHT und wird deshalb nicht von der DAC7-Meldung abgezogen.';
comment on column public.contracts.stripe_fee_lost is
  'Bearbeitungsgebuehr des urspruenglichen Charge, die Stripe auch bei voller '
  'Erstattung einbehaelt. Verlust von Werkant.';
comment on column public.contracts.dispute_fee is
  'Von Stripe erhobene Gebuehr fuer einen Rueckbuchungsfall. Verlust von Werkant.';

comment on column public.contracts.provider_clawback_amount is
  'Betrag, der dem ANBIETER wieder abgenommen wurde (Transfer-Reversal o. ae.). '
  'Existiert heute nicht, bleibt 0. Nur dieser Wert waere von der '
  'DAC7-Meldegrundlage abzuziehen.';

-- Guard erweitern: die neuen Spalten sind Geldspalten und gehoeren
-- ausschliesslich den Edge Functions (Muster wie 0300).
create or replace function guard_contracts_sensitive_cols()
returns trigger language plpgsql security definer as $$
begin
  if current_setting('role', true) = 'service_role' then
    return new;
  end if;

  if new.status is distinct from old.status then
    raise exception 'contracts.status is managed by Edge Functions only';
  end if;
  if new.customer_id is distinct from old.customer_id then
    raise exception 'contracts.customer_id cannot be changed';
  end if;
  if new.provider_id is distinct from old.provider_id then
    raise exception 'contracts.provider_id cannot be changed';
  end if;
  if new.price_gross is distinct from old.price_gross then
    raise exception 'contracts.price_gross is managed by Edge Functions only';
  end if;
  if new.customer_total is distinct from old.customer_total then
    raise exception 'contracts.customer_total is managed by Edge Functions only';
  end if;
  if new.provider_payout is distinct from old.provider_payout then
    raise exception 'contracts.provider_payout is managed by Edge Functions only';
  end if;
  if new.werkr_schutz_fee is distinct from old.werkr_schutz_fee then
    raise exception 'contracts.werkr_schutz_fee is managed by Edge Functions only';
  end if;
  if new.customer_service_fee is distinct from old.customer_service_fee then
    raise exception 'contracts.customer_service_fee is managed by Edge Functions only';
  end if;
  if new.provider_commission is distinct from old.provider_commission then
    raise exception 'contracts.provider_commission is managed by Edge Functions only';
  end if;
  if new.stripe_payment_intent is distinct from old.stripe_payment_intent then
    raise exception 'contracts.stripe_payment_intent is managed by Edge Functions only';
  end if;
  if new.escrow_captured_at is distinct from old.escrow_captured_at then
    raise exception 'contracts.escrow_captured_at is managed by Edge Functions only';
  end if;
  if new.escrow_released_at is distinct from old.escrow_released_at then
    raise exception 'contracts.escrow_released_at is managed by Edge Functions only';
  end if;
  if new.completed_at is distinct from old.completed_at then
    raise exception 'contracts.completed_at is managed by Edge Functions only';
  end if;
  if new.cancelled_at is distinct from old.cancelled_at then
    raise exception 'contracts.cancelled_at is managed by the cancel-contract Edge Function only';
  end if;
  if new.cancellation_reason is distinct from old.cancellation_reason then
    raise exception 'contracts.cancellation_reason is managed by the cancel-contract Edge Function only';
  end if;
  -- NEU (0630)
  if new.customer_refunded_amount is distinct from old.customer_refunded_amount then
    raise exception 'contracts.customer_refunded_amount is managed by the stripe-webhook Edge Function only';
  end if;
  if new.refunded_at is distinct from old.refunded_at then
    raise exception 'contracts.refunded_at is managed by the stripe-webhook Edge Function only';
  end if;
  if new.dispute_state is distinct from old.dispute_state then
    raise exception 'contracts.dispute_state is managed by the stripe-webhook Edge Function only';
  end if;
  if new.provider_clawback_amount is distinct from old.provider_clawback_amount then
    raise exception 'contracts.provider_clawback_amount is managed by Edge Functions only';
  end if;
  if new.stripe_fee_lost is distinct from old.stripe_fee_lost then
    raise exception 'contracts.stripe_fee_lost is managed by the stripe-webhook Edge Function only';
  end if;
  if new.dispute_fee is distinct from old.dispute_fee then
    raise exception 'contracts.dispute_fee is managed by the stripe-webhook Edge Function only';
  end if;

  return new;
end;
$$;

-- Jedes Refund-/Dispute-Event sucht den Vertrag ueber stripe_payment_intent.
-- Auf der Spalte lag bisher weder Index noch Eindeutigkeit: das war ein Full
-- Scan pro Event, und `.maybeSingle()` haette bei zwei Zeilen mit demselben
-- Wert einen Laufzeitfehler geworfen. Zwei Vertraege duerfen sich denselben
-- PaymentIntent nicht teilen — die Eindeutigkeit hier sagt das aus, statt sich
-- darauf zu verlassen.
create unique index if not exists contracts_stripe_payment_intent_key
  on public.contracts (stripe_payment_intent)
  where stripe_payment_intent is not null;
