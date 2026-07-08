-- Enable Supabase Realtime on the tables needed for live UI updates.
-- REPLICA IDENTITY FULL is required so UPDATE/DELETE events carry the full row
-- (not just the primary key), which lets clients see what changed.

alter table public.offers    replica identity full;
alter table public.contracts replica identity full;

-- Add both tables to the realtime publication (idempotent on re-run).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'offers'
  ) then
    alter publication supabase_realtime add table public.offers;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'contracts'
  ) then
    alter publication supabase_realtime add table public.contracts;
  end if;
end $$;
