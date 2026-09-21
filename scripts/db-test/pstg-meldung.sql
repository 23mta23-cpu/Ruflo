-- 1010: Der Stand der DAC7-Jahresmeldung ist ablesbar, und zwar GETRENNT
-- nach „nichts vorbereitet" und „vorbereitet, aber nicht abgegeben".
--
-- Ein einziges Kennzeichen fuer beides waere gruen, sobald pstg-annual-report
-- einmal gelaufen ist -- und die Meldung an das BZSt bliebe trotzdem liegen.
-- PM4 ist deshalb die eigentliche Zusicherung dieser Datei.

alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;
alter table public.jobs disable trigger user;
alter table public.provider_profiles disable trigger user;
alter table public.contracts disable trigger user;

insert into auth.users (id,email,email_confirmed_at) values
  ('c1000000-0000-0000-0000-000000000000','pm-kunde@test.de',now()),
  ('c2000000-0000-0000-0000-000000000000','pm-gross@test.de',now()),
  ('c3000000-0000-0000-0000-000000000000','pm-klein@test.de',now());
insert into profiles (id,role,email,email_verified_at,plz) values
  ('c1000000-0000-0000-0000-000000000000','customer','pm-kunde@test.de',now(),'50667'),
  ('c2000000-0000-0000-0000-000000000000','provider','pm-gross@test.de',now(),'50667'),
  ('c3000000-0000-0000-0000-000000000000','provider','pm-klein@test.de',now(),'50667');
insert into provider_profiles (id,business_name,is_nachbarschaft) values
  ('c2000000-0000-0000-0000-000000000000','PM-Gross',false),
  ('c3000000-0000-0000-0000-000000000000','PM-Klein',false);

-- TEST PM1 (Gegenprobe): solange im VORJAHR nichts abgeschlossen wurde,
-- schlaegt nichts an. Andere Testdateien legen sehr wohl abgeschlossene
-- Vertraege an -- die liegen aber im laufenden Jahr, und genau das ist der
-- Punkt: ein Melde-Alarm im Kaltstart waere ein Fehlalarm, und ein Pruefer
-- mit Fehlalarmen wird abgeschaltet und nie wieder an.
do $$
declare r record;
begin
  select * into r from public.pstg_meldung_status();
  if r.meldepflichtige <> 0 or r.lauf_fehlt or r.abgabe_fehlt then
    raise exception 'FAIL PM1: Alarm, obwohl im Vorjahr nichts abgeschlossen wurde (% / % / %)',
      r.meldepflichtige, r.lauf_fehlt, r.abgabe_fehlt;
  end if;
  raise notice 'PASS PM1: ohne Abschluss im Vorjahr kein Melde-Alarm';
end $$;

-- TEST PM2: das Meldejahr ist das VORJAHR, die Frist der 31. Januar danach.
do $$
declare r record; v_jahr integer;
begin
  v_jahr := extract(year from (now() at time zone 'Europe/Berlin'))::integer - 1;
  select * into r from public.pstg_meldung_status();
  if r.melde_jahr <> v_jahr then
    raise exception 'FAIL PM2: Meldejahr % statt %', r.melde_jahr, v_jahr;
  end if;
  if r.frist <> make_date(v_jahr + 1, 1, 31) then
    raise exception 'FAIL PM2: Frist % statt 31.01.%', r.frist, v_jahr + 1;
  end if;
  raise notice 'PASS PM2: Meldejahr ist das Vorjahr, Frist der 31. Januar danach (§ 13 PStTG)';
end $$;

-- Ein Anbieter ueber der Umsatzschwelle im VORJAHR, einer darunter, und ein
-- dritter Vertrag im LAUFENDEN Jahr (der gehoert nicht in diese Meldung).
insert into jobs (id,customer_id,provider_id,title,description,category,address_plz,address_city,track,status) values
  ('c4000000-0000-0000-0000-000000000000','c1000000-0000-0000-0000-000000000000','c2000000-0000-0000-0000-000000000000',
   'PM-Gross','Beschreibung lang genug fuer den Check.','Elektro','50667','Koeln','handwerker','active'),
  ('c5000000-0000-0000-0000-000000000000','c1000000-0000-0000-0000-000000000000','c3000000-0000-0000-0000-000000000000',
   'PM-Klein','Beschreibung lang genug fuer den Check.','Elektro','50667','Koeln','handwerker','active'),
  ('c6000000-0000-0000-0000-000000000000','c1000000-0000-0000-0000-000000000000','c3000000-0000-0000-0000-000000000000',
   'PM-Heuer','Beschreibung lang genug fuer den Check.','Elektro','50667','Koeln','handwerker','active');

insert into contracts (id,job_id,customer_id,provider_id,price_gross,customer_total,provider_payout,track,status,completed_at,escrow_released_at) values
  -- ueber 2000 EUR im Vorjahr
  ('c7000000-0000-0000-0000-000000000000','c4000000-0000-0000-0000-000000000000',
   'c1000000-0000-0000-0000-000000000000','c2000000-0000-0000-0000-000000000000',
   3000,3075,2760,'handwerker','completed',
   make_timestamptz(extract(year from now())::int - 1, 6, 1, 12, 0, 0),
   make_timestamptz(extract(year from now())::int - 1, 6, 1, 12, 0, 0)),
  -- weit darunter, im Vorjahr
  ('c8000000-0000-0000-0000-000000000000','c5000000-0000-0000-0000-000000000000',
   'c1000000-0000-0000-0000-000000000000','c3000000-0000-0000-0000-000000000000',
   100,102.50,92,'handwerker','completed',
   make_timestamptz(extract(year from now())::int - 1, 6, 1, 12, 0, 0),
   make_timestamptz(extract(year from now())::int - 1, 6, 1, 12, 0, 0)),
  -- ueber der Schwelle, aber im LAUFENDEN Jahr
  ('c9000000-0000-0000-0000-000000000000','c6000000-0000-0000-0000-000000000000',
   'c1000000-0000-0000-0000-000000000000','c3000000-0000-0000-0000-000000000000',
   9000,9225,8280,'handwerker','completed', now(), now());

alter table auth.users enable trigger user;
alter table public.profiles enable trigger user;
alter table public.jobs enable trigger user;
alter table public.provider_profiles enable trigger user;
alter table public.contracts enable trigger user;

-- TEST PM3: ein meldepflichtiger Anbieter ohne Zeile in pstg_reports heisst
-- „der Lauf fehlt". Zugleich Gegenprobe: der Anbieter unter der Schwelle und
-- der Vertrag aus dem laufenden Jahr zaehlen NICHT mit.
do $$
declare r record;
begin
  select * into r from public.pstg_meldung_status();
  if r.meldepflichtige <> 1 then
    raise exception 'FAIL PM3: % meldepflichtig statt 1 (zaehlt der Kleine oder das laufende Jahr mit?)',
      r.meldepflichtige;
  end if;
  if not r.lauf_fehlt then raise exception 'FAIL PM3: lauf_fehlt ist falsch, obwohl nichts vorbereitet ist'; end if;
  if r.abgabe_fehlt then raise exception 'FAIL PM3: abgabe_fehlt schlaegt an, obwohl es gar keine Zeile gibt'; end if;
  raise notice 'PASS PM3: ein meldepflichtiger Anbieter ohne Lauf -> lauf_fehlt, und nur er zaehlt';
end $$;

-- TEST PM4: die Zeile ist da, aber nicht abgegeben. Das ist der Fall, den ein
-- einziges Kennzeichen verdecken wuerde -- vorbereitet ist nicht abgegeben.
insert into pstg_reports (report_year,provider_id,tx_count,revenue,payout) values
  (extract(year from now())::int - 1,'c2000000-0000-0000-0000-000000000000',1,2760,2760);

do $$
declare r record;
begin
  select * into r from public.pstg_meldung_status();
  if r.lauf_fehlt then raise exception 'FAIL PM4: lauf_fehlt bleibt gesetzt, obwohl die Zeile existiert'; end if;
  if not r.abgabe_fehlt then
    raise exception 'FAIL PM4: abgabe_fehlt ist falsch, obwohl submitted_at leer ist -- die Meldung ans BZSt bliebe unbemerkt liegen';
  end if;
  if r.vorbereitet <> 1 or r.abgegeben <> 0 then
    raise exception 'FAIL PM4: vorbereitet=% abgegeben=%', r.vorbereitet, r.abgegeben;
  end if;
  raise notice 'PASS PM4: vorbereitet, aber nicht abgegeben -> abgabe_fehlt (und lauf_fehlt ist aus)';
end $$;

-- TEST PM5 (Gegenprobe): nach der Abgabe ist Ruhe. Ohne diese Zusicherung
-- waere „immer Alarm" ein bestandener Test.
update pstg_reports set submitted_at = now()
 where report_year = extract(year from now())::int - 1;

do $$
declare r record;
begin
  select * into r from public.pstg_meldung_status();
  if r.lauf_fehlt or r.abgabe_fehlt then
    raise exception 'FAIL PM5: Alarm bleibt nach der Abgabe stehen (% / %)', r.lauf_fehlt, r.abgabe_fehlt;
  end if;
  if r.abgegeben <> 1 then raise exception 'FAIL PM5: abgegeben=%', r.abgegeben; end if;
  raise notice 'PASS PM5: nach der Abgabe schlaegt nichts mehr an';
end $$;

-- TEST PM6: ein Angemeldeter darf den Meldestand nicht abfragen. Er nennt
-- die Zahl der meldepflichtigen Anbieter -- eine Betriebskennzahl.
set role authenticated;
set request.jwt.claim.sub = 'c2000000-0000-0000-0000-000000000000';
do $$
begin
  perform public.pstg_meldung_status();
  raise exception 'FAIL PM6: ein Angemeldeter konnte den Meldestand abfragen';
exception when insufficient_privilege then
  raise notice 'PASS PM6: der Meldestand ist fuer Angemeldete gesperrt';
end $$;
reset role;
