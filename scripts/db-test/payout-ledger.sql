-- Payout-Ledger (Migration 0650) gegen echtes Postgres.
--
-- Der FakeSupabase-Recorder in supabase/tests/ wertet Filter NICHT aus. Er kann
-- daher belegen, WELCHE Abfrage der Handler baut, aber nicht, was Postgres
-- daraus macht. Genau das prueft diese Datei -- inklusive ECHTER
-- Nebenlaeufigkeit ueber dblink (zwei getrennte Verbindungen, nicht zwei
-- Aufrufe nacheinander in derselben Sitzung).
create extension if not exists dblink;

\set kunde   '''c0000000-0000-0000-0000-000000000001'''
\set fremder '''c0000000-0000-0000-0000-000000000002'''
\set anb     '''a0000000-0000-0000-0000-000000000001'''
\set job     '''50000000-0000-0000-0000-000000000001'''
\set vertrag '''70000000-0000-0000-0000-000000000001'''

insert into auth.users (id, email) values
  (:kunde,'kunde.payout@example.com'), (:fremder,'fremd.payout@example.com'), (:anb,'anb.payout@example.com')
  on conflict do nothing;
insert into public.profiles (id, role, display_name, email_verified_at) values
  (:kunde,'customer','K',now()), (:fremder,'customer','F',now()), (:anb,'provider','A',now())
  on conflict (id) do update set email_verified_at = now();
insert into public.provider_profiles (id, stripe_account_id) values (:anb,'acct_test_1')
  on conflict (id) do update set stripe_account_id = 'acct_test_1';
insert into public.jobs (id, customer_id, title, description, category_id, status)
  values (:job, :kunde, 'Bad', 'Test', 'sanitaer', 'active') on conflict (id) do nothing;
insert into public.contracts (
  id, job_id, customer_id, provider_id, price_gross, customer_total, provider_payout,
  status, escrow_captured_at, customer_signed_at, provider_signed_at
) values (
  :vertrag, :job, :kunde, :anb, 100, 102.50, 92.00, 'active', now(), now(), now()
) on conflict (id) do nothing;

insert into public.contracts (
  id, job_id, customer_id, provider_id, price_gross, customer_total, provider_payout,
  status, escrow_captured_at, customer_signed_at, provider_signed_at
) values (
  '70000000-0000-0000-0000-000000000002', :job, :kunde, :anb, 100, 102.50, 92.00,
  'active', now(), now(), now()
) on conflict (id) do nothing;

-- ── 1. ECHT ueberlappende Beanspruchung ───────────────────────────────────
-- Zwei dblink-Aufrufe NACHEINANDER waeren keine Nebenlaeufigkeit -- das war der
-- Befund des QA-Reviews an der ersten Fassung dieses Tests: sie lief auch dann
-- gruen, wenn man die Zeilensperre aus payout_claim entfernte. Mit
-- dblink_send_query laufen beide Anfragen wirklich gleichzeitig; das Ergebnis
-- wird erst danach eingesammelt.
do $$
declare a uuid; b uuid; n integer;
  q text := $q$select id from public.payout_claim(
              '70000000-0000-0000-0000-000000000001'::uuid,
              'c0000000-0000-0000-0000-000000000001'::uuid)$q$;
begin
  perform dblink_connect('p1', 'dbname=' || current_database());
  perform dblink_connect('p2', 'dbname=' || current_database());
  perform dblink_send_query('p1', q);
  perform dblink_send_query('p2', q);
  select t.id into a from dblink_get_result('p1') as t(id uuid);
  select t.id into b from dblink_get_result('p2') as t(id uuid);
  perform dblink_disconnect('p1');
  perform dblink_disconnect('p2');

  select count(*) into n from public.payout_operations
    where contract_id = '70000000-0000-0000-0000-000000000001';
  if a = b and n = 1 then
    raise notice 'PASS: zwei ueberlappende Anfragen erhalten dieselbe Operation, genau eine Zeile';
  else
    raise exception 'FAIL: a=% b=% zeilen=%', a, b, n;
  end if;
end $$;

-- ── 1b. Was die Zeilensperre tatsaechlich schuetzt ────────────────────────
-- `select ... for update` auf contracts serialisiert die Vorbedingungspruefung
-- gegen eine GLEICHZEITIGE Vertragsaenderung. Ohne sie koennte payout_claim
-- einen Vertrag beanspruchen, dessen Erstattung gerade nebenan verbucht wird.
-- Hier wird genau das nachgestellt: eine offene Transaktion aendert den
-- Vertrag, die Beanspruchung laeuft parallel an und muss danach ablehnen.
do $$
declare fehler text;
begin
  perform dblink_connect('w1', 'dbname=' || current_database());
  perform dblink_connect('w2', 'dbname=' || current_database());
  -- w1: Erstattung verbuchen, aber NICHT committen.
  perform dblink_exec('w1', 'begin');
  perform dblink_exec('w1', $x$set local role service_role$x$);
  perform dblink_exec('w1', $x$update public.contracts set customer_refunded_amount = 50
                              where id = '70000000-0000-0000-0000-000000000002'$x$);
  -- w2: Beanspruchung anstossen -- blockiert an der Zeilensperre.
  perform dblink_send_query('w2', $x$select id from public.payout_claim(
    '70000000-0000-0000-0000-000000000002'::uuid,
    'c0000000-0000-0000-0000-000000000001'::uuid)$x$);
  perform pg_sleep(0.3);
  perform dblink_exec('w1', 'commit');
  begin
    perform * from dblink_get_result('w2') as t(id uuid);
    fehler := 'keine';
  exception when others then
    fehler := sqlerrm;
  end;
  perform dblink_disconnect('w1');
  perform dblink_disconnect('w2');

  if fehler like '%already_refunded%' then
    raise notice 'PASS: Beanspruchung sieht die nebenlaeufige Erstattung und lehnt ab';
  else
    raise exception 'FAIL: erwartete Ablehnung wegen Erstattung, bekam: %', fehler;
  end if;
end $$;

-- ── 2. Versuchszaehler steigt, Idempotency-Key bleibt stabil ──────────────
do $$
declare k1 text; k2 text; v integer;
begin
  select idempotency_key, attempt_count into k1, v from public.payout_operations
    where contract_id = '70000000-0000-0000-0000-000000000001';
  perform public.payout_claim('70000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001');
  select idempotency_key, attempt_count into k2, v from public.payout_operations
    where contract_id = '70000000-0000-0000-0000-000000000001';
  if k1 = k2 and v >= 3 then
    raise notice 'PASS: Idempotency-Key stabil ueber Wiederholungen, Versuche=%', v;
  else raise exception 'FAIL: key1=% key2=% versuche=%', k1, k2, v; end if;
end $$;

-- ── 3. Fremder Nutzer wird abgewiesen ─────────────────────────────────────
do $$
begin
  perform public.payout_claim('70000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002');
  raise exception 'FAIL: Fremder konnte beanspruchen';
exception when sqlstate 'P0001' then
  raise notice 'PASS: Fremder kann die Auszahlung nicht beanspruchen';
end $$;

-- ── 4. Betrag in ganzen Cent, aus der DB gerechnet ────────────────────────
do $$
declare c integer; d text;
begin
  select amount_cents, destination_account_id into c, d from public.payout_operations
    where contract_id = '70000000-0000-0000-0000-000000000001';
  if c = 9200 and d = 'acct_test_1' then
    raise notice 'PASS: Betrag 9200 Cent und Zielkonto aus der Datenbank';
  else raise exception 'FAIL: cents=% ziel=%', c, d; end if;
end $$;

-- Ab hier unter service_role: exakt der Weg, den die Edge Function nimmt.
-- Der contracts-Guard (0300/0630) laesst nur diese Rolle Statusspalten setzen.
set role service_role;

-- ── 5. Finalisieren: Vertrag, Job und PStTG genau einmal ──────────────────
do $$
declare op uuid; st text; rel timestamptz; js text; z1 numeric; z2 numeric;
begin
  select id into op from public.payout_operations where contract_id = '70000000-0000-0000-0000-000000000001';
  perform public.payout_finalize(op, 'tr_echt_1');
  select status, escrow_released_at into st, rel from public.contracts
    where id = '70000000-0000-0000-0000-000000000001';
  select status into js from public.jobs where id = '50000000-0000-0000-0000-000000000001';
  select coalesce(pstg_tx_count,0) into z1 from public.profiles
    where id = 'a0000000-0000-0000-0000-000000000001';
  if st = 'completed' and rel is not null and js = 'completed' and z1 > 0 then
    raise notice 'PASS: Finalisieren schliesst Vertrag und Auftrag, PStTG-Zaehler=%', z1;
  else raise exception 'FAIL: status=% rel=% job=% pstg=%', st, rel, js, z1; end if;

  -- ZWEITES Finalisieren: darf NICHTS mehr bewegen.
  perform public.payout_finalize(op, 'tr_echt_1');
  select coalesce(pstg_tx_count,0) into z2 from public.profiles
    where id = 'a0000000-0000-0000-0000-000000000001';
  if z1 = z2 then
    raise notice 'PASS: erneutes Finalisieren zaehlt PStTG NICHT erneut (% = %)', z1, z2;
  else raise exception 'FAIL: PStTG doppelt gezaehlt: % -> %', z1, z2; end if;
end $$;

-- ── 6. Abweichende Transfer-ID sperrt statt zu ueberschreiben ─────────────
do $$
declare op uuid; st text;
begin
  select id into op from public.payout_operations where contract_id = '70000000-0000-0000-0000-000000000001';
  update public.payout_operations set status = 'transferred', finalized_at = null where id = op;
  select (public.payout_finalize(op, 'tr_ANDERER')).status into st;
  if st = 'manual_review' then
    raise notice 'PASS: abweichende Transfer-ID sperrt die Operation (manual_review)';
  else raise exception 'FAIL: status=%', st; end if;
end $$;

-- ── 7. Beanspruchen nach Freigabe ist gesperrt ────────────────────────────
do $$
begin
  perform public.payout_claim('70000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001');
  raise exception 'FAIL: bereits freigegebener Vertrag konnte erneut beansprucht werden';
exception when sqlstate 'P0001' then
  raise notice 'PASS: bereits freigegebener Vertrag kann nicht erneut beansprucht werden';
end $$;

reset role;

-- ── 8. RLS: kein Client-Zugriff auf die Tabelle ───────────────────────────
-- "set role authenticated" ist zwingend: als Tabelleneigentuemer greift RLS nicht.
set role authenticated;
set request.jwt.claim.sub = 'c0000000-0000-0000-0000-000000000001';
do $$
declare n integer;
begin
  select count(*) into n from public.payout_operations;
  if n = 0 then raise notice 'PASS: authenticated sieht KEINE Auszahlungs-Operation (Default-Deny)';
  else raise exception 'FAIL: authenticated sieht % Zeilen', n; end if;
end $$;
do $$
begin
  insert into public.payout_operations (contract_id, amount_cents, destination_account_id, idempotency_key, transfer_group)
    values ('70000000-0000-0000-0000-000000000001', 1, 'acct_x', 'k', 'g');
  raise exception 'FAIL: authenticated konnte eine Operation anlegen';
exception when insufficient_privilege or check_violation then
  raise notice 'PASS: authenticated kann keine Auszahlungs-Operation anlegen';
end $$;
do $$
begin
  perform public.payout_claim('70000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001');
  raise exception 'FAIL: authenticated konnte payout_claim aufrufen';
exception when insufficient_privilege then
  raise notice 'PASS: authenticated darf payout_claim nicht aufrufen';
end $$;
reset role;

-- ── 9. Schreibschutz: Anbieter darf sein Auszahlungsziel nicht selbst setzen ─
set role authenticated;
set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
do $$
begin
  update public.provider_profiles set stripe_account_id = 'acct_des_angreifers'
    where id = 'a0000000-0000-0000-0000-000000000001';
  raise exception 'FAIL: Anbieter konnte sein Auszahlungsziel selbst setzen';
exception when raise_exception then
  if sqlerrm like 'FAIL:%' then raise;
  else raise notice 'PASS: Anbieter kann stripe_account_id nicht selbst setzen (Auszahlungsziel geschuetzt)'; end if;
end $$;
reset role;
