-- 1030: haengende und gesperrte Auszahlungen sichtbar.
--
-- ANLASS: `payout_operations.status = 'manual_review'` kam im ganzen Projekt
-- nur in der Migration vor, die ihn setzt, und in den Deno-Tests. In mehreren
-- der Faelle, die ihn ausloesen, ist der Transfer bei Stripe BEREITS gelaufen.

alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;
alter table public.jobs disable trigger user;
alter table public.provider_profiles disable trigger user;
alter table public.contracts disable trigger user;

insert into auth.users (id,email,email_confirmed_at) values
  ('a0c00001-0000-0000-0000-000000000000','az-kunde@test.de',now()),
  ('a0c00002-0000-0000-0000-000000000000','az-betrieb@test.de',now());
insert into profiles (id,role,email,email_verified_at,plz) values
  ('a0c00001-0000-0000-0000-000000000000','customer','az-kunde@test.de',now(),'50667'),
  ('a0c00002-0000-0000-0000-000000000000','provider','az-betrieb@test.de',now(),'50667');
insert into provider_profiles (id,business_name,is_nachbarschaft) values
  ('a0c00002-0000-0000-0000-000000000000','AZ-Betrieb',false);
insert into jobs (id,customer_id,provider_id,title,description,category,address_plz,address_city,track,status) values
  ('a0c00003-0000-0000-0000-000000000000','a0c00001-0000-0000-0000-000000000000','a0c00002-0000-0000-0000-000000000000',
   'Steckdose','Eine Steckdose.','Elektro','50667','Köln','handwerker','active'),
  ('a0c00004-0000-0000-0000-000000000000','a0c00001-0000-0000-0000-000000000000','a0c00002-0000-0000-0000-000000000000',
   'Lampe','Eine Lampe.','Elektro','50667','Köln','handwerker','active');
insert into contracts (id,job_id,customer_id,provider_id,status,price_gross,customer_total,provider_payout) values
  ('a0c00005-0000-0000-0000-000000000000','a0c00003-0000-0000-0000-000000000000',
   'a0c00001-0000-0000-0000-000000000000','a0c00002-0000-0000-0000-000000000000','active',320,328,298.80),
  ('a0c00006-0000-0000-0000-000000000000','a0c00004-0000-0000-0000-000000000000',
   'a0c00001-0000-0000-0000-000000000000','a0c00002-0000-0000-0000-000000000000','active',110,112.75,101.20);

-- AUSGANGSWERT. Die Testdateien laufen NACHEINANDER in dieselbe Datenbank,
-- und escrow.sql hinterlaesst eine Operation auf `manual_review`. Die erste
-- Fassung von AZ1 nahm eine leere Tabelle an und wurde prompt rot -- an einer
-- Funktion, die richtig rechnete. Gemessen wird deshalb die DIFFERENZ.
--
-- Nebenbei der beste Beleg, dass die Auskunft wirkt: sie hat den Altfall
-- eines fremden Tests von sich aus gefunden.
create temp table az_start as select * from public.auszahlung_status();

-- TEST AZ1 (Gegenprobe zuerst): die eigenen Vorgaben aendern den Stand noch
-- nicht. Ohne diese Zusicherung waere „meldet immer Stau" bestanden.
do $$
declare r record; a record;
begin
  select * into a from az_start;
  select * into r from public.auszahlung_status();
  if r.gesperrt <> a.gesperrt or r.haengend <> a.haengend then
    raise exception 'FAIL AZ1: Stand hat sich ohne eigenen Vorgang geaendert (% / %)',
      r.gesperrt, r.haengend;
  end if;
  raise notice 'PASS AZ1: ohne eigenen Auszahlungsvorgang bleibt der Stand gleich';
end $$;

-- TEST AZ2: eine gesperrte Operation wird gezaehlt, mit Betrag und Alter.
do $$
declare r record; a record;
begin
  insert into payout_operations
    (id, contract_id, status, amount_cents, destination_account_id,
     idempotency_key, transfer_group, updated_at, last_error)
  values ('a0c00007-0000-0000-0000-000000000000','a0c00005-0000-0000-0000-000000000000',
          'manual_review', 29880, 'acct_test', 'key-az-1', 'grp-az-1',
          now() - interval '31 hours', 'abweichende Transfer-ID');

  select * into r from public.auszahlung_status();
  select * into a from az_start;
  if r.gesperrt <> a.gesperrt + 1 then
    raise exception 'FAIL AZ2: % gesperrte Operationen statt %', r.gesperrt, a.gesperrt + 1;
  end if;
  if r.gesperrt_cents <> a.gesperrt_cents + 29880 then
    raise exception 'FAIL AZ2: Betrag % statt % Cent', r.gesperrt_cents, a.gesperrt_cents + 29880;
  end if;
  -- Das Alter zaehlt ab `updated_at`, nicht ab `created_at`: gesperrt wurde
  -- sie in dem Moment, in dem der Fehler auffiel.
  if r.aeltester_fall_stunden < 30 or r.aeltester_fall_stunden > 32 then
    raise exception 'FAIL AZ2: Alter % Stunden, erwartet rund 31', r.aeltester_fall_stunden;
  end if;
  if not r.stau then
    raise exception 'FAIL AZ2: kein Stau trotz gesperrter Operation';
  end if;
  raise notice 'PASS AZ2: die gesperrte Auszahlung wird mit Betrag und Alter gemeldet';
end $$;

-- TEST AZ3: eine beanspruchte, nie abgeschlossene Operation zaehlt getrennt.
-- „Gesperrt" und „haengt" sind ZWEI Zustaende -- ein einziges Kennzeichen
-- wuerde den zweiten verdecken, sobald der erste behoben ist (dieselbe
-- Begruendung wie bei lauf_fehlt/abgabe_fehlt in 1010).
do $$
declare r record; a record;
begin
  insert into payout_operations
    (id, contract_id, status, amount_cents, destination_account_id,
     idempotency_key, transfer_group, updated_at)
  values ('a0c00008-0000-0000-0000-000000000000','a0c00006-0000-0000-0000-000000000000',
          'claimed', 10120, 'acct_test', 'key-az-2', 'grp-az-2',
          now() - interval '3 hours');

  select * into r from public.auszahlung_status();
  select * into a from az_start;
  if r.haengend <> a.haengend + 1 or r.haengend_cents <> a.haengend_cents + 10120 then
    raise exception 'FAIL AZ3: haengend % / % Cent statt % / %',
      r.haengend, r.haengend_cents, a.haengend + 1, a.haengend_cents + 10120;
  end if;
  if r.gesperrt <> a.gesperrt + 1 then
    raise exception 'FAIL AZ3: die gesperrte Operation ist verschwunden (%)', r.gesperrt;
  end if;
  raise notice 'PASS AZ3: gesperrt und haengend werden getrennt gezaehlt';
end $$;

-- TEST AZ4 (Gegenprobe): eine FRISCH beanspruchte Operation haengt nicht.
-- Ohne diese Zusicherung waere „jede nicht finalisierte Operation haengt"
-- bestanden -- und der Betreiber bekaeme bei jeder laufenden Auszahlung
-- einen Alarm.
do $$
declare r record; v_vorher integer;
begin
  select haengend into v_vorher from public.auszahlung_status();
  update public.payout_operations set updated_at = now()
    where id = 'a0c00008-0000-0000-0000-000000000000';
  select * into r from public.auszahlung_status();
  if r.haengend <> v_vorher - 1 then
    raise exception 'FAIL AZ4: frisch beansprucht zaehlt weiter als haengend (%)', r.haengend;
  end if;
  raise notice 'PASS AZ4: eine gerade erst beanspruchte Auszahlung haengt nicht';
end $$;

-- TEST AZ5 (Gegenprobe): eine finalisierte Operation zaehlt nirgends mehr.
--
-- `stau` wird hier NICHT geprueft: der Altfall aus escrow.sql steht weiter in
-- der Tabelle, und ein Stau daraus ist richtig. Was diese Probe zeigen soll,
-- ist die Rueckkehr auf den Ausgangswert -- nichts weiter.
do $$
declare r record; a record;
begin
  update public.payout_operations
    set status = 'finalized', stripe_transfer_id = 'tr_az_1',
        finalized_at = now(), last_error = null, updated_at = now() - interval '9 hours'
    where id = 'a0c00007-0000-0000-0000-000000000000';
  select * into r from public.auszahlung_status();
  select * into a from az_start;
  if r.gesperrt <> a.gesperrt then
    raise exception 'FAIL AZ5: finalisierte Operation zaehlt noch als gesperrt (% statt %)',
      r.gesperrt, a.gesperrt;
  end if;
  if r.haengend <> a.haengend then
    raise exception 'FAIL AZ5: finalisierte Operation zaehlt als haengend (% statt %)',
      r.haengend, a.haengend;
  end if;
  raise notice 'PASS AZ5: eine abgeschlossene Auszahlung zaehlt nirgends mehr';
end $$;

-- TEST AZ6: die Auskunft ist fuer Angemeldete gesperrt. Sie nennt Betraege
-- und Stoerungen des Geldwegs -- das ist Betriebswissen.
do $$
begin
  if has_function_privilege('authenticated', 'public.auszahlung_status()', 'EXECUTE')
     or has_function_privilege('anon', 'public.auszahlung_status()', 'EXECUTE') then
    raise exception 'FAIL AZ6: auszahlung_status ist fuer Nutzer offen';
  end if;
  raise notice 'PASS AZ6: auszahlung_status ist fuer Nutzer gesperrt';
end $$;
