-- Migration 038: Backfill fehlende Profile für bestehende Auth-User
--
-- Problem (real beobachtet, 2026-07-08):
--   Nach einem DB-Reset (`drop schema public cascade`) wurden alle
--   public.profiles-Zeilen gelöscht, die zugehörigen auth.users blieben
--   aber bestehen. Der handle_new_user()-Trigger feuert nur bei NEUEN
--   Signups, nicht rückwirkend. Folge: bereits registrierte Nutzer können
--   sich authentifizieren, haben aber kein Profil → Login bricht mit
--   „Profil konnte nicht geladen werden." ab (lib/auth.ts).
--
-- Fix: für jeden auth.users ohne profiles-Zeile ein Profil aus den
-- vorhandenen Metadaten anlegen — identisch zur Trigger-Logik (018).
-- Idempotent: `on conflict do nothing` + `where not exists`.

insert into public.profiles (id, role, full_name, display_name, phone, email, plz, city)
select
  u.id,
  case
    when coalesce(u.raw_user_meta_data->>'role', 'customer') in ('customer','provider')
      then coalesce(u.raw_user_meta_data->>'role', 'customer')
    else 'customer'
  end as role,
  coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)) as full_name,
  coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)) as display_name,
  u.raw_user_meta_data->>'phone' as phone,
  u.email,
  u.raw_user_meta_data->>'plz' as plz,
  u.raw_user_meta_data->>'city' as city
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
)
on conflict (id) do nothing;

-- Provider-Profile für Provider ohne provider_profiles-Zeile nachziehen
insert into public.provider_profiles (id)
select p.id
from public.profiles p
where p.role = 'provider'
  and not exists (
    select 1 from public.provider_profiles pp where pp.id = p.id
  )
on conflict (id) do nothing;
