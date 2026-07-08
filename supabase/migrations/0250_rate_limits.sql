-- Migration 025: Rate limiting store for public Edge Functions
--
-- Edge Functions are stateless across invocations/instances, so an in-memory
-- counter cannot enforce a limit reliably. This table + RPC gives every
-- function a shared, atomic sliding-window counter without new infra.
--
-- Usage (from an Edge Function, via service_role):
--   select allowed from public.check_rate_limit('ip:1.2.3.4:create-payment-intent', 20, 60);
-- Returns true if the call is within budget and records it; false (and does
-- NOT record) once the limit is hit for the current window.

create table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count integer not null default 0
);

-- No RLS policies are defined on purpose: this table is only ever touched
-- via the service_role client inside Edge Functions, same as other
-- service-role-only tables. RLS stays enabled so anon/authenticated roles
-- get zero access by default.
alter table public.rate_limits enable row level security;

create or replace function public.check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_now timestamptz := now();
  v_row public.rate_limits;
begin
  insert into public.rate_limits (key, window_start, count)
  values (p_key, v_now, 1)
  on conflict (key) do update
    set count = case
          when public.rate_limits.window_start <= v_now - make_interval(secs => p_window_seconds)
            then 1
          else public.rate_limits.count + 1
        end,
        window_start = case
          when public.rate_limits.window_start <= v_now - make_interval(secs => p_window_seconds)
            then v_now
          else public.rate_limits.window_start
        end
  returning * into v_row;

  return v_row.count <= p_limit;
end;
$$;

comment on function public.check_rate_limit is
  'Atomic sliding-window rate limit check. Returns true (and counts the call) if under budget, false if the window''s limit is already exceeded.';
