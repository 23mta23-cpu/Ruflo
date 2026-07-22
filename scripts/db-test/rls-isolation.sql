-- RLS-Datenisolation: Kunde A darf Kunde B's Daten NIE sehen (OWASP Broken
-- Access Control). Seed als Superuser (RLS-Bypass, Trigger aus), dann Assertions
-- unter echter authenticated-Rolle (RLS aktiv, weil Nicht-Eigentümer).
alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;
alter table public.jobs disable trigger user;
alter table public.offers disable trigger user;

insert into auth.users (id,email,email_confirmed_at) values
  ('aaaaaaaa-0000-0000-0000-000000000000','a@test.de',now()),
  ('bbbbbbbb-0000-0000-0000-000000000000','b@test.de',now()),
  ('cccccccc-0000-0000-0000-000000000000','p@test.de',now());
insert into profiles (id,role,email,email_verified_at) values
  ('aaaaaaaa-0000-0000-0000-000000000000','customer','a@test.de',now()),
  ('bbbbbbbb-0000-0000-0000-000000000000','customer','b@test.de',now()),
  ('cccccccc-0000-0000-0000-000000000000','provider','p@test.de',now());
insert into provider_profiles (id,business_name) values ('cccccccc-0000-0000-0000-000000000000','P');
insert into jobs (id,customer_id,title,description,category,address_plz,address_city,track,status) values
  ('a1a1a1a1-0000-0000-0000-000000000000','aaaaaaaa-0000-0000-0000-000000000000','JobA','Lang genug beschrieben hier drin.','Elektro','50667','Koeln','handwerker','open'),
  ('b1b1b1b1-0000-0000-0000-000000000000','bbbbbbbb-0000-0000-0000-000000000000','JobB','Lang genug beschrieben hier drin.','Elektro','50667','Koeln','handwerker','open');
insert into offers (id,job_id,provider_id,price,status) values
  ('a2a2a2a2-0000-0000-0000-000000000000','a1a1a1a1-0000-0000-0000-000000000000','cccccccc-0000-0000-0000-000000000000',100,'pending');

alter table auth.users enable trigger user;
alter table public.profiles enable trigger user;
alter table public.jobs enable trigger user;
alter table public.offers enable trigger user;

-- Echten Vertrag erzeugen (Kunde A nimmt an)
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000000';
select accept_offer('a2a2a2a2-0000-0000-0000-000000000000','a1a1a1a1-0000-0000-0000-000000000000');

-- TEST 1: Kunde A unter authenticated-Rolle
set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000000';
do $$
declare own int; foreign_j int;
begin
  select count(*) into own from jobs where id='a1a1a1a1-0000-0000-0000-000000000000';
  select count(*) into foreign_j from jobs where id='b1b1b1b1-0000-0000-0000-000000000000';
  if own <> 1 then raise exception 'FAIL: A sieht eigenen Job nicht (%)', own; end if;
  if foreign_j <> 0 then raise exception 'FAIL: A SIEHT fremden Job B (%) — RLS-Leck!', foreign_j; end if;
  raise notice 'PASS: Kunde A sieht eigenen Job, NICHT den von B';
end $$;
reset role;

-- TEST 2: Kunde B darf A's Vertrag NICHT sehen
set role authenticated;
set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000000';
do $$
declare seen int;
begin
  select count(*) into seen from contracts where customer_id='aaaaaaaa-0000-0000-0000-000000000000';
  if seen <> 0 then raise exception 'FAIL: B SIEHT A-Vertrag (%) — RLS-Leck!', seen; end if;
  raise notice 'PASS: Kunde B sieht A-Vertrag NICHT';
end $$;
reset role;

-- Anbieter-Spalten-Privacy (Migration 0540, Security-Befund H1):
-- anon darf sensible Spalten NICHT lesen, öffentliche Suchfelder schon.
reset role;
set role anon;
do $$
declare v text;
begin
  begin
    select steuer_id into v from public.provider_profiles limit 1;
    raise exception 'FAIL: anon konnte provider_profiles.steuer_id lesen';
  exception when insufficient_privilege then
    raise notice 'PASS: anon kann sensible Anbieter-Spalte (steuer_id) NICHT lesen';
  end;
end $$;
do $$
declare v text;
begin
  select business_name into v from public.provider_profiles limit 1;  -- kein Fehler erwartet
  raise notice 'PASS: anon kann oeffentliches Suchfeld (business_name) weiter lesen';
end $$;
reset role;
