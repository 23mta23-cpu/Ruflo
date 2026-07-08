-- ============================================================
-- WERKR Migration 003  –  Cross-party profile visibility
-- ============================================================
-- Allows both parties in a contract to read each other's
-- base profile (full_name). Without this, the provider can't
-- see the customer name in their auftraege screen, and the
-- customer can't see the provider's base profile.
--
-- provider_profiles already has an "Anyone can view approved
-- provider profiles" policy covering business_name / ratings,
-- so this only needs to cover the base profiles table.
-- ============================================================

create policy "Contract parties can view each other's profile"
  on public.profiles for select
  using (
    exists (
      select 1 from public.contracts c
      where
        (c.customer_id = profiles.id and c.provider_id = auth.uid())
        or
        (c.provider_id = profiles.id and c.customer_id = auth.uid())
    )
  );
