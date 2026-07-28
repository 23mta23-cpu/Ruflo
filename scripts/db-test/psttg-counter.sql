-- PStTG/DAC7-Zähler (Block A3, Migration 0610)
--
-- Meldeschwelle: 30 Transaktionen ODER 2000 EUR im Kalenderjahr
-- (§ 4 Abs. 5 PStTG, gespiegelt in lib/pstTgThresholds.ts).
--
-- (Z1) knapp unter der Transaktionsschwelle -> nicht gesperrt
-- (Z2) exakt auf der Transaktionsschwelle (30.) -> gesperrt
-- (Z3) Umsatzschwelle greift unabhaengig von der Anzahl
-- (Z4) exakt auf 2000.00 EUR -> gesperrt (>= , nicht >)
-- (Z5) Jahreswechsel setzt Zaehler UND Sperre zurueck
-- (Z6) Anbieter kann seine eigenen Zaehler NICHT nullen (Umgehung)
-- (Z7) 50 aufeinanderfolgende Fortschreibungen kommen alle an
reset role;

alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;

insert into auth.users (id,email,email_confirmed_at) values
  ('7a111111-0000-0000-0000-000000000000','pstg-a@test.de',now()),
  ('7a222222-0000-0000-0000-000000000000','pstg-b@test.de',now()),
  ('7a333333-0000-0000-0000-000000000000','pstg-c@test.de',now()),
  ('7a444444-0000-0000-0000-000000000000','pstg-d@test.de',now()),
  ('7a555555-0000-0000-0000-000000000000','pstg-e@test.de',now()),
  ('7a666666-0000-0000-0000-000000000000','pstg-f@test.de',now());
insert into profiles (id,role,email,email_verified_at) values
  ('7a111111-0000-0000-0000-000000000000','provider','pstg-a@test.de',now()),
  ('7a222222-0000-0000-0000-000000000000','provider','pstg-b@test.de',now()),
  ('7a333333-0000-0000-0000-000000000000','provider','pstg-c@test.de',now()),
  ('7a444444-0000-0000-0000-000000000000','provider','pstg-d@test.de',now()),
  ('7a555555-0000-0000-0000-000000000000','provider','pstg-e@test.de',now()),
  ('7a666666-0000-0000-0000-000000000000','provider','pstg-f@test.de',now());

alter table auth.users enable trigger user;
alter table public.profiles enable trigger user;

-- ── TEST Z1: 29 Transaktionen, kleine Betraege -> noch nicht meldepflichtig ──
do $$
declare r record; i int;
begin
  for i in 1..29 loop
    select * into r from pstg_record_transaction('7a111111-0000-0000-0000-000000000000', 10.00);
  end loop;
  if r.tx_count <> 29 then raise exception 'FAIL Z1: tx_count=% statt 29', r.tx_count; end if;
  if r.revenue <> 290.00 then raise exception 'FAIL Z1: revenue=% statt 290.00', r.revenue; end if;
  if r.locked then raise exception 'FAIL Z1: bei 29 Transaktionen / 290 EUR bereits gesperrt'; end if;
  raise notice 'PASS Z1: 29 Transaktionen / 290 EUR — knapp unter beiden Schwellen, nicht gesperrt';
end $$;

-- ── TEST Z2: die 30. Transaktion sperrt (>= 30, nicht > 30) ─────────────────
do $$
declare r record;
begin
  select * into r from pstg_record_transaction('7a111111-0000-0000-0000-000000000000', 10.00);
  if r.tx_count <> 30 then raise exception 'FAIL Z2: tx_count=% statt 30', r.tx_count; end if;
  if not r.locked then raise exception 'FAIL Z2: 30. Transaktion loest die Meldepflicht nicht aus (Schwelle ist >=, nicht >)'; end if;
  raise notice 'PASS Z2: die 30. Transaktion loest die Meldepflicht aus';
end $$;

-- ── TEST Z3: Umsatzschwelle greift unabhaengig von der Anzahl ───────────────
do $$
declare r record;
begin
  select * into r from pstg_record_transaction('7a222222-0000-0000-0000-000000000000', 2500.00);
  if r.tx_count <> 1 then raise exception 'FAIL Z3: tx_count=%', r.tx_count; end if;
  if not r.locked then raise exception 'FAIL Z3: 2500 EUR in EINER Transaktion loest die Meldepflicht nicht aus'; end if;
  raise notice 'PASS Z3: Umsatzschwelle greift auch bei einer einzigen Transaktion';
end $$;

-- ── TEST Z4: exakt 2000.00 EUR ist bereits meldepflichtig ───────────────────
do $$
declare r record;
begin
  select * into r from pstg_record_transaction('7a333333-0000-0000-0000-000000000000', 1999.99);
  if r.locked then raise exception 'FAIL Z4: 1999.99 EUR gilt bereits als meldepflichtig'; end if;
  select * into r from pstg_record_transaction('7a333333-0000-0000-0000-000000000000', 0.01);
  if r.revenue <> 2000.00 then raise exception 'FAIL Z4: revenue=% statt 2000.00', r.revenue; end if;
  if not r.locked then raise exception 'FAIL Z4: exakt 2000.00 EUR loest die Meldepflicht nicht aus (Schwelle ist >=)'; end if;
  raise notice 'PASS Z4: 1999.99 EUR nicht meldepflichtig, exakt 2000.00 EUR schon';
end $$;

-- ── TEST Z5: Jahreswechsel setzt Zaehler UND Sperre zurueck ─────────────────
-- Der Stand des Vorjahres darf nicht fortwirken: ein Anbieter, der 2025
-- meldepflichtig war, startet 2026 wieder bei null.
do $$
declare r record;
begin
  perform pstg_record_transaction('7a444444-0000-0000-0000-000000000000', 2500.00);
  -- Zeile kuenstlich ins Vorjahr versetzen. Als Eigentuemer erlaubt — der
  -- Guard blockt seit 0610 nur noch Client-Rollen.
  update profiles set pstg_year = extract(year from now())::int - 1
   where id = '7a444444-0000-0000-0000-000000000000';

  select * into r from pstg_record_transaction('7a444444-0000-0000-0000-000000000000', 15.00);
  if r.tx_count <> 1 then raise exception 'FAIL Z5: tx_count=% statt 1 — Vorjahr wirkt fort', r.tx_count; end if;
  if r.revenue <> 15.00 then raise exception 'FAIL Z5: revenue=% statt 15.00 — Vorjahresumsatz wirkt fort', r.revenue; end if;
  if r.locked then raise exception 'FAIL Z5: Sperre des Vorjahres wirkt ins neue Jahr fort'; end if;
  raise notice 'PASS Z5: Jahreswechsel setzt Zaehler, Umsatz und Sperre zurueck';
end $$;

-- ── TEST Z6: Anbieter kann seine Zaehler NICHT selbst nullen (Umgehung) ─────
-- Vor 0610 genuegte ein update auf die eigene Profilzeile, um aus der
-- DAC7-Meldung zu verschwinden: pstg-annual-report waehlt die zu meldenden
-- Anbieter ausschliesslich ueber pstg_tx_count/pstg_revenue aus.
set role authenticated;
set request.jwt.claim.sub = '7a222222-0000-0000-0000-000000000000';
do $$
declare n int; c int;
begin
  begin
    update profiles set pstg_tx_count = 0 where id = '7a222222-0000-0000-0000-000000000000';
    raise exception 'FAIL Z6: Anbieter konnte seinen Transaktionszaehler nullen';
  exception when raise_exception then
    if sqlerrm not like '%pstg_tx_count is managed%' then raise; end if;
  end;

  begin
    update profiles set pstg_revenue = 0 where id = '7a222222-0000-0000-0000-000000000000';
    raise exception 'FAIL Z6: Anbieter konnte seinen Umsatzstand nullen';
  exception when raise_exception then
    if sqlerrm not like '%pstg_revenue is managed%' then raise; end if;
  end;

  -- Gegenprobe: harmlose Felder bleiben schreibbar, der Guard ist nicht zu breit
  update profiles set full_name = 'Neuer Name' where id = '7a222222-0000-0000-0000-000000000000';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL Z6: Guard blockiert auch harmlose Profilfelder (% Zeilen)', n; end if;

  select pstg_tx_count into c from profiles where id = '7a222222-0000-0000-0000-000000000000';
  if c <> 1 then raise exception 'FAIL Z6: Zaehler wurde doch veraendert (%)', c; end if;
  raise notice 'PASS Z6: Anbieter kann sich nicht aus der DAC7-Meldung herausschreiben (Name bleibt aenderbar)';
end $$;
reset role;

-- ── TEST Z7: 50 aufeinanderfolgende Fortschreibungen kommen alle an ────────
-- EHRLICHE EINORDNUNG (Befund des Test-Experten-Agenten): Diese Schleife laeuft
-- SEQUENZIELL in einer Session. Sie beweist damit KEINE Nebenlaeufigkeit — das
-- alte Lesen-Rechnen-Schreiben haette sie ebenso bestanden, weil jeder Aufruf
-- committet, bevor der naechste liest. Was sie zeigt: die Funktion zaehlt
-- korrekt hoch und verliert nichts an Rundung oder Typkonvertierung.
--
-- Ein echter Race-Test ist in dieser Harness moeglich (dblink 1.2 ist da, kein
-- Docker noetig): zwei Sessions, S1 haelt den Row-Lock in einer offenen
-- Transaktion, S2 laeuft per dblink_send_query dagegen und blockiert
-- nachweislich (dblink_is_busy = 1), danach S1 commit und
-- dblink_get_result — zweimal rufen, sonst scheitert der folgende commit.
-- Als eigener Block notiert, nicht am Ende einer langen Session angebaut.
do $$
declare i int; c int; rev numeric;
begin
  for i in 1..50 loop
    perform pstg_record_transaction('7a555555-0000-0000-0000-000000000000', 7.00);
  end loop;
  select pstg_tx_count, pstg_revenue into c, rev
    from profiles where id = '7a555555-0000-0000-0000-000000000000';
  if c <> 50 then raise exception 'FAIL Z7: % von 50 Fortschreibungen angekommen', c; end if;
  if rev <> 350.00 then raise exception 'FAIL Z7: revenue=% statt 350.00', rev; end if;
  raise notice 'PASS Z7: alle 50 aufeinanderfolgenden Fortschreibungen angekommen (KEIN Nebenlaeufigkeits-Beweis, siehe Kopf)';
end $$;

-- ── TEST Z8: die Funktion ist nicht fuer Client-Rollen aufrufbar ────────────
set role authenticated;
set request.jwt.claim.sub = '7a666666-0000-0000-0000-000000000000';
do $$
begin
  perform pstg_record_transaction('7a666666-0000-0000-0000-000000000000', 5000.00);
  raise exception 'FAIL Z8: Client konnte die Compliance-Funktion direkt aufrufen';
exception when insufficient_privilege then
  raise notice 'PASS Z8: pstg_record_transaction ist fuer Client-Rollen nicht ausfuehrbar';
end $$;
reset role;

-- ── TEST Z9: die Meldung ueberlebt die erste Auszahlung des neuen Jahres ────
-- Der Ausfall, den der Architektur-Agent gegen echtes Postgres nachgestellt
-- hat: pstg-annual-report waehlte ueber profiles.pstg_year/-count/-revenue aus.
-- Diese Spalten stellt pstg_record_transaction beim Jahreswechsel zurueck. Lief
-- der Bericht auch nur einen Tag nach der ersten Auszahlung des neuen Jahres,
-- fehlten die aktivsten Anbieter des Vorjahres vollstaendig.
--
-- pstg_year_totals (0620) leitet aus den Vertraegen ab. Dieser Test spielt den
-- Ablauf durch: Anbieter erfuellt 2026 die Schwelle, bekommt 2027 eine
-- Auszahlung (Zaehler springt), und die Meldung fuer 2026 muss ihn weiterhin
-- vollstaendig ausweisen.
reset role;

alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;
alter table public.jobs disable trigger user;

insert into auth.users (id,email,email_confirmed_at) values
  ('7b111111-0000-0000-0000-000000000000','jw-kunde@test.de',now()),
  ('7b222222-0000-0000-0000-000000000000','jw-anbieter@test.de',now());
insert into profiles (id,role,email,email_verified_at) values
  ('7b111111-0000-0000-0000-000000000000','customer','jw-kunde@test.de',now()),
  ('7b222222-0000-0000-0000-000000000000','provider','jw-anbieter@test.de',now());
insert into provider_profiles (id,business_name) values
  ('7b222222-0000-0000-0000-000000000000','JahreswechselBetrieb');
insert into jobs (id,customer_id,provider_id,title,description,category,address_plz,address_city,track,status) values
  ('7b333333-0000-0000-0000-000000000000','7b111111-0000-0000-0000-000000000000','7b222222-0000-0000-0000-000000000000',
   'JW','Beschreibung lang genug fuer den Test.','Elektro','50667','Koeln','handwerker','completed');

alter table auth.users enable trigger user;
alter table public.profiles enable trigger user;
alter table public.jobs enable trigger user;

-- 31 abgeschlossene Vertraege in 2026, je 100 EUR Auszahlung
alter table public.contracts disable trigger trg_guard_contracts_sensitive_cols;
do $$
declare i int;
begin
  for i in 1..31 loop
    insert into contracts (job_id,customer_id,provider_id,price_gross,customer_total,provider_payout,track,status,escrow_released_at,completed_at)
    values ('7b333333-0000-0000-0000-000000000000','7b111111-0000-0000-0000-000000000000','7b222222-0000-0000-0000-000000000000',
            108.70,111.42,100.00,'handwerker','completed',
            timestamptz '2026-06-15 12:00:00+02', timestamptz '2026-06-15 12:00:00+02');
  end loop;
  -- Eine Auszahlung im Folgejahr — genau der Vorgang, der den Zaehler umstellt
  insert into contracts (job_id,customer_id,provider_id,price_gross,customer_total,provider_payout,track,status,escrow_released_at,completed_at)
  values ('7b333333-0000-0000-0000-000000000000','7b111111-0000-0000-0000-000000000000','7b222222-0000-0000-0000-000000000000',
          43.48,44.57,40.00,'handwerker','completed',
          timestamptz '2027-01-02 09:00:00+01', timestamptz '2027-01-02 09:00:00+01');
end $$;
alter table public.contracts enable trigger trg_guard_contracts_sensitive_cols;

-- Der Zaehler steht jetzt (wie in Produktion nach der Januar-Auszahlung) auf
-- dem NEUEN Jahr — genau der Zustand, in dem die alte Auswahl das Vorjahr
-- nicht mehr fand.
alter table public.profiles disable trigger trg_guard_profile_sensitive_cols;
update profiles set pstg_year = 2027, pstg_tx_count = 1, pstg_revenue = 40.00, pstg_locked = false
 where id = '7b222222-0000-0000-0000-000000000000';
alter table public.profiles enable trigger trg_guard_profile_sensitive_cols;

do $$
declare n int; r record; alt_treffer int;
begin
  -- ALTE Auswahl (ueber profiles) findet ihn fuer 2026 nicht mehr
  select count(*) into alt_treffer from profiles
   where id = '7b222222-0000-0000-0000-000000000000'
     and pstg_year = 2026
     and (pstg_tx_count >= 30 or pstg_revenue >= 2000);
  if alt_treffer <> 0 then
    raise exception 'FAIL Z9: Vorbedingung verfehlt — der Zaehler steht nicht auf dem neuen Jahr';
  end if;

  -- NEUE Auswahl (aus den Vertraegen) weist ihn vollstaendig aus
  select * into r from pstg_year_totals(2026)
   where provider_id = '7b222222-0000-0000-0000-000000000000';
  if not found then
    raise exception 'FAIL Z9: Anbieter fehlt in der Meldung fuer 2026 — genau der Ausfall, der behoben werden sollte';
  end if;
  if r.tx_count <> 31 then raise exception 'FAIL Z9: tx_count=% statt 31', r.tx_count; end if;
  if r.revenue <> 3100.00 then raise exception 'FAIL Z9: revenue=% statt 3100.00', r.revenue; end if;

  -- Und das Folgejahr wird sauber getrennt gefuehrt
  select * into r from pstg_year_totals(2027)
   where provider_id = '7b222222-0000-0000-0000-000000000000';
  if r.tx_count <> 1 or r.revenue <> 40.00 then
    raise exception 'FAIL Z9: Folgejahr falsch (% / %)', r.tx_count, r.revenue;
  end if;
  raise notice 'PASS Z9: Meldung fuer 2026 bleibt vollstaendig, obwohl der Zaehler schon auf 2027 steht';
end $$;

-- ── TEST Z10: nur bezahlte, abgeschlossene Vertraege zaehlen ────────────────
-- storniert (erstattet) und laufend: beides darf NICHT in die Meldung
insert into contracts (job_id,customer_id,provider_id,price_gross,customer_total,provider_payout,track,status,escrow_released_at)
values ('7b333333-0000-0000-0000-000000000000','7b111111-0000-0000-0000-000000000000','7b222222-0000-0000-0000-000000000000',
        500.00,512.50,460.00,'handwerker','cancelled', timestamptz '2026-07-01 10:00:00+02'),
       ('7b333333-0000-0000-0000-000000000000','7b111111-0000-0000-0000-000000000000','7b222222-0000-0000-0000-000000000000',
        500.00,512.50,460.00,'handwerker','active', null);

do $$
declare r record;
begin
  select * into r from pstg_year_totals(2026)
   where provider_id = '7b222222-0000-0000-0000-000000000000';
  if r.tx_count <> 31 or r.revenue <> 3100.00 then
    raise exception 'FAIL Z10: stornierte oder laufende Vertraege in der Meldung (% / %)', r.tx_count, r.revenue;
  end if;
  raise notice 'PASS Z10: stornierte und laufende Vertraege fliessen nicht in die Meldung';
end $$;

-- ── TEST Z11: Client-Rollen duerfen die Meldegrundlage nicht abfragen ───────
set role authenticated;
set request.jwt.claim.sub = '7b222222-0000-0000-0000-000000000000';
do $$
begin
  perform pstg_year_totals(2026);
  raise exception 'FAIL Z11: Client konnte die Meldegrundlage abfragen';
exception when insufficient_privilege then
  raise notice 'PASS Z11: pstg_year_totals ist fuer Client-Rollen nicht ausfuehrbar';
end $$;
reset role;

-- ── TEST Z12: die Schwelle filtert in der DATENBANK, nicht erst danach ──────
-- Vor-Merge-Befund des Architektur-Agenten: filtert die Funktion nicht selbst,
-- liefert sie eine Zeile pro Anbieter mit IRGENDEINER Auszahlung im Jahr, und
-- PostgREST kappt die Antwort bei max_rows = 1000 still ab. Bei mehr als 1000
-- auszahlungsaktiven Anbietern fehlten die abgeschnittenen in der Meldung —
-- exakt die Ausfallklasse, die 0620 beseitigen soll, nur eine Groessenordnung
-- spaeter. Deshalb muss ein Anbieter unter der Schwelle gar nicht erst
-- zurueckkommen.
reset role;

alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;
alter table public.jobs disable trigger user;

insert into auth.users (id,email,email_confirmed_at) values
  ('7c111111-0000-0000-0000-000000000000','sw-anbieter@test.de',now());
insert into profiles (id,role,email,email_verified_at) values
  ('7c111111-0000-0000-0000-000000000000','provider','sw-anbieter@test.de',now());
insert into provider_profiles (id,business_name) values
  ('7c111111-0000-0000-0000-000000000000','KleinBetrieb');

alter table auth.users enable trigger user;
alter table public.profiles enable trigger user;
alter table public.jobs enable trigger user;

-- Ein einziger kleiner Auftrag in 2026: weit unter beiden Schwellen
insert into contracts (job_id,customer_id,provider_id,price_gross,customer_total,provider_payout,track,status,escrow_released_at,completed_at)
values ('7b333333-0000-0000-0000-000000000000','7b111111-0000-0000-0000-000000000000','7c111111-0000-0000-0000-000000000000',
        20.00,21.50,17.00,'handwerker','completed',
        timestamptz '2026-03-10 11:00:00+01', timestamptz '2026-03-10 11:00:00+01');

do $$
declare n int;
begin
  select count(*) into n from pstg_year_totals(2026)
   where provider_id = '7c111111-0000-0000-0000-000000000000';
  if n <> 0 then
    raise exception 'FAIL Z12: Anbieter unter der Schwelle kommt zurueck — die Antwortmenge waechst mit ALLEN aktiven Anbietern und wird bei max_rows still gekappt';
  end if;

  -- Gegenprobe: mit abgesenkter Schwelle muss derselbe Anbieter erscheinen,
  -- sonst wuerde der Test auch dann gruen, wenn die Zeile aus einem ganz
  -- anderen Grund fehlt.
  select count(*) into n from pstg_year_totals(2026, 1, 1)
   where provider_id = '7c111111-0000-0000-0000-000000000000';
  if n <> 1 then
    raise exception 'FAIL Z12-Gegenprobe: Anbieter fehlt auch bei Schwelle 1/1 (%)', n;
  end if;
  raise notice 'PASS Z12: Schwelle filtert in der Datenbank; Gegenprobe mit abgesenkter Schwelle findet ihn';
end $$;
