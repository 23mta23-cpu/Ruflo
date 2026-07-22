-- Vor-Vertrags-Rückfragen (Migration 0510)
-- (H) Anbieter darf auf OFFENEM Auftrag eine Rückfrage stellen (eigener Thread)
-- (I) Kunde sieht die Rückfrage; Anbieter B sieht Anbieter A's Thread NICHT
-- (J) NB-Helfer darf auf Handwerks-Auftrag keine Rückfrage stellen (Track)
-- (K) Kunde kann im Thread antworten
reset role;

alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;
alter table public.jobs disable trigger user;

insert into auth.users (id,email,email_confirmed_at) values
  ('91111111-0000-0000-0000-000000000000','ic@test.de',now()),   -- Kunde
  ('92222222-0000-0000-0000-000000000000','ia@test.de',now()),   -- Anbieter A
  ('93333333-0000-0000-0000-000000000000','ib@test.de',now()),   -- Anbieter B
  ('94444444-0000-0000-0000-000000000000','inb@test.de',now());  -- NB-Helfer
insert into profiles (id,role,email,email_verified_at) values
  ('91111111-0000-0000-0000-000000000000','customer','ic@test.de',now()),
  ('92222222-0000-0000-0000-000000000000','provider','ia@test.de',now()),
  ('93333333-0000-0000-0000-000000000000','provider','ib@test.de',now()),
  ('94444444-0000-0000-0000-000000000000','provider','inb@test.de',now());
insert into provider_profiles (id,business_name,is_nachbarschaft) values
  ('92222222-0000-0000-0000-000000000000','AnbA',false),
  ('93333333-0000-0000-0000-000000000000','AnbB',false),
  ('94444444-0000-0000-0000-000000000000','NBH',true);
insert into jobs (id,customer_id,title,description,category,address_plz,address_city,track,status) values
  ('95555555-0000-0000-0000-000000000000','91111111-0000-0000-0000-000000000000','Unklar','Bitte Details unklar beschrieben.','Elektro','50667','Koeln','handwerker','open');

alter table auth.users enable trigger user;
alter table public.profiles enable trigger user;
alter table public.jobs enable trigger user;

-- TEST H: Anbieter A stellt eine Rückfrage am offenen Auftrag (eigener Thread)
set role authenticated;
set request.jwt.claim.sub = '92222222-0000-0000-0000-000000000000';
do $$
declare n int;
begin
  insert into messages (job_id,sender_id,sender_role,body,provider_id)
  values ('95555555-0000-0000-0000-000000000000','92222222-0000-0000-0000-000000000000','provider','Was genau ist gewuenscht?','92222222-0000-0000-0000-000000000000');
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: Anbieter konnte keine Rueckfrage stellen'; end if;
  raise notice 'PASS: Anbieter stellt Rueckfrage am offenen Auftrag (ohne Angebot)';
end $$;
reset role;

-- TEST I1: Kunde sieht die Rückfrage
set role authenticated;
set request.jwt.claim.sub = '91111111-0000-0000-0000-000000000000';
do $$
declare n int;
begin
  select count(*) into n from messages where job_id='95555555-0000-0000-0000-000000000000';
  if n <> 1 then raise exception 'FAIL: Kunde sieht die Rueckfrage nicht (%)', n; end if;
  raise notice 'PASS: Kunde sieht die Rueckfrage seines Auftrags';
end $$;
reset role;

-- TEST I2: Anbieter B sieht Anbieter A's Thread NICHT (Datenschutz)
set role authenticated;
set request.jwt.claim.sub = '93333333-0000-0000-0000-000000000000';
do $$
declare n int;
begin
  select count(*) into n from messages where job_id='95555555-0000-0000-0000-000000000000';
  if n <> 0 then raise exception 'FAIL: Anbieter B sieht fremden Thread (%)', n; end if;
  raise notice 'PASS: Anbieter B sieht Anbieter A''s Rueckfrage NICHT';
end $$;
reset role;

-- TEST J: NB-Helfer darf auf Handwerks-Auftrag keine Rückfrage stellen (Track)
set role authenticated;
set request.jwt.claim.sub = '94444444-0000-0000-0000-000000000000';
do $$
begin
  insert into messages (job_id,sender_id,sender_role,body,provider_id)
  values ('95555555-0000-0000-0000-000000000000','94444444-0000-0000-0000-000000000000','provider','Ich haette Interesse','94444444-0000-0000-0000-000000000000');
  raise exception 'FAIL: NB-Helfer konnte auf Handwerks-Auftrag schreiben!';
exception when insufficient_privilege or check_violation then
  raise notice 'PASS: NB-Helfer kann auf Handwerks-Auftrag keine Rueckfrage stellen';
end $$;
reset role;

-- TEST K: Kunde antwortet im Thread von Anbieter A
set role authenticated;
set request.jwt.claim.sub = '91111111-0000-0000-0000-000000000000';
do $$
declare n int;
begin
  insert into messages (job_id,sender_id,sender_role,body,provider_id)
  values ('95555555-0000-0000-0000-000000000000','91111111-0000-0000-0000-000000000000','customer','Ich meine die Deckenlampe im Flur.','92222222-0000-0000-0000-000000000000');
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: Kunde konnte nicht antworten'; end if;
  raise notice 'PASS: Kunde antwortet im Rueckfrage-Thread';
end $$;
reset role;
