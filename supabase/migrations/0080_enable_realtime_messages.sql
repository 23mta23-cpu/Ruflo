-- Enable Supabase Realtime on the messages table so chat screens
-- receive live updates without polling.
-- REPLICA IDENTITY FULL is required so UPDATE/DELETE events carry the full row.

alter table public.messages replica identity full;

-- Add messages to the realtime publication (idempotent on re-run).
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
