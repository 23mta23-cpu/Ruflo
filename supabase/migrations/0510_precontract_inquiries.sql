-- 0510: Vor-Vertrags-Rückfragen im Chat (Founder-Wunsch 22.07.)
--
-- Bisher: messages sind nur per job_id verknüpft, und nur der Kunde bzw. der
-- bereits zugewiesene jobs.provider_id durfte schreiben. Ein interessierter
-- Anbieter/Nachbarschaftshelfer konnte einen unklaren Auftrag NICHT rückfragen,
-- ohne vorher ein verbindliches Angebot abzugeben.
--
-- Neu: messages.provider_id macht jede Konversation zu einem (job, provider)-
-- Thread. So kann JEDER passende Anbieter eine Rückfrage stellen, der Kunde
-- sieht/beantwortet jede Rückfrage getrennt — und Anbieter B sieht die
-- Rückfrage von Anbieter A NICHT (Datenschutz zwischen konkurrierenden Anbietern).

alter table public.messages
  add column if not exists provider_id uuid references public.profiles(id);

-- Bestehende (Vertrags-)Nachrichten dem zugewiesenen Anbieter zuordnen.
update public.messages m
  set provider_id = j.provider_id
  from public.jobs j
  where j.id = m.job_id and j.provider_id is not null and m.provider_id is null;

create index if not exists idx_messages_job_provider
  on public.messages(job_id, provider_id);

-- ── RLS neu: Thread-Zugehörigkeit statt job.provider_id ──────────────────────
drop policy if exists "Job parties read messages" on public.messages;
create policy "Job parties read messages"
  on public.messages for select
  using (
    -- der Kunde des Auftrags sieht alle Threads seines Auftrags …
    auth.uid() = (select customer_id from public.jobs where id = job_id)
    -- … der Anbieter nur seinen eigenen Thread.
    or auth.uid() = provider_id
  );

drop policy if exists "Job parties send messages" on public.messages;
create policy "Job parties send messages"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and provider_id is not null
    and (
      -- Kunde antwortet in einem Thread seines Auftrags
      auth.uid() = (select customer_id from public.jobs where id = job_id)
      or
      -- Anbieter stellt/fortführt eine Rückfrage im EIGENEN Thread — nur wenn
      -- verifiziert, nicht gesperrt und Track passend (analog offers-Policy 0480/0500)
      (
        auth.uid() = provider_id
        and auth_email_confirmed()
        and not exists (
          select 1 from public.provider_profiles pp
          where pp.id = auth.uid() and pp.strike_count >= 3
        )
        and exists (
          select 1 from public.jobs j
          where j.id = job_id
            and (
              j.track = 'nachbarschaft'
              or not exists (
                select 1 from public.provider_profiles pp
                where pp.id = auth.uid() and pp.is_nachbarschaft
              )
            )
        )
      )
    )
  );

-- ── mark_messages_read thread-scoped (optionaler provider-Filter) ────────────
drop function if exists public.mark_messages_read(uuid);
create or replace function public.mark_messages_read(p_job_id uuid, p_provider_id uuid default null)
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
     and (p_provider_id is null or provider_id = p_provider_id)
     and (
       auth.uid() = (select customer_id from public.jobs where id = p_job_id)
       or auth.uid() = provider_id
     );
$$;

revoke all on function public.mark_messages_read(uuid, uuid) from public;
revoke all on function public.mark_messages_read(uuid, uuid) from anon;
grant execute on function public.mark_messages_read(uuid, uuid) to authenticated;
