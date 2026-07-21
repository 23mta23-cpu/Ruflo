-- 0490: Ungelesen-Status für Nachrichten (Art. Chat-UX, Kunden- & Anbieterseite)
-- read_at wird NICHT per direktem UPDATE-Recht gesetzt (Body bliebe sonst
-- durch dieselbe Policy änderbar), sondern über eine security-definer-RPC,
-- die die Job-Partei-Zugehörigkeit selbst prüft.

alter table public.messages add column if not exists read_at timestamptz;

create or replace function public.mark_messages_read(p_job_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.messages
     set read_at = now()
   where job_id = p_job_id
     and read_at is null
     and sender_id <> auth.uid()
     and auth.uid() in (
       select customer_id from public.jobs where id = p_job_id
       union
       select provider_id from public.jobs where id = p_job_id
     );
$$;

revoke all on function public.mark_messages_read(uuid) from public;
revoke all on function public.mark_messages_read(uuid) from anon;
grant execute on function public.mark_messages_read(uuid) to authenticated;
