-- Migration 0390: Geld-Fluss-Fixes — accept_offer reparieren + decline_offer
--
-- (1) accept_offer: Die einzige Definition (0060) verlangt 3 Argumente
--     (p_offer_id, p_job_id, p_customer_id), der Client (lib/offers.ts) ruft
--     aber mit 2 auf. PostgREST matcht RPCs über Name UND Argumentmenge —
--     die Funktion wurde nie gefunden, Angebot-Annahme schlug daher IMMER
--     fehl (beide Einstiege: angebot.tsx, auftrag-detail.tsx).
--     Zusätzlich war p_customer_id ein Client-Parameter, der nie gegen
--     auth.uid() geprüft wurde — ein Angreifer hätte mit der korrekten
--     3-Arg-Signatur die Kunden-Identität frei wählen können (Impersonation).
--     Neue 2-Arg-Version leitet den Kunden serverseitig aus auth.uid() ab.
-- (2) Signaturen: customer_signed_at/provider_signed_at wurden nirgends
--     gesetzt — vertrag.tsx blieb dadurch dauerhaft "Ausstehend". Semantik:
--     Angebot abgeben = Anbieter-Signatur, Angebot annehmen = Kunden-
--     Signatur; beide werden bei Vertragserstellung gestempelt.
-- (3) decline_offer: Kunden konnten Angebote nicht ablehnen (RLS erlaubt
--     offers-UPDATE nur dem Anbieter auf eigene Zeilen) — der Ablehnen-
--     Button in angebot.tsx schrieb nie etwas. Neue RPC mit Job-Owner-Check.

drop function if exists accept_offer(uuid, uuid, uuid);
drop function if exists accept_offer(uuid, uuid);

create function accept_offer(
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

  -- Lock the offer row to prevent double-acceptance
  select * into v_offer from offers where id = p_offer_id for update;
  if not found then raise exception 'Offer not found'; end if;
  if v_offer.status <> 'pending' then raise exception 'Offer is not pending'; end if;
  if v_offer.job_id <> p_job_id then raise exception 'Offer does not belong to job'; end if;

  select * into v_job from jobs where id = p_job_id;
  if not found then raise exception 'Job not found'; end if;
  if v_job.customer_id <> v_customer then raise exception 'Not the job owner'; end if;

  v_price := v_offer.price;

  -- Fee calculation mirrors feeEngine.ts
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

  return next v_contract;
end;
$$;

revoke execute on function accept_offer(uuid, uuid) from public;
grant execute on function accept_offer(uuid, uuid) to authenticated;

create or replace function decline_offer(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer offers%rowtype;
  v_job   jobs%rowtype;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select * into v_offer from offers where id = p_offer_id for update;
  if not found then raise exception 'Offer not found'; end if;
  if v_offer.status <> 'pending' then raise exception 'Offer is not pending'; end if;

  select * into v_job from jobs where id = v_offer.job_id;
  if v_job.customer_id <> auth.uid() then raise exception 'Not the job owner'; end if;

  update offers set status = 'declined', updated_at = now() where id = p_offer_id;
end;
$$;

revoke execute on function decline_offer(uuid) from public;
grant execute on function decline_offer(uuid) to authenticated;
