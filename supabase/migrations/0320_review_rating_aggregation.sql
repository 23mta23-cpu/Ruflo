-- Migration 032: actually compute rating_avg/rating_count, split by track
--
-- Found while implementing the premortem's "Todesursache 4" fix
-- (docs/premortem_werkr.md): provider_profiles.rating_avg/rating_count
-- (added in migration 017) were read everywhere in the app but never
-- written anywhere — no trigger, no function, no Edge Function updated
-- them after a review was inserted. Every provider's displayed rating was
-- permanently the column default, disconnected from the reviews table.
--
-- Also implements the premortem's trust-signal-dilution fix: a Handwerker
-- rating and a Nachbarschaft-helper rating are not the same signal and must
-- not be blended into one score. reviews doesn't carry its own track
-- column, but the linked contract does (contracts.track) — use that.

alter table public.provider_profiles
  add column if not exists rating_avg_handwerker    numeric(3,1) default 0,
  add column if not exists rating_count_handwerker   integer      default 0,
  add column if not exists rating_avg_nachbarschaft  numeric(3,1) default 0,
  add column if not exists rating_count_nachbarschaft integer     default 0;

comment on column public.provider_profiles.rating_avg is
  'Combined rating across both tracks, kept for backward compatibility with screens not yet updated to the track-split columns. Prefer rating_avg_handwerker/rating_avg_nachbarschaft for new UI.';

create or replace function recompute_provider_ratings()
returns trigger language plpgsql security definer as $$
declare
  v_provider_id uuid := new.reviewed_id;
begin
  -- Only providers have a rating to maintain; reviews of customers (the
  -- reverse direction, e.g. provider rates customer) have no target row.
  if not exists (select 1 from public.provider_profiles where id = v_provider_id) then
    return new;
  end if;

  update public.provider_profiles p
  set
    rating_avg   = coalesce((
      select round(avg(r.rating)::numeric, 1) from public.reviews r
      where r.reviewed_id = v_provider_id
    ), 0),
    rating_count = (
      select count(*) from public.reviews r where r.reviewed_id = v_provider_id
    ),
    rating_avg_handwerker = coalesce((
      select round(avg(r.rating)::numeric, 1)
      from public.reviews r join public.contracts c on c.id = r.contract_id
      where r.reviewed_id = v_provider_id and c.track = 'handwerker'
    ), 0),
    rating_count_handwerker = (
      select count(*)
      from public.reviews r join public.contracts c on c.id = r.contract_id
      where r.reviewed_id = v_provider_id and c.track = 'handwerker'
    ),
    rating_avg_nachbarschaft = coalesce((
      select round(avg(r.rating)::numeric, 1)
      from public.reviews r join public.contracts c on c.id = r.contract_id
      where r.reviewed_id = v_provider_id and c.track = 'nachbarschaft'
    ), 0),
    rating_count_nachbarschaft = (
      select count(*)
      from public.reviews r join public.contracts c on c.id = r.contract_id
      where r.reviewed_id = v_provider_id and c.track = 'nachbarschaft'
    ),
    updated_at = now()
  where p.id = v_provider_id;

  return new;
end;
$$;

create trigger trg_recompute_provider_ratings
  after insert on public.reviews
  for each row execute function recompute_provider_ratings();
