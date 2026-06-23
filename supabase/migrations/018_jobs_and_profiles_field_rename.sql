-- Migration 018: Fix critical schema drift between code and migrations
--
-- Problems closed:
--   A. profiles missing columns that handle_new_user() trigger writes:
--      full_name, email, phone, plz, city
--   B. user_role domain referenced in trigger but never created
--   C. jobs missing columns that lib/jobs.ts reads/writes:
--      category (code uses this; schema has category_id)
--      address_city, address_plz, address_street
--
-- Strategy: add columns with IF NOT EXISTS (idempotent), backfill,
-- recreate handle_new_user() with correct column names.

-- ── A/B: user_role domain + profiles columns ─────────────────

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create domain user_role as text check (value in ('customer','provider'));
  end if;
end$$;

alter table public.profiles
  add column if not exists full_name  text,
  add column if not exists email      text,
  add column if not exists phone      text,
  add column if not exists plz        text,
  add column if not exists city       text;

-- Sync display_name → full_name for existing rows
update public.profiles
  set full_name = display_name
  where full_name is null and display_name is not null;

-- Recreate trigger to write to all profile columns correctly
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  v_role  text;
  v_name  text;
begin
  v_role := coalesce(new.raw_user_meta_data->>'role', 'customer');
  if v_role not in ('customer','provider') then
    v_role := 'customer';
  end if;

  v_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, role, full_name, display_name, phone, email, plz, city)
  values (
    new.id,
    v_role,
    v_name,
    v_name,
    new.raw_user_meta_data->>'phone',
    new.email,
    new.raw_user_meta_data->>'plz',
    new.raw_user_meta_data->>'city'
  )
  on conflict (id) do nothing;

  if v_role = 'provider' then
    insert into public.provider_profiles (id)
    values (new.id)
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

-- ── C: jobs missing address and category fields ───────────────

alter table public.jobs
  add column if not exists category       text,
  add column if not exists address_city   text,
  add column if not exists address_plz    text,
  add column if not exists address_street text;

-- Backfill: copy legacy category_id → category for existing rows
update public.jobs set category = category_id where category is null and category_id is not null;
