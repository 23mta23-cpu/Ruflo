-- 1000: die Obergrenze je Auftrag wirkt, und sie sperrt nicht zu viel.
--
-- Der Weg vorbei waere nicht das hohe Angebot, sondern die AENDERUNG: niedrig
-- einstellen, annehmen lassen, dann hochsetzen. `not valid` verhindert das
-- trotzdem -- die Bedingung gilt fuer jedes geaenderte Angebot. Genau das
-- prueft TG4, und ohne diese Zusicherung waere die Grenze eine Attrappe.

alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;
alter table public.jobs disable trigger user;
alter table public.provider_profiles disable trigger user;

insert into auth.users (id,email,email_confirmed_at) values
  ('a1000000-0000-0000-0000-000000000000','tg-kunde@test.de',now()),
  ('a2000000-0000-0000-0000-000000000000','tg-betrieb@test.de',now());
insert into profiles (id,role,email,email_verified_at,plz) values
  ('a1000000-0000-0000-0000-000000000000','customer','tg-kunde@test.de',now(),'50667'),
  ('a2000000-0000-0000-0000-000000000000','provider','tg-betrieb@test.de',now(),'50667');
insert into provider_profiles (id,business_name,trade_id,category_ids,kyc_status,kyc_verified,available) values
  ('a2000000-0000-0000-0000-000000000000','Bodenleger TG','bodenleger','{bodenleger}','approved',true,true);
insert into jobs (id,customer_id,title,description,category,category_id,address_plz,address_city,track,status) values
  ('a3000000-0000-0000-0000-000000000000','a1000000-0000-0000-0000-000000000000','Boden','Lang genug beschrieben hier drin.','Bodenleger','bodenleger','50667','Koeln','handwerker','open');

alter table auth.users enable trigger user;
alter table public.profiles enable trigger user;
alter table public.jobs enable trigger user;
alter table public.provider_profiles enable trigger user;

set role authenticated;
set request.jwt.claim.sub = 'a2000000-0000-0000-0000-000000000000';

-- TEST TG1: über der Grenze geht nicht
do $$
begin
  insert into offers (job_id,provider_id,price,status)
  values ('a3000000-0000-0000-0000-000000000000','a2000000-0000-0000-0000-000000000000',5001,'pending');
  raise exception 'FAIL TG1: ein Angebot über der Grenze ging durch';
exception when check_violation then
  raise notice 'PASS TG1: ein Angebot über der Obergrenze wird abgewiesen';
end $$;

-- TEST TG2 (Gegenprobe): genau auf der Grenze geht
do $$
declare n int;
begin
  insert into offers (id,job_id,provider_id,price,status)
  values ('a4000000-0000-0000-0000-000000000000','a3000000-0000-0000-0000-000000000000','a2000000-0000-0000-0000-000000000000',5000,'pending');
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL TG2'; end if;
  raise notice 'PASS TG2: genau auf der Obergrenze geht das Angebot durch';
end $$;

-- TEST TG3 (Gegenprobe): ein gewöhnliches Angebot bleibt unberührt.
-- Ohne diese Zusicherung wäre „alles sperren" ein bestandener Test.
do $$
declare n int;
begin
  insert into offers (id,job_id,provider_id,price,status)
  values ('a5000000-0000-0000-0000-000000000000','a3000000-0000-0000-0000-000000000000','a2000000-0000-0000-0000-000000000000',320,'pending');
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL TG3'; end if;
  raise notice 'PASS TG3: ein gewöhnliches Angebot bleibt unberührt';
end $$;
reset role;

-- TEST TG4: der Weg vorbei ist zu. Niedrig einstellen, dann hochsetzen.
-- Als service_role, weil die UPDATE-Policy auf offers dem Anbieter das
-- Nachbessern nicht erlaubt -- geprüft wird hier die BEDINGUNG, nicht die
-- Policy, und eine Bedingung, die nur beim Einfügen gilt, wäre eine Attrappe.
set role service_role;
do $$
begin
  update offers set price = 9000 where id = 'a5000000-0000-0000-0000-000000000000';
  raise exception 'FAIL TG4: ein Angebot ließ sich über die Grenze hochsetzen';
exception when check_violation then
  raise notice 'PASS TG4: auch das Hochsetzen über die Grenze wird abgewiesen';
end $$;

-- TEST TG5 (Gegenprobe): unterhalb der Grenze lässt es sich weiter ändern
do $$
declare n int;
begin
  update offers set price = 410 where id = 'a5000000-0000-0000-0000-000000000000';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL TG5'; end if;
  raise notice 'PASS TG5: unterhalb der Grenze bleibt das Ändern möglich';
end $$;
reset role;
