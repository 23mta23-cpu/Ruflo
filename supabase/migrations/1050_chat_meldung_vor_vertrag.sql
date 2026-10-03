-- Melden im Chat auch VOR Vertragsschluss (Befund 03.10.2026, Founder-Screenshot)
--
-- 0700 erlaubte eine Meldung nur zwischen den Parteien eines Auftrags:
-- `jobs.customer_id` und `jobs.provider_id`. `jobs.provider_id` wird aber erst
-- beim Vertrag gesetzt. Seit 0510 laeuft jeder Chat davor als Anfrage-Thread
-- (job, messages.provider_id). Genau dort werden Telefonnummern geschickt,
-- um die Plattform zu umgehen, und genau dort schlug „Melden" mit
-- „Melden hat nicht geklappt" fehl: die Policy fand keinen Anbieter am Auftrag.
--
-- Neu: zusaetzlich zur Vertragspartei darf melden, wer mit dem Gemeldeten
-- einen Anfrage-Thread zu DIESEM Auftrag hat (Kunde <-> Anbieter des Threads).
-- Ausserdem muss eine mitgegebene Nachricht zu diesem Auftrag gehoeren und vom
-- Gemeldeten stammen; sonst liesse sich eine Nachricht aus einem anderen
-- Vorgang einer fremden Person anheften.
--
-- Alle Spalten sind mit `chat_reports.` qualifiziert: `messages` hat selbst
-- eine Spalte `job_id`, ein unqualifiziertes `job_id` im Unterabfrage-FROM
-- wuerde still auf m.job_id zeigen und die Pruefung leer laufen lassen.

drop policy if exists chat_reports_insert on public.chat_reports;
create policy chat_reports_insert on public.chat_reports
  for insert
  with check (
    auth.uid() = chat_reports.reporter_id
    and (
      -- Vertragsparteien (wie 0700)
      exists (
        select 1 from public.jobs j
        where j.id = chat_reports.job_id
          and (j.customer_id = auth.uid() or j.provider_id = auth.uid())
          and (j.customer_id = chat_reports.reported_id
               or j.provider_id = chat_reports.reported_id)
      )
      -- Anfrage-Thread vor Vertragsschluss (0510)
      or exists (
        select 1 from public.jobs j
        join public.messages m on m.job_id = j.id
        where j.id = chat_reports.job_id
          and m.provider_id is not null
          and (
            (j.customer_id = auth.uid() and m.provider_id = chat_reports.reported_id)
            or (m.provider_id = auth.uid() and j.customer_id = chat_reports.reported_id)
          )
      )
    )
    and (
      chat_reports.message_id is null
      or exists (
        select 1 from public.messages m
        where m.id = chat_reports.message_id
          and m.job_id = chat_reports.job_id
          and m.sender_id = chat_reports.reported_id
      )
    )
  );
