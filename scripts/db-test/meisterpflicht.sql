-- 0980: die Meisterpflicht wird durchgesetzt, nicht nur behauptet.
--
-- Der Fall, auf den es ankommt, ist NICHT „der Betrieb ohne Meisterbrief wird
-- gesperrt". Das ist leicht gruen zu bekommen -- indem man alle sperrt. Genau
-- das waere die Falle vom 07.09., als ein Rechteentzug beinahe jedem Betrieb
-- das Bieten genommen haette.
--
-- Sechs der zwoelf Zusicherungen unten sind deshalb Gegenproben: das
-- zulassungsfreie Gewerk, das gewoehnliche Speichern, das behaltene Gewerk,
-- der Nachbarschaftsauftrag, der geprueft-freigegebene Betrieb und die
-- Lesbarkeit der Liste.

alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;
alter table public.jobs disable trigger user;
alter table public.provider_profiles disable trigger user;

insert into auth.users (id,email,email_confirmed_at) values
  ('e1000000-0000-0000-0000-000000000000','mp-kunde@test.de',now()),
  ('e2000000-0000-0000-0000-000000000000','mp-ohne@test.de',now()),
  ('e3000000-0000-0000-0000-000000000000','mp-mit@test.de',now()),
  ('e4000000-0000-0000-0000-000000000000','mp-warte@test.de',now()),
  ('e5000000-0000-0000-0000-000000000000','mp-boden@test.de',now()),
  ('eb000000-0000-0000-0000-000000000000','mp-frei@test.de',now()),
  ('ec000000-0000-0000-0000-000000000000','mp-ohnedatei@test.de',now());
insert into profiles (id,role,email,email_verified_at,plz) values
  ('e1000000-0000-0000-0000-000000000000','customer','mp-kunde@test.de',now(),'50667'),
  ('e2000000-0000-0000-0000-000000000000','provider','mp-ohne@test.de',now(),'50667'),
  ('e3000000-0000-0000-0000-000000000000','provider','mp-mit@test.de',now(),'50667'),
  ('e4000000-0000-0000-0000-000000000000','provider','mp-warte@test.de',now(),'50667'),
  ('e5000000-0000-0000-0000-000000000000','provider','mp-boden@test.de',now(),'50667'),
  ('eb000000-0000-0000-0000-000000000000','provider','mp-frei@test.de',now(),'50667'),
  ('ec000000-0000-0000-0000-000000000000','provider','mp-ohnedatei@test.de',now(),'50667');

-- „ohne": freigegeben, KEIN geprüfter Meisterbrief, trägt bereits elektro
-- (Altbestand aus der Zeit vor dieser Migration -- genau der Fall, den es gab).
insert into provider_profiles (id,business_name,trade_id,category_ids,kyc_status,kyc_verified,meister_verified,available) values
  ('e2000000-0000-0000-0000-000000000000','Ohne Meister','elektro','{elektro}','approved',true,false,true),
  ('e3000000-0000-0000-0000-000000000000','Mit Meister','elektro','{elektro}','approved',true,true,true),
  ('e5000000-0000-0000-0000-000000000000','Bodenleger','bodenleger','{bodenleger}','approved',true,false,true);
-- „warte": steht kurz vor der Freigabe, Meisterbrief liegt vor.
insert into provider_profiles (id,business_name,trade_id,category_ids,kyc_status,kyc_verified,meister_verified,meisterbrief_path,gewerbeschein_path,available) values
  ('e4000000-0000-0000-0000-000000000000','Wartet','fliesen','{fliesen}','in_review',false,false,'x/meister.pdf','x/gewerbe.pdf',true),
  -- Zulassungsfreies Gewerk, aber ein Dokument liegt bei (etwa versehentlich
  -- hochgeladen). Ohne diesen Fall war MP13 nicht unterscheidungsfaehig: es
  -- scheiterte schon an `meisterbrief_path is not null`, und die Mutation
  -- „Vermerk auch bei zulassungsfreiem Gewerk" blieb gruen.
  ('eb000000-0000-0000-0000-000000000000','Frei mit Datei','gebaeudereinigung','{gebaeudereinigung}','in_review',false,false,'x/irgendwas.pdf','x/gewerbe.pdf',true);

insert into jobs (id,customer_id,title,description,category,category_id,address_plz,address_city,track,status) values
  ('e6000000-0000-0000-0000-000000000000','e1000000-0000-0000-0000-000000000000','Elektro','Lang genug beschrieben hier drin.','Elektro','elektro','50667','Koeln','handwerker','open'),
  ('e7000000-0000-0000-0000-000000000000','e1000000-0000-0000-0000-000000000000','Boden','Lang genug beschrieben hier drin.','Bodenleger','bodenleger','50667','Koeln','handwerker','open'),
  -- Altzeile ohne Kennung: seit 0410 erlaubt, und genau der Weg vorbei.
  ('e8000000-0000-0000-0000-000000000000','e1000000-0000-0000-0000-000000000000','Alt','Lang genug beschrieben hier drin.','Elektro',NULL,'50667','Koeln','handwerker','open'),
  ('e9000000-0000-0000-0000-000000000000','e1000000-0000-0000-0000-000000000000','Nachbar','Lang genug beschrieben hier drin.','Garten','garten','50667','Koeln','nachbarschaft','open');

alter table auth.users enable trigger user;
alter table public.profiles enable trigger user;
alter table public.jobs enable trigger user;
alter table public.provider_profiles enable trigger user;

-- TEST MP1: ohne geprüften Meisterbrief kein Angebot auf ein Anlage-A-Gewerk
set role authenticated;
set request.jwt.claim.sub = 'e2000000-0000-0000-0000-000000000000';
do $$
begin
  insert into offers (job_id,provider_id,price,status)
  values ('e6000000-0000-0000-0000-000000000000','e2000000-0000-0000-0000-000000000000',300,'pending');
  raise exception 'FAIL MP1: Betrieb ohne geprüften Meisterbrief konnte auf Elektro bieten';
exception when insufficient_privilege or check_violation then
  raise notice 'PASS MP1: ohne geprüften Meisterbrief kein Angebot auf ein Anlage-A-Gewerk';
end $$;

-- TEST MP2 (Gegenprobe): derselbe Betrieb darf auf ein zulassungsfreies Gewerk
do $$
declare n int;
begin
  insert into offers (job_id,provider_id,price,status)
  values ('e7000000-0000-0000-0000-000000000000','e2000000-0000-0000-0000-000000000000',300,'pending');
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL MP2'; end if;
  raise notice 'PASS MP2: auf ein zulassungsfreies Gewerk darf er weiterhin bieten';
end $$;

-- TEST MP3: die Altzeile ohne Kennung ist ebenfalls gesperrt (Anzeigename)
do $$
begin
  insert into offers (job_id,provider_id,price,status)
  values ('e8000000-0000-0000-0000-000000000000','e2000000-0000-0000-0000-000000000000',300,'pending');
  raise exception 'FAIL MP3: Auftrag ohne category_id war der Weg vorbei';
exception when insufficient_privilege or check_violation then
  raise notice 'PASS MP3: auch ohne category_id greift die Pflicht über den Anzeigenamen';
end $$;

-- TEST MP4 (Gegenprobe): der geprüfte Betrieb darf bieten
set request.jwt.claim.sub = 'e3000000-0000-0000-0000-000000000000';
do $$
declare n int;
begin
  insert into offers (job_id,provider_id,price,status)
  values ('e6000000-0000-0000-0000-000000000000','e3000000-0000-0000-0000-000000000000',320,'pending');
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL MP4'; end if;
  raise notice 'PASS MP4: mit geprüftem Meisterbrief geht das Angebot durch';
end $$;

-- TEST MP5: kein nachträglicher Eintrag eines Anlage-A-Gewerks ins Profil
set request.jwt.claim.sub = 'e5000000-0000-0000-0000-000000000000';
do $$
begin
  update provider_profiles set category_ids = '{bodenleger,maler}'
   where id = 'e5000000-0000-0000-0000-000000000000';
  raise exception 'FAIL MP5: Anlage-A-Gewerk ließ sich ohne Meisterbrief nachtragen';
exception when check_violation then
  raise notice 'PASS MP5: ein Anlage-A-Gewerk lässt sich nicht nachtragen';
end $$;

-- TEST MP6 (Gegenprobe): sonst speichert sein Profil ganz normal
do $$
declare n int;
begin
  update provider_profiles set bio = 'Verlege Böden seit 1998.'
   where id = 'e5000000-0000-0000-0000-000000000000';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL MP6'; end if;
  raise notice 'PASS MP6: das gewöhnliche Speichern des Profils bleibt möglich';
end $$;

-- TEST MP7 (Gegenprobe): ein zulassungsfreies Gewerk darf er ergänzen
do $$
declare n int;
begin
  update provider_profiles set category_ids = '{bodenleger,gebaeudereinigung}'
   where id = 'e5000000-0000-0000-0000-000000000000';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL MP7'; end if;
  raise notice 'PASS MP7: ein zulassungsfreies Gewerk lässt sich ergänzen';
end $$;

-- TEST MP8 (Gegenprobe): wer ein Gewerk BEHÄLT, wird nicht ausgesperrt
set request.jwt.claim.sub = 'e2000000-0000-0000-0000-000000000000';
do $$
declare n int;
begin
  update provider_profiles set category_ids = '{elektro,bodenleger}'
   where id = 'e2000000-0000-0000-0000-000000000000';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL MP8'; end if;
  raise notice 'PASS MP8: ein behaltenes Gewerk sperrt das Speichern nicht';
end $$;

-- TEST MP9 (Gegenprobe): der Nachbarschaftsauftrag bleibt unberührt
do $$
declare n int;
begin
  insert into offers (job_id,provider_id,price,status)
  values ('e9000000-0000-0000-0000-000000000000','e2000000-0000-0000-0000-000000000000',40,'pending');
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL MP9'; end if;
  raise notice 'PASS MP9: Nachbarschaftsaufträge bleiben von der Meisterpflicht unberührt';
end $$;

-- TEST MP10: die Liste selbst ist für Clients GESPERRT, die Antwort kommt
-- über die Funktion. Beides gehört geprüft: ein Gate, dessen Grundlage jeder
-- lesen darf, wäre nicht falsch, aber unnötig weit.
do $$
begin
  perform 1 from meisterpflicht_gewerke;
  raise exception 'FAIL MP10: die Liste ist für Angemeldete lesbar';
exception when insufficient_privilege then
  raise notice 'PASS MP10: die Liste ist für Clients gesperrt';
end $$;

-- TEST MP10b (Gegenprobe): die Auskunft darüber ist trotzdem zu bekommen.
-- Ohne diese Zusicherung wäre „alles gesperrt" der einfachste grüne Haken --
-- und die Angebots-Policy, die dieselbe Funktion ruft, wäre tot.
do $$
begin
  if not auftrag_braucht_meister('elektro', NULL) then raise exception 'FAIL MP10b: elektro gilt nicht als meisterpflichtig'; end if;
  if auftrag_braucht_meister('bodenleger', 'Bodenleger') then raise exception 'FAIL MP10b: bodenleger gilt als meisterpflichtig'; end if;
  raise notice 'PASS MP10b: die Auskunft ist für Angemeldete erreichbar und richtig';
end $$;

-- TEST MP11: niemand kann sich den Meisterbrief selbst zusprechen
do $$
begin
  update provider_profiles set meister_verified = true
   where id = 'e2000000-0000-0000-0000-000000000000';
  raise exception 'FAIL MP11: Betrieb konnte sich meister_verified selbst setzen';
exception when raise_exception then
  if sqlerrm like '%FAIL MP11%' then raise; end if;
  raise notice 'PASS MP11: meister_verified lässt sich nicht selbst setzen';
end $$;
reset role;

-- TEST MP12: die Freigabe hält den Meisterbrief fest
set role service_role;
do $$
declare v boolean;
begin
  update provider_profiles
     set kyc_status = 'approved', kyc_verified = true
   where id = 'e4000000-0000-0000-0000-000000000000';
  select meister_verified into v from provider_profiles
   where id = 'e4000000-0000-0000-0000-000000000000';
  if v is not true then raise exception 'FAIL MP12: Freigabe hielt den Meisterbrief nicht fest'; end if;
  raise notice 'PASS MP12: die Freigabe hält den geprüften Meisterbrief fest';
end $$;

-- TEST MP13 (Gegenprobe): bei einem zulassungsfreien Gewerk bleibt er aus,
-- OBWOHL ein Dokument beiliegt. Der Fall mit Dokument ist der entscheidende:
-- ohne ihn scheiterte die Zusicherung schon an `meisterbrief_path is not null`
-- und haette die Gewerk-Bedingung gar nicht gemessen.
do $$
declare v boolean;
begin
  update provider_profiles set kyc_status = 'approved', kyc_verified = true
   where id = 'eb000000-0000-0000-0000-000000000000';
  select meister_verified into v from provider_profiles
   where id = 'eb000000-0000-0000-0000-000000000000';
  if coalesce(v,false) then raise exception 'FAIL MP13: zulassungsfrei und trotzdem als Meister geführt'; end if;
  raise notice 'PASS MP13: ein zulassungsfreies Gewerk führt zu keinem Meister-Vermerk';
end $$;

-- TEST MP17: der Betreiber kann ein Gewerk korrigieren.
-- Die Sperre richtet sich gegen den Betrieb, der sich selbst ein Gewerk
-- zuschreibt, nicht gegen die Verwaltung. Ohne diese Zusicherung waere die
-- service_role-Ausnahme in `gewerk_wechsel_pruefen` ein ungeprueftes Stueck
-- Code -- die Mutation „Ausnahme entfernt" blieb gruen, bis es sie gab.
do $$
declare n int;
begin
  update provider_profiles set category_ids = '{bodenleger,dachdecker}'
   where id = 'e5000000-0000-0000-0000-000000000000';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL MP17: der Betreiber konnte das Gewerk nicht korrigieren'; end if;
  update provider_profiles set category_ids = '{bodenleger,gebaeudereinigung}'
   where id = 'e5000000-0000-0000-0000-000000000000';
  raise notice 'PASS MP17: der Betreiber kann ein Gewerk auch ohne Meister-Vermerk korrigieren';
end $$;

-- TEST MP15: eine Freigabe ohne hinterlegtes Dokument spricht keinen
-- Meisterbrief zu. In der Oberflaeche kann das nicht passieren (lib/pruefung.ts
-- sperrt den Knopf), aber die Datenbank darf sich darauf nicht verlassen -- ein
-- Vermerk, der ohne Beleg entsteht, ist derselbe Fehler wie eine Zusage ohne
-- Mechanismus. Aufgefallen, weil die Mutation „Bedingung `meisterbrief_path is
-- not null` entfernt" gruen blieb.
do $$
declare v boolean;
begin
  insert into provider_profiles (id,business_name,trade_id,category_ids,kyc_status,available)
  values ('ec000000-0000-0000-0000-000000000000','Ohne Datei','maler','{maler}','in_review',true);
  update provider_profiles set kyc_status = 'approved', kyc_verified = true
   where id = 'ec000000-0000-0000-0000-000000000000';
  select meister_verified into v from provider_profiles
   where id = 'ec000000-0000-0000-0000-000000000000';
  if coalesce(v,false) then raise exception 'FAIL MP15: Meister-Vermerk ohne hinterlegtes Dokument'; end if;
  raise notice 'PASS MP15: ohne hinterlegtes Dokument kein Meister-Vermerk';
end $$;

-- TEST MP16: ein entzogener Vermerk kommt durch gewoehnliches Speichern nicht
-- zurueck. Laeuft der Meisterbrief ab und nimmt der Betreiber den Vermerk
-- weg, darf ein Klick auf „Speichern" im Profil ihn nicht wiederherstellen.
-- Aufgefallen, weil die Mutation „Freigabe-Bedingung faellt weg" gruen blieb.
update provider_profiles set meister_verified = false
 where id = 'e4000000-0000-0000-0000-000000000000';
reset role;
set role authenticated;
set request.jwt.claim.sub = 'e4000000-0000-0000-0000-000000000000';
do $$
declare v boolean;
begin
  update provider_profiles set bio = 'Fliesen seit 2004.'
   where id = 'e4000000-0000-0000-0000-000000000000';
  select meister_verified into v from provider_profiles
   where id = 'e4000000-0000-0000-0000-000000000000';
  if coalesce(v,false) then raise exception 'FAIL MP16: entzogener Vermerk kam durch Speichern zurueck'; end if;
  raise notice 'PASS MP16: ein entzogener Vermerk kommt durch Speichern nicht zurück';
end $$;
reset role;
set role service_role;
update provider_profiles set meister_verified = true
 where id = 'e4000000-0000-0000-0000-000000000000';

-- TEST MP14: und danach darf der freigegebene Betrieb auch bieten
reset role;
set role authenticated;
set request.jwt.claim.sub = 'e4000000-0000-0000-0000-000000000000';
do $$
declare n int; j uuid;
begin
  insert into jobs (id,customer_id,title,description,category,category_id,address_plz,address_city,track,status)
  values (gen_random_uuid(),'e1000000-0000-0000-0000-000000000000','F','Lang genug beschrieben hier drin.','Fliesen','fliesen','50667','Koeln','handwerker','open')
  returning id into j;
  raise exception 'FAIL MP14-setup: Anbieter konnte Auftrag anlegen';
exception when insufficient_privilege or check_violation then
  null;  -- erwartet: ein Anbieter legt keine fremden Auftraege an
end $$;
reset role;
set role service_role;
insert into jobs (id,customer_id,title,description,category,category_id,address_plz,address_city,track,status)
values ('ea000000-0000-0000-0000-000000000000','e1000000-0000-0000-0000-000000000000','Fliesen','Lang genug beschrieben hier drin.','Fliesen','fliesen','50667','Koeln','handwerker','open');
reset role;
set role authenticated;
set request.jwt.claim.sub = 'e4000000-0000-0000-0000-000000000000';
do $$
declare n int;
begin
  insert into offers (job_id,provider_id,price,status)
  values ('ea000000-0000-0000-0000-000000000000','e4000000-0000-0000-0000-000000000000',500,'pending');
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL MP14'; end if;
  raise notice 'PASS MP14: der frisch freigegebene Meisterbetrieb kann bieten';
end $$;
reset role;
