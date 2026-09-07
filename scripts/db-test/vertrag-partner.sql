-- Namen der Vertragsparteien (Migration 0800)
--
-- Anlass: Der „Digitale Vertrag" nannte den Auftragnehmer „Anbieter". Die
-- Abfrage lud den Anbieter gar nicht.
--
-- Warum eine SECURITY-DEFINER-Funktion und kein Join: in provider_profiles
-- stehen steuer_id und stripe_account_id. Eine Zeilen-Policy gaebe immer die
-- GANZE Zeile frei. Genau deshalb wird hier scharf geprueft, dass die
-- Funktion nichts herausgibt, was sie nicht soll.
--
-- (VA) Der Kunde sieht die Namen seines eigenen Vertrags
-- (VB) Der Anbieter ebenfalls
-- (VC) Ein Fremder sieht NICHTS — auch nicht mit geratener Vertrags-ID
-- (VD) Ein Fremder bekommt auch bei gemischter Liste nur die eigenen Zeilen
-- (VE) Fehlender Firmenname kommt als NULL, nicht als leerer Text
-- (VF) Die Funktion gibt Namen zurueck, auch wenn der Anbieter inaktiv ist
-- (VG) anon darf die Funktion gar nicht ausfuehren

\set kunde   '''cb000000-0000-0000-0000-000000000001'''
\set fremder '''cb000000-0000-0000-0000-000000000002'''
\set anb     '''ab100000-0000-0000-0000-000000000001'''
\set anbLeer '''ab100000-0000-0000-0000-000000000002'''
\set job     '''5b000000-0000-0000-0000-000000000001'''
\set job2    '''5b000000-0000-0000-0000-000000000002'''
\set v1      '''7b000000-0000-0000-0000-000000000001'''
\set v2      '''7b000000-0000-0000-0000-000000000002'''

reset role;
insert into auth.users (id, email) values
  (:kunde,'k.vp@example.com'), (:fremder,'f.vp@example.com'),
  (:anb,'a.vp@example.com'), (:anbLeer,'al.vp@example.com') on conflict do nothing;
insert into public.profiles (id, role, full_name, display_name, email_verified_at) values
  (:kunde,'customer','Tayyip Ates','TA',now()),
  (:fremder,'customer','Fremde Person','FP',now()),
  (:anb,'provider','A','A',now()),
  (:anbLeer,'provider','B','B',now())
  on conflict (id) do update set full_name = excluded.full_name, email_verified_at = now();
insert into public.provider_profiles (id, business_name, stripe_account_id, available, kyc_status) values
  (:anb,'Yilmaz Haustechnik GmbH','acct_vp_1', true, 'approved'),
  (:anbLeer,'   ','acct_vp_2', true, 'approved')
  on conflict (id) do update set business_name = excluded.business_name;
insert into public.jobs (id, customer_id, title, description, category_id, status) values
  (:job, :kunde, 'Steckdosen', 'Test', 'elektro', 'active'),
  (:job2, :kunde, 'Zweiter', 'Test', 'elektro', 'active') on conflict (id) do nothing;
insert into public.contracts (
  id, job_id, customer_id, provider_id, price_gross, customer_total, provider_payout,
  status, customer_signed_at, provider_signed_at
) values
  (:v1, :job,  :kunde, :anb,     200, 205.00, 184.00, 'pending', now(), now()),
  (:v2, :job2, :kunde, :anbLeer, 200, 205.00, 184.00, 'pending', now(), now())
  on conflict (id) do nothing;

-- ── VA: der Kunde ──────────────────────────────────────────────────────────
set role authenticated;
set request.jwt.claim.sub = 'cb000000-0000-0000-0000-000000000001';
do $$
declare r record;
begin
  select * into r from public.vertrag_partner(array['7b000000-0000-0000-0000-000000000001'::uuid]);
  if r.anbieter_name is distinct from 'Yilmaz Haustechnik GmbH' then
    raise exception 'FAIL VA: Anbietername war %', coalesce(r.anbieter_name, '<null>');
  end if;
  if r.kunde_name is distinct from 'Tayyip Ates' then
    raise exception 'FAIL VA: Kundenname war %', coalesce(r.kunde_name, '<null>');
  end if;
  raise notice 'PASS VA: der Kunde sieht beide Namen seines Vertrags';
end $$;

-- ── VB: der Anbieter ───────────────────────────────────────────────────────
set request.jwt.claim.sub = 'ab100000-0000-0000-0000-000000000001';
do $$
declare n integer;
begin
  select count(*) into n from public.vertrag_partner(array['7b000000-0000-0000-0000-000000000001'::uuid]);
  if n <> 1 then raise exception 'FAIL VB: der Anbieter sah % Zeilen', n; end if;
  raise notice 'PASS VB: der Anbieter sieht seinen eigenen Vertrag';
end $$;

-- ── VC: der Fremde ─────────────────────────────────────────────────────────
-- Der wichtigste Fall. Ohne die Aufrufer-Pruefung waere die Funktion ein
-- Namensverzeichnis: man muesste nur Vertrags-IDs durchprobieren.
set request.jwt.claim.sub = 'cb000000-0000-0000-0000-000000000002';
do $$
declare n integer;
begin
  select count(*) into n from public.vertrag_partner(array['7b000000-0000-0000-0000-000000000001'::uuid]);
  if n <> 0 then raise exception 'FAIL VC: ein Fremder bekam % Zeilen mit Namen', n; end if;
  raise notice 'PASS VC: ein Fremder bekommt keine Namen';
end $$;

-- ── VD: gemischte Liste ────────────────────────────────────────────────────
reset role;
insert into public.jobs (id, customer_id, title, description, category_id, status)
  values ('5b000000-0000-0000-0000-000000000003', 'cb000000-0000-0000-0000-000000000002',
          'Fremd', 'Test', 'elektro', 'active') on conflict (id) do nothing;
insert into public.contracts (
  id, job_id, customer_id, provider_id, price_gross, customer_total, provider_payout, status
) values ('7b000000-0000-0000-0000-000000000003', '5b000000-0000-0000-0000-000000000003',
          'cb000000-0000-0000-0000-000000000002', 'ab100000-0000-0000-0000-000000000001',
          100, 102.50, 92.00, 'pending') on conflict (id) do nothing;
set role authenticated;
set request.jwt.claim.sub = 'cb000000-0000-0000-0000-000000000001';
do $$
declare n integer;
begin
  select count(*) into n from public.vertrag_partner(array[
    '7b000000-0000-0000-0000-000000000001'::uuid,
    '7b000000-0000-0000-0000-000000000003'::uuid]);
  if n <> 1 then
    raise exception 'FAIL VD: aus einer gemischten Liste kamen % Zeilen statt 1', n;
  end if;
  raise notice 'PASS VD: aus einer gemischten Liste kommen nur die eigenen Vertraege';
end $$;

-- ── VE: leerer Firmenname ──────────────────────────────────────────────────
-- Der Bildschirm muss „kein Name hinterlegt" von einem Namen unterscheiden
-- koennen, sonst zeigt er wieder ein Wort, das wie ein Name aussieht.
do $$
declare r record;
begin
  select * into r from public.vertrag_partner(array['7b000000-0000-0000-0000-000000000002'::uuid]);
  if r.anbieter_name is not null then
    raise exception 'FAIL VE: leerer Firmenname kam als "%" durch', r.anbieter_name;
  end if;
  raise notice 'PASS VE: ein leerer Firmenname kommt als NULL';
end $$;

-- ── VF: inaktiver Anbieter ─────────────────────────────────────────────────
-- Die Policy auf provider_profiles verlangt available = true. Ein Vertrag muss
-- seine Partei aber dauerhaft nennen, gerade wenn sie sich abgemeldet hat.
reset role;
update public.provider_profiles set available = false, kyc_status = 'pending'
 where id = 'ab100000-0000-0000-0000-000000000001';
set role authenticated;
set request.jwt.claim.sub = 'cb000000-0000-0000-0000-000000000001';
do $$
declare r record;
begin
  select * into r from public.vertrag_partner(array['7b000000-0000-0000-0000-000000000001'::uuid]);
  if r.anbieter_name is distinct from 'Yilmaz Haustechnik GmbH' then
    raise exception 'FAIL VF: bei inaktivem Anbieter kam %', coalesce(r.anbieter_name, '<null>');
  end if;
  raise notice 'PASS VF: der Name bleibt auch bei inaktivem Anbieter lesbar';
end $$;

-- ── VG: anon ───────────────────────────────────────────────────────────────
reset role;
set role anon;
do $$
begin
  begin
    perform public.vertrag_partner(array['7b000000-0000-0000-0000-000000000001'::uuid]);
    raise exception 'FAIL VG: anon durfte die Funktion ausfuehren';
  exception when insufficient_privilege then
    raise notice 'PASS VG: anon darf die Funktion nicht ausfuehren';
  end;
end $$;
reset role;
