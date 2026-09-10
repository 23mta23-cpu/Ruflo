-- abnahme_lauf_status (0850): sieht der Betrieb, wenn der naechtliche Lauf
-- nichts bewirkt?
--
-- Der Prueferwert liegt im SYMPTOM: pg_cron gibt es hier nicht, und selbst wo
-- es ihn gibt, laeuft ein vom Gateway abgewiesener Auftrag "erfolgreich".
-- Deshalb wird geprueft, ob faellige Vertraege zu lange liegen bleiben.
--
-- ISOLATION IN EINER TRANSAKTION, und zwar nicht aus Ordnungsliebe:
-- `stau` ist eine Aussage ueber die GANZE Datenbank. Fruehere Testdateien im
-- selben Lauf hinterlassen faellige Vertraege -- beim ersten Versuch waren es
-- zwei, und AL2 ("ohne faellige Vertraege kein Stau") schlug fehl, obwohl die
-- Funktion richtig rechnete. Der Test nahm eine leere Datenbank an, die es
-- nicht gab. Innerhalb der Transaktion werden die Alt-Vertraege beiseite
-- geraeumt; das `rollback` am Ende gibt sie unveraendert zurueck.

begin;

-- Alt-Vertraege aus frueheren Testdateien beiseite (wird zurueckgerollt).
--
-- NICHT ueber escrow_released_at: darauf liegt ein Schutz-Trigger
-- ("managed by Edge Functions only"), und der soll auch im Test halten.
-- Stattdessen die Faelligkeit in die Zukunft schieben -- dafuer muss der
-- Waechter kurz aus, wie in den anderen Testdateien auch.
alter table public.contracts disable trigger user;
update public.contracts set abnahme_faellig_am = now() + interval '100 days'
 where status = 'active' and escrow_released_at is null
   and abnahme_faellig_am is not null and abnahme_faellig_am <= now();
alter table public.contracts enable trigger user;

alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;
alter table public.jobs disable trigger user;
alter table public.offers disable trigger user;

insert into auth.users (id, email, email_confirmed_at) values
  ('cc000000-0000-0000-0000-0000000000a1','stau-kunde@test.de', now()),
  ('cc000000-0000-0000-0000-0000000000a2','stau-anbieter@test.de', now());
insert into profiles (id, role, email, email_verified_at) values
  ('cc000000-0000-0000-0000-0000000000a1','customer','stau-kunde@test.de', now()),
  ('cc000000-0000-0000-0000-0000000000a2','provider','stau-anbieter@test.de', now());
insert into provider_profiles (id, business_name) values
  ('cc000000-0000-0000-0000-0000000000a2','Staubetrieb');
insert into jobs (id, customer_id, provider_id, title, description, category, address_plz, address_city, track, status) values
  ('cc000000-0000-0000-0000-0000000000b1','cc000000-0000-0000-0000-0000000000a1',
   'cc000000-0000-0000-0000-0000000000a2','Stau','Beschreibung lang genug fuer den Test hier drin.',
   'Elektro','50667','Koeln','handwerker','active');

alter table auth.users enable trigger user;
alter table public.profiles enable trigger user;
alter table public.jobs enable trigger user;
alter table public.offers enable trigger user;

-- AL1: Ohne pg_cron meldet die Funktion "kein Zeitplan", statt zu scheitern.
-- Auf einer frischen Instanz ist genau das der Zustand.
do $$
declare s record;
begin
  select * into s from public.abnahme_lauf_status();
  if s.zeitplan_vorhanden then
    raise exception 'FAIL AL1: Zeitplan gemeldet, obwohl pg_cron hier fehlt';
  end if;
  raise notice 'PASS AL1: ohne pg_cron meldet die Funktion kein Zeitplan, ohne Fehler';
end $$;

-- AL2: Kein faelliger Vertrag heisst kein Stau.
do $$
declare s record;
begin
  select * into s from public.abnahme_lauf_status();
  if s.faellige_vertraege <> 0 or s.stau then
    raise exception 'FAIL AL2: Stau ohne faellige Vertraege (n=%, stau=%)',
      s.faellige_vertraege, s.stau;
  end if;
  raise notice 'PASS AL2: ohne faellige Vertraege kein Stau';
end $$;

-- AL3: Ein Vertrag, der seit gestern faellig ist, ist NOCH kein Stau. Ein
-- einzelner ausgefallener Lauf ist ausdruecklich unkritisch.
insert into contracts (
  id, job_id, customer_id, provider_id, track, status,
  price_gross, werkr_schutz_fee, customer_service_fee,
  provider_commission, customer_total, provider_payout,
  escrow_captured_at, fertig_gemeldet_am, abnahme_faellig_am,
  abnahme_hinweis, abnahme_hinweis_fassung
) values (
  'cc000000-0000-0000-0000-0000000000d1','cc000000-0000-0000-0000-0000000000b1',
  'cc000000-0000-0000-0000-0000000000a1','cc000000-0000-0000-0000-0000000000a2',
  'handwerker','active', 200, 0, 5, 16, 205, 184,
  now() - interval '20 days', now() - interval '15 days', now() - interval '1 day',
  'Hinweistext','640-2-v2'
);
do $$
declare s record;
begin
  select * into s from public.abnahme_lauf_status();
  if s.faellige_vertraege <> 1 then
    raise exception 'FAIL AL3: faellige Vertraege %, erwartet 1', s.faellige_vertraege;
  end if;
  if s.stau then
    raise exception 'FAIL AL3: ein Tag Rueckstand gilt schon als Stau';
  end if;
  raise notice 'PASS AL3: ein Tag Rueckstand ist noch kein Stau';
end $$;

-- AL4: Zwei Tage Rueckstand IST ein Stau. Das ist der Fall, den niemand
-- gesehen haette: der Auftrag laeuft, das Gateway weist ihn ab, das Geld
-- bleibt liegen.
update contracts
   set abnahme_faellig_am = now() - interval '3 days'
 where id = 'cc000000-0000-0000-0000-0000000000d1';
do $$
declare s record;
begin
  select * into s from public.abnahme_lauf_status();
  if not s.stau then
    raise exception 'FAIL AL4: drei Tage Rueckstand melden keinen Stau (tage=%)',
      s.aeltester_faelliger_tage;
  end if;
  if s.aeltester_faelliger_tage < 3 then
    raise exception 'FAIL AL4: Alter falsch berechnet (%)', s.aeltester_faelliger_tage;
  end if;
  raise notice 'PASS AL4: drei Tage Rueckstand melden Stau';
end $$;

-- AL5: Ein freigegebener Vertrag zaehlt nicht mehr mit. Sonst stuende der
-- Stau fuer immer, und die Meldung waere nach der ersten Auszahlung wertlos.
-- Der Waechter auf escrow_released_at bleibt bestehen; er gehoert dorthin.
-- Fuer diesen Test wird er kurz abgeschaltet, weil hier die Wirkung der
-- Freigabe auf die Stau-Meldung geprueft wird, nicht der Waechter selbst
-- (den prueft contracts-insert-lockdown.sql).
alter table public.contracts disable trigger user;
update contracts
   set escrow_released_at = now()
 where id = 'cc000000-0000-0000-0000-0000000000d1';
alter table public.contracts enable trigger user;
do $$
declare s record;
begin
  select * into s from public.abnahme_lauf_status();
  if s.stau or s.faellige_vertraege <> 0 then
    raise exception 'FAIL AL5: freigegebener Vertrag zaehlt weiter (n=%, stau=%)',
      s.faellige_vertraege, s.stau;
  end if;
  raise notice 'PASS AL5: nach der Freigabe verschwindet der Stau';
end $$;

-- AL6: Nutzer duerfen die Betriebsauskunft nicht abfragen.
set request.jwt.claim.sub = 'cc000000-0000-0000-0000-0000000000a1';
set role authenticated;
do $$
begin
  begin
    perform public.abnahme_lauf_status();
    raise exception 'FAIL AL6: Angemeldeter durfte abnahme_lauf_status aufrufen';
  exception when insufficient_privilege then
    null;
  end;
  raise notice 'PASS AL6: abnahme_lauf_status ist fuer Nutzer gesperrt';
end $$;
reset role;

-- Alles zurueck. Die Alt-Vertraege sind danach wieder so, wie sie waren.
rollback;
