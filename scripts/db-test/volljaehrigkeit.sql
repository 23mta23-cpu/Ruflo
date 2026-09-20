-- 0990: die 18+-Erklaerung ist ein Nachweis, und der Nachbarschaftszweig
--       kommt ueberhaupt in eine Pruefung.
--
-- Der Fall, auf den es ankommt, ist NICHT „ohne Erklaerung geht es nicht".
-- Das ist leicht gruen zu bekommen, indem man den Uebergang ganz zumacht.
-- Vier der zehn Zusicherungen sind deshalb Gegenproben: der Handwerksweg,
-- der erlaubte Uebergang, das eigene Lesen und die Korrektur der Erklaerung.

alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;
alter table public.provider_profiles disable trigger user;

insert into auth.users (id,email,email_confirmed_at) values
  ('f1000000-0000-0000-0000-000000000000','vj-helfer@test.de',now()),
  ('f2000000-0000-0000-0000-000000000000','vj-ohne@test.de',now()),
  ('f3000000-0000-0000-0000-000000000000','vj-handwerk@test.de',now()),
  ('f4000000-0000-0000-0000-000000000000','vj-fremd@test.de',now()),
  ('f5000000-0000-0000-0000-000000000000','vj-leer@test.de',now());
insert into profiles (id,role,email,email_verified_at) values
  ('f1000000-0000-0000-0000-000000000000','provider','vj-helfer@test.de',now()),
  ('f2000000-0000-0000-0000-000000000000','provider','vj-ohne@test.de',now()),
  ('f3000000-0000-0000-0000-000000000000','provider','vj-handwerk@test.de',now()),
  ('f4000000-0000-0000-0000-000000000000','provider','vj-fremd@test.de',now()),
  ('f5000000-0000-0000-0000-000000000000','provider','vj-leer@test.de',now());
insert into provider_profiles (id,business_name,is_nachbarschaft,category_ids,kyc_status) values
  ('f1000000-0000-0000-0000-000000000000','Helfer',true,'{garten}','pending'),
  ('f2000000-0000-0000-0000-000000000000','Ohne',true,'{garten}','pending'),
  ('f4000000-0000-0000-0000-000000000000','Fremd',true,'{garten}','pending'),
  ('f5000000-0000-0000-0000-000000000000','Leer',true,'{}','pending');
insert into provider_profiles (id,business_name,is_nachbarschaft,category_ids,trade_id,gewerbeschein_path,kyc_status) values
  ('f3000000-0000-0000-0000-000000000000','Handwerk',false,'{bodenleger}','bodenleger','x/gewerbe.pdf','pending');

alter table auth.users enable trigger user;
alter table public.profiles enable trigger user;
alter table public.provider_profiles enable trigger user;

set role authenticated;

-- TEST VJ1: ohne Erklärung kein Übergang in die Prüfung
set request.jwt.claim.sub = 'f2000000-0000-0000-0000-000000000000';
do $$
begin
  update provider_profiles set kyc_status = 'in_review'
   where id = 'f2000000-0000-0000-0000-000000000000';
  raise exception 'FAIL VJ1: Helfer kam ohne 18+-Erklärung in die Prüfung';
exception when raise_exception then
  if sqlerrm like '%FAIL VJ1%' then raise; end if;
  raise notice 'PASS VJ1: ohne 18+-Erklärung kein Übergang in die Prüfung';
end $$;

-- TEST VJ2: die eigene Erklärung lässt sich anlegen
set request.jwt.claim.sub = 'f1000000-0000-0000-0000-000000000000';
do $$
declare n int;
begin
  insert into volljaehrigkeits_erklaerungen (helfer_id,fassung,angezeigter_text)
  values ('f1000000-0000-0000-0000-000000000000','volljaehrigkeit-2026-09-20',
          'Ich erkläre, dass ich mindestens 18 Jahre alt bin. Das ist meine eigene Angabe.');
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL VJ2'; end if;
  raise notice 'PASS VJ2: der Helfer kann seine eigene Erklärung hinterlegen';
end $$;

-- TEST VJ3 (Gegenprobe): mit Erklärung geht der Übergang
do $$
declare v text;
begin
  update provider_profiles set kyc_status = 'in_review'
   where id = 'f1000000-0000-0000-0000-000000000000';
  select kyc_status into v from provider_profiles
   where id = 'f1000000-0000-0000-0000-000000000000';
  if v <> 'in_review' then raise exception 'FAIL VJ3: Übergang blieb aus'; end if;
  raise notice 'PASS VJ3: mit Erklärung kommt der Helfer in die Prüfung';
end $$;

-- TEST VJ4 (Gegenprobe): der Zeitstempel wird gesetzt
do $$
declare t timestamptz;
begin
  select kyc_submitted_at into t from provider_profiles
   where id = 'f1000000-0000-0000-0000-000000000000';
  if t is null then raise exception 'FAIL VJ4: kein Einreichungszeitpunkt'; end if;
  raise notice 'PASS VJ4: der Einreichungszeitpunkt steht fest';
end $$;

-- TEST VJ5 (Gegenprobe): der Handwerksweg bleibt unberührt
set request.jwt.claim.sub = 'f3000000-0000-0000-0000-000000000000';
do $$
declare v text;
begin
  update provider_profiles set kyc_status = 'in_review'
   where id = 'f3000000-0000-0000-0000-000000000000';
  select kyc_status into v from provider_profiles
   where id = 'f3000000-0000-0000-0000-000000000000';
  if v <> 'in_review' then raise exception 'FAIL VJ5: Handwerksweg mitgesperrt'; end if;
  raise notice 'PASS VJ5: der Handwerksweg über den Gewerbeschein bleibt offen';
end $$;

-- TEST VJ6: ohne Leistung kein Übergang, auch mit Erklärung
set request.jwt.claim.sub = 'f5000000-0000-0000-0000-000000000000';
do $$
begin
  insert into volljaehrigkeits_erklaerungen (helfer_id,fassung,angezeigter_text)
  values ('f5000000-0000-0000-0000-000000000000','volljaehrigkeit-2026-09-20',
          'Ich erkläre, dass ich mindestens 18 Jahre alt bin. Das ist meine eigene Angabe.');
  update provider_profiles set kyc_status = 'in_review'
   where id = 'f5000000-0000-0000-0000-000000000000';
  raise exception 'FAIL VJ6: Helfer ohne Leistung kam in die Prüfung';
exception when raise_exception then
  if sqlerrm like '%FAIL VJ6%' then raise; end if;
  raise notice 'PASS VJ6: ohne angegebene Leistung kein Übergang';
end $$;

-- TEST VJ7: niemand erklärt für einen anderen.
--
-- Das Ziel ist BEWUSST ein Helfer ohne eigene Erklärung (f2000000). Die erste
-- Fassung zielte auf f1000000, der seit VJ2 schon eine Zeile hat -- dort wies
-- der Primärschlüssel ab, nicht die Policy, und die Mutation „Schreibpolicy
-- erlaubt jeden" blieb grün. Die Falle steht seit 16.08. in CLAUDE.md, und ich
-- bin trotzdem hineingelaufen.
set request.jwt.claim.sub = 'f4000000-0000-0000-0000-000000000000';
do $$
begin
  insert into volljaehrigkeits_erklaerungen (helfer_id,fassung,angezeigter_text)
  values ('f2000000-0000-0000-0000-000000000000','volljaehrigkeit-2026-09-20',
          'Fremde Erklärung, die hier nicht entstehen darf, in voller Länge.');
  raise exception 'FAIL VJ7: fremde Erklärung ließ sich anlegen';
exception when insufficient_privilege then
  raise notice 'PASS VJ7: niemand erklärt für einen anderen';
end $$;

-- TEST VJ8: niemand liest die Erklärung eines anderen
do $$
declare n int;
begin
  select count(*) into n from volljaehrigkeits_erklaerungen
   where helfer_id = 'f1000000-0000-0000-0000-000000000000';
  if n <> 0 then raise exception 'FAIL VJ8: fremde Erklärung war lesbar'; end if;
  raise notice 'PASS VJ8: eine fremde Erklärung ist nicht lesbar';
end $$;

-- TEST VJ9 (Gegenprobe): die eigene schon
set request.jwt.claim.sub = 'f1000000-0000-0000-0000-000000000000';
do $$
declare n int;
begin
  select count(*) into n from volljaehrigkeits_erklaerungen
   where helfer_id = 'f1000000-0000-0000-0000-000000000000';
  if n <> 1 then raise exception 'FAIL VJ9: die eigene Erklärung war nicht lesbar'; end if;
  raise notice 'PASS VJ9: der Helfer liest seine eigene Erklärung (Art. 15 DSGVO)';
end $$;

-- TEST VJ10: der Nachweis lässt sich nicht wegnehmen.
--
-- Gemessen, nicht angenommen: ein DELETE ohne Policy wirft NICHT, es trifft
-- null Zeilen und meldet Erfolg. Die erste Fassung dieses Tests erwartete eine
-- Ausnahme und war deshalb rot, obwohl der Schutz griff. Geprüft wird die
-- WIRKUNG -- steht die Zeile danach noch da.
do $$
declare n int;
begin
  delete from volljaehrigkeits_erklaerungen
   where helfer_id = 'f1000000-0000-0000-0000-000000000000';
  select count(*) into n from volljaehrigkeits_erklaerungen
   where helfer_id = 'f1000000-0000-0000-0000-000000000000';
  if n <> 1 then raise exception 'FAIL VJ10: der Nachweis ließ sich löschen'; end if;
  raise notice 'PASS VJ10: ein Nachweis lässt sich nicht löschen';
end $$;

-- TEST VJ12: ein Handwerksbetrieb legt hier keine Erklärung ab.
--
-- Die Bedingung `is_nachbarschaft` in der Schreib-Policy war bis zu dieser
-- Zusicherung durch KEINE Mutation rot zu bekommen: der Guard in 0990 prüft
-- sie ohnehin ein zweites Mal. Zwei Bedingungen, die dieselben Fälle
-- abdecken, sind eine Bedingung (Lehre von 0710) -- entweder es gibt einen
-- Test für den Fall, den nur die erste abfängt, oder die Bedingung gehört
-- weg. Der Fall: eine Zeile über einen Handwerksbetrieb wäre ein Datenfehler
-- in einer Tabelle, die ausschließlich Nachbarschaftshelfer führt.
set request.jwt.claim.sub = 'f3000000-0000-0000-0000-000000000000';
do $$
begin
  insert into volljaehrigkeits_erklaerungen (helfer_id,fassung,angezeigter_text)
  values ('f3000000-0000-0000-0000-000000000000','volljaehrigkeit-2026-09-20',
          'Ich erkläre, dass ich mindestens 18 Jahre alt bin. Das ist meine eigene Angabe.');
  raise exception 'FAIL VJ12: ein Handwerksbetrieb konnte hier erklären';
exception when insufficient_privilege then
  raise notice 'PASS VJ12: ein Handwerksbetrieb legt hier keine Erklärung ab';
end $$;

-- TEST VJ11: ein leerer Wortlaut ist kein Nachweis.
--
-- Die Fassung ist BEWUSST gültig ('volljaehrigkeit-2026-09-20'). Die erste
-- Fassung übergab 'v1' -- zwei Zeichen, und damit schlug die Bedingung an
-- `fassung` an statt der an `angezeigter_text`. Die Mutation „Untergrenze des
-- Wortlauts weg" blieb deshalb grün: eine zweite Bedingung deckte denselben
-- Fall ab, dieselbe Klasse wie bei 0710.
set request.jwt.claim.sub = 'f4000000-0000-0000-0000-000000000000';
do $$
begin
  insert into volljaehrigkeits_erklaerungen (helfer_id,fassung,angezeigter_text)
  values ('f4000000-0000-0000-0000-000000000000','volljaehrigkeit-2026-09-20','zu kurz');
  raise exception 'FAIL VJ11: ein Nachweis ohne Wortlaut ging durch';
exception when check_violation then
  raise notice 'PASS VJ11: ein Nachweis ohne brauchbaren Wortlaut wird abgewiesen';
end $$;
reset role;
