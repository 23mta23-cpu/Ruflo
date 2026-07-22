-- Qualitäts- & Strike-Automatik (Migration 0500, Founder-Entscheid Option C)
-- (E) Leak-Flags → Strike erst ab der Häufung (je 3 = 1 Strike, Einzeltreffer 0)
-- (F) 3 Strikes → Anbieter kann keine Angebote mehr abgeben (Sperre)
-- (G) Schlechte Bewertung (rating <= 2) erhöht bad_review_count (Info-Banner-Signal)
reset role;

alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;
alter table public.jobs disable trigger user;
alter table public.offers disable trigger user;

insert into auth.users (id,email,email_confirmed_at) values
  ('f1111111-0000-0000-0000-000000000000','qc@test.de',now()),   -- Kunde
  ('f2222222-0000-0000-0000-000000000000','qp@test.de',now()),   -- Anbieter (Strike/Review-Ziel)
  ('f3333333-0000-0000-0000-000000000000','qs@test.de',now());   -- Anbieter (vorab 3 Strikes = gesperrt)
insert into profiles (id,role,email,email_verified_at) values
  ('f1111111-0000-0000-0000-000000000000','customer','qc@test.de',now()),
  ('f2222222-0000-0000-0000-000000000000','provider','qp@test.de',now()),
  ('f3333333-0000-0000-0000-000000000000','provider','qs@test.de',now());
insert into provider_profiles (id,business_name,is_nachbarschaft,strike_count) values
  ('f2222222-0000-0000-0000-000000000000','QP',false,0),
  ('f3333333-0000-0000-0000-000000000000','QS',false,3);   -- bereits gesperrt
insert into jobs (id,customer_id,provider_id,title,description,category,address_plz,address_city,track,status) values
  ('f4444444-0000-0000-0000-000000000000','f1111111-0000-0000-0000-000000000000','f2222222-0000-0000-0000-000000000000','QJob','Lang genug beschrieben hier drin.','Elektro','50667','Koeln','handwerker','active');
insert into jobs (id,customer_id,title,description,category,address_plz,address_city,track,status) values
  ('f5555555-0000-0000-0000-000000000000','f1111111-0000-0000-0000-000000000000','QJob2','Lang genug beschrieben hier drin.','Elektro','50667','Koeln','handwerker','open');
insert into contracts (id,job_id,customer_id,provider_id,price_gross,customer_total,provider_payout,track,status) values
  ('f6666666-0000-0000-0000-000000000000','f4444444-0000-0000-0000-000000000000','f1111111-0000-0000-0000-000000000000','f2222222-0000-0000-0000-000000000000',100,102.50,92,'handwerker','completed');

alter table auth.users enable trigger user;
alter table public.profiles enable trigger user;
alter table public.jobs enable trigger user;
alter table public.offers enable trigger user;

-- TEST E: Leak-Flags → Strike erst ab der 3. Häufung (Option C)
insert into chat_leak_flags (job_id,sender_id,leak_types) values
  ('f4444444-0000-0000-0000-000000000000','f2222222-0000-0000-0000-000000000000',array['phone']),
  ('f4444444-0000-0000-0000-000000000000','f2222222-0000-0000-0000-000000000000',array['email']);
do $$
declare s int;
begin
  select strike_count into s from provider_profiles where id='f2222222-0000-0000-0000-000000000000';
  if s <> 0 then raise exception 'FAIL: Einzeltreffer vergaben schon einen Strike (%)', s; end if;
  raise notice 'PASS: 2 Leak-Flags = noch kein Strike (Einzeltreffer sanktioniert nicht)';
end $$;
insert into chat_leak_flags (job_id,sender_id,leak_types) values
  ('f4444444-0000-0000-0000-000000000000','f2222222-0000-0000-0000-000000000000',array['iban']);
do $$
declare s int;
begin
  select strike_count into s from provider_profiles where id='f2222222-0000-0000-0000-000000000000';
  if s <> 1 then raise exception 'FAIL: 3 Flags ergaben nicht genau 1 Strike (%)', s; end if;
  raise notice 'PASS: 3 Leak-Flags = 1 Strike (Häufung sanktioniert, Option C)';
end $$;

-- TEST F: gesperrter Anbieter (3 Strikes) kann kein Angebot abgeben
set role authenticated;
set request.jwt.claim.sub = 'f3333333-0000-0000-0000-000000000000';
do $$
begin
  insert into offers (job_id,provider_id,price,status)
  values ('f5555555-0000-0000-0000-000000000000','f3333333-0000-0000-0000-000000000000',90,'pending');
  raise exception 'FAIL: gesperrter Anbieter (3 Strikes) konnte bieten!';
exception when insufficient_privilege or check_violation then
  raise notice 'PASS: gesperrter Anbieter (3 Strikes) kann kein Angebot abgeben';
end $$;
reset role;

-- TEST G: schlechte Bewertung (rating <= 2) erhöht bad_review_count
insert into reviews (contract_id,reviewer_id,reviewed_id,rating,comment) values
  ('f6666666-0000-0000-0000-000000000000','f1111111-0000-0000-0000-000000000000','f2222222-0000-0000-0000-000000000000',1,'Leider schlecht');
do $$
declare b int;
begin
  select bad_review_count into b from provider_profiles where id='f2222222-0000-0000-0000-000000000000';
  if b <> 1 then raise exception 'FAIL: bad_review_count nicht erhöht (%)', b; end if;
  raise notice 'PASS: schlechte Bewertung (<=2*) erhöht bad_review_count (Info-Banner-Signal)';
end $$;
