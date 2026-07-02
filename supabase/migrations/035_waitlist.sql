-- Migration 035: nationwide waitlist
--
-- Product decision (see notes/04-Entscheidungen): WERKR launches
-- operationally in Köln only, but wants nationwide awareness from day 1.
-- Users outside the active city can't create a job yet (see
-- lib/cities.ts ACTIVE_CITIES) and are routed to a waitlist instead, so
-- interest is captured rather than lost -- and so premature multi-city
-- job postings don't dilute the liquidity of the one city that's actually
-- live (docs/premortem_werkr.md, Todesursache 1).

create table if not exists public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  city        text not null,
  plz         text,
  source      text not null default 'landing',
  user_id     uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);

create index if not exists idx_waitlist_city on public.waitlist(lower(city));

alter table public.waitlist enable row level security;

-- Open signup: unauthenticated visitors on the landing page must be able
-- to join. No PII beyond email/city/plz is collected, and there is no
-- select policy for anon/authenticated -- entries are only readable via
-- service_role (admin export for city-launch prioritization).
drop policy if exists waitlist_insert_anyone on public.waitlist;
create policy waitlist_insert_anyone on public.waitlist
  for insert
  with check (true);
