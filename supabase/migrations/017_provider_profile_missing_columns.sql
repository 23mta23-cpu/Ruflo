-- Migration 017: Add missing provider_profiles columns
-- These fields are in database.types.ts and queried by multiple screens,
-- but were never added via ALTER TABLE, causing runtime errors on a fresh DB.

alter table public.provider_profiles
  add column if not exists kyc_status       text not null default 'pending'
                            check (kyc_status in ('pending','approved','rejected')),
  add column if not exists meister_verified boolean      default false,
  add column if not exists is_nachbarschaft boolean      default false,
  add column if not exists trade_id         text,
  add column if not exists rating_avg       numeric(3,1) default 5.0,
  add column if not exists rating_count     integer      default 0;

-- Backfill kyc_status from the legacy kyc_verified boolean
update public.provider_profiles
  set kyc_status = case when kyc_verified then 'approved' else 'pending' end
  where true;

-- Update public search RLS to use kyc_status (canonical) alongside kyc_verified
drop policy if exists "Public can read active providers" on public.provider_profiles;

create policy "Public can read active providers"
  on public.provider_profiles for select
  using (available = true and kyc_status = 'approved');

comment on column public.provider_profiles.kyc_status is
  'Canonical KYC state. kyc_verified (bool) is legacy; use kyc_status for all new code.';
