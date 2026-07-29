-- Migration 0640: Betrugs-Fruehwarnung und tatsaechliche Cash-Bewegungen
--
-- Drei Luecken aus dem CFO-Review zu #155:
--
-- 1. `radar.early_fraud_warning.created` — das Kartennetz meldet, dass eine
--    Zahlung mit hoher Wahrscheinlichkeit als Betrug zurueckgebucht wird. Wer
--    daraufhin von sich aus erstattet, verhindert den Chargeback vollstaendig:
--    keine Dispute-Fee (rund 15 EUR) und, wichtiger, kein Zaehler auf der
--    Rueckbuchungsquote. Stripe nimmt die ab 0,75 % zum Anlass fuer Reserven
--    oder eine Kontosperrung. An einem 300-EUR-Auftrag kostet ein verlorener
--    Fall rund 296 EUR — die Fruehwarnung ist der einzige Punkt im ganzen
--    Geldpfad, an dem sich das noch abwenden laesst.
--
-- 2. `charge.refund.updated` — eine Erstattung kann fehlschlagen (Bank weist
--    zurueck). Dann steht `customer_refunded_amount` da, obwohl das Geld
--    wieder bei Werkant liegt.
--
-- 3. `charge.dispute.funds_withdrawn` / `funds_reinstated` — das sind die
--    tatsaechlichen Cash-Bewegungen. `created`/`closed` sind Statusmeldungen,
--    kein Geld. Ohne die beiden laesst sich der Bankauszug nicht gegen die
--    eigene Buchfuehrung abgleichen.

alter table public.contracts
  add column if not exists fraud_warning_at     timestamptz,
  add column if not exists fraud_warning_action text
    check (fraud_warning_action is null
           or fraud_warning_action in ('erstattet','offen','zu_spaet')),
  -- Wurde der Betrag tatsaechlich vom Plattform-Saldo eingezogen bzw. wieder
  -- gutgeschrieben. Getrennt von dispute_state, weil Status und Geldfluss bei
  -- Stripe verschiedene Ereignisse sind.
  add column if not exists dispute_funds_withdrawn boolean not null default false;

comment on column public.contracts.fraud_warning_at is
  'Zeitpunkt einer Radar-Fruehwarnung (radar.early_fraud_warning.created). '
  'Ab hier ist der Chargeback noch abwendbar — danach nicht mehr.';
comment on column public.contracts.fraud_warning_action is
  'erstattet = proaktiv erstattet, Chargeback abgewendet. offen = gemeldet, '
  'aber nichts unternommen (Automatik aus). zu_spaet = Warnung kam erst, als '
  'die Rueckbuchung schon lief.';
comment on column public.contracts.dispute_funds_withdrawn is
  'true, sobald Stripe den Betrag tatsaechlich vom Plattform-Saldo eingezogen '
  'hat (funds_withdrawn); false nach funds_reinstated.';

-- Guard: auch diese Spalten gehoeren ausschliesslich der Edge Function.
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

  return new;
end;
$$;
