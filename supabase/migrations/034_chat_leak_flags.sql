-- Migration 034: persist anti-leakage detections from chat (lib/chatGuard.ts)
--
-- Context: chat.tsx already runs detectLeak() client-side and shows a soft
-- nudge (LEAKAGE_NUDGE) when a message looks like a phone number/IBAN/email.
-- AGB §7(2) lists "Beauftragung außerhalb der Plattform" as strike-worthy,
-- and provider_profiles.strike_count (migration 019) was added with the
-- comment "Managed by admin/audit flows" -- but no such flow existed; the
-- signal was shown to the user and then discarded.
--
-- This does NOT auto-issue strikes: a single regex match (phone/IBAN/email
-- pattern) is not proof of an actual off-platform deal, client-side
-- detection is trivially bypassed, and auto-sanctioning on an unreliable
-- signal is unfair to legitimate users and legally risky. Instead this
-- persists the flag so repeated patterns are visible for manual admin
-- review before a strike is applied (matches the "admin/audit flows"
-- comment on strike_count).

create table if not exists public.chat_leak_flags (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs(id) on delete cascade,
  sender_id   uuid not null references public.profiles(id),
  leak_types  text[] not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_chat_leak_flags_job on public.chat_leak_flags(job_id);
create index if not exists idx_chat_leak_flags_sender on public.chat_leak_flags(sender_id);

alter table public.chat_leak_flags enable row level security;

-- Sender may log a flag for a job they are a party to (customer or provider).
-- No select policy for authenticated users: this is an admin/audit signal,
-- not something either chat party should be able to read back about
-- themselves or the other side.
drop policy if exists chat_leak_flags_insert on public.chat_leak_flags;
create policy chat_leak_flags_insert on public.chat_leak_flags
  for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.jobs j
      where j.id = job_id and (j.customer_id = auth.uid() or j.provider_id = auth.uid())
    )
  );
