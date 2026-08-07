-- Verifiziert, dass ein authentifizierter Kunde KEINE contracts-Zeile direkt
-- anlegen kann.
--
-- BEFUND (Security-Review zu diesem Block, P0, VERIFIZIERT):
-- `trg_guard_contracts_sensitive_cols` ist `before update` -- er feuert bei
-- INSERT nie. Die RLS-Policy "Customer creates own contracts" (0050) prueft nur
-- `auth.uid() = customer_id` und die Job-Eigentuemerschaft, aber KEINE einzelne
-- Spalte. Ein Kunde konnte damit per REST-API eine Vertragszeile mit frei
-- gewaehltem `provider_payout`, gesetztem `escrow_captured_at` und
-- `status='active'` anlegen -- also einen bezahlten Auftrag behaupten, ohne je
-- bezahlt zu haben. `release-escrow` prueft den PaymentIntent nicht gegen
-- Stripe, sondern vertraut der Zeile: es haette den erfundenen Betrag vom
-- Plattform-Saldo an ein Connect-Konto ueberwiesen. Geld raus ohne Geld rein.
--
-- Der Fix (0680) entzieht `authenticated`/`anon` das INSERT-Recht komplett.
-- Das ist moeglich, weil es keinen einzigen clientseitigen contracts-Insert
-- gibt: jeder legitime Vertrag entsteht in `accept_offer()`, und die Funktion
-- ist `security definer`, laeuft also unter dem Eigentuemer weiter.

alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;
alter table public.jobs disable trigger user;
alter table public.offers disable trigger user;

insert into auth.users (id,email,email_confirmed_at) values
  ('ee000000-0000-0000-0000-000000000000','lockdown-kunde@test.de',now()),
  ('ee111111-0000-0000-0000-000000000000','lockdown-anbieter@test.de',now());
insert into profiles (id,role,email,email_verified_at) values
  ('ee000000-0000-0000-0000-000000000000','customer','lockdown-kunde@test.de',now()),
  ('ee111111-0000-0000-0000-000000000000','provider','lockdown-anbieter@test.de',now());
insert into provider_profiles (id,business_name) values ('ee111111-0000-0000-0000-000000000000','L');
insert into jobs (id,customer_id,title,description,category,address_plz,address_city,track,status) values
  ('ee222222-0000-0000-0000-000000000000','ee000000-0000-0000-0000-000000000000','JobL','Lang genug beschrieben hier drin.','Elektro','50667','Koeln','handwerker','open');
insert into offers (id,job_id,provider_id,price,status) values
  ('ee333333-0000-0000-0000-000000000000','ee222222-0000-0000-0000-000000000000','ee111111-0000-0000-0000-000000000000',100,'pending');

alter table auth.users enable trigger user;
alter table public.profiles enable trigger user;
alter table public.jobs enable trigger user;
alter table public.offers enable trigger user;

-- Z1: Der Direkt-Insert eines erfundenen, scheinbar bezahlten Vertrags scheitert.
do $$
declare v_id uuid;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub','ee000000-0000-0000-0000-000000000000',true);
  begin
    insert into contracts (job_id, customer_id, provider_id, track,
      price_gross, customer_total, provider_payout, provider_commission,
      customer_service_fee, werkr_schutz_fee, status,
      escrow_captured_at, stripe_payment_intent,
      dispute_amount_cents, dispute_funds_moved_at, stripe_dispute_id,
      dispute_funds_withdrawn)
    values ('ee222222-0000-0000-0000-000000000000',
      'ee000000-0000-0000-0000-000000000000','ee111111-0000-0000-0000-000000000000','handwerker',
      9999, 0.01, 9999, 0, 0, 0, 'active',
      now(), 'pi_frei_erfunden', 777777, now(), 'dp_frei_erfunden', true)
    returning id into v_id;
    raise exception 'FAIL Z1: Kunde konnte einen bezahlten Vertrag frei erfinden (contract=%)', v_id;
  exception
    when insufficient_privilege then
      raise notice 'PASS Z1: Direkter contracts-Insert ist authenticated entzogen (0680)';
  end;
end $$;
reset role;

-- Z2: Der LEGITIME Weg funktioniert unveraendert weiter -- accept_offer ist
-- security definer und darf trotz des Entzugs weiterhin inserten. Ohne diese
-- Zusicherung waere Z1 ein Fix, der das Produkt kaputtmacht.
do $$
declare v_contract contracts%rowtype; v_n int;
begin
  perform set_config('request.jwt.claim.sub','ee000000-0000-0000-0000-000000000000',true);
  select * into v_contract from accept_offer(
    'ee333333-0000-0000-0000-000000000000','ee222222-0000-0000-0000-000000000000');
  select count(*) into v_n from contracts where job_id = 'ee222222-0000-0000-0000-000000000000';
  if v_n <> 1 then
    raise exception 'FAIL Z2: accept_offer hat keinen Vertrag angelegt (n=%)', v_n;
  end if;
  if v_contract.provider_payout is null or v_contract.provider_payout <= 0 then
    raise exception 'FAIL Z2: accept_offer lieferte keinen gueltigen provider_payout';
  end if;
  raise notice 'PASS Z2: accept_offer legt weiterhin Vertraege an (payout=%)', v_contract.provider_payout;
end $$;

-- Z3: anon darf ebenfalls nicht inserten.
do $$
begin
  set local role anon;
  begin
    insert into contracts (job_id, customer_id, provider_id, track,
      price_gross, customer_total, provider_payout, status)
    values ('ee222222-0000-0000-0000-000000000000',
      'ee000000-0000-0000-0000-000000000000','ee111111-0000-0000-0000-000000000000','handwerker',
      1, 1, 1, 'active');
    raise exception 'FAIL Z3: anon konnte einen Vertrag anlegen';
  exception
    when insufficient_privilege then
      raise notice 'PASS Z3: Direkter contracts-Insert ist auch anon entzogen (0680)';
  end;
end $$;
reset role;
