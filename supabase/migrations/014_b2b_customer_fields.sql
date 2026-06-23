-- Migration 014: B2B customer fields on profiles
-- Adds account_type (private|business), company_name, ust_id.
-- Nachbarschaft is gated to private accounts only (Scheinselbständigkeit risk for B2B).
-- Reverse-charge / §13b UStG invoicing uses ust_id to detect EU B2B transactions.

alter table public.profiles
  add column if not exists account_type text not null default 'private'
    check (account_type in ('private', 'business')),
  add column if not exists company_name  text,
  add column if not exists ust_id        text;

-- Update auth trigger to capture B2B fields from signup metadata.
-- Note: full_name/phone/email/plz/city are NOT yet in profiles at this point
-- (added by migration 018). Only insert columns available now.
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  v_role         text;
  v_name         text;
  v_account_type text;
begin
  v_role := coalesce(new.raw_user_meta_data->>'role', 'customer');
  if v_role not in ('customer', 'provider') then
    v_role := 'customer';
  end if;

  v_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    split_part(new.email, '@', 1)
  );
  v_account_type := coalesce(new.raw_user_meta_data->>'account_type', 'private');

  insert into public.profiles (id, role, display_name, account_type, company_name, ust_id)
  values (
    new.id,
    v_role,
    v_name,
    v_account_type,
    new.raw_user_meta_data->>'company_name',
    new.raw_user_meta_data->>'ust_id'
  );

  if v_role = 'provider' then
    insert into public.provider_profiles (id)
    values (new.id);
  end if;

  return new;
end;
$$;
