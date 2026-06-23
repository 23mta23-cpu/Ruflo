-- Migration 016: Add scheduled_at to jobs table
-- Migration 011 added scheduled_at to offers and the accept_offer RPC references
-- jobs.scheduled_at, but never ran ALTER TABLE jobs ADD COLUMN.
-- This migration closes that gap.
alter table public.jobs
  add column if not exists scheduled_at timestamptz;

comment on column public.jobs.scheduled_at is
  'Agreed appointment time, copied from offers.scheduled_at when offer is accepted.';
