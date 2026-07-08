-- Migration 011: Add scheduled_at to offers table
-- Allows providers to propose a specific appointment time when submitting offers.
-- The accept_offer RPC can then copy this to jobs.scheduled_at when the offer is accepted.

alter table public.offers
  add column if not exists scheduled_at timestamptz;

comment on column public.offers.scheduled_at is
  'Proposed appointment date/time from provider. Copied to jobs.scheduled_at on offer acceptance.';

-- Update accept_offer RPC to propagate scheduled_at to the job
-- Fixed 2026-07-02: migration 006 defined this returning `setof contracts`;
-- CREATE OR REPLACE FUNCTION cannot change a function's return type, so this
-- errored on any fresh, in-order apply ("cannot change return type of
-- existing function"). DROP first, as Postgres's own error HINT says.
-- See migration 028 for an idempotent catch-up for environments that hit
-- the old broken version of this file before this fix landed.
drop function if exists public.accept_offer(uuid, uuid, uuid);

create function public.accept_offer(
  p_offer_id   uuid,
  p_job_id     uuid,
  p_customer_id uuid
)
returns public.contracts
language plpgsql
security definer
as $$
declare
  v_offer    public.offers%rowtype;
  v_price    numeric(10,2);
  v_track    text;

  v_werkr_schutz_fee      numeric(10,2);
  v_customer_service_fee  numeric(10,2);
  v_provider_commission   numeric(10,2);
  v_customer_total        numeric(10,2);
  v_provider_payout       numeric(10,2);

  v_contract public.contracts%rowtype;
begin
  -- Lock and validate offer
  select * into v_offer from public.offers
  where id = p_offer_id and job_id = p_job_id and status = 'pending'
  for update;

  if not found then
    raise exception 'Offer not found or already processed';
  end if;

  -- Validate customer owns the job
  if not exists (
    select 1 from public.jobs
    where id = p_job_id and customer_id = p_customer_id
  ) then
    raise exception 'Unauthorized: job does not belong to customer';
  end if;

  v_price := v_offer.price;

  -- Determine fee track from job
  select track into v_track from public.jobs where id = p_job_id;

  if v_track = 'nachbarschaft' then
    v_werkr_schutz_fee     := 1.99;
    v_customer_service_fee := 0;
    v_provider_commission  := 0;
    v_customer_total       := round((v_price + v_werkr_schutz_fee)::numeric, 2);
    v_provider_payout      := v_price;
  else
    -- Handwerker track
    v_werkr_schutz_fee     := 0;
    v_customer_service_fee := round(greatest(v_price * 0.025, 1.50)::numeric, 2);
    v_provider_commission  := round(greatest(v_price * 0.08, 3.00)::numeric, 2);
    v_customer_total       := round((v_price + v_customer_service_fee)::numeric, 2);
    v_provider_payout      := round((v_price - v_provider_commission)::numeric, 2);
  end if;

  -- Mark offer accepted, decline others
  update public.offers set status = 'accepted' where id = p_offer_id;
  update public.offers
  set status = 'declined'
  where job_id = p_job_id and id != p_offer_id and status = 'pending';

  -- Lock job to matched provider, copy scheduled_at from offer if set
  update public.jobs
  set
    status      = 'matched',
    provider_id = v_offer.provider_id,
    updated_at  = now(),
    scheduled_at = coalesce(v_offer.scheduled_at, scheduled_at)
  where id = p_job_id;

  -- Create contract
  insert into public.contracts (
    job_id, customer_id, provider_id,
    price_gross, werkr_schutz_fee, customer_service_fee,
    provider_commission, customer_total, provider_payout,
    status, track
  ) values (
    p_job_id, p_customer_id, v_offer.provider_id,
    v_price, v_werkr_schutz_fee, v_customer_service_fee,
    v_provider_commission, v_customer_total, v_provider_payout,
    'pending', v_track
  )
  returning * into v_contract;

  return v_contract;
end;
$$;

grant execute on function public.accept_offer(uuid, uuid, uuid) to authenticated;
