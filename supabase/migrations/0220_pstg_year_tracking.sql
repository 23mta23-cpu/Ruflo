-- Migration 022: PStTG year-tracking + annual report log
--
-- Problems fixed:
--   1. pstg_tx_count / pstg_revenue never reset at year boundary →
--      add pstg_year so release-escrow can detect year rollover and reset.
--   2. No audit trail for what was reported to BZSt →
--      add pstg_reports table to record each annual report run.

-- ── 1. Year column on profiles ─────────────────────────────────────────────
alter table public.profiles
  add column if not exists pstg_year integer not null default extract(year from now())::integer;

comment on column public.profiles.pstg_year is
  'Calendar year that pstg_tx_count and pstg_revenue refer to. '
  'release-escrow resets counters whenever the current year differs from this value.';

-- Backfill existing rows to current year (safe: counters are live for this year)
update public.profiles set pstg_year = extract(year from now())::integer where pstg_year is null;

-- ── 2. PStTG annual report log ─────────────────────────────────────────────
create table if not exists public.pstg_reports (
  id              uuid primary key default gen_random_uuid(),
  report_year     integer not null,
  provider_id     uuid not null references public.profiles(id) on delete cascade,
  tx_count        integer not null,
  revenue         numeric(12,2) not null,
  payout          numeric(12,2) not null,
  notified_at     timestamptz not null default now(),
  submitted_at    timestamptz,            -- set when XML report is actually sent to BZSt
  created_at      timestamptz not null default now(),
  unique (report_year, provider_id)
);

comment on table public.pstg_reports is
  'Audit log of PStTG (DAC7) annual reports. One row per provider per year who '
  'exceeded the §5 PStTG threshold (≥30 transactions OR ≥€2,000 revenue).';

-- RLS: providers can read their own report rows; nobody can write from client
alter table public.pstg_reports enable row level security;

create policy "Providers read own pstg reports"
  on public.pstg_reports for select
  using (auth.uid() = provider_id);

-- All writes go through service_role (Edge Functions only — no client INSERT/UPDATE)
