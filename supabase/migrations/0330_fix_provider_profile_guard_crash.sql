-- Migration 033: fix guard_provider_profile_sensitive_cols() referencing a
-- column that never existed on provider_profiles
--
-- CRITICAL, found while testing migration 032 against a real database:
-- guard_provider_profile_sensitive_cols() (migration 005) checks
-- `new.pstg_locked is distinct from old.pstg_locked` -- but pstg_locked was
-- only ever added to `profiles` (migration 012), never to
-- `provider_profiles`. Because trigger functions use the generic `record`
-- type for NEW/OLD, this doesn't fail at CREATE FUNCTION time -- it fails
-- at runtime, on literally every UPDATE to provider_profiles, with
-- "record new has no field pstg_locked".
--
-- Blast radius: this trigger fires on EVERY provider_profiles UPDATE,
-- including stripe-webhook's own write of stripe_onboarded=true after a
-- successful Connect onboarding (supabase/functions/stripe-webhook/index.ts)
-- -- meaning no provider could ever have been marked stripe_onboarded, and
-- therefore could never receive an escrow payout. Also breaks ordinary
-- profile edits (availability, bio, KYC status) from
-- app/(provider)/profil-bearbeiten.tsx. This has apparently never been
-- exercised against a schema with migration 005+ fully applied before now
-- -- caught by actually running the full migration chain + a functional
-- test (migration 032's review-rating test), not by reading the code.
--
-- Fix: drop the erroneous pstg_locked check. profiles.pstg_locked already
-- has its own, correct guard in guard_profile_sensitive_cols().

create or replace function guard_provider_profile_sensitive_cols()
returns trigger language plpgsql security definer as $$
begin
  if current_setting('role', true) = 'service_role' then
    return new;
  end if;

  if new.stripe_onboarded is distinct from old.stripe_onboarded then
    raise exception 'stripe_onboarded is managed exclusively by the Stripe webhook (ADR-0004)';
  end if;
  if new.kyc_status is distinct from old.kyc_status then
    raise exception 'kyc_status is managed by the KYC review process';
  end if;
  if new.meister_verified is distinct from old.meister_verified then
    raise exception 'meister_verified is managed by the verification team';
  end if;
  return new;
end;
$$;
