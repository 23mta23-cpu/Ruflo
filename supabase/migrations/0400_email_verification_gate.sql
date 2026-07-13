-- Migration 0400: Eigenes E-Mail-Verifikations-System + Gate für Transaktionen
--
-- Kontext (Founder-Entscheidung 13.07.): Supabase-Bestätigungsmails kommen
-- auf dem Free-Tier-SMTP (~2 Mails/h) nicht an — Registrierung war faktisch
-- tot. Neue Strategie:
--   • "Confirm email" im Supabase-Dashboard wird DEAKTIVIERT → Nutzer sind
--     nach Signup sofort eingeloggt (Supabase setzt email_confirmed_at dann
--     automatisch — das Feld ist ab da KEIN Verifikations-Signal mehr für
--     Neu-Registrierungen, bleibt aber gültig für Alt-Nutzer).
--   • Eigene Double-Opt-in-Verifikation über die verify-email Edge Function
--     (Resend, wie waitlist-doi): setzt profiles.email_verified_at.
--   • Dieses Gate erzwingt: kein Auftrag aufgeben, kein Angebot abgeben,
--     kein Angebot annehmen ohne Verifikation. Stöbern bleibt frei.
--     Client-Checks sind nur UX — die Durchsetzung ist hier.

-- ── Verifikations-Zustand ─────────────────────────────────────
alter table public.profiles
  add column if not exists email_verified_at timestamptz;

-- Alt-Nutzer, die den Supabase-Bestätigungslink bereits geklickt haben,
-- gelten als verifiziert (einmaliger Backfill; das OR in der Gate-Funktion
-- deckt sie ohnehin ab, der Backfill macht es im Datenbestand explizit).
update public.profiles p
  set email_verified_at = u.email_confirmed_at
  from auth.users u
  where u.id = p.id
    and p.email_verified_at is null
    and u.email_confirmed_at is not null;

-- Clients dürfen den Verifikations-Stempel nicht selbst setzen —
-- nur service_role (verify-email Edge Function).
create or replace function guard_email_verified_col()
returns trigger language plpgsql security definer as $$
begin
  if current_setting('role', true) = 'service_role' then return new; end if;
  if new.email_verified_at is distinct from old.email_verified_at then
    raise exception 'profiles.email_verified_at is managed by the verify-email Edge Function only';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_email_verified on public.profiles;
create trigger trg_guard_email_verified
  before update on public.profiles
  for each row execute function guard_email_verified_col();

-- Token-Speicher für den Bestätigungslink (nur service_role; RLS ohne
-- Policies = default deny für alle Client-Rollen).
create table if not exists public.email_verifications (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  token      uuid not null unique default gen_random_uuid(),
  email      text not null,
  sent_at    timestamptz not null default now()
);
alter table public.email_verifications enable row level security;

-- ── Gate-Funktion ─────────────────────────────────────────────
-- Verifiziert = Supabase-Bestätigung (Alt-Nutzer / falls Confirm wieder an)
-- ODER eigener DOI-Stempel (Neu-Nutzer über verify-email).
create or replace function auth_email_confirmed()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from auth.users u
    join public.profiles p on p.id = u.id
    where u.id = auth.uid()
      and (u.email_confirmed_at is not null or p.email_verified_at is not null)
  )
$$;

revoke execute on function auth_email_confirmed() from public;
grant execute on function auth_email_confirmed() to authenticated;

-- ── Gates ─────────────────────────────────────────────────────
-- (1) Auftrag aufgeben nur verifiziert
drop policy if exists "Customers create jobs" on public.jobs;
create policy "Customers create jobs"
  on public.jobs for insert
  with check (auth.uid() = customer_id and auth_email_confirmed());

-- (2) Angebot abgeben nur verifiziert
drop policy if exists "Provider creates offers on open jobs" on public.offers;
create policy "Provider creates offers on open jobs"
  on public.offers for insert
  with check (
    auth.uid() = provider_id
    and auth_email_confirmed()
    and exists (
      select 1 from public.jobs j
      where j.id = job_id
        and j.status in ('open', 'matched')
    )
  );

-- (3) Angebot annehmen nur verifiziert
--     (vollständige Neudefinition von 0390 + Verifikations-Check)
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

  return next v_contract;
end;
$$;

revoke execute on function accept_offer(uuid, uuid) from public;
grant execute on function accept_offer(uuid, uuid) to authenticated;
