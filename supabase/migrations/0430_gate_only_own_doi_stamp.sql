-- Migration 0430: Verifikations-Gate nur noch über den eigenen DOI-Stempel
--
-- Live-Befund 13.07. (E2E-Test nach Umstellung auf Autoconfirm): Mit
-- deaktiviertem "Confirm email" setzt Supabase bei JEDEM Signup sofort
-- auth.users.email_confirmed_at — der Alt-Nutzer-Kompatibilitätspfad
-- (OR email_confirmed_at) in 0400 schaltete damit ungewollt alle
-- Neu-Registrierungen frei (unverifizierter Testnutzer konnte einen Job
-- anlegen). Alt-Nutzer brauchen den Pfad nicht: Der 0400-Backfill hat
-- ihre Supabase-Bestätigung bereits nach profiles.email_verified_at
-- kopiert (er lief VOR der Autoconfirm-Umstellung).
--
-- Neu: einzig profiles.email_verified_at zählt — gesetzt ausschließlich
-- von der verify-email Edge Function (Guard-Trigger aus 0400).

create or replace function auth_email_confirmed()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and email_verified_at is not null
  )
$$;

-- Aufräumen: E2E-Testdaten des heutigen Live-Tests (Job entstand durch die
-- oben beschriebene Lücke; Testnutzer werkant.e2e.* sind Wegwerf-Konten).
delete from public.jobs where title = 'E2E Gate Test';
delete from auth.users where email like 'werkant.e2e.%@gmail.com';
