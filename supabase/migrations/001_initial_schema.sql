-- ============================================================
-- WERKR Initial Schema  –  Migration 001
-- ============================================================

-- ── Enums ────────────────────────────────────────────────────

create type user_role         as enum ('customer', 'provider');
create type kyc_status        as enum ('pending', 'approved', 'rejected');
create type job_status        as enum ('open', 'matched', 'contracted', 'in_progress', 'completed', 'cancelled', 'disputed');
create type offer_status      as enum ('pending', 'accepted', 'declined', 'expired');
create type contract_status   as enum ('pending', 'active', 'completed', 'disputed', 'cancelled');
create type message_type      as enum ('text', 'offer_card', 'system');
create type fee_track         as enum ('handwerker', 'nachbarschaft');

-- ── profiles (extends auth.users) ────────────────────────────

create table public.profiles (
  id              uuid        primary key references auth.users(id) on delete cascade,
  role            user_role   not null,
  full_name       text        not null,
  phone           text,
  email           text        not null,
  avatar_url      text,
  plz             text,
  city            text,
  -- PStTG tracking (§5 PStTG)
  pstg_tx_count   integer     not null default 0,
  pstg_revenue    numeric(12,2) not null default 0,
  pstg_locked     boolean     not null default false,
  -- Stripe
  stripe_customer_id  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- ── provider_profiles ────────────────────────────────────────

create table public.provider_profiles (
  id                  uuid        primary key references public.profiles(id) on delete cascade,
  business_name       text,
  trade_id            text,
  is_nachbarschaft    boolean     not null default false,
  -- Stripe Connect (ADR-0004: ONLY set via webhook account.updated charges_enabled=true)
  stripe_account_id   text,
  stripe_onboarded    boolean     not null default false,
  -- KYC
  kyc_status          kyc_status  not null default 'pending',
  steuer_id           text,
  meister_verified    boolean     not null default false,
  -- Pro
  is_pro              boolean     not null default false,
  pro_expires_at      timestamptz,
  -- Reputation
  rating_avg          numeric(3,2) not null default 0,
  rating_count        integer     not null default 0,
  strike_count        integer     not null default 0,
  -- Availability
  available           boolean     not null default true,
  bio                 text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.provider_profiles enable row level security;

create policy "Anyone can view approved provider profiles"
  on public.provider_profiles for select
  using (kyc_status = 'approved');

create policy "Provider can view own profile"
  on public.provider_profiles for select
  using (auth.uid() = id);

create policy "Provider can update own profile"
  on public.provider_profiles for update
  using (auth.uid() = id);

-- ── jobs ─────────────────────────────────────────────────────

create table public.jobs (
  id              uuid        primary key default gen_random_uuid(),
  customer_id     uuid        not null references public.profiles(id),
  provider_id     uuid        references public.provider_profiles(id),
  title           text        not null,
  description     text        not null,
  category        text        not null,
  track           fee_track   not null default 'handwerker',
  -- Address (street only visible after match)
  address_plz     text        not null,
  address_city    text        not null,
  address_street  text,
  -- Pricing
  price_gross     numeric(10,2),
  -- Status & timing
  status          job_status  not null default 'open',
  scheduled_at    timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.jobs enable row level security;

create policy "Customer sees own jobs"
  on public.jobs for select
  using (auth.uid() = customer_id);

create policy "Provider sees open or matched jobs"
  on public.jobs for select
  using (
    status = 'open'
    or provider_id = auth.uid()
  );

create policy "Customer creates jobs"
  on public.jobs for insert
  with check (auth.uid() = customer_id);

create policy "Customer updates own open jobs"
  on public.jobs for update
  using (auth.uid() = customer_id and status = 'open');

-- ── offers ───────────────────────────────────────────────────

create table public.offers (
  id              uuid        primary key default gen_random_uuid(),
  job_id          uuid        not null references public.jobs(id) on delete cascade,
  provider_id     uuid        not null references public.provider_profiles(id),
  price           numeric(10,2) not null,
  description     text,
  duration_hours  numeric(4,1),
  status          offer_status not null default 'pending',
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default (now() + interval '48 hours')
);

alter table public.offers enable row level security;

create policy "Provider sees own offers"
  on public.offers for select
  using (auth.uid() = provider_id);

create policy "Customer sees offers on own jobs"
  on public.offers for select
  using (
    exists (select 1 from public.jobs j where j.id = job_id and j.customer_id = auth.uid())
  );

create policy "Provider creates offers"
  on public.offers for insert
  with check (auth.uid() = provider_id);

create policy "Provider can update own pending offers"
  on public.offers for update
  using (auth.uid() = provider_id and status = 'pending');

-- ── contracts ────────────────────────────────────────────────

create table public.contracts (
  id                      uuid          primary key default gen_random_uuid(),
  job_id                  uuid          not null references public.jobs(id),
  offer_id                uuid          not null references public.offers(id),
  customer_id             uuid          not null references public.profiles(id),
  provider_id             uuid          not null references public.provider_profiles(id),
  -- Signatures
  customer_signed_at      timestamptz,
  provider_signed_at      timestamptz,
  -- Escrow (Stripe PaymentIntent)
  stripe_payment_intent   text,
  escrow_captured_at      timestamptz,
  escrow_released_at      timestamptz,
  -- Fees (snapshotted at contract creation)
  price_gross             numeric(10,2) not null,
  werkr_schutz_fee        numeric(10,2) not null default 0,
  customer_service_fee    numeric(10,2) not null default 0,
  provider_commission     numeric(10,2) not null default 0,
  customer_total          numeric(10,2) not null,
  provider_payout         numeric(10,2) not null,
  track                   fee_track     not null,
  -- Status
  status                  contract_status not null default 'pending',
  completed_at            timestamptz,
  cancelled_at            timestamptz,
  created_at              timestamptz not null default now()
);

alter table public.contracts enable row level security;

create policy "Both parties see their contracts"
  on public.contracts for select
  using (auth.uid() = customer_id or auth.uid() = provider_id);

-- ── messages ─────────────────────────────────────────────────

create table public.messages (
  id          uuid        primary key default gen_random_uuid(),
  job_id      uuid        not null references public.jobs(id) on delete cascade,
  sender_id   uuid        not null references public.profiles(id),
  content     text        not null,
  type        message_type not null default 'text',
  offer_id    uuid        references public.offers(id),
  created_at  timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "Both job parties see messages"
  on public.messages for select
  using (
    exists (
      select 1 from public.jobs j
      where j.id = job_id
      and (j.customer_id = auth.uid() or j.provider_id = auth.uid())
    )
  );

create policy "Job parties can send messages"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.jobs j
      where j.id = job_id
      and (j.customer_id = auth.uid() or j.provider_id = auth.uid())
    )
  );

-- ── reviews ──────────────────────────────────────────────────

create table public.reviews (
  id              uuid        primary key default gen_random_uuid(),
  contract_id     uuid        not null references public.contracts(id),
  reviewer_id     uuid        not null references public.profiles(id),
  reviewed_id     uuid        not null references public.profiles(id),
  rating          smallint    not null check (rating between 1 and 5),
  comment         text,
  created_at      timestamptz not null default now(),
  unique (contract_id, reviewer_id)
);

alter table public.reviews enable row level security;

create policy "Reviews are public"
  on public.reviews for select using (true);

create policy "Reviewer can create review after contract completed"
  on public.reviews for insert
  with check (
    auth.uid() = reviewer_id
    and exists (
      select 1 from public.contracts c
      where c.id = contract_id
      and c.status = 'completed'
      and (c.customer_id = auth.uid() or c.provider_id = auth.uid())
    )
  );

-- ── Trigger: update provider rating on new review ────────────

create or replace function update_provider_rating()
returns trigger language plpgsql security definer as $$
begin
  update public.provider_profiles
  set
    rating_avg   = (select round(avg(rating)::numeric, 2) from public.reviews where reviewed_id = new.reviewed_id),
    rating_count = (select count(*) from public.reviews where reviewed_id = new.reviewed_id)
  where id = new.reviewed_id;
  return new;
end;
$$;

create trigger trg_update_provider_rating
  after insert on public.reviews
  for each row execute function update_provider_rating();

-- ── Trigger: updated_at timestamps ───────────────────────────

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function set_updated_at();

create trigger trg_provider_profiles_updated_at
  before update on public.provider_profiles
  for each row execute function set_updated_at();

create trigger trg_jobs_updated_at
  before update on public.jobs
  for each row execute function set_updated_at();

-- ── Indexes ──────────────────────────────────────────────────

create index idx_jobs_status        on public.jobs(status);
create index idx_jobs_plz           on public.jobs(address_plz);
create index idx_jobs_category      on public.jobs(category);
create index idx_jobs_customer      on public.jobs(customer_id);
create index idx_jobs_provider      on public.jobs(provider_id);
create index idx_offers_job         on public.offers(job_id);
create index idx_offers_provider    on public.offers(provider_id);
create index idx_messages_job       on public.messages(job_id);
create index idx_messages_created   on public.messages(job_id, created_at);
create index idx_reviews_reviewed   on public.reviews(reviewed_id);
create index idx_provider_available on public.provider_profiles(available, kyc_status);
