-- Migration 029: fix IDOR in accept_offer() — client-supplied identity parameter
--
-- accept_offer(p_offer_id, p_job_id, p_customer_id) has been SECURITY DEFINER
-- and callable by any `authenticated` user since migration 006. Its only
-- authorization check compared `p_customer_id` (a CLIENT-SUPPLIED parameter)
-- against jobs.customer_id — it never verified p_customer_id = auth.uid().
--
-- Any authenticated user could call the RPC directly (POST
-- /rest/v1/rpc/accept_offer) with someone else's real customer_id (visible
-- throughout the app via job/offer listings) and force-accept a pending
-- offer on that customer's behalf: creates a binding contracts row, declines
-- competing offers, and matches the job to a provider the real customer
-- never chose — entirely bypassing consent. Found during a pre-launch
-- security audit; never exploited as far as anyone knows, but the app
-- itself always passed auth.uid() as p_customer_id, which is why this was
-- never triggered by normal use — the gap was only reachable by calling the
-- RPC directly, which is exactly what a real attacker would do.
--
-- Fix: drop the p_customer_id parameter; use auth.uid() directly inside the
-- function so the caller's identity cannot be spoofed. Client code
-- (lib/offers.ts, app/angebot.tsx, app/auftrag-detail.tsx) updated to match
-- the new 2-argument signature in the same commit as this migration.

drop function if exists public.accept_offer(uuid, uuid, uuid);

create function public.accept_offer(
  p_offer_id uuid,
  p_job_id   uuid
)
returns public.contracts
language plpgsql
security definer
as $$
declare
  v_customer_id uuid := auth.uid();
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
  if v_customer_id is null then
    raise exception 'Unauthorized';
  end if;

  -- Lock and validate offer
  select * into v_offer from public.offers
  where id = p_offer_id and job_id = p_job_id and status = 'pending'
  for update;

  if not found then
    raise exception 'Offer not found or already processed';
  end if;

  -- Validate the CALLER (not a client-supplied id) owns the job
  if not exists (
    select 1 from public.jobs
    where id = p_job_id and customer_id = v_customer_id
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
    p_job_id, v_customer_id, v_offer.provider_id,
    v_price, v_werkr_schutz_fee, v_customer_service_fee,
    v_provider_commission, v_customer_total, v_provider_payout,
    'pending', v_track
  )
  returning * into v_contract;

  return v_contract;
end;
$$;

grant execute on function public.accept_offer(uuid, uuid) to authenticated;
