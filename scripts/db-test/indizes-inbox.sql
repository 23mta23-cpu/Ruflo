-- Indizes und Inbox-Abfragen (Migration 0760)
--
-- Anlass: Lead-Engineer-Review. Alle bestehenden Pruefungen waren gruen, weil
-- sie Korrektheit messen und nicht Verhalten unter Last. Auf `jobs` lag kein
-- einziger Index, und die Aufraeumung in `rate_limits` las bei JEDEM
-- API-Aufruf die ganze Tabelle.
--
-- (IA) Die drei jobs-Indizes existieren
-- (IB) rate_limits hat einen Index auf window_start
-- (IC) messages-Indizes passen zu den Abfragen, der ueberfluessige ist weg
-- (ID) Kunden-Inbox: eine Zeile je (Auftrag, Anbieter), neueste zuerst
-- (IE) Anbieter-Inbox: eine Zeile je Auftrag
-- (IF) Die Inbox zeigt NUR eigene Gespraeche — auch wenn ein anderer fragt
reset role;

alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;
alter table public.jobs disable trigger user;
alter table public.messages disable trigger user;

insert into auth.users (id,email,email_confirmed_at) values
  ('fa000001-0000-0000-0000-000000000000','ik@test.de',now()),   -- Kunde
  ('fa000002-0000-0000-0000-000000000000','ia@test.de',now()),   -- Anbieter A
  ('fa000003-0000-0000-0000-000000000000','ib@test.de',now()),   -- Anbieter B
  ('fa000004-0000-0000-0000-000000000000','ic@test.de',now());   -- fremder Kunde
insert into profiles (id,role,email,email_verified_at) values
  ('fa000001-0000-0000-0000-000000000000','customer','ik@test.de',now()),
  ('fa000002-0000-0000-0000-000000000000','provider','ia@test.de',now()),
  ('fa000003-0000-0000-0000-000000000000','provider','ib@test.de',now()),
  ('fa000004-0000-0000-0000-000000000000','customer','ic@test.de',now());
insert into provider_profiles (id,business_name,is_nachbarschaft) values
  ('fa000002-0000-0000-0000-000000000000','Betrieb A',false),
  ('fa000003-0000-0000-0000-000000000000','Betrieb B',false);
insert into jobs (id,customer_id,title,description,category,address_plz,address_city,track,status) values
  ('fa000010-0000-0000-0000-000000000000','fa000001-0000-0000-0000-000000000000','Auftrag Eins','Lang genug beschrieben hier drin.','Elektro','50667','Koeln','handwerker','open'),
  ('fa000011-0000-0000-0000-000000000000','fa000001-0000-0000-0000-000000000000','Auftrag Zwei','Lang genug beschrieben hier drin.','Sanitär','50667','Koeln','handwerker','open'),
  ('fa000012-0000-0000-0000-000000000000','fa000004-0000-0000-0000-000000000000','Fremder Auftrag','Lang genug beschrieben hier drin.','Maler','50667','Koeln','handwerker','open');

-- Auftrag 1: zwei Anbieter-Threads, je zwei Nachrichten.
insert into messages (job_id,provider_id,sender_id,sender_role,body,created_at) values
  ('fa000010-0000-0000-0000-000000000000','fa000002-0000-0000-0000-000000000000','fa000002-0000-0000-0000-000000000000','provider','A alt',   now()-interval '3 hours'),
  ('fa000010-0000-0000-0000-000000000000','fa000002-0000-0000-0000-000000000000','fa000001-0000-0000-0000-000000000000','customer','A neu',   now()-interval '1 hour'),
  ('fa000010-0000-0000-0000-000000000000','fa000003-0000-0000-0000-000000000000','fa000003-0000-0000-0000-000000000000','provider','B alt',   now()-interval '4 hours'),
  ('fa000010-0000-0000-0000-000000000000','fa000003-0000-0000-0000-000000000000','fa000003-0000-0000-0000-000000000000','provider','B neu',   now()-interval '2 hours'),
  ('fa000011-0000-0000-0000-000000000000','fa000002-0000-0000-0000-000000000000','fa000002-0000-0000-0000-000000000000','provider','Zwei A',  now()-interval '30 minutes'),
  ('fa000012-0000-0000-0000-000000000000','fa000002-0000-0000-0000-000000000000','fa000002-0000-0000-0000-000000000000','provider','Fremd',   now()-interval '10 minutes');

alter table auth.users enable trigger user;
alter table public.profiles enable trigger user;
alter table public.jobs enable trigger user;
alter table public.messages enable trigger user;

-- TEST IA: ohne diese drei Indizes las jeder App-Start die ganze jobs-Tabelle.
do $$
declare fehlt text := '';
begin
  foreach fehlt in array array['idx_jobs_feed_offen','idx_jobs_offen_alle','idx_jobs_kunde'] loop
    if not exists (select 1 from pg_indexes where schemaname='public' and indexname=fehlt) then
      raise exception 'FAIL: Index % fehlt — der Anbieter-Feed faellt auf Seq Scan zurueck', fehlt;
    end if;
  end loop;
  raise notice 'PASS IA: die drei jobs-Indizes existieren';
end $$;

-- TEST IB: die Aufraeumung laeuft bei JEDEM ratenbegrenzten Aufruf.
do $$
begin
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='idx_rate_limits_fenster') then
    raise exception 'FAIL: rate_limits ohne Index auf window_start — Seq Scan pro API-Aufruf';
  end if;
  raise notice 'PASS IB: rate_limits hat einen Index auf window_start';
end $$;

-- TEST IC: der alte Index ist ein Praefix des neuen und kostet nur noch
-- Schreibzeit. Bleibt er stehen, wurde die Migration halb angewendet.
do $$
begin
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='idx_messages_verlauf') then
    raise exception 'FAIL: idx_messages_verlauf fehlt';
  end if;
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='idx_messages_anbieter') then
    raise exception 'FAIL: idx_messages_anbieter fehlt — die Anbieter-Inbox filtert nur nach provider_id';
  end if;
  if exists (select 1 from pg_indexes where schemaname='public' and indexname='idx_messages_job_provider') then
    raise exception 'FAIL: ueberfluessiger Index idx_messages_job_provider steht noch';
  end if;
  raise notice 'PASS IC: messages-Indizes passen zu den Abfragen';
end $$;

-- TEST ID: Kunden-Inbox. Drei Gespraeche aus sechs Nachrichten, neueste zuerst.
set role authenticated;
set request.jwt.claim.sub = 'fa000001-0000-0000-0000-000000000000';
do $$
declare n int; erstes text; zweit text;
begin
  select count(*) into n from konversationen_kunde();
  if n <> 3 then raise exception 'FAIL: Kunden-Inbox lieferte % Zeilen statt 3', n; end if;

  select letzte_nachricht into erstes from konversationen_kunde() limit 1;
  if erstes <> 'Zwei A' then
    raise exception 'FAIL: neuestes Gespraech steht nicht oben (%)', erstes;
  end if;

  -- Je (Auftrag, Anbieter) nur die NEUESTE Nachricht, nicht die aelteste.
  select letzte_nachricht into zweit from konversationen_kunde()
   where job_id='fa000010-0000-0000-0000-000000000000'
     and provider_id='fa000002-0000-0000-0000-000000000000';
  if zweit <> 'A neu' then
    raise exception 'FAIL: nicht die neueste Nachricht des Gespraechs (%)', zweit;
  end if;
  raise notice 'PASS ID: Kunden-Inbox liefert je Gespraech die neueste Nachricht';
end $$;
reset role;

-- TEST IE: Anbieter-Inbox. Anbieter A hat drei Auftraege beruehrt.
set role authenticated;
set request.jwt.claim.sub = 'fa000002-0000-0000-0000-000000000000';
do $$
declare n int;
begin
  select count(*) into n from konversationen_anbieter();
  if n <> 3 then raise exception 'FAIL: Anbieter-Inbox lieferte % Zeilen statt 3', n; end if;
  raise notice 'PASS IE: Anbieter-Inbox liefert eine Zeile je Auftrag';
end $$;
reset role;

-- TEST IF: der eigentliche Sicherheitspunkt. Die Funktionen nehmen KEINEN
-- Parameter — der Nutzer kommt aus auth.uid(). Ein fremder Kunde darf im
-- Postfach des ersten nichts sehen.
set role authenticated;
set request.jwt.claim.sub = 'fa000004-0000-0000-0000-000000000000';
do $$
declare n int;
begin
  select count(*) into n from konversationen_kunde()
   where job_id in ('fa000010-0000-0000-0000-000000000000','fa000011-0000-0000-0000-000000000000');
  if n <> 0 then
    raise exception 'FAIL: fremder Kunde sah % Gespraeche eines anderen', n;
  end if;
  raise notice 'PASS IF: die Inbox zeigt ausschliesslich eigene Gespraeche';
end $$;
reset role;

-- TEST IG: die zweite Schicht, isoliert.
--
-- IF oben beweist NICHT, was es zu beweisen scheint: die Mutation „Bedingung
-- j.customer_id = auth.uid() entfernt" liess IF gruen, weil RLS auf jobs den
-- fremden Kunden ohnehin abfaengt. Ein Test, der zwei Schichten zugleich
-- prueft, sagt ueber keine der beiden etwas.
--
-- Deshalb hier RLS auf jobs und messages fuer die Dauer EINER Zusicherung
-- abschalten. Bleibt die Inbox dann leer, traegt die Einschraenkung in der
-- Funktion selbst — und nicht nur die Policy darunter.
reset role;
alter table public.jobs     disable row level security;
alter table public.messages disable row level security;

set role authenticated;
set request.jwt.claim.sub = 'fa000004-0000-0000-0000-000000000000';
do $$
declare n int;
begin
  select count(*) into n from konversationen_kunde()
   where job_id in ('fa000010-0000-0000-0000-000000000000','fa000011-0000-0000-0000-000000000000');
  if n <> 0 then
    raise exception 'FAIL: ohne RLS sah der fremde Kunde % fremde Gespraeche — die Funktion schuetzt nicht selbst', n;
  end if;
  raise notice 'PASS IG: die Funktion schraenkt selbst ein, nicht nur RLS darunter';
end $$;
reset role;

alter table public.jobs     enable row level security;
alter table public.messages enable row level security;
