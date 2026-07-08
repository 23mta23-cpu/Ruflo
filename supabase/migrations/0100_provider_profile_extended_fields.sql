-- WERKR Migration 010 – Extend provider_profiles with local-only fields
-- Currently stored in AsyncStorage (werkr_provider_extras_v2).
-- Adding to DB enables cross-device sync and admin visibility.
-- After applying: update lib/providerProfiles.ts to read/write from DB.

alter table public.provider_profiles
  add column if not exists phone         text,
  add column if not exists min_hourly_rate numeric(10,2) default 13,
  add column if not exists radius_km     integer default 15,
  add column if not exists category_ids  text[] default '{}';
