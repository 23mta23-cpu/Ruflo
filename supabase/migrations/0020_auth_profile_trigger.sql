-- ============================================================
-- WERKR Migration 002  –  Auth → Profile auto-creation
-- ============================================================
-- Creates a trigger on auth.users so that every new Supabase
-- signup automatically gets a row in public.profiles.
-- The role is read from user_metadata supplied at signUp time
-- (defaults to 'customer' when not provided).
-- ============================================================

-- ── INSERT policy: users can insert their own profile row ────
-- (needed if the trigger runs with invoker rights instead of definer)

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Provider can insert own provider profile"
  on public.provider_profiles for insert
  with check (auth.uid() = id);

-- ── Function: create profile on signup ──────────────────────

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  v_role   text;
  v_name   text;
begin
  -- Read role from metadata; fall back to 'customer'
  v_role := coalesce(new.raw_user_meta_data->>'role', 'customer');
  if v_role not in ('customer', 'provider') then
    v_role := 'customer';
  end if;

  v_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    split_part(new.email, '@', 1)
  );

  -- Only insert columns that exist at migration-002 time.
  -- Migration 018 adds full_name/phone/email/plz/city and recreates this trigger.
  insert into public.profiles (id, role, display_name)
  values (new.id, v_role, v_name);

  -- For providers: also seed an empty provider_profiles row
  if v_role = 'provider' then
    insert into public.provider_profiles (id)
    values (new.id);
  end if;

  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
