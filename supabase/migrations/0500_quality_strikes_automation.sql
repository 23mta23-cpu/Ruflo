-- 0500: Qualitäts- & Strike-Automatik (Founder-Entscheid 22.07., Option C)
--
-- Zwei Signale laufen im Anbieter-Qualitätsbild zusammen:
--   (1) Kontaktdaten-Leaks im Chat (chat_leak_flags, 0340) — halb-automatisch:
--       je FLAGS_PER_STRIKE erkannten Versuchen +1 Strike. Ein EINZELNER
--       Regex-Treffer vergibt bewusst KEINEN Strike (unzuverlässig, umgehbar,
--       unfair bei Fehlalarm — siehe 0340). Erst die Häufung sanktioniert.
--   (2) Schlechte Bewertungen (rating <= 2) — nur ein Zähler + Info-Banner im
--       Dashboard, KEIN automatischer Strike: eine subjektive Kundenmeinung
--       ist kein Regelverstoß, Auto-Sperre wäre unfair/rechtlich riskant.
-- Bei STRIKES_FOR_SUSPENSION Strikes wird der Anbieter gesperrt (kann keine
-- neuen Angebote mehr abgeben) — durchgesetzt in der offers-INSERT-Policy.

-- ── (2) Zähler für schlechte Bewertungen ─────────────────────────────────────
alter table public.provider_profiles
  add column if not exists bad_review_count integer not null default 0;

comment on column public.provider_profiles.bad_review_count is
  'Anzahl Bewertungen mit rating <= 2. Speist den Qualitäts-Info-Banner im '
  'Anbieter-Dashboard; löst KEINEN automatischen Strike aus.';

-- recompute_provider_ratings um bad_review_count erweitern (Rest unverändert
-- zu 0320 — create or replace ersetzt die ganze Funktion).
create or replace function recompute_provider_ratings()
returns trigger language plpgsql security definer as $$
declare
  v_provider_id uuid := new.reviewed_id;
begin
  if not exists (select 1 from public.provider_profiles where id = v_provider_id) then
    return new;
  end if;

  update public.provider_profiles p
  set
    rating_avg   = coalesce((
      select round(avg(r.rating)::numeric, 1) from public.reviews r
      where r.reviewed_id = v_provider_id
    ), 0),
    rating_count = (
      select count(*) from public.reviews r where r.reviewed_id = v_provider_id
    ),
    bad_review_count = (
      select count(*) from public.reviews r
      where r.reviewed_id = v_provider_id and r.rating <= 2
    ),
    rating_avg_handwerker = coalesce((
      select round(avg(r.rating)::numeric, 1)
      from public.reviews r join public.contracts c on c.id = r.contract_id
      where r.reviewed_id = v_provider_id and c.track = 'handwerker'
    ), 0),
    rating_count_handwerker = (
      select count(*)
      from public.reviews r join public.contracts c on c.id = r.contract_id
      where r.reviewed_id = v_provider_id and c.track = 'handwerker'
    ),
    rating_avg_nachbarschaft = coalesce((
      select round(avg(r.rating)::numeric, 1)
      from public.reviews r join public.contracts c on c.id = r.contract_id
      where r.reviewed_id = v_provider_id and c.track = 'nachbarschaft'
    ), 0),
    rating_count_nachbarschaft = (
      select count(*)
      from public.reviews r join public.contracts c on c.id = r.contract_id
      where r.reviewed_id = v_provider_id and c.track = 'nachbarschaft'
    ),
    updated_at = now()
  where p.id = v_provider_id;

  return new;
end;
$$;

-- ── (1) Kontaktdaten-Leaks → Strikes (Option C, halb-automatisch) ────────────
-- FLAGS_PER_STRIKE = 3: erst die dritte Häufung zählt als ein Strike.
create or replace function apply_leak_strikes()
returns trigger language plpgsql security definer as $$
declare
  v_flags  integer;
  v_target integer;
begin
  -- Nur Anbieter tragen strike_count; Kunden (Stripe-identifiziert) nicht.
  if not exists (select 1 from public.provider_profiles where id = new.sender_id) then
    return new;
  end if;

  select count(*) into v_flags
  from public.chat_leak_flags where sender_id = new.sender_id;

  v_target := floor(v_flags / 3.0);  -- FLAGS_PER_STRIKE = 3

  -- Strikes nie verringern (greatest), nur bei tatsächlichem Anstieg schreiben.
  update public.provider_profiles
     set strike_count = greatest(strike_count, v_target),
         updated_at   = now()
   where id = new.sender_id
     and strike_count < v_target;

  return new;
end;
$$;

drop trigger if exists trg_apply_leak_strikes on public.chat_leak_flags;
create trigger trg_apply_leak_strikes
  after insert on public.chat_leak_flags
  for each row execute function apply_leak_strikes();

-- ── Sperre bei 3 Strikes: gesperrter Anbieter kann nicht mehr bieten ─────────
-- Erweitert die 0480-Policy um das Suspension-Gate (STRIKES_FOR_SUSPENSION=3);
-- Track-Trennung bleibt unverändert erhalten.
drop policy if exists "Provider creates offers on open jobs" on public.offers;
create policy "Provider creates offers on open jobs"
  on public.offers for insert
  with check (
    auth.uid() = provider_id
    and auth_email_confirmed()
    and not exists (
      select 1 from public.provider_profiles pp
      where pp.id = auth.uid() and pp.strike_count >= 3
    )
    and exists (
      select 1 from public.jobs j
      where j.id = job_id
        and j.status in ('open', 'matched')
        and (
          j.track = 'nachbarschaft'
          or not exists (
            select 1 from public.provider_profiles pp
            where pp.id = auth.uid() and pp.is_nachbarschaft
          )
        )
    )
  );
