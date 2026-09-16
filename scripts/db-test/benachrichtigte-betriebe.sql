-- 0920: jobs.benachrichtigte_betriebe / benachrichtigt_am
--
-- Die Zahl soll dem Kunden sagen, wie viele Betriebe ueber seinen Auftrag
-- benachrichtigt wurden. Sie ist nur dann etwas wert, wenn sie NICHT von
-- jemandem gesetzt werden kann, der ein Interesse an ihrem Wert hat. Geprueft
-- wird deshalb genau das Spaltenrecht, nicht die Anzeige.
--
-- Achtung bei der Gegenrichtung: 0920 entzieht `update on jobs` von
-- `authenticated` und gibt es spaltenweise zurueck. Ein Fehler dabei wuerde
-- JEDE Aenderung eines Kunden an seinem Auftrag sperren. BB3 prueft das.

alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;
alter table public.jobs disable trigger user;

insert into auth.users (id,email,email_confirmed_at) values
  ('bb111111-0000-0000-0000-0000000000b1','bb-kunde@test.de',now());
insert into profiles (id,role,email,email_verified_at) values
  ('bb111111-0000-0000-0000-0000000000b1','customer','bb-kunde@test.de',now());
insert into jobs (id,customer_id,title,description,category,address_plz,address_city,track,status) values
  ('bb333333-0000-0000-0000-0000000000b3','bb111111-0000-0000-0000-0000000000b1',
   'BB-Job','Lang genug beschrieben hier drin.','Elektro','50667','Koeln','handwerker','open');

-- BB0: frisch angelegt ist die Zahl NULL, nicht 0. Der Unterschied traegt die
--      ganze Anzeige: NULL heisst "noch nicht gelaufen", 0 heisst "gelaufen
--      und niemand passte".
do $$
declare v_wert integer; v_zeit timestamptz;
begin
  select benachrichtigte_betriebe, benachrichtigt_am into v_wert, v_zeit
    from jobs where id = 'bb333333-0000-0000-0000-0000000000b3';
  if v_wert is not null or v_zeit is not null then
    raise exception 'FAIL BB0: frischer Auftrag hat schon einen Wert (% / %)', v_wert, v_zeit;
  end if;
  raise notice 'PASS BB0: frisch angelegt ist die Zahl NULL, nicht 0';
end $$;

-- BB1: ein Angemeldeter darf die Zahl NICHT setzen. Sonst koennte ein Kunde
--      sich eine Null wegschreiben oder ein Anbieter eine Zahl erfinden.
set role authenticated;
do $$
begin
  update jobs set benachrichtigte_betriebe = 99
    where id = 'bb333333-0000-0000-0000-0000000000b3';
  raise exception 'FAIL BB1: ein Angemeldeter konnte die Zahl setzen';
exception when insufficient_privilege then
  raise notice 'PASS BB1: ein Angemeldeter darf die Zahl nicht setzen';
end $$;

-- BB2: dasselbe fuer den Zeitpunkt.
do $$
begin
  update jobs set benachrichtigt_am = now()
    where id = 'bb333333-0000-0000-0000-0000000000b3';
  raise exception 'FAIL BB2: ein Angemeldeter konnte den Zeitpunkt setzen';
exception when insufficient_privilege then
  raise notice 'PASS BB2: ein Angemeldeter darf den Zeitpunkt nicht setzen';
end $$;

-- BB3 GEGENPROBE, und die ist Pflicht: der Rechteentzug darf nicht ALLES
--     sperren. Ein Kunde muss seinen Auftrag weiter bearbeiten koennen, sonst
--     ist "alles sperren" der einfachste gruene Haken (CLAUDE.md, 07.09.).
do $$
begin
  update jobs set title = 'BB-Job, neu betitelt'
    where id = 'bb333333-0000-0000-0000-0000000000b3';
  raise notice 'PASS BB3: gewoehnliche Spalten bleiben fuer Angemeldete aenderbar';
exception when insufficient_privilege then
  raise exception 'FAIL BB3: der Rechteentzug sperrt auch gewoehnliche Aenderungen';
end $$;
reset role;

-- BB4: der service_role (die Edge Function) darf beides setzen.
set role service_role;
do $$
begin
  update jobs set benachrichtigte_betriebe = 0, benachrichtigt_am = now()
    where id = 'bb333333-0000-0000-0000-0000000000b3';
  raise notice 'PASS BB4: der service_role darf die Zahl setzen';
exception when insufficient_privilege then
  raise exception 'FAIL BB4: der service_role darf die Zahl nicht setzen';
end $$;
reset role;

-- BB5: und danach steht wirklich 0 da, nicht NULL. Sonst kann die Anzeige
--      "gelaufen, niemand passte" nicht von "noch nicht gelaufen" trennen.
do $$
declare v_wert integer;
begin
  select benachrichtigte_betriebe into v_wert
    from jobs where id = 'bb333333-0000-0000-0000-0000000000b3';
  if v_wert is distinct from 0 then
    raise exception 'FAIL BB5: nach dem Schreiben steht % statt 0', v_wert;
  end if;
  raise notice 'PASS BB5: eine geschriebene 0 bleibt 0 und wird nicht zu NULL';
end $$;
