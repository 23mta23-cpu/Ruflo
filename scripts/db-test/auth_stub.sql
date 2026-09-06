create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  email_confirmed_at timestamptz,
  created_at timestamptz default now()
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(current_setting('request.jwt.claim.role', true), 'authenticated')
$$;
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb
$$;
create or replace function auth.email() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claim.email', true), '')
$$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
-- In echtem Supabase hat service_role BYPASSRLS. Ohne das Attribut verhaelt
-- sich der Stub strenger als die Produktion, und Tests, die den Weg der Edge
-- Functions nachstellen, scheitern an RLS statt an echter Logik.
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then
  begin alter role service_role bypassrls; exception when others then null; end;
end $$;
-- In echtem Supabase duerfen anon/authenticated das auth-Schema benutzen und
-- auth.uid() ausfuehren — anders koennte keine einzige RLS-Policy arbeiten,
-- denn `auth.uid() = user_id` wird in der Rolle des Aufrufers ausgewertet.
-- Ohne diese Grants war der Stub strenger als die Produktion: eine Funktion
-- mit SECURITY INVOKER scheiterte hier an "permission denied for schema auth",
-- obwohl sie live laeuft. Dieselbe Klasse wie das fehlende BYPASSRLS oben.
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid()   to anon, authenticated, service_role;
grant execute on function auth.role()  to anon, authenticated, service_role;
grant execute on function auth.jwt()   to anon, authenticated, service_role;
grant execute on function auth.email() to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;

create extension if not exists pgcrypto;
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now()
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text, name text,
  owner uuid, created_at timestamptz default now()
);
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
  select string_to_array(name, '/')
$$;
do $$ begin create publication supabase_realtime; exception when duplicate_object then null; end $$;
