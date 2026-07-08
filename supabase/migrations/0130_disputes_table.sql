-- WERKR Migration 013 – disputes table for Reklamation screen
-- Disputes are created by customers when a contract has issues.
-- Status is managed by WERKR support via service_role only.

create table if not exists public.disputes (
  id            uuid primary key default uuid_generate_v4(),
  contract_id   uuid not null references public.contracts(id) on delete cascade,
  reporter_id   uuid not null references public.profiles(id),
  case_id       text not null unique,
  category      text not null check (category in ('quality','noshow','price','damage','communication','other')),
  description   text not null check (char_length(description) >= 30),
  status        text not null default 'open' check (status in ('open','provider_response_pending','under_review','resolved')),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Index for fast lookup by contract
create index idx_disputes_contract on public.disputes(contract_id);
-- Index for reporter's open disputes
create index idx_disputes_reporter on public.disputes(reporter_id);

-- RLS: reporters can see their own disputes; no client-side status updates
alter table public.disputes enable row level security;

create policy "reporter can insert own dispute"
  on public.disputes for insert
  with check (auth.uid() = reporter_id);

create policy "reporter can view own disputes"
  on public.disputes for select
  using (auth.uid() = reporter_id);

-- updated_at trigger
create trigger trg_disputes_updated_at
  before update on public.disputes
  for each row execute procedure moddatetime(updated_at);
