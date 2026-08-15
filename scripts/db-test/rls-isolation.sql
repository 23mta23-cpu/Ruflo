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

-- Anbieter-Sichtbarkeit (0540 + 0560, Security-Befund H1/H1-voll):
-- Basistabelle für anon komplett gesperrt; öffentliche Felder nur über die
-- View; eingeloggte Nicht-Eigentümer sehen fremde Anbieter-Zeilen NICHT.
reset role;
set role anon;
do $$
begin
  begin
    perform 1 from public.provider_profiles limit 1;
    raise exception 'FAIL: anon konnte die Basistabelle provider_profiles lesen';
  exception when insufficient_privilege then
    raise notice 'PASS: anon hat keinen Zugriff mehr auf die Basistabelle provider_profiles';
  end;
end $$;
do $$
declare v text;
begin
  select business_name into v from public.provider_public limit 1;
  raise notice 'PASS: anon liest oeffentliche Anbieter-Felder ueber die View provider_public';
end $$;
reset role;

-- Eingeloggter Nicht-Eigentümer (Kunde) sieht die fremde Anbieter-Basiszeile NICHT
set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000000';
do $$
declare n int;
begin
  select count(*) into n from public.provider_profiles where id = 'cccccccc-0000-0000-0000-000000000000';
  if n <> 0 then raise exception 'FAIL: Fremder liest fremde Anbieter-Basiszeile (%)', n; end if;
  raise notice 'PASS: eingeloggter Nicht-Eigentuemer sieht fremde Anbieter-Basiszeile NICHT (H1-voll)';
end $$;
reset role;

-- Die oeffentliche View fuehrt KEINE sensible Spalte.
--
-- Die zwei Pruefungen oben belegen, dass die BASISTABELLE dicht ist. Der
-- zweite Weg zu denselben Daten ist die View provider_public, und die laeuft
-- als security definer, umgeht die RLS also bewusst. Ein spaeteres
-- `select pp.*` beim Erweitern der View wuerde Telefonnummer, Steuer-ID und
-- PStTG-Zaehler in einem Rutsch wieder oeffentlich machen, ohne dass eine
-- Policy angefasst wurde -- und keine der obigen Assertions wuerde das merken.
--
-- Geprueft wird deshalb das SCHEMA der View, nicht ein Beispielwert.
do $$
declare v_verraten text[];
begin
  select array_agg(column_name order by column_name) into v_verraten
    from information_schema.columns
    where table_schema = 'public' and table_name = 'provider_public'
      and column_name in ('phone','steuer_id','psttg_revenue_eur','psttg_job_count',
                          'psttg_tax_id','psttg_frozen','strike_count',
                          'gewerbeschein_path','meisterbrief_path');
  if v_verraten is not null then
    raise exception 'FAIL: provider_public fuehrt sensible Spalten: %', array_to_string(v_verraten,', ');
  end if;
  raise notice 'PASS: provider_public fuehrt keine sensible Spalte (Schema geprueft, H1-voll)';
end $$;

-- Der Anbieter selbst sieht seine Eigen-Zeile weiterhin
set role authenticated;
set request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000000';
do $$
declare n int;
begin
  select count(*) into n from public.provider_profiles where id = 'cccccccc-0000-0000-0000-000000000000';
  if n <> 1 then raise exception 'FAIL: Anbieter sieht eigene Zeile nicht (%)', n; end if;
  raise notice 'PASS: Anbieter sieht die eigene Basiszeile weiterhin';
end $$;
reset role;

-- Kundenadresse (job_addresses, Migration 0570, Security-Befund M1):
-- nur Auftrags-Kunde + ZUGEWIESENER Anbieter lesen die Straße; ein browsender
-- (nicht zugewiesener) Anbieter NICHT.
reset role;
alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;
alter table public.jobs disable trigger user;
insert into auth.users (id,email,email_confirmed_at) values
  ('a1111111-0000-0000-0000-000000000000','mac@test.de',now()),
  ('a2222222-0000-0000-0000-000000000000','map@test.de',now()),
  ('a3333333-0000-0000-0000-000000000000','mab@test.de',now());
insert into profiles (id,role,email,email_verified_at) values
  ('a1111111-0000-0000-0000-000000000000','customer','mac@test.de',now()),
  ('a2222222-0000-0000-0000-000000000000','provider','map@test.de',now()),
  ('a3333333-0000-0000-0000-000000000000','provider','mab@test.de',now());
insert into provider_profiles (id,business_name) values
  ('a2222222-0000-0000-0000-000000000000','ZP'),('a3333333-0000-0000-0000-000000000000','BP');
insert into jobs (id,customer_id,provider_id,title,description,category,address_plz,address_city,track,status) values
  ('a4444444-0000-0000-0000-000000000000','a1111111-0000-0000-0000-000000000000','a2222222-0000-0000-0000-000000000000','MJob','Lang genug beschrieben hier drin.','Elektro','50667','Koeln','handwerker','active');
insert into job_addresses (job_id,address_street) values ('a4444444-0000-0000-0000-000000000000','Musterstrasse 5');
alter table auth.users enable trigger user;
alter table public.profiles enable trigger user;
alter table public.jobs enable trigger user;

set role authenticated; set request.jwt.claim.sub = 'a3333333-0000-0000-0000-000000000000';
do $$ declare n int; begin
  select count(*) into n from job_addresses where job_id='a4444444-0000-0000-0000-000000000000';
  if n <> 0 then raise exception 'FAIL: browsender Anbieter liest Kundenadresse (%)', n; end if;
  raise notice 'PASS: browsender Anbieter sieht die Kundenadresse NICHT (M1)';
end $$; reset role;

set role authenticated; set request.jwt.claim.sub = 'a2222222-0000-0000-0000-000000000000';
do $$ declare v text; begin
  select address_street into v from job_addresses where job_id='a4444444-0000-0000-0000-000000000000';
  if v is null then raise exception 'FAIL: zugewiesener Anbieter sieht Strasse nicht'; end if;
  raise notice 'PASS: zugewiesener Anbieter sieht die Kundenadresse';
end $$; reset role;

set role authenticated; set request.jwt.claim.sub = 'a1111111-0000-0000-0000-000000000000';
do $$ declare v text; begin
  select address_street into v from job_addresses where job_id='a4444444-0000-0000-0000-000000000000';
  if v is null then raise exception 'FAIL: Kunde sieht eigene Adresse nicht'; end if;
  raise notice 'PASS: Kunde sieht die eigene Adresse';
end $$; reset role;

-- ── Anbieter-Posteingang (0590) ──────────────────────────────────────────────
-- Ein Anbieter, der eine Rueckfrage gestellt hat, muss den Auftrag weiter lesen
-- koennen, auch wenn ein ANDERER den Zuschlag bekommt (status='active').
-- Gleichzeitig darf ein unbeteiligter Anbieter das NICHT koennen.
--
-- Die user-Trigger werden wie in inquiries.sql abgeschaltet: sonst legt
-- handle_new_user beim auth.users-Insert schon eine profiles-Zeile OHNE
-- email_verified_at an, das eigene Insert laeuft in "on conflict do nothing"
-- und auth_email_confirmed() ist false -> die Rueckfrage wird blockiert.
reset role;
alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;
alter table public.jobs disable trigger user;

insert into auth.users (id,email,email_confirmed_at) values
  ('c1c1c1c1-0000-0000-0000-000000000000','pi-kunde@test.de',now()),
  ('c2c2c2c2-0000-0000-0000-000000000000','pi-frager@test.de',now()),
  ('c3c3c3c3-0000-0000-0000-000000000000','pi-gewinner@test.de',now()),
  ('c4c4c4c4-0000-0000-0000-000000000000','pi-unbeteiligt@test.de',now());
insert into profiles (id,role,email,email_verified_at) values
  ('c1c1c1c1-0000-0000-0000-000000000000','customer','pi-kunde@test.de',now()),
  ('c2c2c2c2-0000-0000-0000-000000000000','provider','pi-frager@test.de',now()),
  ('c3c3c3c3-0000-0000-0000-000000000000','provider','pi-gewinner@test.de',now()),
  ('c4c4c4c4-0000-0000-0000-000000000000','provider','pi-unbeteiligt@test.de',now());
insert into provider_profiles (id,business_name,is_nachbarschaft) values
  ('c2c2c2c2-0000-0000-0000-000000000000','Frager',false),
  ('c3c3c3c3-0000-0000-0000-000000000000','Gewinner',false),
  ('c4c4c4c4-0000-0000-0000-000000000000','Unbeteiligt',false);
insert into jobs (id,customer_id,title,description,category,address_plz,address_city,track,status) values
  ('c9c9c9c9-0000-0000-0000-000000000000','c1c1c1c1-0000-0000-0000-000000000000',
   'Posteingang-Job','Lang genug beschrieben hier drin.','Elektro','50667','Koeln','handwerker','open');

alter table auth.users enable trigger user;
alter table public.profiles enable trigger user;
alter table public.jobs enable trigger user;

-- Frager stellt eine Rueckfrage, solange der Auftrag offen ist
set role authenticated;
set request.jwt.claim.sub = 'c2c2c2c2-0000-0000-0000-000000000000';
do $$
declare n int;
begin
  insert into messages (job_id,sender_id,sender_role,body,provider_id)
  values ('c9c9c9c9-0000-0000-0000-000000000000','c2c2c2c2-0000-0000-0000-000000000000',
          'provider','Was genau ist gewuenscht?','c2c2c2c2-0000-0000-0000-000000000000');
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: Rueckfrage konnte nicht gestellt werden'; end if;
end $$;
reset role;

-- Auftrag geht an einen ANDEREN Anbieter (als postgres, umgeht RLS bewusst)
update jobs set status='active', provider_id='c3c3c3c3-0000-0000-0000-000000000000'
  where id='c9c9c9c9-0000-0000-0000-000000000000';

-- (a) Der Frager sieht den Auftrag weiterhin.
-- "set role authenticated" ist zwingend: als postgres (Tabelleneigentuemer)
-- wird RLS gar nicht ausgewertet und der Test waere wertlos.
set role authenticated;
set request.jwt.claim.sub = 'c2c2c2c2-0000-0000-0000-000000000000';
do $$
declare n int;
begin
  select count(*) into n from jobs where id='c9c9c9c9-0000-0000-0000-000000000000';
  if n <> 1 then
    raise exception 'FAIL: Thread-Teilnehmer sieht seinen Auftrag nicht mehr (n=%)', n;
  end if;
  raise notice 'PASS: Anbieter mit Rueckfrage liest den Auftrag auch nach Vergabe an andere';
end $$;
reset role;

-- (b) Ein voellig unbeteiligter Anbieter (kein Thread, nicht zugewiesen) darf
-- den nicht mehr offenen Auftrag NICHT sehen.
set role authenticated;
set request.jwt.claim.sub = 'c4c4c4c4-0000-0000-0000-000000000000';
do $$
declare n int;
begin
  select count(*) into n from jobs where id='c9c9c9c9-0000-0000-0000-000000000000';
  if n <> 0 then
    raise exception 'FAIL: Unbeteiligter liest fremden aktiven Auftrag (n=%)', n;
  end if;
  raise notice 'PASS: Unbeteiligter sieht den aktiven Auftrag weiterhin nicht';
end $$;
reset role;
