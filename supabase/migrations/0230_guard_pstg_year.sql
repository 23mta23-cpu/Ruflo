-- Migration 023: Guard pstg_year from client-side writes
--
-- pstg_year was added in migration 022 but not protected by the guard trigger.
-- Like pstg_locked, it must only be written by release-escrow (service_role)
-- to prevent providers from gaming their threshold tracking.

create or replace function guard_profile_sensitive_cols()
returns trigger language plpgsql security definer as $$
begin
  -- Block role escalation
  if new.role is distinct from old.role then
    raise exception 'role cannot be changed after account creation';
  end if;

  -- Block client-side writes to pstg_locked (service_role only)
  if new.pstg_locked is distinct from old.pstg_locked then
    if current_setting('role', true) <> 'service_role' then
      raise exception 'pstg_locked is managed by the compliance system';
    end if;
  end if;

  -- Block client-side writes to pstg_year (service_role only)
  -- Prevents providers from rolling forward their year to reset threshold counters.
  if new.pstg_year is distinct from old.pstg_year then
    if current_setting('role', true) <> 'service_role' then
      raise exception 'pstg_year is managed by the compliance system';
    end if;
  end if;

  return new;
end;
$$;
