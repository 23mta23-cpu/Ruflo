-- ============================================================
-- WERKR Migration 002b  –  contracts + offers base tables
-- ============================================================
-- ORDERING: must run AFTER 002 (profiles/jobs exist) and BEFORE 003
-- (003 adds an RLS policy that references public.contracts). The "002b"
-- prefix sorts lexically between "002_" and "003_".
--
-- WHY THIS EXISTS: migrations 003–006 + the accept_offer RPC reference
-- public.contracts and public.offers, but no committed migration ever
-- created them — they were created manually in the dev project and never
-- version-controlled. A fresh `supabase db push` (production) fails at 003
-- without this file.
--
-- ⚠️ RECONSTRUCTED from authoritative SQL sources (accept_offer RPC in
-- migration 011, the four Edge Functions, and the column references in
-- migrations 003/004/005). database.types.ts was NOT used as the source of
-- truth because it demonstrably diverges from the real schema (e.g. the jobs
-- table). Before the production push, validate this against the real dev
-- schema:  supabase db dump --schema public  (diff the contracts/offers DDL).
--
-- All statements are idempotent (if not exists / if exists) so re-running on
-- the dev project — which already has these tables — is a no-op.
-- ============================================================

-- ── offers ───────────────────────────────────────────────────
-- Created before contracts because contracts.offer_id references offers(id).
create table if not exists public.offers (
  id              uuid primary key default uuid_generate_v4(),
  job_id          uuid not null references public.jobs(id) on delete cascade,
  provider_id     uuid not null references public.profiles(id),
  price           numeric(10,2) not null,
  description     text,
  duration_hours  numeric(5,1),
  status          text not null default 'pending'
                    check (status in ('pending','accepted','declined','expired')),
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default (now() + interval '7 days')
  -- NOTE: updated_at added by migration 004, scheduled_at by migration 011.
);

create index if not exists idx_offers_job      on public.offers(job_id);
create index if not exists idx_offers_provider on public.offers(provider_id);

alter table public.offers enable row level security;

-- Read: the job owner (customer) and the offering provider can see the offer.
create policy "Offer parties read offers"
  on public.offers for select
  using (
    auth.uid() = provider_id
    or exists (
      select 1 from public.jobs j
      where j.id = offers.job_id and j.customer_id = auth.uid()
    )
  );

-- Base INSERT policy. Migration 005 (H4) drops this exact policy name and
-- replaces it with an "on open jobs" guarded version — keep the name in sync.
create policy "Provider creates offers"
  on public.offers for insert
  with check (auth.uid() = provider_id);

-- ── contracts ────────────────────────────────────────────────
-- Both customer_id and provider_id reference profiles(id) (= auth.uid()),
-- confirmed by the migration-003 RLS policy (c.provider_id = auth.uid()).
create table if not exists public.contracts (
  id                    uuid primary key default uuid_generate_v4(),
  job_id                uuid not null references public.jobs(id) on delete cascade,
  offer_id              uuid references public.offers(id),
  customer_id           uuid not null references public.profiles(id),
  provider_id           uuid not null references public.profiles(id),
  customer_signed_at    timestamptz,
  provider_signed_at    timestamptz,
  stripe_payment_intent text,
  escrow_captured_at    timestamptz,
  escrow_released_at    timestamptz,
  price_gross           numeric(10,2) not null,
  werkr_schutz_fee      numeric(10,2) not null default 0,
  customer_service_fee  numeric(10,2) not null default 0,
  provider_commission   numeric(10,2) not null default 0,
  customer_total        numeric(10,2) not null,
  provider_payout       numeric(10,2) not null,
  track                 text not null default 'handwerker'
                          check (track in ('handwerker','nachbarschaft')),
  status                text not null default 'pending'
                          check (status in ('pending','active','completed','disputed','cancelled')),
  completed_at          timestamptz,
  cancelled_at          timestamptz,
  created_at            timestamptz not null default now()
  -- NOTE: updated_at + fee-nonneg CHECK added by migration 004.
);

create index if not exists idx_contracts_job on public.contracts(job_id);

alter table public.contracts enable row level security;

-- Read: either party can read their own contracts. INSERT and UPDATE policies
-- are added by migration 005 (C1/C2); this file only provides the base SELECT.
create policy "Contract parties read own contracts"
  on public.contracts for select
  using (auth.uid() = customer_id or auth.uid() = provider_id);
