-- Migration 009: Add cancellation fields to contracts + push_token to profiles
-- Needed by: cancel-contract Edge Function, lib/notifications.ts registerPushToken()

-- ── contracts: cancellation tracking ──────────────────────────────────────────
alter table public.contracts
  add column if not exists appointment_at      timestamptz,
  add column if not exists cancelled_at        timestamptz,
  add column if not exists cancellation_reason text;

-- ── profiles: push notification token ─────────────────────────────────────────
alter table public.profiles
  add column if not exists push_token text;

-- ── Index: fast lookup of active contracts by appointment time ─────────────────
create index if not exists idx_contracts_appointment_at
  on public.contracts (appointment_at)
  where status = 'active';
