-- Migration 019: Add provider_profiles columns used by code but never migrated
--
-- steuer_id     — tax ID stored by PStTG compliance flow (lib/pstTg.ts)
-- is_pro        — pro subscription flag read by anbieter.tsx display
-- pro_expires_at — subscription expiry used by pro.tsx
-- strike_count  — violation counter shown in admin/audit flows
--
-- phone, min_hourly_rate, radius_km, category_ids are already in the schema
-- (migration 001 + 010) but providerProfiles.ts still falls back to AsyncStorage
-- for them. Those columns exist; no ALTER TABLE needed.

alter table public.provider_profiles
  add column if not exists steuer_id      text,
  add column if not exists is_pro         boolean      not null default false,
  add column if not exists pro_expires_at timestamptz,
  add column if not exists strike_count   integer      not null default 0;

comment on column public.provider_profiles.steuer_id is
  'Provider Steuer-ID (tax number). Written by client; validated by PStTG compliance flow.';
comment on column public.provider_profiles.is_pro is
  'Whether provider has an active Pro subscription. Read-only on client — set by stripe-webhook Edge Function.';
comment on column public.provider_profiles.strike_count is
  'Number of quality strikes. Managed by admin/Edge Functions.';
