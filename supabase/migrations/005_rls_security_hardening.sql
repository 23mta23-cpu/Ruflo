-- ============================================================
-- WERKR Migration 005  –  RLS security hardening
-- ============================================================
-- Closes four critical/high gaps found in security audit:
--   C1 – contracts had no INSERT policy (any auth user could create)
--   C2 – contracts had no UPDATE policy (any auth user could complete/cancel)
--   H1 – provider_profiles UPDATE allowed setting stripe_onboarded,
--          kyc_status, meister_verified, pstg_locked client-side
--   H2 – profiles UPDATE allowed clients to escalate their role
--   H4 – offers INSERT had no guard that the target job is open
-- ============================================================

-- ── C1: contracts INSERT ─────────────────────────────────────
-- Only the job's customer may create a contract, and the job_id
-- must belong to them. Prevents impersonation or ghost contracts.

create policy "Customer creates own contracts"
  on public.contracts for insert
  with check (
    auth.uid() = customer_id
    and exists (
      select 1 from public.jobs j
      where j.id = job_id
        and j.customer_id = auth.uid()
    )
  );

-- ── C2: contracts UPDATE ─────────────────────────────────────
-- Both parties may update their own contract (e.g. status transitions).
-- Additional business rules (who can mark completed vs cancelled) are
-- enforced at the application layer; the DB policy enforces party membership.

create policy "Contract parties can update their contract"
  on public.contracts for update
  using (auth.uid() = customer_id or auth.uid() = provider_id)
  with check (auth.uid() = customer_id or auth.uid() = provider_id);

-- ── H2: block role escalation via profiles UPDATE ───────────────
-- Drop the permissive policy and replace with a column-restricted one.
-- The 'role' column must not be changeable by the user themselves.

drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- Prevent clients from escalating role or manipulating compliance fields.
    -- NOTE: PostgreSQL column-level security is not supported directly in
    -- RLS WITH CHECK; use a BEFORE UPDATE trigger to enforce column immutability.
    and true
  );

-- Trigger to block client-side mutations of sensitive profile columns.
create or replace function guard_profile_sensitive_cols()
returns trigger language plpgsql security definer as $$
begin
  if new.role is distinct from old.role then
    raise exception 'role cannot be changed after account creation';
  end if;
  if new.pstg_locked is distinct from old.pstg_locked then
    raise exception 'pstg_locked is managed by the compliance system';
  end if;
  return new;
end;
$$;

create trigger trg_guard_profile_sensitive_cols
  before update on public.profiles
  for each row execute function guard_profile_sensitive_cols();

-- ── H1: block stripe_onboarded + kyc escalation in provider_profiles ──
-- stripe_onboarded must ONLY be set via the Stripe Connect webhook
-- (account.updated, charges_enabled=true). ADR-0004, C-1.

create or replace function guard_provider_profile_sensitive_cols()
returns trigger language plpgsql security definer as $$
begin
  if new.stripe_onboarded is distinct from old.stripe_onboarded then
    raise exception 'stripe_onboarded is managed exclusively by the Stripe webhook (ADR-0004)';
  end if;
  if new.kyc_status is distinct from old.kyc_status then
    raise exception 'kyc_status is managed by the KYC review process';
  end if;
  if new.meister_verified is distinct from old.meister_verified then
    raise exception 'meister_verified is managed by the verification team';
  end if;
  if new.pstg_locked is distinct from old.pstg_locked then
    raise exception 'pstg_locked is managed by the compliance system';
  end if;
  return new;
end;
$$;

create trigger trg_guard_provider_profile_sensitive_cols
  before update on public.provider_profiles
  for each row execute function guard_provider_profile_sensitive_cols();

-- ── H4: offers INSERT must target an open job ────────────────
-- Drop and replace the provider offers INSERT policy to require
-- the target job to be in an open or matched state.

drop policy if exists "Provider creates offers" on public.offers;

create policy "Provider creates offers on open jobs"
  on public.offers for insert
  with check (
    auth.uid() = provider_id
    and exists (
      select 1 from public.jobs j
      where j.id = job_id
        and j.status in ('open', 'matched')
    )
  );
