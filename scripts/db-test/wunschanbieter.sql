-- 1020: Wunschanbieter am Auftrag.
--
-- ANLASS: `app/anbieter.tsx` uebergab dem Auftrags-Trichter seit jeher eine
-- Anbieterkennung, die dieser nirgends gelesen hat. Der Knopf hiess
-- „Unverbindliche Anfrage stellen" und schrieb eine Ausschreibung an alle.
--
-- Hier geprueft wird, was die DATENBANK dazu zusichert. Ob der Bildschirm den
-- Wunsch anzeigt, ist eine Browser-Frage; ob die Mitteilung ihn erreicht, eine
-- Jest-Frage (__tests__/anbieterAuswahl.test.ts).

alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;
alter table public.jobs disable trigger user;
alter table public.provider_profiles disable trigger user;

insert into auth.users (id,email,email_confirmed_at) values
  ('d1000000-0000-0000-0000-000000000000','wa-kunde@test.de',now()),
  ('d2000000-0000-0000-0000-000000000000','wa-betrieb@test.de',now()),
  ('d3000000-0000-0000-0000-000000000000','wa-nurnutzer@test.de',now());
insert into profiles (id,role,email,email_verified_at,plz) values
  ('d1000000-0000-0000-0000-000000000000','customer','wa-kunde@test.de',now(),'50667'),
  ('d2000000-0000-0000-0000-000000000000','provider','wa-betrieb@test.de',now(),'50667'),
  ('d3000000-0000-0000-0000-000000000000','customer','wa-nurnutzer@test.de',now(),'50667');
insert into provider_profiles (id,business_name,is_nachbarschaft) values
  ('d2000000-0000-0000-0000-000000000000','WA-Betrieb',false);

-- TEST WA1: der Wunsch laesst sich beim Anlegen setzen und bleibt stehen.
do $$
declare v_wunsch uuid;
begin
  insert into jobs (id,customer_id,title,description,category,address_plz,address_city,track,status,requested_provider_id)
  values ('d4000000-0000-0000-0000-000000000000','d1000000-0000-0000-0000-000000000000',
          'Steckdose setzen','Eine Steckdose im Flur.','Elektro','50667','Köln','handwerker','open',
          'd2000000-0000-0000-0000-000000000000');
  select requested_provider_id into v_wunsch from jobs
   where id = 'd4000000-0000-0000-0000-000000000000';
  if v_wunsch is distinct from 'd2000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'FAIL WA1: Wunsch steht als % statt als der gewaehlte Betrieb', v_wunsch;
  end if;
  raise notice 'PASS WA1: der Wunschanbieter wird beim Anlegen gespeichert';
end $$;

-- TEST WA2 (Gegenprobe): ohne Wunsch bleibt die Spalte leer. Ohne diese
-- Zusicherung waere „schreibt immer irgendetwas hinein" ein bestandener Test.
do $$
declare v_wunsch uuid;
begin
  insert into jobs (id,customer_id,title,description,category,address_plz,address_city,track,status)
  values ('d5000000-0000-0000-0000-000000000000','d1000000-0000-0000-0000-000000000000',
          'Wand streichen','Ein Zimmer.','Maler','50667','Köln','handwerker','open');
  select requested_provider_id into v_wunsch from jobs
   where id = 'd5000000-0000-0000-0000-000000000000';
  if v_wunsch is not null then
    raise exception 'FAIL WA2: ohne Wunsch steht % in der Spalte', v_wunsch;
  end if;
  raise notice 'PASS WA2: ohne Wunsch bleibt die Spalte leer';
end $$;

-- TEST WA3: es muss ein ANBIETER sein. Der Fremdschluessel zeigt bewusst auf
-- provider_profiles und nicht auf profiles -- sonst liesse sich ein
-- beliebiger Nutzer als Wunschanbieter eintragen.
do $$
begin
  begin
    insert into jobs (id,customer_id,title,description,category,address_plz,address_city,track,status,requested_provider_id)
    values ('d6000000-0000-0000-0000-000000000000','d1000000-0000-0000-0000-000000000000',
            'Regal aufbauen','Ein Regal.','Möbelmontage','50667','Köln','handwerker','open',
            'd3000000-0000-0000-0000-000000000000');
    raise exception 'FAIL WA3: ein Nutzer ohne Anbieterprofil wurde als Wunsch angenommen';
  exception
    when foreign_key_violation then
      raise notice 'PASS WA3: nur ein Anbieter kann Wunschanbieter sein';
  end;
end $$;

-- TEST WA4: Angemeldete duerfen den Wunsch NICHT nachtraeglich aendern.
-- Sonst stuende auf der Karte eines Betriebs „Direkt an Sie gerichtet",
-- obwohl der Kunde ihn nie ausgesucht hat.
do $$
begin
  if has_column_privilege('authenticated', 'public.jobs', 'requested_provider_id', 'UPDATE') then
    raise exception 'FAIL WA4: der Wunschanbieter ist nachtraeglich aenderbar';
  end if;
  raise notice 'PASS WA4: der Wunschanbieter ist nach dem Anlegen gesperrt';
end $$;

-- TEST WA5 (Gegenprobe): das Anlegen bleibt erlaubt. Ohne diese Zusicherung
-- waere „alle Rechte an der Spalte entziehen" der bequemste gruene Haken --
-- und der Wunsch liesse sich gar nicht mehr aeussern.
do $$
begin
  if not has_column_privilege('authenticated', 'public.jobs', 'requested_provider_id', 'INSERT') then
    raise exception 'FAIL WA5: der Wunsch laesst sich gar nicht mehr setzen';
  end if;
  raise notice 'PASS WA5: der Wunsch laesst sich beim Anlegen weiterhin setzen';
end $$;

-- TEST WA6: ein geloeschtes Anbieterprofil nimmt den Auftrag nicht mit.
do $$
declare v_da boolean; v_wunsch uuid;
begin
  delete from provider_profiles where id = 'd2000000-0000-0000-0000-000000000000';
  select true, requested_provider_id into v_da, v_wunsch from jobs
   where id = 'd4000000-0000-0000-0000-000000000000';
  if not coalesce(v_da, false) then
    raise exception 'FAIL WA6: der Auftrag wurde mitgeloescht';
  end if;
  if v_wunsch is not null then
    raise exception 'FAIL WA6: der Wunsch zeigt auf ein geloeschtes Profil (%)', v_wunsch;
  end if;
  raise notice 'PASS WA6: ein geloeschtes Anbieterprofil setzt den Wunsch auf leer';
end $$;
