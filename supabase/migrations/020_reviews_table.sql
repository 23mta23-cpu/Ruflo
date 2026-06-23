-- Migration 020: Create reviews table
-- Reviews are written by customers after contract completion via bewertung.tsx.
-- reviewed_id is the provider being reviewed; reviewer_id is the customer.
-- Unique constraint: one review per (contract, reviewer) pair.

create table if not exists public.reviews (
  id           uuid        primary key default uuid_generate_v4(),
  contract_id  uuid        not null references public.contracts(id) on delete cascade,
  reviewer_id  uuid        not null references public.profiles(id),
  reviewed_id  uuid        not null references public.profiles(id),
  rating       integer     not null check (rating between 1 and 5),
  comment      text,
  created_at   timestamptz not null default now(),
  unique (contract_id, reviewer_id)
);

create index if not exists idx_reviews_reviewed_id on public.reviews(reviewed_id);
create index if not exists idx_reviews_reviewer_id on public.reviews(reviewer_id);
create index if not exists idx_reviews_contract_id  on public.reviews(contract_id);

-- RLS: anyone can read reviews; only the reviewer can insert their own.
alter table public.reviews enable row level security;

create policy "reviews_select" on public.reviews
  for select using (true);

create policy "reviews_insert" on public.reviews
  for insert with check (auth.uid() = reviewer_id);
