-- Kein Angebot auf den EIGENEN Auftrag.
--
-- Befund aus dem Review des Chat-Rollen-Umbaus (26.07.): weder die
-- offers-INSERT-Policy noch accept_offer prüften customer_id <> provider_id.
-- Gegen frisch replayte Migrationen verifiziert: Selbst-Angebot UND
-- Selbst-Annahme waren erlaubt, Ergebnis war ein aktiver Vertrag mit
-- customer_id = provider_id.
--
-- Folgen: kaputte Rollenableitung im Chat (derselbe Nutzer ist beide Parteien),
-- sinnlose Escrow-/Gebührenbuchungen und ein offensichtlicher Weg, Umsatz und
-- Bewertungen künstlich zu erzeugen.
--
-- Die Client-Liste filtert das bereits heraus (app/(provider)/auftraege.tsx
-- via .neq('customer_id', user.id)) — das ist aber nur Kosmetik, die Lücke lag
-- in der Datenbank. Default-Deny gehört hierher.

-- ── (1) INSERT-Gate: Policy aus 0500 um die Selbst-Angebots-Sperre ergänzt ──
-- Alle bisherigen Bedingungen bleiben unverändert erhalten (E-Mail-Gate,
-- Strike-Sperre, Track-Trennung, Job-Status).
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
        and j.customer_id <> auth.uid()          -- NEU: kein Eigen-Angebot
        and (
          j.track = 'nachbarschaft'
          or not exists (
            select 1 from public.provider_profiles pp
            where pp.id = auth.uid() and pp.is_nachbarschaft
          )
        )
    )
  );

-- ── (2) Zweite Verteidigungslinie direkt an der Tabelle ─────────────────────
-- Greift auch für service_role/Edge Functions, die RLS umgehen.
create or replace function guard_no_self_offer()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  v_customer uuid;
begin
  select customer_id into v_customer from public.jobs where id = new.job_id;
  if v_customer is not null and v_customer = new.provider_id then
    raise exception 'Ein Angebot auf den eigenen Auftrag ist nicht zulaessig';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_no_self_offer on public.offers;
create trigger trg_guard_no_self_offer
  before insert or update of provider_id, job_id on public.offers
  for each row execute function guard_no_self_offer();
