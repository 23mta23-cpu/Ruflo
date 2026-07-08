-- WERKR Migration 012 – PStTG compliance columns on profiles
-- Adds pstg_tx_count, pstg_revenue, pstg_locked to profiles table.
-- These are updated exclusively by the release-escrow Edge Function (service_role).
-- The guard_profile_sensitive_cols trigger is updated to allow service_role writes.

alter table public.profiles
  add column if not exists pstg_tx_count integer     not null default 0,
  add column if not exists pstg_revenue  numeric(12,2) not null default 0,
  add column if not exists pstg_locked   boolean     not null default false;

-- Update the guard trigger to allow service_role to change pstg_locked.
-- Client-side writes are still blocked; only Edge Functions (service_role) may set it.
create or replace function guard_profile_sensitive_cols()
returns trigger language plpgsql security definer as $$
begin
  if new.role is distinct from old.role then
    raise exception 'role cannot be changed after account creation';
  end if;
  -- Allow service_role (Edge Functions) to manage pstg_locked.
  if new.pstg_locked is distinct from old.pstg_locked then
    if current_setting('role', true) <> 'service_role' then
      raise exception 'pstg_locked is managed by the compliance system';
    end if;
  end if;
  return new;
end;
$$;
