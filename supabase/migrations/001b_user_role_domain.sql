-- Migration 001b: Create user_role domain before 002_auth_profile_trigger uses it
--
-- 001_initial_schema.sql creates tables but not the user_role domain.
-- 002_auth_profile_trigger.sql declares `v_role user_role` in PL/pgSQL which
-- requires the domain to exist at function-creation time (PostgreSQL validates
-- DECLARE types immediately). Without this file, migration 002 fails on a fresh
-- DB and no user can ever register.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create domain user_role as text check (value in ('customer', 'provider'));
  end if;
end$$;
