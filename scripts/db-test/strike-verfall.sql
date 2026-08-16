-- Strike-Verfall und Begruendung (Migration 0720)
--
-- AGB §7(3) sagt "3 Strikes INNERHALB VON 12 MONATEN". Der Code zaehlte bis
-- 16.08.2026 ueber die gesamte Kontodauer und liess Strikes nie wieder
-- verschwinden. AGB §7(4) verspricht eine Begruendung (Art. 4 P2B-VO); es gab
-- nur einen Zaehler, aus dem sich keine erzeugen laesst.
--
-- (W)  Alte Funde ausserhalb des Fensters zaehlen NICHT mehr mit
-- (X)  Drei Funde IM Fenster ergeben weiterhin genau einen Strike
-- (Y)  Jeder Strike traegt eine Begruendung und ein Verfallsdatum (§7(4))
-- (Z)  Ein verfallener Strike sperrt nicht mehr
-- (Z2) Ein aufgehobener Strike (Beschwerde, §7(5)) sperrt nicht mehr
-- (Z3) Drei aktive Strikes sperren weiterhin
-- (Z4) Der Anbieter kann SEINE Strikes lesen, fremde nicht
-- (Z5) Der Anbieter kann Strikes nicht selbst aendern oder loeschen
reset role;

alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;
alter table public.jobs disable trigger user;

insert into auth.users (id,email,email_confirmed_at) values
  ('e9000001-0000-0000-0000-000000000000','sc@test.de',now()),   -- Kunde
  ('e9000002-0000-0000-0000-000000000000','sa@test.de',now()),   -- Anbieter: Alt-Funde
  ('e9000003-0000-0000-0000-000000000000','sb@test.de',now()),   -- Anbieter: verfallener Strike
  ('e9000004-0000-0000-0000-000000000000','sd@test.de',now());   -- Anbieter: 3 aktive Strikes
insert into profiles (id,role,email,email_verified_at) values
  ('e9000001-0000-0000-0000-000000000000','customer','sc@test.de',now()),
  ('e9000002-0000-0000-0000-000000000000','provider','sa@test.de',now()),
  ('e9000003-0000-0000-0000-000000000000','provider','sb@test.de',now()),
  ('e9000004-0000-0000-0000-000000000000','provider','sd@test.de',now());
insert into provider_profiles (id,business_name,is_nachbarschaft,strike_count) values
  ('e9000002-0000-0000-0000-000000000000','SA',false,0),
  ('e9000003-0000-0000-0000-000000000000','SB',false,0),
  ('e9000004-0000-0000-0000-000000000000','SD',false,0);
insert into jobs (id,customer_id,provider_id,title,description,category,address_plz,address_city,track,status) values
  ('e9000005-0000-0000-0000-000000000000','e9000001-0000-0000-0000-000000000000','e9000002-0000-0000-0000-000000000000','SJob','Lang genug beschrieben hier drin.','Elektro','50667','Koeln','handwerker','active');
insert into jobs (id,customer_id,title,description,category,address_plz,address_city,track,status) values
  ('e9000006-0000-0000-0000-000000000000','e9000001-0000-0000-0000-000000000000','SOffen','Lang genug beschrieben hier drin.','Elektro','50667','Koeln','handwerker','open');

alter table auth.users enable trigger user;
alter table public.profiles enable trigger user;
alter table public.jobs enable trigger user;

-- TEST W: der Treue-Anbieter. Zwei Funde vor ueber einem Jahr, dann zwei neue.
-- Alte Rechnung: 4 Funde / 3 = 1 Strike. Nach AGB §7(3): nur 2 Funde im
-- Fenster, also KEIN Strike. Genau dieser Fall traf langjaehrige Anbieter.
insert into chat_leak_flags (job_id,sender_id,leak_types,created_at) values
  ('e9000005-0000-0000-0000-000000000000','e9000002-0000-0000-0000-000000000000',array['phone'], now() - interval '20 months'),
  ('e9000005-0000-0000-0000-000000000000','e9000002-0000-0000-0000-000000000000',array['email'], now() - interval '14 months'),
  ('e9000005-0000-0000-0000-000000000000','e9000002-0000-0000-0000-000000000000',array['phone'], now() - interval '3 months');
insert into chat_leak_flags (job_id,sender_id,leak_types) values
  ('e9000005-0000-0000-0000-000000000000','e9000002-0000-0000-0000-000000000000',array['iban']);
do $$
declare s int;
begin
  select aktive_strikes('e9000002-0000-0000-0000-000000000000') into s;
  if s <> 0 then
    raise exception 'FAIL: Funde ausserhalb der 12 Monate haben einen Strike erzeugt (%)', s;
  end if;
  raise notice 'PASS W: alte Funde ausserhalb des 12-Monats-Fensters zaehlen nicht mit (AGB 7(3))';
end $$;

-- TEST X: dritter Fund IM Fenster -> genau ein Strike
insert into chat_leak_flags (job_id,sender_id,leak_types) values
  ('e9000005-0000-0000-0000-000000000000','e9000002-0000-0000-0000-000000000000',array['phone']);
do $$
declare s int;
begin
  select aktive_strikes('e9000002-0000-0000-0000-000000000000') into s;
  if s <> 1 then raise exception 'FAIL: 3 Funde im Fenster ergaben nicht genau 1 Strike (%)', s; end if;
  raise notice 'PASS X: 3 Funde im Fenster = 1 Strike (Haeufung sanktioniert, Einzeltreffer nicht)';
end $$;

-- TEST Y: Begruendung und Verfallsdatum vorhanden (AGB 7(4), Art. 4 P2B-VO)
do $$
declare r record;
begin
  select begruendung, verfaellt_am, grund into r
  from provider_strikes where provider_id = 'e9000002-0000-0000-0000-000000000000';
  if r.begruendung is null or char_length(r.begruendung) < 20 then
    raise exception 'FAIL: Strike ohne brauchbare Begruendung';
  end if;
  if r.verfaellt_am <= now() then raise exception 'FAIL: Verfallsdatum liegt nicht in der Zukunft'; end if;
  if r.grund <> 'kontaktdaten_umgehung' then raise exception 'FAIL: falscher Anlass (%)', r.grund; end if;
  -- Der Anbieter muss aus dem Text erkennen koennen, WORAN er ist.
  if position('kontakt@werkant.de' in r.begruendung) = 0 then
    raise exception 'FAIL: Begruendung nennt keinen Beschwerdeweg (AGB 7(5))';
  end if;
  raise notice 'PASS Y: Strike traegt Begruendung, Anlass, Verfallsdatum und Beschwerdeweg';
end $$;

-- TEST Z: ein verfallener Strike sperrt nicht mehr
insert into provider_strikes (provider_id,grund,begruendung,erteilt_am,verfaellt_am) values
  ('e9000003-0000-0000-0000-000000000000','kontaktdaten_umgehung',
   'Testfall: dieser Strike ist bereits verfallen und darf nicht mehr wirken.',
   now() - interval '13 months', now() - interval '1 month'),
  ('e9000003-0000-0000-0000-000000000000','kontaktdaten_umgehung',
   'Testfall: dieser Strike ist bereits verfallen und darf nicht mehr wirken.',
   now() - interval '13 months', now() - interval '1 month'),
  ('e9000003-0000-0000-0000-000000000000','kontaktdaten_umgehung',
   'Testfall: dieser Strike ist bereits verfallen und darf nicht mehr wirken.',
   now() - interval '13 months', now() - interval '1 month');
do $$
declare s int;
begin
  select aktive_strikes('e9000003-0000-0000-0000-000000000000') into s;
  if s <> 0 then raise exception 'FAIL: verfallene Strikes zaehlen noch (%)', s; end if;
  raise notice 'PASS Z: verfallene Strikes zaehlen nicht mehr';
end $$;

set role authenticated;
set request.jwt.claim.sub = 'e9000003-0000-0000-0000-000000000000';
do $$
begin
  insert into offers (job_id,provider_id,price,status)
  values ('e9000006-0000-0000-0000-000000000000','e9000003-0000-0000-0000-000000000000',90,'pending');
  raise notice 'PASS Z-b: Anbieter mit NUR verfallenen Strikes darf wieder bieten';
exception when insufficient_privilege then
  raise exception 'FAIL: verfallene Strikes sperren immer noch (AGB 7(3) verletzt)';
end $$;
reset role;

-- TEST Z3: drei AKTIVE Strikes sperren weiterhin — die Sperre darf durch den
-- Verfall nicht insgesamt wirkungslos werden.
insert into provider_strikes (provider_id,grund,begruendung) values
  ('e9000004-0000-0000-0000-000000000000','kontaktdaten_umgehung','Testfall: aktiver Strike eins von drei hier drin.'),
  ('e9000004-0000-0000-0000-000000000000','nichterscheinen','Testfall: aktiver Strike zwei von drei hier drin.'),
  ('e9000004-0000-0000-0000-000000000000','falsche_angaben','Testfall: aktiver Strike drei von drei hier drin.');
set role authenticated;
set request.jwt.claim.sub = 'e9000004-0000-0000-0000-000000000000';
do $$
begin
  insert into offers (job_id,provider_id,price,status)
  values ('e9000006-0000-0000-0000-000000000000','e9000004-0000-0000-0000-000000000000',90,'pending');
  raise exception 'FAIL: Anbieter mit 3 AKTIVEN Strikes konnte bieten!';
exception when insufficient_privilege then
  raise notice 'PASS Z3: 3 aktive Strikes sperren weiterhin';
end $$;
reset role;

-- TEST Z2: eine erfolgreiche Beschwerde (AGB 7(5)) hebt die Sperre auf
update provider_strikes
   set aufgehoben_am = now(), aufgehoben_grund = 'Beschwerde begruendet'
 where provider_id = 'e9000004-0000-0000-0000-000000000000'
   and grund = 'falsche_angaben';
set role authenticated;
set request.jwt.claim.sub = 'e9000004-0000-0000-0000-000000000000';
do $$
begin
  insert into offers (job_id,provider_id,price,status)
  values ('e9000006-0000-0000-0000-000000000000','e9000004-0000-0000-0000-000000000000',90,'pending');
  raise notice 'PASS Z2: aufgehobener Strike (Beschwerde) hebt die Sperre auf';
exception when insufficient_privilege then
  raise exception 'FAIL: aufgehobener Strike sperrt weiterhin (AGB 7(5) wirkungslos)';
end $$;

-- TEST Z4: der Anbieter sieht SEINE Strikes, fremde nicht.
-- Er muss sie sehen — sonst kann er nicht verstehen, warum er eingeschraenkt
-- ist, und nicht nach 7(5) Beschwerde einlegen.
do $$
declare eigene int; fremde int;
begin
  select count(*) into eigene from provider_strikes
   where provider_id = 'e9000004-0000-0000-0000-000000000000';
  select count(*) into fremde from provider_strikes
   where provider_id <> 'e9000004-0000-0000-0000-000000000000';
  if eigene <> 3 then raise exception 'FAIL: Anbieter sieht seine eigenen Strikes nicht (%)', eigene; end if;
  if fremde <> 0 then raise exception 'FAIL: Anbieter sieht FREMDE Strikes (%)', fremde; end if;
  raise notice 'PASS Z4: Anbieter sieht seine eigenen Strikes, fremde nicht';
end $$;

-- TEST Z5: der Betroffene kann seine Strikes nicht selbst wegraeumen
do $$
declare betroffen int;
begin
  delete from provider_strikes where provider_id = 'e9000004-0000-0000-0000-000000000000';
  get diagnostics betroffen = row_count;
  if betroffen <> 0 then raise exception 'FAIL: Anbieter konnte eigene Strikes loeschen!'; end if;
  raise notice 'PASS Z5: Anbieter kann eigene Strikes nicht loeschen';
exception when insufficient_privilege then
  raise notice 'PASS Z5: Anbieter kann eigene Strikes nicht loeschen (Recht entzogen)';
end $$;

reset role;
