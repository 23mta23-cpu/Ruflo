-- Meldungen aus dem Chat (Migration 0700)
--
-- Der Strike-Weg 0340 → 0500 hängt am Gerät des ABSENDERS: chat_leak_flags
-- darf laut RLS nur `auth.uid() = sender_id` schreiben. Wer die Nummer bewusst
-- weitergibt, ist genau derjenige, dessen Client den Fund melden müsste.
-- 0700 gibt dem EMPFÄNGER den zweiten, unabhängigen Weg — und muss dabei
-- verhindern, dass daraus ein Werkzeug gegen Unbeteiligte wird.
--
-- (H) Empfänger darf den Absender melden          — der Fall aus dem Befund
-- (I) Melden über einen FREMDEN Auftrag: verboten
-- (J) Melden eines Unbeteiligten: verboten
-- (K) Sich selbst melden: verboten
-- (L) Dieselbe Nachricht doppelt melden: verboten
-- (M) Eine Meldung erzeugt KEINEN Strike (Missbrauchsschutz)
-- (N) Niemand kann Meldungen zurücklesen
reset role;

alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;
alter table public.jobs disable trigger user;

insert into auth.users (id,email,email_confirmed_at) values
  ('e7000001-0000-0000-0000-000000000000','rc@test.de',now()),   -- Kunde (meldet)
  ('e7000002-0000-0000-0000-000000000000','rp@test.de',now()),   -- Anbieter (gemeldet)
  ('e7000003-0000-0000-0000-000000000000','rx@test.de',now());   -- Unbeteiligter
insert into profiles (id,role,email,email_verified_at) values
  ('e7000001-0000-0000-0000-000000000000','customer','rc@test.de',now()),
  ('e7000002-0000-0000-0000-000000000000','provider','rp@test.de',now()),
  ('e7000003-0000-0000-0000-000000000000','provider','rx@test.de',now());
insert into provider_profiles (id,business_name,is_nachbarschaft,strike_count) values
  ('e7000002-0000-0000-0000-000000000000','RP',false,0),
  ('e7000003-0000-0000-0000-000000000000','RX',false,0);
insert into jobs (id,customer_id,provider_id,title,description,category,address_plz,address_city,track,status) values
  ('e7000004-0000-0000-0000-000000000000','e7000001-0000-0000-0000-000000000000','e7000002-0000-0000-0000-000000000000','RJob','Lang genug beschrieben hier drin.','Elektro','50667','Koeln','handwerker','active');
-- Fremder Auftrag, an dem der Melder KEINE Partei ist.
insert into jobs (id,customer_id,provider_id,title,description,category,address_plz,address_city,track,status) values
  ('e7000005-0000-0000-0000-000000000000','e7000003-0000-0000-0000-000000000000','e7000002-0000-0000-0000-000000000000','RFremd','Lang genug beschrieben hier drin.','Elektro','50667','Koeln','handwerker','active');
insert into messages (id,job_id,sender_id,sender_role,body) values
  ('e7000006-0000-0000-0000-000000000000','e7000004-0000-0000-0000-000000000000','e7000002-0000-0000-0000-000000000000','provider','Ruf mich an unter 0170 1234567');

alter table auth.users enable trigger user;
alter table public.profiles enable trigger user;
alter table public.jobs enable trigger user;

set role authenticated;
set request.jwt.claim.sub = 'e7000001-0000-0000-0000-000000000000';

-- TEST H: der Empfänger darf melden — genau der Fall, der vorher fehlte
do $$
begin
  insert into chat_reports (job_id,message_id,reporter_id,reported_id,grund,notiz)
  values ('e7000004-0000-0000-0000-000000000000','e7000006-0000-0000-0000-000000000000',
          'e7000001-0000-0000-0000-000000000000','e7000002-0000-0000-0000-000000000000',
          'kontaktdaten','Hat mir seine Handynummer geschickt.');
  raise notice 'PASS: Empfaenger kann eine erhaltene Nachricht melden';
exception when others then
  raise exception 'FAIL: Empfaenger konnte NICHT melden (%)', sqlerrm;
end $$;

-- TEST I: Melden über einen fremden Auftrag ist verboten
do $$
begin
  insert into chat_reports (job_id,reporter_id,reported_id,grund)
  values ('e7000005-0000-0000-0000-000000000000',
          'e7000001-0000-0000-0000-000000000000','e7000002-0000-0000-0000-000000000000','spam');
  raise exception 'FAIL: Meldung ueber einen FREMDEN Auftrag ging durch!';
exception when insufficient_privilege then
  raise notice 'PASS: Meldung ueber einen fremden Auftrag wird abgewiesen';
end $$;

-- TEST J: einen Unbeteiligten melden ist verboten
do $$
begin
  insert into chat_reports (job_id,reporter_id,reported_id,grund)
  values ('e7000004-0000-0000-0000-000000000000',
          'e7000001-0000-0000-0000-000000000000','e7000003-0000-0000-0000-000000000000','spam');
  raise exception 'FAIL: ein Unbeteiligter konnte gemeldet werden!';
exception when insufficient_privilege then
  raise notice 'PASS: nur die andere Partei desselben Auftrags ist meldbar';
end $$;

-- TEST K: sich selbst melden ist verboten
do $$
begin
  insert into chat_reports (job_id,reporter_id,reported_id,grund)
  values ('e7000004-0000-0000-0000-000000000000',
          'e7000001-0000-0000-0000-000000000000','e7000001-0000-0000-0000-000000000000','spam');
  raise exception 'FAIL: Selbstmeldung ging durch!';
exception when check_violation or insufficient_privilege then
  raise notice 'PASS: Selbstmeldung wird abgewiesen';
end $$;

-- TEST L: dieselbe Nachricht doppelt melden ist verboten
do $$
begin
  insert into chat_reports (job_id,message_id,reporter_id,reported_id,grund)
  values ('e7000004-0000-0000-0000-000000000000','e7000006-0000-0000-0000-000000000000',
          'e7000001-0000-0000-0000-000000000000','e7000002-0000-0000-0000-000000000000','spam');
  raise exception 'FAIL: dieselbe Nachricht liess sich zweimal melden!';
exception when unique_violation then
  raise notice 'PASS: dieselbe Nachricht ist nur einmal meldbar';
end $$;

-- TEST N: niemand liest Meldungen zurück — auch der Melder nicht.
-- Saehe der Gemeldete sie, wuesste er sofort, wer ihn gemeldet hat.
do $$
declare n int;
begin
  select count(*) into n from chat_reports;
  if n <> 0 then raise exception 'FAIL: Meldungen sind lesbar (% Zeilen)', n; end if;
  raise notice 'PASS: Meldungen sind fuer Nutzer nicht lesbar (default-deny)';
end $$;

reset role;

-- TEST M: eine Meldung erzeugt KEINEN Strike.
-- Anders als die Regex-Funde ist eine Meldung vom Melder frei ausloesbar:
-- drei Meldungen wuerden sonst genuegen, um einen Anbieter aus dem Markt zu
-- nehmen. Eine Meldung ist ein Pruefsignal, keine Sanktion.
do $$
declare s int;
begin
  select strike_count into s from provider_profiles where id='e7000002-0000-0000-0000-000000000000';
  if s <> 0 then raise exception 'FAIL: Meldung hat automatisch einen Strike vergeben (%)', s; end if;
  raise notice 'PASS: eine Meldung vergibt KEINEN automatischen Strike';
end $$;
