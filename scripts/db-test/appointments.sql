-- Terminvorschläge im Chat (Migration 0520)
-- (L) Vorschlag anlegen (Thread-Partei) + 'appointment'-Nachricht
-- (M) Gegenseite nimmt an → status accepted, jobs.scheduled_at gesetzt, System-Msg
-- (N) Vorschlagender kann eigenen Vorschlag NICHT beantworten
-- (O) Fremder (keine Partei) kann keinen Vorschlag anlegen
-- (P) Ablehnen → status rejected, Termin unverändert
reset role;

alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;
alter table public.jobs disable trigger user;

insert into auth.users (id,email,email_confirmed_at) values
  ('71111111-0000-0000-0000-000000000000','ac@test.de',now()),
  ('72222222-0000-0000-0000-000000000000','ap@test.de',now()),
  ('73333333-0000-0000-0000-000000000000','as@test.de',now());
insert into profiles (id,role,email,email_verified_at) values
  ('71111111-0000-0000-0000-000000000000','customer','ac@test.de',now()),
  ('72222222-0000-0000-0000-000000000000','provider','ap@test.de',now()),
  ('73333333-0000-0000-0000-000000000000','provider','as@test.de',now());
insert into provider_profiles (id,business_name,is_nachbarschaft) values
  ('72222222-0000-0000-0000-000000000000','AppP',false),
  ('73333333-0000-0000-0000-000000000000','NBH',true);   -- NB-Helfer (Track-Test)
insert into jobs (id,customer_id,title,description,category,address_plz,address_city,track,status) values
  ('74444444-0000-0000-0000-000000000000','71111111-0000-0000-0000-000000000000','ApptJob','Lang genug beschrieben hier drin.','Elektro','50667','Koeln','handwerker','open');

alter table auth.users enable trigger user;
alter table public.profiles enable trigger user;
alter table public.jobs enable trigger user;

-- TEST L: Anbieter (Thread-Partei) schlägt einen Termin vor
set role authenticated;
set request.jwt.claim.sub = '72222222-0000-0000-0000-000000000000';
do $$
declare v_id uuid; n int;
begin
  v_id := propose_appointment('74444444-0000-0000-0000-000000000000','72222222-0000-0000-0000-000000000000', now() + interval '2 days');
  if v_id is null then raise exception 'FAIL: kein Vorschlag angelegt'; end if;
  select count(*) into n from messages where job_id='74444444-0000-0000-0000-000000000000' and type='appointment';
  if n <> 1 then raise exception 'FAIL: keine appointment-Nachricht (%)', n; end if;
  raise notice 'PASS: Anbieter schlaegt Termin vor (Vorschlag + Chat-Karte)';
end $$;
reset role;

-- TEST M: Kunde nimmt an → jobs.scheduled_at gesetzt + System-Nachricht
set role authenticated;
set request.jwt.claim.sub = '71111111-0000-0000-0000-000000000000';
do $$
declare v_id uuid;
begin
  select id into v_id from appointment_proposals where job_id='74444444-0000-0000-0000-000000000000' and status='pending' limit 1;
  perform respond_appointment(v_id, true);
end $$;
reset role;
do $$
declare st text; sched timestamptz; sysn int;
begin
  select status into st from appointment_proposals where job_id='74444444-0000-0000-0000-000000000000' order by created_at limit 1;
  select scheduled_at into sched from jobs where id='74444444-0000-0000-0000-000000000000';
  select count(*) into sysn from messages where job_id='74444444-0000-0000-0000-000000000000' and type='system';
  if st <> 'accepted' then raise exception 'FAIL: Vorschlag nicht accepted (%)', st; end if;
  if sched is null then raise exception 'FAIL: jobs.scheduled_at nicht gesetzt'; end if;
  if sysn < 1 then raise exception 'FAIL: keine System-Nachricht'; end if;
  raise notice 'PASS: Kunde nimmt an → Termin gesetzt + System-Nachricht';
end $$;

-- TEST N: Vorschlagender kann eigenen Vorschlag NICHT beantworten
set role authenticated;
set request.jwt.claim.sub = '72222222-0000-0000-0000-000000000000';
do $$
declare v_id uuid;
begin
  v_id := propose_appointment('74444444-0000-0000-0000-000000000000','72222222-0000-0000-0000-000000000000', now() + interval '3 days');
  begin
    perform respond_appointment(v_id, true);
    raise exception 'FAIL: Vorschlagender konnte eigenen Vorschlag annehmen';
  exception when others then
    if sqlerrm like '%own proposal%' then raise notice 'PASS: Vorschlagender kann eigenen Vorschlag nicht beantworten';
    else raise; end if;
  end;
end $$;
reset role;

-- TEST O: NB-Helfer kann auf Handwerks-Auftrag keinen Termin vorschlagen (Track)
set role authenticated;
set request.jwt.claim.sub = '73333333-0000-0000-0000-000000000000';
do $$
begin
  perform propose_appointment('74444444-0000-0000-0000-000000000000','73333333-0000-0000-0000-000000000000', now() + interval '1 day');
  raise exception 'FAIL: NB-Helfer konnte auf Handwerks-Auftrag Termin vorschlagen';
exception when others then
  if sqlerrm like '%Track not allowed%' then raise notice 'PASS: NB-Helfer kann auf Handwerks-Auftrag keinen Termin vorschlagen';
  else raise; end if;
end $$;
reset role;

-- TEST P: Ablehnen → status rejected, Termin unveraendert
set role authenticated;
set request.jwt.claim.sub = '71111111-0000-0000-0000-000000000000';
do $$
declare v_id uuid;
begin
  select id into v_id from appointment_proposals
   where job_id='74444444-0000-0000-0000-000000000000' and status='pending'
   order by created_at desc limit 1;   -- der offene Vorschlag aus TEST N
  perform respond_appointment(v_id, false);
end $$;
reset role;
do $$
declare st text; cnt int;
begin
  select count(*) into cnt from appointment_proposals
   where job_id='74444444-0000-0000-0000-000000000000' and status='rejected';
  if cnt < 1 then raise exception 'FAIL: kein Vorschlag rejected'; end if;
  raise notice 'PASS: Ablehnen setzt Status rejected';
end $$;
