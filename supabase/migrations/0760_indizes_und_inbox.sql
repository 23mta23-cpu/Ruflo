-- 0760: Die Abfragen, die mit dem Wachstum umkippen
--
-- ANLASS: Lead-Engineer-Review 06.09.2026. Alle bestehenden Pruefungen waren
-- gruen (tsc 0, Jest 389, DB-Test 166, deno check sauber) — sie messen aber
-- Korrektheit, nicht Verhalten unter Last. Gegen eine Testdatenbank mit
-- 50.000 Auftraegen und 40.000 Ratenbegrenzungs-Zeilen gemessen:
--
--   Anbieter-Feed          Seq Scan, 47.924 Zeilen verworfen, 1.224 Buffer, 10,3 ms
--   rate_limits-Aufraeumung Seq Scan, 373 Buffer, 10,7 ms — BEI JEDEM API-AUFRUF
--
-- Beides waechst linear mit der Tabelle. Bei 500.000 Auftraegen ist der Feed
-- bei ~100 ms, und zwar pro Anbieter pro App-Start.

-- ── 1. jobs hatte KEINEN einzigen Index ─────────────────────────────────────
-- Teilindizes: nur offene Auftraege. Ihr Anteil sinkt mit der Zeit (die
-- meisten Auftraege sind irgendwann abgeschlossen oder storniert), der Index
-- bleibt damit dauerhaft klein. Gemessen bei 50.000 Zeilen: 184 kB und 112 kB.
create index if not exists idx_jobs_feed_offen
  on public.jobs (track, created_at desc) where status = 'open';

create index if not exists idx_jobs_offen_alle
  on public.jobs (created_at desc) where status = 'open';

-- Eigene Auftraege des Kunden (lib/jobs.ts getMyOpenJobs).
create index if not exists idx_jobs_kunde
  on public.jobs (customer_id, status, created_at desc);

comment on index public.idx_jobs_feed_offen is
  'Anbieter-Feed: status=open + track, sortiert nach created_at. Ohne diesen '
  'Index las jeder App-Start die gesamte jobs-Tabelle (gemessen 10,3 ms bei '
  '50k Zeilen, 0,16 ms mit Index).';

-- ── 2. rate_limits: die Aufraeumung lief bei jedem Aufruf ueber die ganze Tabelle
-- `enforce_rate_limit` loescht zu Beginn alles aelter als 7 Tage. Ohne Index
-- auf window_start ist das ein Seq Scan — auch dann, wenn es nichts zu
-- loeschen gibt, was der Normalfall ist. Das traf JEDEN ratenbegrenzten
-- Endpunkt, also praktisch die gesamte API.
create index if not exists idx_rate_limits_fenster
  on public.rate_limits (window_start);

-- ── 3. messages: Index passte nicht zur Sortierung ──────────────────────────
-- Der Verlauf filtert (job_id, provider_id) und sortiert nach created_at. Der
-- bisherige Index deckte nur die beiden ersten Spalten ab, sortiert wurde
-- danach im Speicher.
create index if not exists idx_messages_verlauf
  on public.messages (job_id, provider_id, created_at);

-- Die Anbieter-Inbox filtert NUR nach provider_id. Als zweite Spalte eines
-- Index ist provider_id dafuer nutzlos.
create index if not exists idx_messages_anbieter
  on public.messages (provider_id, created_at desc);

-- Der alte Index ist jetzt ein Praefix von idx_messages_verlauf und damit
-- ueberfluessig. Ein ueberfluessiger Index kostet bei jedem INSERT Zeit.
drop index if exists public.idx_messages_job_provider;

-- ── 4. Inbox: aus einer unbegrenzten Abfrage wird eine begrenzte ────────────
-- Vorher holten beide Inbox-Funktionen SAEMTLICHE Nachrichten des Nutzers
-- ohne `limit`, sortierten sie und warfen in JavaScript alles weg ausser der
-- jeweils neuesten pro Gespraech. Bei 300 Gespraechen mit je 40 Nachrichten
-- gingen 12.000 Zeilen ueber die Leitung, um 300 anzuzeigen.
--
-- `distinct on` erledigt das in der Datenbank: das Ergebnis ist durch die
-- Zahl der GESPRAECHE begrenzt, nicht durch die Zahl der Nachrichten.
--
-- Bewusst SECURITY INVOKER (Voreinstellung): die RLS-Policies auf messages
-- und jobs gelten unveraendert weiter. Und bewusst ohne Parameter — der
-- Nutzer kommt aus auth.uid(), damit niemand das Postfach eines anderen
-- abfragen kann, indem er eine fremde ID uebergibt.

create or replace function public.konversationen_kunde()
returns table (
  job_id           uuid,
  job_titel        text,
  provider_id      uuid,
  business_name    text,
  letzte_nachricht text,
  letzte_am        timestamptz,
  von_mir          boolean
)
language sql
stable
set search_path = public
as $$
  select t.* from (
    select distinct on (m.job_id, m.provider_id)
           m.job_id,
           coalesce(j.title, 'Auftrag')            as job_titel,
           m.provider_id,
           coalesce(pp.business_name, 'Anbieter')  as business_name,
           m.body                                  as letzte_nachricht,
           m.created_at                            as letzte_am,
           (m.sender_id = auth.uid())              as von_mir
      from public.messages m
      join public.jobs j
        on j.id = m.job_id and j.customer_id = auth.uid()
      left join public.provider_public pp on pp.id = m.provider_id
     where m.provider_id is not null
     order by m.job_id, m.provider_id, m.created_at desc
  ) t
  order by t.letzte_am desc;
$$;

-- Erst loeschen: 0790 erweitert die Rueckgabe um `kunde_name`. `create or
-- replace` kann den Zeilentyp einer Funktion nicht aendern ("Row type defined
-- by OUT parameters is different") — im Wiederholungslauf scheitert diese
-- Datei sonst an ihrer eigenen spaeteren Fassung. Die Rechte werden weiter
-- unten in derselben Datei neu vergeben.
drop function if exists public.konversationen_anbieter();
create or replace function public.konversationen_anbieter()
returns table (
  job_id           uuid,
  job_titel        text,
  letzte_nachricht text,
  letzte_am        timestamptz,
  von_mir          boolean
)
language sql
stable
set search_path = public
as $$
  select t.* from (
    select distinct on (m.job_id)
           m.job_id,
           -- Migration 0590 haelt den Auftrag fuer Thread-Teilnehmer lesbar.
           -- Fehlt der Titel dennoch, bleibt der Thread erreichbar statt zu
           -- verschwinden — genau die Sackgasse aus dem Befund vom 26.07.
           coalesce(j.title, 'Auftrag nicht mehr verfügbar') as job_titel,
           m.body                     as letzte_nachricht,
           m.created_at               as letzte_am,
           (m.sender_id = auth.uid()) as von_mir
      from public.messages m
      left join public.jobs j on j.id = m.job_id
     where m.provider_id = auth.uid()
     order by m.job_id, m.created_at desc
  ) t
  order by t.letzte_am desc;
$$;

grant execute on function public.konversationen_kunde()    to authenticated;
grant execute on function public.konversationen_anbieter() to authenticated;

comment on function public.konversationen_kunde is
  'Kunden-Inbox: eine Zeile je (Auftrag, Anbieter). Ersetzt eine unbegrenzte '
  'Abfrage aller Nachrichten des Nutzers. Nutzer kommt aus auth.uid().';
