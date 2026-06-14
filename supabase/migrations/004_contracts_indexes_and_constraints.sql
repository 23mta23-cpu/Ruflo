-- ============================================================
-- WERKR Migration 004  –  contracts: indexes + constraints
-- ============================================================

-- ── Indexes ──────────────────────────────────────────────────

-- Needed by getMyContractsAsCustomer, getMyContractsAsProvider,
-- getContractByJobId, and the migration-003 RLS policy.
create index idx_contracts_customer on public.contracts(customer_id);
create index idx_contracts_provider on public.contracts(provider_id);
create index idx_contracts_job      on public.contracts(job_id);

-- Covers the EXISTS subquery in the migration-003 RLS policy
-- (profiles SELECT using contracts cross-party check).
create index idx_contracts_parties  on public.contracts(customer_id, provider_id);

-- ── updated_at ───────────────────────────────────────────────

alter table public.contracts
  add column updated_at timestamptz not null default now();

create trigger trg_contracts_updated_at
  before update on public.contracts
  for each row execute function set_updated_at();

-- ── CHECK constraints ─────────────────────────────────────────

alter table public.offers
  add constraint chk_offers_price_positive
    check (price > 0);

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

-- ── updated_at for offers ────────────────────────────────────

alter table public.offers
  add column updated_at timestamptz not null default now();

create trigger trg_offers_updated_at
  before update on public.offers
  for each row execute function set_updated_at();
