-- Track-Trennung (Migration 0480) + Nachrichten-Ungelesen-RPC (Migration 0490)
--
-- (C) 0480 — §1-HwO-Track-Trennung (Founder-Befund 20.07. nachts):
--     Nachbarschaftshelfer (provider_profiles.is_nachbarschaft) duerfen NICHT
--     auf Handwerks-Auftraege bieten, WOHL aber auf Nachbarschafts-Auftraege.
--     Die Policy erzwingt das serverseitig (Defense in Depth zur Client-Filterung).
-- (D) 0490 — Partei-Check der RPC mark_messages_read:
--     read_at wird nur fuer Job-Parteien gesetzt; ein Fremder ist ein No-op,
--     der Empfaenger (nicht der Absender) markiert wirksam als gelesen.
reset role;

alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;
alter table public.jobs disable trigger user;
alter table public.offers disable trigger user;

insert into auth.users (id,email,email_confirmed_at) values
  ('e1111111-0000-0000-0000-000000000000','tc@test.de',now()),    -- Kunde
  ('e2222222-0000-0000-0000-000000000000','nbp@test.de',now()),   -- NB-Anbieter
  ('e3333333-0000-0000-0000-000000000000','np@test.de',now()),    -- normaler Anbieter
  ('e4444444-0000-0000-0000-000000000000','strg@test.de',now());  -- Fremder (keine Job-Partei)
insert into profiles (id,role,email,email_verified_at) values
  ('e1111111-0000-0000-0000-000000000000','customer','tc@test.de',now()),
  ('e2222222-0000-0000-0000-000000000000','provider','nbp@test.de',now()),
  ('e3333333-0000-0000-0000-000000000000','provider','np@test.de',now()),
  ('e4444444-0000-0000-0000-000000000000','provider','strg@test.de',now());
insert into provider_profiles (id,business_name,is_nachbarschaft) values
  ('e2222222-0000-0000-0000-000000000000','NBHelfer',true),
  ('e3333333-0000-0000-0000-000000000000','Handwerk',false),
  ('e4444444-0000-0000-0000-000000000000','Fremd',false);
-- Handwerks-Job (open) + Nachbarschafts-Job (open), beide vom Kunden
insert into jobs (id,customer_id,title,description,category,address_plz,address_city,track,status) values
  ('e5555555-0000-0000-0000-000000000000','e1111111-0000-0000-0000-000000000000','HW','Lang genug beschrieben hier drin.','Elektro','50667','Koeln','handwerker','open'),
  ('e6666666-0000-0000-0000-000000000000','e1111111-0000-0000-0000-000000000000','NB','Lang genug beschrieben hier drin.','Garten','50667','Koeln','nachbarschaft','open');
-- Aktiver Job Kunde<->normaler Anbieter fuer den Nachrichten-Test
insert into jobs (id,customer_id,provider_id,title,description,category,address_plz,address_city,track,status) values
  ('e7777777-0000-0000-0000-000000000000','e1111111-0000-0000-0000-000000000000','e3333333-0000-0000-0000-000000000000','Chat','Lang genug beschrieben hier drin.','Elektro','50667','Koeln','handwerker','active');
-- Nachricht vom Anbieter an den Kunden (ungelesen)
insert into messages (id,job_id,sender_id,sender_role,body) values
  ('e8888888-0000-0000-0000-000000000000','e7777777-0000-0000-0000-000000000000','e3333333-0000-0000-0000-000000000000','provider','Hallo, wann passt es Ihnen?');

alter table auth.users enable trigger user;
alter table public.profiles enable trigger user;
alter table public.jobs enable trigger user;
alter table public.offers enable trigger user;

-- TEST C1: NB-Anbieter darf NICHT auf einen Handwerks-Job bieten (0480)
set role authenticated;
set request.jwt.claim.sub = 'e2222222-0000-0000-0000-000000000000';
do $$
begin
  insert into offers (job_id,provider_id,price,status)
  values ('e5555555-0000-0000-0000-000000000000','e2222222-0000-0000-0000-000000000000',90,'pending');
  raise exception 'FAIL: NB-Anbieter konnte auf Handwerks-Job bieten — Track-Trennung kaputt!';
exception when insufficient_privilege or check_violation then
  raise notice 'PASS: NB-Anbieter kann NICHT auf Handwerks-Job bieten';
end $$;
reset role;

-- TEST C2: NB-Anbieter DARF auf einen Nachbarschafts-Job bieten
set role authenticated;
set request.jwt.claim.sub = 'e2222222-0000-0000-0000-000000000000';
do $$
declare n int;
begin
  insert into offers (job_id,provider_id,price,status)
  values ('e6666666-0000-0000-0000-000000000000','e2222222-0000-0000-0000-000000000000',40,'pending');
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: NB-Anbieter konnte nicht auf NB-Job bieten'; end if;
  raise notice 'PASS: NB-Anbieter kann auf Nachbarschafts-Job bieten';
end $$;
reset role;

-- TEST D1: Fremder markiert Nachrichten NICHT als gelesen (0490 Partei-Check)
set role authenticated;
set request.jwt.claim.sub = 'e4444444-0000-0000-0000-000000000000';
select mark_messages_read('e7777777-0000-0000-0000-000000000000');
reset role;
do $$
declare r timestamptz;
begin
  select read_at into r from messages where id='e8888888-0000-0000-0000-000000000000';
  if r is not null then raise exception 'FAIL: Fremder konnte Nachricht als gelesen markieren!'; end if;
  raise notice 'PASS: Fremder kann fremde Nachrichten nicht als gelesen markieren';
end $$;

-- TEST D2: Empfaenger (Kunde, nicht Absender) markiert die Nachricht als gelesen
set role authenticated;
set request.jwt.claim.sub = 'e1111111-0000-0000-0000-000000000000';
select mark_messages_read('e7777777-0000-0000-0000-000000000000');
reset role;
do $$
declare r timestamptz;
begin
  select read_at into r from messages where id='e8888888-0000-0000-0000-000000000000';
  if r is null then raise exception 'FAIL: Empfaenger-Markierung nicht wirksam'; end if;
  raise notice 'PASS: Job-Partei (Empfaenger) markiert Nachricht als gelesen';
end $$;
