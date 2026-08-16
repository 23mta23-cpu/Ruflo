-- Anbieter-Verfuegbarkeit (Migration 0740)
--
-- Bis 16.08.2026 lagen die Frei/Gesperrt-Markierungen des Kalenders nur im
-- Bildschirmzustand — und wurden von NICHTS gelesen. Ein Anbieter konnte den
-- Freitag sperren und bekam weiter Terminvorschlaege fuer Freitag.
--
-- (BA) Vorgabe ist GESPERRT — keine Zeile heisst nicht verfuegbar
-- (BB) Der Anbieter meldet eine Stunde frei, ist_anbieter_frei sagt ja
-- (BC) Ortszeit, nicht UTC — 09:00 Berlin ist 09:00, nicht 07:00
-- (BD) Ein Fremder kann keine Verfuegbarkeit fuer einen anderen eintragen
-- (BE) Ein Fremder kann sie auch nicht loeschen
-- (BF) Der Kunde DARF sie lesen — sonst kann er keinen Termin vorschlagen
-- (BG) Zweimal dieselbe Stunde freigeben ist kein Fehler
reset role;

alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;

insert into auth.users (id,email,email_confirmed_at) values
  ('ec000001-0000-0000-0000-000000000000','vp@test.de',now()),   -- Anbieter
  ('ec000002-0000-0000-0000-000000000000','vk@test.de',now()),   -- Kunde
  ('ec000003-0000-0000-0000-000000000000','vf@test.de',now());   -- Fremder Anbieter
insert into profiles (id,role,email,email_verified_at) values
  ('ec000001-0000-0000-0000-000000000000','provider','vp@test.de',now()),
  ('ec000002-0000-0000-0000-000000000000','customer','vk@test.de',now()),
  ('ec000003-0000-0000-0000-000000000000','provider','vf@test.de',now());
insert into provider_profiles (id,business_name,is_nachbarschaft) values
  ('ec000001-0000-0000-0000-000000000000','VP',false),
  ('ec000003-0000-0000-0000-000000000000','VF',false);

alter table auth.users enable trigger user;
alter table public.profiles enable trigger user;

-- TEST BA: ohne Eintrag gilt die Stunde als gesperrt.
-- Verfuegbarkeit wird zugesagt, nicht unterstellt — vorher zeigte der Kalender
-- fest verdrahtete freie Stunden an Mo/Mi/Fr, die niemand je zugesagt hatte.
do $$
begin
  if ist_anbieter_frei('ec000001-0000-0000-0000-000000000000',
                       '2026-09-01 09:00+02'::timestamptz) then
    raise exception 'FAIL: ohne Eintrag als frei gemeldet (Vorgabe muss gesperrt sein)';
  end if;
  raise notice 'PASS BA: ohne Eintrag gilt die Stunde als gesperrt';
end $$;

set role authenticated;
set request.jwt.claim.sub = 'ec000001-0000-0000-0000-000000000000';

-- TEST BB: der Anbieter meldet eine Stunde frei
insert into provider_availability (provider_id, tag, stunde)
values ('ec000001-0000-0000-0000-000000000000', '2026-09-01', 9);
do $$
begin
  if not ist_anbieter_frei('ec000001-0000-0000-0000-000000000000',
                           '2026-09-01 09:00+02'::timestamptz) then
    raise exception 'FAIL: gemeldete Stunde wird nicht als frei erkannt';
  end if;
  raise notice 'PASS BB: gemeldete Stunde wird als frei erkannt';
end $$;

-- TEST BC: Ortszeit, nicht UTC.
-- 09:00 deutscher Sommerzeit ist 07:00 UTC. Rechnete die Funktion in UTC,
-- wuerde sie hier Stunde 7 suchen und nichts finden — der Anbieter haette
-- "9 Uhr" gemeint und die Plattform verstuende 7 Uhr. Dieselbe Klasse wie der
-- toISOString()-Fehler im Kalender.
do $$
begin
  -- Derselbe Zeitpunkt, in UTC ausgedrueckt: muss ebenfalls frei sein.
  if not ist_anbieter_frei('ec000001-0000-0000-0000-000000000000',
                           '2026-09-01 07:00+00'::timestamptz) then
    raise exception 'FAIL: Ortszeit falsch gerechnet (09:00 Berlin = 07:00 UTC)';
  end if;
  -- Und 07:00 ORTSZEIT darf NICHT frei sein.
  if ist_anbieter_frei('ec000001-0000-0000-0000-000000000000',
                       '2026-09-01 07:00+02'::timestamptz) then
    raise exception 'FAIL: 07:00 Ortszeit faelschlich als frei gemeldet';
  end if;
  raise notice 'PASS BC: gerechnet wird in Ortszeit, nicht in UTC';
end $$;

-- TEST BG: zweimal dieselbe Stunde freigeben ist derselbe Wunsch, kein Fehler
do $$
begin
  insert into provider_availability (provider_id, tag, stunde)
  values ('ec000001-0000-0000-0000-000000000000', '2026-09-01', 9)
  on conflict (provider_id, tag, stunde) do nothing;
  raise notice 'PASS BG: dieselbe Stunde doppelt freigeben ist kein Fehler';
exception when others then
  raise exception 'FAIL: doppelte Freigabe scheiterte (%)', sqlerrm;
end $$;

-- TEST BD: ein Fremder traegt nichts fuer einen anderen ein
set request.jwt.claim.sub = 'ec000003-0000-0000-0000-000000000000';
do $$
begin
  insert into provider_availability (provider_id, tag, stunde)
  values ('ec000001-0000-0000-0000-000000000000', '2026-09-02', 14);
  raise exception 'FAIL: Fremder konnte Verfuegbarkeit fuer einen anderen eintragen!';
exception when insufficient_privilege then
  raise notice 'PASS BD: nur der Anbieter selbst traegt seine Verfuegbarkeit ein';
end $$;

-- TEST BE: ein Fremder loescht sie auch nicht
do $$
declare betroffen int;
begin
  delete from provider_availability
   where provider_id = 'ec000001-0000-0000-0000-000000000000';
  get diagnostics betroffen = row_count;
  if betroffen <> 0 then
    raise exception 'FAIL: Fremder konnte fremde Verfuegbarkeit loeschen (% Zeilen)!', betroffen;
  end if;
  raise notice 'PASS BE: nur der Anbieter selbst loescht seine Verfuegbarkeit';
exception when insufficient_privilege then
  raise notice 'PASS BE: nur der Anbieter selbst loescht seine Verfuegbarkeit (Recht entzogen)';
end $$;

-- TEST BF: der KUNDE darf lesen.
-- Ohne das kann er nicht sehen, wann der Anbieter kann — und genau das war der
-- Grund, warum es die Tabelle gibt.
set request.jwt.claim.sub = 'ec000002-0000-0000-0000-000000000000';
do $$
declare n int;
begin
  select count(*) into n from provider_availability
   where provider_id = 'ec000001-0000-0000-0000-000000000000';
  if n < 1 then
    raise exception 'FAIL: Kunde sieht die Verfuegbarkeit des Anbieters nicht (%)', n;
  end if;
  raise notice 'PASS BF: der Kunde sieht die Verfuegbarkeit des Anbieters';
end $$;

reset role;
