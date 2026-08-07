-- Migration 0670: Betrag der Rueckbuchungs-Cashbewegung festhalten
--
-- BEFUND (Architektur-Review zu PR #164, P1): `dispute_funds_withdrawn` ist ein
-- Boolean. Der tatsaechlich bewegte Betrag steht ausschliesslich in einer
-- console.error-Zeile des stripe-webhook. Bei einer Teil-Rueckbuchung, bei einer
-- Teil-Gutschrift oder nach der Log-Rotation laesst sich der Abgleich zwischen
-- Bankauszug und Buchfuehrung aus der Datenbank allein nicht mehr
-- rekonstruieren -- und das ueber eine Aufbewahrungsfrist von zehn Jahren
-- (HGB § 257).
--
-- Ein Boolean beantwortet "ist Geld geflossen?", nicht "wie viel". Fuer eine
-- Buchfuehrung ist genau die zweite Frage die relevante.
--
-- BEWUSST NUR ZWEI SPALTEN: Betrag und Zeitpunkt der letzten Bewegung. Eine
-- vollstaendige Bewegungshistorie je Dispute waere eine eigene Tabelle; Stripe
-- kennt pro Dispute genau einen Einzug und hoechstens eine Gutschrift, deshalb
-- reicht der jeweils letzte Stand. Waechst der Bedarf, ist der Weg derselbe wie
-- bei contract_payment_intents (0660).

alter table public.contracts
  -- Ganze Cent, wie alle Geldbetraege in diesem Schema. `dispute.amount` kommt
  -- von Stripe bereits in der kleinsten Waehrungseinheit -- hier wird also
  -- NICHT gerundet, sondern uebernommen.
  add column if not exists dispute_amount_cents  integer,
  add column if not exists dispute_funds_moved_at timestamptz,
  -- Ohne die Stripe-Objekt-ID ist eine Buchung nicht eindeutig zuzuordnen:
  -- Betrag und Zeitpunkt allein reichen nicht, um im Stripe-Dashboard den
  -- exakten Vorgang wiederzufinden, den eine Zeile des Bankauszugs meint.
  -- Der Handler hat `dispute.id` an dieser Stelle ohnehin schon zur Hand.
  add column if not exists stripe_dispute_id      text;

comment on column public.contracts.dispute_amount_cents is
  'Betrag der letzten Rueckbuchungs-Cashbewegung in ganzen Cent, wie von Stripe geliefert. Zusammen mit dispute_funds_withdrawn (Richtung) und dispute_funds_moved_at (Zeitpunkt) der Beleg fuer den Abgleich Bankauszug gegen Buchfuehrung.';
comment on column public.contracts.dispute_funds_moved_at is
  'Zeitpunkt der letzten Rueckbuchungs-Cashbewegung. Wird bei jedem funds_withdrawn/funds_reinstated neu gesetzt -- anders als refunded_at, das bewusst nur beim ersten Mal gesetzt wird, ist hier der LETZTE Stand der interessante.';
comment on column public.contracts.stripe_dispute_id is
  'Stripe-Dispute-ID (dp_...) der letzten Rueckbuchungs-Cashbewegung. Die Referenz, ueber die eine Zeile des Bankauszugs eindeutig einem Stripe-Vorgang zugeordnet werden kann.';

-- Geldspalten gehoeren ausschliesslich den Edge Functions (Muster 0300/0630/0640).
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
  -- NEU (0640)
  if new.fraud_warning_at is distinct from old.fraud_warning_at then
    raise exception 'contracts.fraud_warning_at is managed by the stripe-webhook Edge Function only';
  end if;
  if new.fraud_warning_action is distinct from old.fraud_warning_action then
    raise exception 'contracts.fraud_warning_action is managed by the stripe-webhook Edge Function only';
  end if;
  if new.dispute_funds_withdrawn is distinct from old.dispute_funds_withdrawn then
    raise exception 'contracts.dispute_funds_withdrawn is managed by the stripe-webhook Edge Function only';
  end if;
  -- NEU (0670)
  if new.dispute_amount_cents is distinct from old.dispute_amount_cents then
    raise exception 'contracts.dispute_amount_cents is managed by the stripe-webhook Edge Function only';
  end if;
  if new.dispute_funds_moved_at is distinct from old.dispute_funds_moved_at then
    raise exception 'contracts.dispute_funds_moved_at is managed by the stripe-webhook Edge Function only';
  end if;
  if new.stripe_dispute_id is distinct from old.stripe_dispute_id then
    raise exception 'contracts.stripe_dispute_id is managed by the stripe-webhook Edge Function only';
  end if;

  return new;
end;
$$;
