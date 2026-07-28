-- Doppelzustellung beim stripe-webhook (Block A2)
--
-- WARUM: Stripe stellt dasselbe Event ausdruecklich mehrfach zu und wiederholt
-- bis zu drei Tage lang, wenn der Endpunkt je 500 antwortet. Der Handler fuer
-- payment_intent.succeeded schrieb bis jetzt bedingungslos:
--     update contracts set escrow_captured_at = now(), status = 'active'
--      where id = <contract_id>
-- Eine zweite Zustellung setzte damit AUCH einen bereits stornierten Vertrag
-- zurueck auf 'active', mit frischem escrow_captured_at. cancel-contract hatte
-- dann schon erstattet, aber escrow_released_at ist noch leer — also passieren
-- alle drei Vorbedingungen von release-escrow (status active / captured gesetzt
-- / released leer) und Werkant ueberweist dem Anbieter Geld, das der Kunde
-- bereits zurueckbekommen hat.
--
-- Der Handler nutzt jetzt ein Compare-and-Swap: nur aus 'pending' und nur
-- solange escrow_captured_at leer ist. Dieser Test spiegelt exakt die
-- WHERE-Bedingung, die PostgREST daraus erzeugt.
--
-- (Y1) Erste Zustellung wirkt: pending -> active, Zeitstempel gesetzt
-- (Y2) Doppelzustellung wirkt NICHT und ueberschreibt den Zeitstempel nicht
-- (Y3) Spaete Zustellung nach Storno belebt den Vertrag NICHT wieder (Geld!)
-- (Y4) Spaete Zustellung nach Abschluss belebt den Vertrag NICHT wieder
--
-- GRENZE DIESES TESTS, bewusst benannt: die Assertions fuehren nicht die Edge
-- Function aus, sondern spiegeln ihre WHERE-Bedingung in SQL. Streicht jemand
-- die Bedingungen im TypeScript, faellt es hier nicht automatisch auf. Deshalb
-- steht am Ende die Gegenprobe Y5: sie fuehrt die ALTE, bedingungslose
-- Anweisung aus und zeigt, dass sie den stornierten Vertrag tatsaechlich
-- wiederbelebt — damit ist dokumentiert, warum die Bedingungen dort stehen.
--
-- Der Webhook laeuft als service_role und umgeht damit RLS UND den
-- 0300-Guard. Deshalb ist der Guard-Trigger hier abgeschaltet — sonst wuerde
-- der Test etwas anderes pruefen als die Produktion tut.
reset role;

alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;
alter table public.jobs disable trigger user;
alter table public.offers disable trigger user;

insert into auth.users (id,email,email_confirmed_at) values
  ('8a111111-0000-0000-0000-000000000000','wh-kunde@test.de',now()),
  ('8a222222-0000-0000-0000-000000000000','wh-anbieter@test.de',now());
insert into profiles (id,role,email,email_verified_at) values
  ('8a111111-0000-0000-0000-000000000000','customer','wh-kunde@test.de',now()),
  ('8a222222-0000-0000-0000-000000000000','provider','wh-anbieter@test.de',now());
insert into provider_profiles (id,business_name,is_nachbarschaft) values
  ('8a222222-0000-0000-0000-000000000000','WebhookBetrieb',false);
insert into jobs (id,customer_id,title,description,category,address_plz,address_city,track,status) values
  ('8b000001-0000-0000-0000-000000000000','8a111111-0000-0000-0000-000000000000','Normal','Beschreibung lang genug fuer den Test.','Elektro','50667','Koeln','handwerker','open'),
  ('8b000002-0000-0000-0000-000000000000','8a111111-0000-0000-0000-000000000000','Storno','Beschreibung lang genug fuer den Test.','Elektro','50667','Koeln','handwerker','open'),
  ('8b000003-0000-0000-0000-000000000000','8a111111-0000-0000-0000-000000000000','Fertig','Beschreibung lang genug fuer den Test.','Elektro','50667','Koeln','handwerker','open');
insert into offers (id,job_id,provider_id,price,status) values
  ('8bb00001-0000-0000-0000-000000000000','8b000001-0000-0000-0000-000000000000','8a222222-0000-0000-0000-000000000000',100,'pending'),
  ('8bb00002-0000-0000-0000-000000000000','8b000002-0000-0000-0000-000000000000','8a222222-0000-0000-0000-000000000000',100,'pending'),
  ('8bb00003-0000-0000-0000-000000000000','8b000003-0000-0000-0000-000000000000','8a222222-0000-0000-0000-000000000000',100,'pending');

alter table auth.users enable trigger user;
alter table public.profiles enable trigger user;
alter table public.jobs enable trigger user;
alter table public.offers enable trigger user;

set request.jwt.claim.sub = '8a111111-0000-0000-0000-000000000000';
select accept_offer('8bb00001-0000-0000-0000-000000000000','8b000001-0000-0000-0000-000000000000');
select accept_offer('8bb00002-0000-0000-0000-000000000000','8b000002-0000-0000-0000-000000000000');
select accept_offer('8bb00003-0000-0000-0000-000000000000','8b000003-0000-0000-0000-000000000000');

-- Der Webhook arbeitet als service_role und umgeht den Guard-Trigger.
alter table public.contracts disable trigger trg_guard_contracts_sensitive_cols;

-- ── TEST Y1: erste Zustellung wirkt ─────────────────────────────────────────
do $$
declare v_id uuid; n int; c contracts%rowtype;
begin
  select id into v_id from contracts where offer_id='8bb00001-0000-0000-0000-000000000000';
  if v_id is null then raise exception 'FAIL: Testvertrag fehlt'; end if;

  update contracts set escrow_captured_at = now(), status = 'active'
   where id = v_id and status = 'pending' and escrow_captured_at is null;
  get diagnostics n = row_count;

  select * into c from contracts where id = v_id;
  if n <> 1 then raise exception 'FAIL: erste Zustellung wirkte nicht (% Zeilen)', n; end if;
  if c.status <> 'active' then raise exception 'FAIL: status=% statt active', c.status; end if;
  if c.escrow_captured_at is null then raise exception 'FAIL: escrow_captured_at nicht gesetzt'; end if;
  raise notice 'PASS Webhook Y1: erste Zustellung setzt pending -> active und stempelt den Escrow';
end $$;

-- ── TEST Y2: Doppelzustellung wirkt nicht ───────────────────────────────────
do $$
declare v_id uuid; n int; t_vorher timestamptz; t_nachher timestamptz; st text;
begin
  select id, escrow_captured_at into v_id, t_vorher
    from contracts where offer_id='8bb00001-0000-0000-0000-000000000000';

  -- exakt dieselbe Anweisung ein zweites Mal (Stripe liefert doppelt aus)
  update contracts set escrow_captured_at = now(), status = 'active'
   where id = v_id and status = 'pending' and escrow_captured_at is null;
  get diagnostics n = row_count;

  select escrow_captured_at, status into t_nachher, st from contracts where id = v_id;
  if n <> 0 then raise exception 'FAIL: Doppelzustellung hat % Zeilen veraendert', n; end if;
  if t_nachher is distinct from t_vorher then
    raise exception 'FAIL: Doppelzustellung hat den Escrow-Zeitstempel ueberschrieben (% -> %)', t_vorher, t_nachher;
  end if;
  if st <> 'active' then raise exception 'FAIL: status nach Doppelzustellung=%', st; end if;
  raise notice 'PASS Webhook Y2: Doppelzustellung aendert nichts (kein neuer Zeitstempel, keine Folgewirkung)';
end $$;

-- ── TEST Y3: spaete Zustellung nach Storno (der Geld-Fall) ──────────────────
-- Ablauf wie in Produktion: Zahlung eingegangen, Kunde storniert (cancel-contract
-- erstattet und setzt 'cancelled'), danach trifft eine Wiederholung desselben
-- Stripe-Events ein.
do $$
declare v_id uuid; n int; st text; rel timestamptz;
begin
  select id into v_id from contracts where offer_id='8bb00002-0000-0000-0000-000000000000';

  update contracts set escrow_captured_at = now(), status = 'active'
   where id = v_id and status = 'pending' and escrow_captured_at is null;

  -- cancel-contract: erstattet und storniert
  update contracts set status = 'cancelled', cancelled_at = now() where id = v_id;

  -- Wiederholung des Zahlungs-Events
  update contracts set escrow_captured_at = now(), status = 'active'
   where id = v_id and status = 'pending' and escrow_captured_at is null;
  get diagnostics n = row_count;

  select status, escrow_released_at into st, rel from contracts where id = v_id;
  if n <> 0 then raise exception 'FAIL: Wiederholung hat den stornierten Vertrag angefasst (% Zeilen)', n; end if;
  if st <> 'cancelled' then
    raise exception 'FAIL: stornierter Vertrag wurde auf % wiederbelebt — release-escrow koennte jetzt bereits erstattetes Geld auszahlen', st;
  end if;
  raise notice 'PASS Webhook Y3: Wiederholung belebt einen stornierten Vertrag NICHT wieder (keine Auszahlung nach Erstattung)';
end $$;

-- ── TEST Y4: spaete Zustellung nach Abschluss ───────────────────────────────
do $$
declare v_id uuid; n int; st text;
begin
  select id into v_id from contracts where offer_id='8bb00003-0000-0000-0000-000000000000';

  update contracts set escrow_captured_at = now(), status = 'active'
   where id = v_id and status = 'pending' and escrow_captured_at is null;
  -- release-escrow: ausgezahlt und abgeschlossen
  update contracts set status = 'completed', escrow_released_at = now(), completed_at = now()
   where id = v_id;

  update contracts set escrow_captured_at = now(), status = 'active'
   where id = v_id and status = 'pending' and escrow_captured_at is null;
  get diagnostics n = row_count;

  select status into st from contracts where id = v_id;
  if n <> 0 then raise exception 'FAIL: Wiederholung hat den abgeschlossenen Vertrag angefasst (% Zeilen)', n; end if;
  if st <> 'completed' then raise exception 'FAIL: abgeschlossener Vertrag wurde auf % zurueckgesetzt', st; end if;
  raise notice 'PASS Webhook Y4: Wiederholung setzt einen abgeschlossenen Vertrag nicht zurueck';
end $$;

-- ── TEST Y5: Gegenprobe — die alte, bedingungslose Anweisung ist gefaehrlich ─
-- Belegt am selben stornierten Vertrag aus Y3, dass die Bedingungen nicht
-- kosmetisch sind: ohne sie kippt ein erstatteter Vertrag zurueck auf 'active'
-- mit leerem escrow_released_at — und damit passieren alle drei Vorbedingungen
-- von release-escrow.
do $$
declare v_id uuid; st text; rel timestamptz; cap timestamptz;
begin
  select id into v_id from contracts where offer_id='8bb00002-0000-0000-0000-000000000000';
  if (select status from contracts where id = v_id) <> 'cancelled' then
    raise exception 'FAIL: Vorbedingung von Y5 nicht erfuellt (Vertrag nicht storniert)';
  end if;

  -- exakt der Stand VOR dem Fix
  update contracts set escrow_captured_at = now(), status = 'active' where id = v_id;

  select status, escrow_released_at, escrow_captured_at into st, rel, cap
    from contracts where id = v_id;
  if st <> 'active' or cap is null or rel is not null then
    raise exception 'FAIL: Gegenprobe traf den erwarteten Zustand nicht (%/%/%)', st, cap, rel;
  end if;
  raise notice 'PASS Webhook Y5 (Gegenprobe): ohne die Bedingungen wird ein erstatteter Vertrag wieder auszahlbar — genau das verhindert der Fix';

  -- Aufraeumen, damit der Zustand nicht spaetere Leser in die Irre fuehrt
  update contracts set status = 'cancelled', escrow_captured_at = null where id = v_id;
end $$;

alter table public.contracts enable trigger trg_guard_contracts_sensitive_cols;

-- ── TEST Y6-Y8: Erstattung und Rueckbuchung nach Abschluss (Migration 0630) ─
-- Vor 0630 blieb ein solcher Vorgang unsichtbar: status 'completed', alle
-- Betraege unveraendert, kein Hinweis darauf, dass Geld zurueckgeflossen ist.
-- Geprueft wird die Semantik der Webhook-Anweisungen (charge.refunded /
-- charge.dispute.*) gegen echtes Postgres.
reset role;
alter table public.contracts disable trigger trg_guard_contracts_sensitive_cols;

-- Vertrag aus Y4 ist bereits 'completed' mit gesetztem escrow_released_at
do $$
declare v_id uuid; v_pi text := 'pi_test_refund_0630';
begin
  select id into v_id from contracts where offer_id='8bb00003-0000-0000-0000-000000000000';
  update contracts set stripe_payment_intent = v_pi where id = v_id;

  -- charge.refunded: kumulierter Betrag wird GESETZT, nicht addiert
  update contracts set customer_refunded_amount = 45.00, refunded_at = now()
   where stripe_payment_intent = v_pi;
  -- Doppelzustellung desselben Events: derselbe kumulierte Wert
  update contracts set customer_refunded_amount = 45.00, refunded_at = now()
   where stripe_payment_intent = v_pi;

  if (select customer_refunded_amount from contracts where id = v_id) <> 45.00 then
    raise exception 'FAIL Y6: Doppelzustellung hat den Erstattungsbetrag verdoppelt';
  end if;
  raise notice 'PASS Y6: Erstattung wird gesetzt statt addiert — Doppelzustellung verdoppelt nichts';
end $$;

-- Y7: die Erstattung darf die DAC7-Meldung NICHT mindern
-- (kein Transfer-Reversal im Code -> die Verguetung des Anbieters ist
-- unveraendert, § 3 Abs. 5 PStTG. Ein Abzug wuerde zu niedrig melden.)
do $$
declare v_id uuid; r record; erwartet numeric;
begin
  select id into v_id from contracts where offer_id='8bb00003-0000-0000-0000-000000000000';
  select provider_payout into erwartet from contracts where id = v_id;

  select * into r from pstg_year_totals(
    extract(year from (select escrow_released_at at time zone 'Europe/Berlin' from contracts where id = v_id))::int,
    1, 1)
   where provider_id = (select provider_id from contracts where id = v_id);

  if not found then raise exception 'FAIL Y7: Vertrag fehlt in der Meldegrundlage'; end if;
  if r.revenue < erwartet then
    raise exception 'FAIL Y7: Erstattung an den KUNDEN hat die Meldesumme gemindert (% statt mindestens %) — der Anbieter wuerde zu niedrig gemeldet', r.revenue, erwartet;
  end if;
  raise notice 'PASS Y7: Kundenerstattung mindert die DAC7-Meldung nicht (kein Rueckholmechanismus, Verguetung unveraendert)';
end $$;

-- Y8: Rueckbuchungs-Zustand wird festgehalten und ist auf gueltige Werte begrenzt
do $$
declare v_id uuid;
begin
  select id into v_id from contracts where offer_id='8bb00003-0000-0000-0000-000000000000';
  update contracts set dispute_state = 'open' where id = v_id;
  update contracts set dispute_state = 'lost' where id = v_id;
  if (select dispute_state from contracts where id = v_id) <> 'lost' then
    raise exception 'FAIL Y8: Rueckbuchungs-Zustand nicht gespeichert';
  end if;
  begin
    update contracts set dispute_state = 'vielleicht' where id = v_id;
    raise exception 'FAIL Y8: erfundener Rueckbuchungs-Zustand wurde akzeptiert';
  exception when check_violation then
    raise notice 'PASS Y8: Rueckbuchungs-Zustand wird festgehalten, erfundene Werte abgewiesen';
  end;
end $$;

alter table public.contracts enable trigger trg_guard_contracts_sensitive_cols;

-- Y9: der Kunde kann die neuen Geldspalten nicht selbst setzen (0630-Guard)
set role authenticated;
set request.jwt.claim.sub = '8a111111-0000-0000-0000-000000000000';
do $$
declare v_id uuid;
begin
  select id into v_id from contracts where offer_id='8bb00003-0000-0000-0000-000000000000';
  begin
    update contracts set customer_refunded_amount = 999.00 where id = v_id;
    raise exception 'FAIL Y9: Kunde konnte sich eine Erstattung eintragen';
  exception when raise_exception then
    if sqlerrm not like '%customer_refunded_amount is managed%' then raise; end if;
  end;
  begin
    update contracts set provider_clawback_amount = 999.00 where id = v_id;
    raise exception 'FAIL Y9: Kunde konnte eine Rueckholung eintragen';
  exception when raise_exception then
    if sqlerrm not like '%provider_clawback_amount is managed%' then raise; end if;
  end;
  raise notice 'PASS Y9: die neuen Geldspalten sind clientseitig gesperrt (0630)';
end $$;
reset role;
