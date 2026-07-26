-- Anbieter-Posteingang: Auftrag lesbar halten, solange ein Gespräch existiert.
--
-- Befund (Founder-Gerätetest 26.07. / Review): Ein Anbieter stellt eine
-- Rückfrage zu einem offenen Auftrag. Bekommt anschließend ein ANDERER Anbieter
-- den Zuschlag, wechselt der Auftrag auf status='active' — damit greift weder
-- "Providers browse open jobs" (0470, nur open/matched) noch "Parties read own
-- jobs" (0010, nur customer_id/provider_id). Der Auftrag verschwindet für ihn
-- komplett.
--
-- Die messages-Policy (0510) lässt ihn seinen eigenen Thread weiterhin lesen —
-- er hat also einen Gesprächsverlauf zu einem Auftrag, den er nicht mehr
-- benennen kann. In der App war das eine Sackgasse: kein Posteingang, kein Weg
-- zurück in den Thread.
--
-- Diese Policy erlaubt genau das Nötige: Wer nachweislich in einem Thread zu
-- diesem Auftrag geschrieben oder geschrieben bekommen hat (messages.provider_id
-- = auth.uid()), darf die Auftragszeile weiter lesen.
--
-- Warum das vertretbar ist:
--   * Teilnahme ist nicht selbst herstellbar — um überhaupt in den Thread zu
--     kommen, musste die send-Policy (0510) passieren: verifiziert, nicht
--     gesperrt, passender Track, Auftrag zu dem Zeitpunkt offen.
--   * Der Auftrag war für diesen Anbieter ohnehin schon sichtbar, als er offen
--     war. Es entsteht kein Zugriff auf etwas vorher Verborgenes.
--   * Die Adresse liegt seit 0570 in job_addresses mit eigener Policy und
--     bleibt unberührt — es geht nur um Titel/Beschreibung/Status.
--   * Der Kundenname bleibt geschützt: profiles ist erst für Vertragsparteien
--     lesbar (0030). Der Posteingang zeigt vor Vertragsschluss bewusst "Kunde".

-- WICHTIG: Die Prüfung MUSS über eine security-definer-Funktion laufen.
-- Ein direktes "exists (select 1 from messages ...)" in der jobs-Policy erzeugt
-- eine Endlosschleife, weil die messages-Policy (0510) ihrerseits jobs liest
-- ("infinite recursion detected in policy for relation messages" — lokal beim
-- Migrations-Replay reproduziert). Die Funktion umgeht RLS und bricht den Zyklus.
create or replace function auth_is_thread_participant(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.messages m
    where m.job_id = p_job_id
      and m.provider_id = auth.uid()
  )
$$;

revoke execute on function auth_is_thread_participant(uuid) from public;
grant execute on function auth_is_thread_participant(uuid) to authenticated;

drop policy if exists "Thread participants read job" on public.jobs;
create policy "Thread participants read job"
  on public.jobs for select
  using (auth_is_thread_participant(id));
