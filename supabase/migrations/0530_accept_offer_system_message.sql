-- 0530: accept_offer legt nach erfolgreicher Vertragserstellung eine
-- System-Nachricht in den (job, provider)-Thread. Founder-Wunsch
-- „Angebot angenommen" im Chat. Geld-/Gebühren-/Signatur-Logik unverändert
-- gegenüber 0400 — nur der abschließende Insert kommt hinzu.
create or replace function accept_offer(
  p_offer_id uuid,
  p_job_id   uuid
) returns setof contracts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid;
  v_offer   offers%rowtype;
  v_job     jobs%rowtype;
  v_price   numeric;
  v_werkr_schutz_fee     numeric;
  v_customer_service_fee numeric;
  v_provider_commission  numeric;
  v_customer_total       numeric;
  v_provider_payout      numeric;
  v_now      timestamptz := now();
  v_contract contracts%rowtype;
begin
  v_customer := auth.uid();
  if v_customer is null then raise exception 'Not authenticated'; end if;
  if not auth_email_confirmed() then raise exception 'Email not verified'; end if;

  select * into v_offer from offers where id = p_offer_id for update;
  if not found then raise exception 'Offer not found'; end if;
  if v_offer.status <> 'pending' then raise exception 'Offer is not pending'; end if;
  if v_offer.job_id <> p_job_id then raise exception 'Offer does not belong to job'; end if;

  select * into v_job from jobs where id = p_job_id;
  if not found then raise exception 'Job not found'; end if;
  if v_job.customer_id <> v_customer then raise exception 'Not the job owner'; end if;

  v_price := v_offer.price;

  if v_job.track = 'nachbarschaft' then
    v_werkr_schutz_fee     := 1.99;
    v_customer_service_fee := 0;
    v_provider_commission  := 0;
    v_customer_total       := round((v_price + 1.99)::numeric, 2);
    v_provider_payout      := v_price;
  else
    v_provider_commission  := round(greatest(v_price * 0.08, 3.00)::numeric, 2);
    v_customer_service_fee := round(greatest(v_price * 0.025, 1.50)::numeric, 2);
    v_werkr_schutz_fee     := 0;
    v_customer_total       := round((v_price + v_customer_service_fee)::numeric, 2);
    v_provider_payout      := round((v_price - v_provider_commission)::numeric, 2);
  end if;

  insert into contracts (
    job_id, offer_id, customer_id, provider_id, track,
    price_gross, werkr_schutz_fee, customer_service_fee,
    provider_commission, customer_total, provider_payout,
    customer_signed_at, provider_signed_at
  ) values (
    p_job_id, p_offer_id, v_customer, v_offer.provider_id, v_job.track,
    v_price, v_werkr_schutz_fee, v_customer_service_fee,
    v_provider_commission, v_customer_total, v_provider_payout,
    v_now, v_now
  ) returning * into v_contract;

  update offers set status = 'accepted', updated_at = now() where id = p_offer_id;

  update offers set status = 'declined', updated_at = now()
    where job_id = p_job_id and id <> p_offer_id and status = 'pending';

  update jobs set status = 'active', provider_id = v_offer.provider_id where id = p_job_id;

  -- System-Nachricht in den (job, provider)-Thread des angenommenen Anbieters
  -- (0530). type='system', Absender = Kunde. provider_id = jobs.provider_id
  -- nach Annahme = v_offer.provider_id.
  insert into public.messages (job_id, sender_id, sender_role, body, provider_id, type)
    values (p_job_id, v_customer, 'customer',
            'Angebot angenommen — Auftrag ist beauftragt.',
            v_offer.provider_id, 'system');

  return next v_contract;
end;
$$;

revoke execute on function accept_offer(uuid, uuid) from public;
grant execute on function accept_offer(uuid, uuid) to authenticated;
