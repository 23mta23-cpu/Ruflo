create or replace function accept_offer(
  p_offer_id   uuid,
  p_job_id     uuid,
  p_customer_id uuid
) returns setof contracts
language plpgsql
security definer
as $$
declare
  v_offer   offers%rowtype;
  v_job     jobs%rowtype;
  v_price   numeric;
  v_werkr_schutz_fee    numeric;
  v_customer_service_fee numeric;
  v_provider_commission  numeric;
  v_customer_total       numeric;
  v_provider_payout      numeric;
  v_contract contracts%rowtype;
begin
  -- Lock the offer row to prevent double-acceptance
  select * into v_offer from offers where id = p_offer_id for update;
  if not found then raise exception 'Offer not found'; end if;
  if v_offer.status <> 'pending' then raise exception 'Offer is not pending'; end if;

  -- Fetch job (no lock needed — we update it below)
  select * into v_job from jobs where id = p_job_id;
  if not found then raise exception 'Job not found'; end if;
  if v_job.customer_id <> p_customer_id then raise exception 'Not the job owner'; end if;

  v_price := v_offer.price;

  -- Fee calculation mirrors feeEngine.ts
  if v_job.track = 'nachbarschaft' then
    v_werkr_schutz_fee     := 1.99;
    v_customer_service_fee := 0;
    v_provider_commission  := 0;
    v_customer_total       := round((v_price + 1.99)::numeric, 2);
    v_provider_payout      := v_price;
  else
    -- Handwerker: max(price * 0.08, 3.00) commission, max(price * 0.025, 1.50) service fee
    v_provider_commission  := round(greatest(v_price * 0.08, 3.00)::numeric, 2);
    v_customer_service_fee := round(greatest(v_price * 0.025, 1.50)::numeric, 2);
    v_werkr_schutz_fee     := 0;
    v_customer_total       := round((v_price + v_customer_service_fee)::numeric, 2);
    v_provider_payout      := round((v_price - v_provider_commission)::numeric, 2);
  end if;

  -- Insert contract
  insert into contracts (
    job_id, offer_id, customer_id, provider_id, track,
    price_gross, werkr_schutz_fee, customer_service_fee,
    provider_commission, customer_total, provider_payout
  ) values (
    p_job_id, p_offer_id, p_customer_id, v_offer.provider_id, v_job.track,
    v_price, v_werkr_schutz_fee, v_customer_service_fee,
    v_provider_commission, v_customer_total, v_provider_payout
  ) returning * into v_contract;

  -- Mark offer accepted
  update offers set status = 'accepted', updated_at = now() where id = p_offer_id;

  -- Decline all other pending offers for this job
  update offers set status = 'declined', updated_at = now()
    where job_id = p_job_id and id <> p_offer_id and status = 'pending';

  -- Update job status
  update jobs set status = 'contracted', provider_id = v_offer.provider_id where id = p_job_id;

  return next v_contract;
end;
$$;

-- Grant execute to authenticated users only
revoke execute on function accept_offer(uuid, uuid, uuid) from public;
grant execute on function accept_offer(uuid, uuid, uuid) to authenticated;
