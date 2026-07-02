-- ============================================================
-- WERKR Migration 004  –  contracts: indexes + constraints
-- ============================================================
--
-- Fixed 2026-07-02 after actually running the full migration chain against
-- a real Postgres database for the first time (previously only ever
-- read, never executed end to end). Two bugs, both now guarded:
--   1. idx_contracts_job collided with the identically-named index already
--      created (with IF NOT EXISTS) by migration 002b — this line errored
--      on any fresh, in-order apply.
--   2. Both triggers called set_updated_at(), a function never defined in
--      any migration. Migration 013 later establishes the correct pattern
--      (the standard `moddatetime` extension) — used here instead.
-- See migration 027 for an idempotent catch-up for environments that hit
-- the old broken version of this file before this fix landed.

create extension if not exists moddatetime;

-- ── Indexes ──────────────────────────────────────────────────

-- Needed by getMyContractsAsCustomer, getMyContractsAsProvider,
-- getContractByJobId, and the migration-003 RLS policy.
create index if not exists idx_contracts_customer on public.contracts(customer_id);
create index if not exists idx_contracts_provider on public.contracts(provider_id);
create index if not exists idx_contracts_job      on public.contracts(job_id);

-- Covers the EXISTS subquery in the migration-003 RLS policy
-- (profiles SELECT using contracts cross-party check).
create index if not exists idx_contracts_parties  on public.contracts(customer_id, provider_id);

-- ── updated_at ───────────────────────────────────────────────

alter table public.contracts
  add column if not exists updated_at timestamptz not null default now();

create or replace trigger trg_contracts_updated_at
  before update on public.contracts
  for each row execute procedure moddatetime(updated_at);

-- ── CHECK constraints ─────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_offers_price_positive') then
    alter table public.offers
      add constraint chk_offers_price_positive
        check (price > 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'chk_contracts_fees_nonneg') then
    alter table public.contracts
      add constraint chk_contracts_fees_nonneg
        check (
          price_gross         > 0
          and customer_total  > 0
          and provider_payout >= 0
          and werkr_schutz_fee        >= 0
          and customer_service_fee    >= 0
          and provider_commission     >= 0
        );
  end if;
end $$;

-- ── updated_at for offers ────────────────────────────────────

alter table public.offers
  add column if not exists updated_at timestamptz not null default now();

create or replace trigger trg_offers_updated_at
  before update on public.offers
  for each row execute procedure moddatetime(updated_at);
