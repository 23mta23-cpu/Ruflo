-- Migration 027: fix two bugs in migration 004 that were never caught because
-- nobody had ever run the full migration chain against a fresh database
-- before this session.
--
-- Bug 1: `create index idx_contracts_job ...` (no IF NOT EXISTS) collides
-- with the identically-named index already created by migration 002b
-- (`create index if not exists idx_contracts_job ...`). On a fresh database
-- applied in order, 004 errors out at this line.
--
-- Bug 2: because psql runs a .sql file as autocommitted statements (not one
-- transaction), that error aborts the *rest* of 004 too — meaning
-- contracts.updated_at, its trigger, and BOTH check constraints
-- (chk_offers_price_positive, chk_contracts_fees_nonneg) may never have been
-- created, on ANY environment that ran 004 in full sequence. Migration 004
-- also references a trigger function `set_updated_at()` that is not defined
-- anywhere in this migration history — migration 013 later uses the correct
-- approach (the standard `moddatetime` extension), so this migration uses
-- that instead.
--
-- Everything below is written idempotently so it is safe to run regardless
-- of how much of 004 a given environment actually completed.

create extension if not exists moddatetime;

-- ── Indexes (idempotent — matches 002b's existing idx_contracts_job) ───────
create index if not exists idx_contracts_customer on public.contracts(customer_id);
create index if not exists idx_contracts_provider on public.contracts(provider_id);
create index if not exists idx_contracts_job      on public.contracts(job_id);
create index if not exists idx_contracts_parties  on public.contracts(customer_id, provider_id);

-- ── contracts.updated_at + trigger ──────────────────────────────────────────
alter table public.contracts
  add column if not exists updated_at timestamptz not null default now();

create or replace trigger trg_contracts_updated_at
  before update on public.contracts
  for each row execute procedure moddatetime(updated_at);

-- ── offers.updated_at + trigger ─────────────────────────────────────────────
alter table public.offers
  add column if not exists updated_at timestamptz not null default now();

create or replace trigger trg_offers_updated_at
  before update on public.offers
  for each row execute procedure moddatetime(updated_at);

-- ── CHECK constraints (Postgres has no ADD CONSTRAINT IF NOT EXISTS) ───────
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_offers_price_positive'
  ) then
    alter table public.offers
      add constraint chk_offers_price_positive check (price > 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'chk_contracts_fees_nonneg'
  ) then
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
