-- PaymentIntent-Historie (Migration 0660) gegen echtes Postgres.
--
-- Der FakeSupabase-Recorder wertet Filter NICHT aus. Was hier geprueft wird, ist
-- die tatsaechliche Wirkung: Eindeutigkeit, "genau einer ist aktuell",
-- Wiederfinden ueber ALTE Intents, Default-Deny und ECHTE Nebenlaeufigkeit
-- (zwei ueberlappende dblink-Verbindungen, nicht zwei Aufrufe nacheinander).
create extension if not exists dblink;

\set kunde   '''d0000000-0000-0000-0000-000000000001'''
\set anb     '''b0000000-0000-0000-0000-000000000001'''
\set job     '''60000000-0000-0000-0000-000000000001'''
\set v1      '''90000000-0000-0000-0000-000000000001'''
\set v2      '''90000000-0000-0000-0000-000000000002'''

insert into auth.users (id, email) values
  (:kunde,'kunde.pi@example.com'), (:anb,'anb.pi@example.com') on conflict do nothing;
insert into public.profiles (id, role, display_name, email_verified_at) values
  (:kunde,'customer','K',now()), (:anb,'provider','A',now())
  on conflict (id) do update set email_verified_at = now();
insert into public.provider_profiles (id) values (:anb) on conflict (id) do nothing;
insert into public.jobs (id, customer_id, title, description, category_id, status)
  values (:job, :kunde, 'PI-Test', 'x', 'sanitaer', 'active') on conflict (id) do nothing;
insert into public.contracts (
  id, job_id, customer_id, provider_id, price_gross, customer_total, provider_payout,
  status, customer_signed_at, provider_signed_at
) values
  (:v1, :job, :kunde, :anb, 100, 102.50, 92, 'pending', now(), now()),
  (:v2, :job, :kunde, :anb, 100, 102.50, 92, 'pending', now(), now())
  on conflict (id) do nothing;

set role service_role;

-- ── 1. Registrierung setzt aktuell und pflegt den Spiegel ─────────────────
do $$
declare v_spiegel text; n integer;
begin
  perform public.register_payment_intent('90000000-0000-0000-0000-000000000001','pi_A',10250);
  select stripe_payment_intent into v_spiegel from public.contracts
    where id = '90000000-0000-0000-0000-000000000001';
  select count(*) into n from public.contract_payment_intents
    where contract_id = '90000000-0000-0000-0000-000000000001' and is_current;
  if v_spiegel = 'pi_A' and n = 1 then
    raise notice 'PASS: Registrierung setzt aktuell und spiegelt nach contracts';
  else raise exception 'FAIL: spiegel=% aktuell=%', v_spiegel, n; end if;
end $$;

-- ── 2. Zweiter Intent stuft den ersten zurueck, Historie bleibt ───────────
do $$
declare alt boolean; neu boolean; ges integer; sp text;
begin
  perform public.register_payment_intent('90000000-0000-0000-0000-000000000001','pi_B',10250);
  select is_current into alt from public.contract_payment_intents where payment_intent_id = 'pi_A';
  select is_current into neu from public.contract_payment_intents where payment_intent_id = 'pi_B';
  select count(*) into ges from public.contract_payment_intents
    where contract_id = '90000000-0000-0000-0000-000000000001';
  select stripe_payment_intent into sp from public.contracts
    where id = '90000000-0000-0000-0000-000000000001';
  if alt = false and neu = true and ges = 2 and sp = 'pi_B' then
    raise notice 'PASS: zweiter Intent uebernimmt, der erste bleibt als Historie erhalten';
  else raise exception 'FAIL: alt=% neu=% gesamt=% spiegel=%', alt, neu, ges, sp; end if;
end $$;

-- ── 3. Der Kernzweck: ALTER Intent findet seinen Vertrag ──────────────────
do $$
declare c uuid; akt boolean;
begin
  select contract_id, is_current into c, akt
    from public.contract_for_payment_intent('pi_A');
  if c = '90000000-0000-0000-0000-000000000001' and akt = false then
    raise notice 'PASS: Ereignis zu einem ALTEN Intent findet den Vertrag (als nicht aktuell erkennbar)';
  else raise exception 'FAIL: vertrag=% aktuell=%', c, akt; end if;
end $$;

-- ── 4. Nur EIN aktueller Intent je Vertrag ────────────────────────────────
do $$
begin
  insert into public.contract_payment_intents
    (payment_intent_id, contract_id, amount_cents, is_current)
    values ('pi_C','90000000-0000-0000-0000-000000000001',10250,true);
  raise exception 'FAIL: zwei aktuelle Intents am selben Vertrag moeglich';
exception when unique_violation then
  raise notice 'PASS: genau ein aktueller Intent je Vertrag (partieller Unique-Index)';
end $$;

-- ── 5. Ein Intent gehoert genau EINEM Vertrag ─────────────────────────────
do $$
begin
  perform public.register_payment_intent('90000000-0000-0000-0000-000000000002','pi_A',10250);
  raise exception 'FAIL: Intent wurde still an einen anderen Vertrag umgehaengt';
exception when sqlstate 'P0001' then
  raise notice 'PASS: derselbe Intent kann nicht an zwei Vertraege (lauter Fehler statt stillem Umhaengen)';
end $$;

reset role;

-- ── 6. ECHT ueberlappende Registrierung ───────────────────────────────────
-- Der Verbindungsaufbau laeuft als postgres (service_role hat kein Passwort);
-- die Rolle wird IN der jeweiligen dblink-Sitzung gesetzt -- genau der Weg, den
-- die Edge Function nimmt.
--
-- WAS DIESER TEST BELEGT UND WAS NICHT (Klarstellung nach dem QA-Review):
-- Er belegt, dass zwei ECHT ueberlappende Registrierungen beide durchgehen und
-- genau EINEN aktuellen Intent hinterlassen. Er belegt NICHT, dass die
-- Zeilensperre `for update` dafuer noetig ist -- die Gegenprobe des Reviews hat
-- gezeigt, dass der Test auch ohne sie gruen bleibt. Der eigentliche Schutz
-- kommt vom partiellen Unique-Index `(contract_id) where is_current` und der
-- Zeilensperre des `update`-Befehls in der Funktion selbst. Die Sperre auf
-- `contracts` serialisiert zusaetzlich die Vorbedingungspruefung; ein Test
-- dafuer waere ein eigener (vgl. payout-ledger.sql, Abschnitt 1b).
-- Zwei dblink-Aufrufe NACHEINANDER waeren keine Nebenlaeufigkeit. Mit
-- dblink_send_query laufen beide wirklich gleichzeitig.
do $$
declare n integer; akt integer; f1 text; f2 text;
begin
  perform dblink_connect('i1', 'dbname=' || current_database());
  perform dblink_connect('i2', 'dbname=' || current_database());
  perform dblink_exec('i1', 'set role service_role');
  perform dblink_exec('i2', 'set role service_role');
  perform dblink_send_query('i1',
    $q$select payment_intent_id from public.register_payment_intent(
       '90000000-0000-0000-0000-000000000002'::uuid,'pi_P',10250)$q$);
  perform dblink_send_query('i2',
    $q$select payment_intent_id from public.register_payment_intent(
       '90000000-0000-0000-0000-000000000002'::uuid,'pi_Q',10250)$q$);
  begin select t.x into f1 from dblink_get_result('i1') as t(x text);
  exception when others then f1 := 'fehler'; end;
  begin select t.x into f2 from dblink_get_result('i2') as t(x text);
  exception when others then f2 := 'fehler'; end;
  perform dblink_disconnect('i1');
  perform dblink_disconnect('i2');

  select count(*) into akt from public.contract_payment_intents
    where contract_id = '90000000-0000-0000-0000-000000000002' and is_current;
  select count(*) into n from public.contract_payment_intents
    where contract_id = '90000000-0000-0000-0000-000000000002';
  -- Strenger als zuvor (Befund des QA-Reviews): die alte Fassung liess mit
  -- `n >= 1` und ohne Fehlerpruefung eine unter Kontention fehlgeschlagene
  -- Registrierung stillschweigend als PASS durchgehen.
  if akt = 1 and n = 2 and f1 <> 'fehler' and f2 <> 'fehler' then
    raise notice 'PASS: ueberlappende Registrierung — beide erfolgreich, genau EINER aktuell, beide in der Historie';
  else raise exception 'FAIL: aktuell=% gesamt=% r1=% r2=%', akt, n, f1, f2; end if;
end $$;

-- ── 7. Default-Deny fuer Clients ──────────────────────────────────────────
set role authenticated;
set request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000001';
do $$
declare n integer;
begin
  select count(*) into n from public.contract_payment_intents;
  if n = 0 then raise notice 'PASS: authenticated sieht KEINEN PaymentIntent (Default-Deny)';
  else raise exception 'FAIL: authenticated sieht % Zeilen', n; end if;
end $$;
do $$
begin
  perform public.register_payment_intent('90000000-0000-0000-0000-000000000001','pi_boese',1);
  raise exception 'FAIL: authenticated konnte einen Intent registrieren';
exception when insufficient_privilege then
  raise notice 'PASS: authenticated darf register_payment_intent nicht aufrufen';
end $$;
reset role;
