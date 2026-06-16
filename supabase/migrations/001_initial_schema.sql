-- WERKR Initial Schema
-- Run in Supabase Dashboard → SQL Editor
-- Project: chnphpmpdpllnpqtvwhx.supabase.co

-- ── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Users (mirrors auth.users, holds app-level profile) ─────────────────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          text not null check (role in ('customer', 'provider')),
  display_name  text,
  avatar_url    text,
  created_at    timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ── Provider profiles ────────────────────────────────────────────────────────
create table if not exists public.provider_profiles (
  id               uuid primary key references public.profiles(id) on delete cascade,
  business_name    text,
  bio              text,
  phone            text,
  min_hourly_rate  numeric(10,2) default 13,
  radius_km        integer default 15,
  category_ids     text[] default '{}',
  available        boolean default true,
  -- ADR-0004: stripe_onboarded is ONLY written by the webhook Edge Function
  stripe_onboarded boolean default false,
  kyc_verified     boolean default false,
  -- PStTG counters (current calendar year)
  pstTg_job_count    integer default 0,
  pstTg_revenue_eur  numeric(12,2) default 0,
  pstTg_tax_id       text,
  pstTg_frozen       boolean default false,
  updated_at       timestamptz default now()
);

alter table public.provider_profiles enable row level security;

create policy "Providers read own profile"
  on public.provider_profiles for select
  using (auth.uid() = id);

create policy "Providers update own profile (no stripe flag)"
  on public.provider_profiles for update
  using (auth.uid() = id)
  with check (stripe_onboarded = (select stripe_onboarded from public.provider_profiles where id = auth.uid()));

-- Public read for search (limited columns)
create policy "Public can read active providers"
  on public.provider_profiles for select
  using (available = true and kyc_verified = true);

-- ── Jobs ─────────────────────────────────────────────────────────────────────
create table if not exists public.jobs (
  id           uuid primary key default uuid_generate_v4(),
  customer_id  uuid not null references public.profiles(id),
  provider_id  uuid references public.profiles(id),
  category_id  text not null,
  title        text not null,
  description  text,
  address      text,
  status       text not null default 'open'
               check (status in ('open','matched','active','completed','cancelled','disputed')),
  gross_eur    numeric(10,2),
  track        text not null default 'handwerker' check (track in ('handwerker','nachbarschaft')),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

alter table public.jobs enable row level security;

create policy "Parties read own jobs"
  on public.jobs for select
  using (auth.uid() = customer_id or auth.uid() = provider_id);

create policy "Customers create jobs"
  on public.jobs for insert
  with check (auth.uid() = customer_id);

-- ── Messages ─────────────────────────────────────────────────────────────────
create table if not exists public.messages (
  id           uuid primary key default uuid_generate_v4(),
  job_id       uuid not null references public.jobs(id) on delete cascade,
  sender_id    uuid not null references public.profiles(id),
  sender_role  text not null check (sender_role in ('customer','provider')),
  body         text not null check (char_length(body) between 1 and 2000),
  created_at   timestamptz default now()
);

alter table public.messages enable row level security;

create policy "Job parties read messages"
  on public.messages for select
  using (
    auth.uid() in (
      select customer_id from public.jobs where id = job_id
      union
      select provider_id from public.jobs where id = job_id
    )
  );

create policy "Job parties send messages"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and auth.uid() in (
      select customer_id from public.jobs where id = job_id
      union
      select provider_id from public.jobs where id = job_id
    )
  );

-- ── Realtime: enable for messages table ──────────────────────────────────────
alter publication supabase_realtime add table public.messages;

-- ── Pro subscriptions (local state only until Stripe Billing is live) ────────
create table if not exists public.pro_subscriptions (
  id              uuid primary key default uuid_generate_v4(),
  provider_id     uuid not null references public.provider_profiles(id) on delete cascade,
  status          text not null default 'inactive'
                  check (status in ('inactive','trialing','active','cancel_scheduled','cancelled')),
  stripe_sub_id   text,                        -- set by webhook only (ADR-0004)
  period_start    timestamptz,
  period_end      timestamptz,
  trial_used      boolean default false,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table public.pro_subscriptions enable row level security;

create policy "Providers read own subscription"
  on public.pro_subscriptions for select
  using (auth.uid() = provider_id);
