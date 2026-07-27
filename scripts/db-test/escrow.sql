-- Geldpfad-Zustandsmaschine + Gebuehren-Paritaet (Block A1)
--
-- WARUM: Die Gebuehren sind ZWEIMAL implementiert — in `lib/feeEngine.ts` und
-- noch einmal in plpgsql in accept_offer (0530:41-52). Zwei unabhaengige
-- Implementierungen derselben Geldmathematik laufen frueher oder spaeter
-- auseinander, und dann wird dem Kunden ein anderer Betrag abgebucht als die
-- App anzeigt. money-core.sql prueft bisher NUR Handwerker/100 EUR — dort
-- greift keine der beiden Mindestgebuehren und kein Rundungsfall. Die
-- `greatest(...)`-Zweige und der Nachbarschafts-Track waren nie geprueft.
--
-- Die Erwartungswerte unten sind nicht geschaetzt, sondern aus feeEngine.ts
-- ausgerechnet (Math.max + Math.round(x*100)/100).
--
-- (U) Gebuehren-Paritaet an den Grenzfaellen beider Tracks
-- (V) Escrow-Spalten sind clientseitig nicht schreibbar (0300-Guard)
-- (W) Fremder sieht/aendert den Vertrag nicht (RLS)
-- (X) status-CHECK laesst keinen erfundenen Zustand zu
--
-- GRENZE DIESES TESTS (bewusst dokumentiert, damit gruen nicht mit
-- "vollstaendig abgedeckt" verwechselt wird): Die eigentlichen Uebergaenge
-- escrow_captured -> released -> completed passieren in den Edge Functions
-- release-escrow / cancel-contract / stripe-webhook mit service_role. Die
-- umgehen RLS UND den Guard-Trigger. Was hier geprueft wird, ist die
-- Verteidigungslinie DAHINTER: wenn eine Function je umgangen wird, darf die
-- Datenbank den Geldpfad trotzdem nicht freigeben.
reset role;

alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;
alter table public.jobs disable trigger user;
alter table public.offers disable trigger user;

insert into auth.users (id,email,email_confirmed_at) values
  ('c1111111-0000-0000-0000-000000000000','esc-kunde@test.de',now()),
  ('c2222222-0000-0000-0000-000000000000','esc-anbieter@test.de',now()),
  ('c3333333-0000-0000-0000-000000000000','esc-fremd@test.de',now()),
  ('c4444444-0000-0000-0000-000000000000','esc-nbhelfer@test.de',now());
insert into profiles (id,role,email,email_verified_at) values
  ('c1111111-0000-0000-0000-000000000000','customer','esc-kunde@test.de',now()),
  ('c2222222-0000-0000-0000-000000000000','provider','esc-anbieter@test.de',now()),
  ('c3333333-0000-0000-0000-000000000000','provider','esc-fremd@test.de',now()),
  ('c4444444-0000-0000-0000-000000000000','provider','esc-nbhelfer@test.de',now());
insert into provider_profiles (id,business_name,is_nachbarschaft) values
  ('c2222222-0000-0000-0000-000000000000','EscBetrieb',false),
  ('c3333333-0000-0000-0000-000000000000','FremdBetrieb',false),
  ('c4444444-0000-0000-0000-000000000000','NBHelfer',true);

-- Ein Auftrag je Preis-Grenzfall. Handwerk:
--   20.00 -> beide Mindestgebuehren greifen (1.60 -> 3.00 / 0.50 -> 1.50)
--   60.00 -> Kundengebuehr exakt auf der Mindestgrenze (60*0.025 = 1.50)
--  101.00 -> Rundungsfall: 101*0.025 = 2.525 -> kaufmaennisch 2.53
-- Nachbarschaft:
--   50.00 -> fixe 1.99, Helfer bekommt 100 %
insert into jobs (id,customer_id,title,description,category,address_plz,address_city,track,status) values
  ('ca000020-0000-0000-0000-000000000000','c1111111-0000-0000-0000-000000000000','Klein','Beschreibung lang genug fuer den Test.','Elektro','50667','Koeln','handwerker','open'),
  ('ca000060-0000-0000-0000-000000000000','c1111111-0000-0000-0000-000000000000','Grenze','Beschreibung lang genug fuer den Test.','Elektro','50667','Koeln','handwerker','open'),
  ('ca000101-0000-0000-0000-000000000000','c1111111-0000-0000-0000-000000000000','Rundung','Beschreibung lang genug fuer den Test.','Elektro','50667','Koeln','handwerker','open'),
  ('ca000050-0000-0000-0000-000000000000','c1111111-0000-0000-0000-000000000000','Nachbar','Beschreibung lang genug fuer den Test.','Garten','50667','Koeln','nachbarschaft','open');
insert into offers (id,job_id,provider_id,price,status) values
  ('cb000020-0000-0000-0000-000000000000','ca000020-0000-0000-0000-000000000000','c2222222-0000-0000-0000-000000000000',20.00,'pending'),
  ('cb000060-0000-0000-0000-000000000000','ca000060-0000-0000-0000-000000000000','c2222222-0000-0000-0000-000000000000',60.00,'pending'),
  ('cb000101-0000-0000-0000-000000000000','ca000101-0000-0000-0000-000000000000','c2222222-0000-0000-0000-000000000000',101.00,'pending'),
  ('cb000050-0000-0000-0000-000000000000','ca000050-0000-0000-0000-000000000000','c4444444-0000-0000-0000-000000000000',50.00,'pending');

alter table auth.users enable trigger user;
alter table public.profiles enable trigger user;
alter table public.jobs enable trigger user;
alter table public.offers enable trigger user;

set request.jwt.claim.sub = 'c1111111-0000-0000-0000-000000000000';
select accept_offer('cb000020-0000-0000-0000-000000000000','ca000020-0000-0000-0000-000000000000');
select accept_offer('cb000060-0000-0000-0000-000000000000','ca000060-0000-0000-0000-000000000000');
select accept_offer('cb000101-0000-0000-0000-000000000000','ca000101-0000-0000-0000-000000000000');
select accept_offer('cb000050-0000-0000-0000-000000000000','ca000050-0000-0000-0000-000000000000');

-- ── TEST U1: beide Mindestgebuehren (20 EUR) ────────────────────────────────
do $$
declare c contracts%rowtype;
begin
  select * into c from contracts where offer_id='cb000020-0000-0000-0000-000000000000';
  if c.provider_commission  <> 3.00  then raise exception 'FAIL 20EUR: Mindest-Kommission nicht angewandt (%), feeEngine sagt 3.00', c.provider_commission; end if;
  if c.customer_service_fee <> 1.50  then raise exception 'FAIL 20EUR: Mindest-Servicegebuehr nicht angewandt (%), feeEngine sagt 1.50', c.customer_service_fee; end if;
  if c.customer_total       <> 21.50 then raise exception 'FAIL 20EUR: customer_total=% statt 21.50', c.customer_total; end if;
  if c.provider_payout      <> 17.00 then raise exception 'FAIL 20EUR: provider_payout=% statt 17.00', c.provider_payout; end if;
  raise notice 'PASS Gebuehren 20 EUR: beide Mindestgebuehren greifen wie in feeEngine (3.00/1.50/21.50/17.00)';
end $$;

-- ── TEST U2: exakt auf der Mindestgrenze (60 EUR) ───────────────────────────
do $$
declare c contracts%rowtype;
begin
  select * into c from contracts where offer_id='cb000060-0000-0000-0000-000000000000';
  if c.provider_commission  <> 4.80  then raise exception 'FAIL 60EUR: commission=% statt 4.80', c.provider_commission; end if;
  if c.customer_service_fee <> 1.50  then raise exception 'FAIL 60EUR: Grenzfall 60*0.025=1.50 falsch (%)', c.customer_service_fee; end if;
  if c.customer_total       <> 61.50 then raise exception 'FAIL 60EUR: customer_total=% statt 61.50', c.customer_total; end if;
  if c.provider_payout      <> 55.20 then raise exception 'FAIL 60EUR: provider_payout=% statt 55.20', c.provider_payout; end if;
  raise notice 'PASS Gebuehren 60 EUR: Kundengebuehr exakt auf der Mindestgrenze (4.80/1.50/61.50/55.20)';
end $$;

-- ── TEST U3: kaufmaennische Rundung (101 EUR) ───────────────────────────────
-- 101 * 0.025 = 2.525. Kaufmaennisch aufgerundet 2.53; runde-zur-geraden-Zahl
-- ("banker's rounding") ergaebe 2.52. feeEngine nutzt Math.round -> 2.53.
do $$
declare c contracts%rowtype;
begin
  select * into c from contracts where offer_id='cb000101-0000-0000-0000-000000000000';
  if c.provider_commission  <> 8.08   then raise exception 'FAIL 101EUR: commission=% statt 8.08', c.provider_commission; end if;
  if c.customer_service_fee <> 2.53   then raise exception 'FAIL 101EUR: Rundung 2.525 ergab % statt 2.53 — SQL und feeEngine runden verschieden', c.customer_service_fee; end if;
  if c.customer_total       <> 103.53 then raise exception 'FAIL 101EUR: customer_total=% statt 103.53', c.customer_total; end if;
  if c.provider_payout      <> 92.92  then raise exception 'FAIL 101EUR: provider_payout=% statt 92.92', c.provider_payout; end if;
  raise notice 'PASS Gebuehren 101 EUR: 2.525 wird kaufmaennisch auf 2.53 gerundet wie in feeEngine';
end $$;

-- ── TEST U4: Nachbarschafts-Track (50 EUR) ──────────────────────────────────
do $$
declare c contracts%rowtype;
begin
  select * into c from contracts where offer_id='cb000050-0000-0000-0000-000000000000';
  if c.track                <> 'nachbarschaft' then raise exception 'FAIL NB: track=%', c.track; end if;
  if c.werkr_schutz_fee     <> 1.99  then raise exception 'FAIL NB: Werkant-Schutz=% statt 1.99', c.werkr_schutz_fee; end if;
  if c.provider_commission  <> 0     then raise exception 'FAIL NB: Helfer zahlt Kommission (%) — NB-Helfer bekommt 100 Prozent', c.provider_commission; end if;
  if c.customer_service_fee <> 0     then raise exception 'FAIL NB: zusaetzliche Servicegebuehr (%)', c.customer_service_fee; end if;
  if c.customer_total       <> 51.99 then raise exception 'FAIL NB: customer_total=% statt 51.99', c.customer_total; end if;
  if c.provider_payout      <> 50.00 then raise exception 'FAIL NB: payout=% statt 50.00 (100 Prozent)', c.provider_payout; end if;
  raise notice 'PASS Gebuehren Nachbarschaft 50 EUR: fixe 1.99, Helfer bekommt 100 Prozent';
end $$;

-- ── TEST V: Escrow-/Geldspalten sind clientseitig gesperrt (0300-Guard) ─────
-- Der Kunde ist Vertragspartei und darf die Zeile per RLS updaten. Ohne den
-- Guard koennte er sich die Freigabe selbst stempeln oder den Preis druecken.
set role authenticated;
set request.jwt.claim.sub = 'c1111111-0000-0000-0000-000000000000';
do $$
declare v_id uuid;
begin
  select id into v_id from contracts where offer_id='cb000101-0000-0000-0000-000000000000';

  begin
    update contracts set escrow_released_at = now() where id = v_id;
    raise exception 'FAIL: Kunde konnte die Escrow-Freigabe selbst stempeln';
  exception when raise_exception then
    if sqlerrm not like '%escrow_released_at is managed%' then raise; end if;
  end;

  begin
    update contracts set status = 'completed' where id = v_id;
    raise exception 'FAIL: Kunde konnte den Vertragsstatus selbst auf completed setzen';
  exception when raise_exception then
    if sqlerrm not like '%status is managed%' then raise; end if;
  end;

  begin
    update contracts set customer_total = 1.00 where id = v_id;
    raise exception 'FAIL: Kunde konnte den zu zahlenden Betrag druecken';
  exception when raise_exception then
    if sqlerrm not like '%customer_total is managed%' then raise; end if;
  end;

  raise notice 'PASS Guard: Kunde kann weder Freigabe noch Status noch Betrag selbst setzen (0300)';
end $$;
reset role;

-- Und dieselbe Sperre fuer den Anbieter — er haette das staerkere Motiv,
-- sich die Auszahlung selbst freizugeben.
set role authenticated;
set request.jwt.claim.sub = 'c2222222-0000-0000-0000-000000000000';
do $$
declare v_id uuid;
begin
  select id into v_id from contracts where offer_id='cb000101-0000-0000-0000-000000000000';
  begin
    update contracts set escrow_released_at = now(), status = 'completed' where id = v_id;
    raise exception 'FAIL: Anbieter konnte sich die Auszahlung selbst freigeben';
  exception when raise_exception then
    if sqlerrm not like '%is managed%' then raise; end if;
  end;
  begin
    update contracts set provider_payout = 999.00 where id = v_id;
    raise exception 'FAIL: Anbieter konnte seine Auszahlung hochsetzen';
  exception when raise_exception then
    if sqlerrm not like '%provider_payout is managed%' then raise; end if;
  end;
  raise notice 'PASS Guard: Anbieter kann sich weder Freigabe noch hoehere Auszahlung setzen (0300)';
end $$;
reset role;

-- ── TEST W: Fremder sieht und aendert den Vertrag nicht (RLS) ───────────────
set role authenticated;
set request.jwt.claim.sub = 'c3333333-0000-0000-0000-000000000000';
do $$
declare n int; upd int;
begin
  select count(*) into n from contracts where offer_id='cb000101-0000-0000-0000-000000000000';
  if n <> 0 then raise exception 'FAIL: Unbeteiligter liest fremden Vertrag (%)', n; end if;

  update contracts set status = 'cancelled' where offer_id='cb000101-0000-0000-0000-000000000000';
  get diagnostics upd = row_count;
  if upd <> 0 then raise exception 'FAIL: Unbeteiligter konnte fremden Vertrag stornieren (% Zeilen)', upd; end if;
  raise notice 'PASS RLS: Unbeteiligter sieht den Vertrag nicht und kann ihn nicht stornieren';
end $$;
reset role;

-- ── TEST X: status-CHECK laesst keinen erfundenen Zustand zu ────────────────
-- Die Edge Functions arbeiten als service_role und umgehen damit RLS UND den
-- 0300-Guard (dessen erste Zeile genau das erlaubt). Wenn eine Function je
-- einen falschen Status schreiben wollte, ist der CHECK die letzte Instanz.
--
-- Geprueft wird hier NUR der CHECK. Dafuer wird der Guard-Trigger kurz
-- abgeschaltet (als Eigentuemer), sonst greift er zuerst und der CHECK kaeme
-- nie zum Zug — das hat beim Schreiben dieses Tests genau so zugeschlagen.
--
-- Nebenbefund: der 0300-Guard sperrt auch den Tabelleneigentuemer, nicht nur
-- Client-Rollen — anders als der profiles-Guard, den 0600 bewusst fuer den
-- SQL-Editor geoeffnet hat. Fuer Geldspalten ist das die richtige Haerte (kein
-- manuelles Nachbuchen im Dashboard), aber man muss es wissen, bevor man im
-- Dashboard einen Vertrag "schnell korrigieren" will.
reset role;
alter table public.contracts disable trigger trg_guard_contracts_sensitive_cols;
do $$
declare v_id uuid; n int;
begin
  select id into v_id from contracts where offer_id='cb000101-0000-0000-0000-000000000000';
  if v_id is null then raise exception 'FAIL: Testvertrag nicht gefunden — Assertion waere ins Leere gelaufen'; end if;

  begin
    update contracts set status = 'ausgezahlt' where id = v_id;
    get diagnostics n = row_count;
    raise exception 'FAIL: erfundener Vertragsstatus wurde akzeptiert (% Zeilen)', n;
  exception when check_violation then
    raise notice 'PASS CHECK: erfundener Vertragsstatus wird abgewiesen (letzte Instanz hinter den Functions)';
  end;

  -- Gegenprobe: ein gueltiger Zustand geht durch — sonst wuerde der Test auch
  -- dann gruen, wenn die Spalte aus einem ganz anderen Grund unschreibbar ist.
  update contracts set status = 'cancelled' where id = v_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: gueltiger Zustandswechsel schlug fehl (% Zeilen)', n; end if;
  raise notice 'PASS CHECK-Gegenprobe: gueltiger Zustandswechsel auf cancelled geht durch';
end $$;
alter table public.contracts enable trigger trg_guard_contracts_sensitive_cols;
