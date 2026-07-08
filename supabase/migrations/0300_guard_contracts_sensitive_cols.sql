-- Migration 030: guard money/party columns on contracts from client writes
--
-- Migration 005's "Contract parties can update their contract" policy scopes
-- UPDATE to party membership only, with no column restriction — unlike the
-- equivalent policies for profiles/provider_profiles, which got dedicated
-- guard triggers in the same migration (guard_profile_sensitive_cols,
-- guard_provider_profile_sensitive_cols). contracts never got one.
--
-- Net effect: either party could directly UPDATE their own contract row via
-- the Supabase client SDK/REST API and rewrite status, every fee/amount
-- column, escrow timestamps, stripe_payment_intent, or even customer_id/
-- provider_id itself (e.g. a customer setting customer_total to a tiny
-- amount before create-payment-intent reads it, since that function trusts
-- the DB row rather than re-deriving the price; or rewriting the other
-- party's id to gain profile-visibility / push-notification access to an
-- arbitrary victim via the migration-003 "contract parties" policies).
-- Found during a pre-launch security audit — the access-control-matrix
-- documented "only service_role may write these columns" as a rule, but
-- unlike profiles/provider_profiles it was never enforced in the database.
--
-- Fix: block non-service_role writes to every money/status/identity column.
-- The app never legitimately needs to UPDATE contracts client-side — all
-- real transitions already happen via service_role Edge Functions
-- (create-payment-intent, stripe-webhook, release-escrow, cancel-contract)
-- or the accept_offer() SECURITY DEFINER RPC (which INSERTs, not UPDATEs).

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

  return new;
end;
$$;

create trigger trg_guard_contracts_sensitive_cols
  before update on public.contracts
  for each row execute function guard_contracts_sensitive_cols();
