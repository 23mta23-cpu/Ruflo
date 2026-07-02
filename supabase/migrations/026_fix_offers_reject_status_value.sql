-- Migration 026: fix offers reject-policy status value mismatch
--
-- Migration 024's RLS policy allows a provider to flip a pending offer to
-- status = 'rejected'. But the offers table's CHECK constraint (migration
-- 002b) only allows status IN ('pending','accepted','declined','expired') —
-- 'rejected' is not a valid value. Every other place that declines an offer
-- (migration 006's accept_offer RPC, migration 011) correctly uses
-- 'declined'.
--
-- Net effect: the provider "Ablehnen" button's UPDATE passes the RLS check,
-- then fails the CHECK constraint and errors out — the exact silent-failure
-- class of bug migration 024 was written to fix, reintroduced by a wrong
-- status literal. Replace the policy to use the correct value.

drop policy if exists "Provider rejects own pending offer" on public.offers;

create policy "Provider rejects own pending offer"
  on public.offers for update
  using (
    provider_id = auth.uid()
    and status = 'pending'
  )
  with check (
    provider_id = auth.uid()
    and status = 'declined'
  );
