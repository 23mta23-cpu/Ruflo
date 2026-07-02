-- Migration 036: Double-Opt-In for the waitlist (UWG §7 compliance)
--
-- Marketing emails to waitlist signups require confirmed consent in
-- Germany (double opt-in is the de-facto legal standard). Adds a random
-- confirmation token and a confirmed_at timestamp; the waitlist-doi Edge
-- Function emails the confirm link and flips confirmed_at on click.
-- Unconfirmed entries MUST NOT receive marketing mail.

alter table public.waitlist
  add column if not exists confirm_token uuid not null default gen_random_uuid(),
  add column if not exists confirmed_at  timestamptz;

create index if not exists idx_waitlist_confirm_token on public.waitlist(confirm_token);

comment on column public.waitlist.confirmed_at is
  'Set by waitlist-doi Edge Function when the user clicks the confirm link. NULL = no marketing emails allowed (UWG §7).';
