-- (A) E-Mail-Gate: unbestätigte Nutzer dürfen KEINE Aufträge anlegen (der
--     Mechanismus, der RESEND_API_KEY zum echten Go-Live-Blocker macht).
-- (B) decline_offer: Job-Owner darf ablehnen, Fremder nicht.
alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;
alter table public.jobs disable trigger user;
alter table public.offers disable trigger user;

insert into auth.users (id,email,email_confirmed_at) values
  ('d1111111-0000-0000-0000-000000000000','v@test.de',now()),   -- verifiziert
  ('d2222222-0000-0000-0000-000000000000','u@test.de',now()),   -- UNbestätigt
  ('d3333333-0000-0000-0000-000000000000','p@test.de',now());   -- Anbieter
insert into profiles (id,role,email,email_verified_at) values
  ('d1111111-0000-0000-0000-000000000000','customer','v@test.de',now()),
  ('d2222222-0000-0000-0000-000000000000','customer','u@test.de',NULL),  -- kein email_verified_at
  ('d3333333-0000-0000-0000-000000000000','provider','p@test.de',now());
insert into provider_profiles (id,business_name) values ('d3333333-0000-0000-0000-000000000000','P');
-- vorhandener Job (vom verifizierten Kunden) + Angebot für decline-Test
insert into jobs (id,customer_id,title,description,category,address_plz,address_city,track,status) values
  ('d4444444-0000-0000-0000-000000000000','d1111111-0000-0000-0000-000000000000','JobV','Lang genug beschrieben hier drin.','Elektro','50667','Koeln','handwerker','open');
insert into offers (id,job_id,provider_id,price,status) values
  ('d5555555-0000-0000-0000-000000000000','d4444444-0000-0000-0000-000000000000','d3333333-0000-0000-0000-000000000000',80,'pending');

alter table auth.users enable trigger user;
alter table public.profiles enable trigger user;
alter table public.jobs enable trigger user;
alter table public.offers enable trigger user;

-- TEST A1: UNbestätigter Kunde darf keinen Job anlegen (RLS with-check greift)
set role authenticated;
set request.jwt.claim.sub = 'd2222222-0000-0000-0000-000000000000';
do $$
begin
  insert into jobs (customer_id,title,description,category,address_plz,address_city,track,status)
  values ('d2222222-0000-0000-0000-000000000000','Verboten','Lang genug beschrieben hier drin.','Elektro','50667','Koeln','handwerker','open');
  raise exception 'FAIL: unbestätigter Nutzer konnte Job anlegen — Gate kaputt!';
exception when insufficient_privilege or check_violation then
  raise notice 'PASS: unbestätigter Nutzer wird beim Auftrag-Anlegen blockiert';
end $$;
reset role;

-- TEST A2: bestätigter Kunde DARF Job anlegen
set role authenticated;
set request.jwt.claim.sub = 'd1111111-0000-0000-0000-000000000000';
do $$
declare n int;
begin
  insert into jobs (customer_id,title,description,category,address_plz,address_city,track,status)
  values ('d1111111-0000-0000-0000-000000000000','Erlaubt','Lang genug beschrieben hier drin.','Elektro','50667','Koeln','handwerker','open');
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: bestätigter Kunde konnte nicht anlegen'; end if;
  raise notice 'PASS: bestätigter Kunde kann Auftrag anlegen';
end $$;
reset role;

-- TEST B1: Fremder darf Angebot NICHT ablehnen
set request.jwt.claim.sub = 'd3333333-0000-0000-0000-000000000000';
do $$
begin
  perform decline_offer('d5555555-0000-0000-0000-000000000000');
  raise exception 'FAIL: Fremder konnte ablehnen';
exception when others then
  if sqlerrm like '%Not the job owner%' then raise notice 'PASS: Fremder kann Angebot nicht ablehnen';
  else raise; end if;
end $$;

-- TEST B2: Job-Owner darf ablehnen
set request.jwt.claim.sub = 'd1111111-0000-0000-0000-000000000000';
select decline_offer('d5555555-0000-0000-0000-000000000000');
do $$
declare st text;
begin
  select status into st from offers where id='d5555555-0000-0000-0000-000000000000';
  if st <> 'declined' then raise exception 'FAIL: Angebot nicht declined (%)', st; end if;
  raise notice 'PASS: Job-Owner kann Angebot ablehnen (declined)';
end $$;
