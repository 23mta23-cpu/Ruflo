-- Abnahmefrist und fiktive Abnahme nach § 640 Abs. 2 BGB (Migration 0770)
--
-- Anlass: Die Website versprach "Meldet er sich nicht, laeuft die Frist ab und
-- die Freigabe erfolgt automatisch". Es gab davon nichts.
--
-- Geprueft wird jede Voraussetzung EINZELN. Grund ist die Lehre aus 0710:
-- zwei Bedingungen, die dieselben Faelle abdecken, sind EINE Bedingung — die
-- Mutation "erste Bedingung entfernt" blieb damals gruen, weil die zweite
-- dieselben Testfaelle abfing. Fuer jede Teilbedingung gibt es hier deshalb
-- einen Fall, den NUR sie abfaengt.
--
-- (AA) Nur der Anbieter kann Fertigstellung melden
-- (AB) Melden setzt Frist UND haelt den Hinweistext fest
-- (AC) Der Hinweis benennt die Folge — sonst greift § 640 Abs. 2 S. 2 nicht
-- (AD) Zweites Melden verlaengert die Frist nicht
-- (AE) Vor Fristablauf: keine fiktive Abnahme
-- (AF) Nach Fristablauf: fiktive Abnahme
-- (AG) Ohne gemeldete Fertigstellung: nie (auch mit gesetzter Frist)
-- (AH) Ohne Hinweistext: nie
-- (AI) Offener Mangel haelt die Frist auf
-- (AJ) Erledigter Mangel haelt sie NICHT auf
-- (AK) payout_claim mit fiktiver Abnahme verlangt, dass sie eingetreten ist
-- (AL) payout_claim fiktiv mit Aufrufer ist verboten
-- (AM) Der normale Kundenweg funktioniert unveraendert weiter
-- (AN) Ein Fremder kommt weiterhin nicht durch
-- (AO) Die fiktive Auszahlung wird als solche vermerkt

\set kunde   '''cf000000-0000-0000-0000-000000000001'''
\set fremder '''cf000000-0000-0000-0000-000000000002'''
\set anb     '''af000000-0000-0000-0000-000000000001'''
\set job     '''5f000000-0000-0000-0000-000000000001'''
\set v1      '''7f000000-0000-0000-0000-000000000001'''
\set v2      '''7f000000-0000-0000-0000-000000000002'''
\set v3      '''7f000000-0000-0000-0000-000000000003'''

reset role;
insert into auth.users (id, email) values
  (:kunde,'k.abnahme@example.com'), (:fremder,'f.abnahme@example.com'), (:anb,'a.abnahme@example.com')
  on conflict do nothing;
insert into public.profiles (id, role, display_name, email_verified_at) values
  (:kunde,'customer','K',now()), (:fremder,'customer','F',now()), (:anb,'provider','A',now())
  on conflict (id) do update set email_verified_at = now();
insert into public.provider_profiles (id, stripe_account_id) values (:anb,'acct_abnahme_1')
  on conflict (id) do update set stripe_account_id = 'acct_abnahme_1';
insert into public.jobs (id, customer_id, title, description, category_id, status)
  values (:job, :kunde, 'Heizung', 'Vier Ventile tauschen', 'sanitaer', 'active')
  on conflict (id) do nothing;

insert into public.contracts (
  id, job_id, customer_id, provider_id, price_gross, customer_total, provider_payout,
  status, escrow_captured_at, customer_signed_at, provider_signed_at
) values
  (:v1, :job, :kunde, :anb, 240, 246.00, 220.80, 'active', now(), now(), now()),
  (:v2, :job, :kunde, :anb, 240, 246.00, 220.80, 'active', now(), now(), now()),
  (:v3, :job, :kunde, :anb, 240, 246.00, 220.80, 'active', now(), now(), now())
  on conflict (id) do nothing;

-- ── AA: nur der Anbieter meldet ────────────────────────────────────────────
set role authenticated;
set request.jwt.claim.sub = 'cf000000-0000-0000-0000-000000000001';  -- der Kunde
do $$
declare fehler text;
begin
  begin
    perform public.fertigstellung_melden('7f000000-0000-0000-0000-000000000001');
    raise exception 'FAIL AA: der Kunde konnte Fertigstellung melden';
  exception when sqlstate 'P0001' then
    get stacked diagnostics fehler = message_text;
    if fehler <> 'forbidden' then raise exception 'FAIL AA: falscher Fehler %', fehler; end if;
    raise notice 'PASS AA: nur der Anbieter kann Fertigstellung melden';
  end;
end $$;

-- ── AB/AC/AD: melden, Hinweis, Idempotenz ──────────────────────────────────
set request.jwt.claim.sub = 'af000000-0000-0000-0000-000000000001';  -- der Anbieter
do $$
declare c public.contracts%rowtype; erste timestamptz;
begin
  select * into c from public.fertigstellung_melden('7f000000-0000-0000-0000-000000000001');

  if c.fertig_gemeldet_am is null or c.abnahme_faellig_am is null then
    raise exception 'FAIL AB: Frist wurde nicht gesetzt';
  end if;
  if c.abnahme_faellig_am::date <> (now() + (public.abnahme_frist_tage() || ' days')::interval)::date then
    raise exception 'FAIL AB: Frist liegt nicht bei % Tagen', public.abnahme_frist_tage();
  end if;
  if c.abnahme_hinweis is null or c.abnahme_hinweis_fassung is null then
    raise exception 'FAIL AB: der Hinweistext wurde nicht festgehalten';
  end if;
  raise notice 'PASS AB: Melden setzt die Frist und haelt den Hinweistext fest';

  -- § 640 Abs. 2 S. 2 verlangt einen Hinweis auf die FOLGE. Ein Text, der nur
  -- um Freigabe bittet, erfuellt den Tatbestand nicht — dann traete die
  -- Wirkung nicht ein, und die Auszahlung waere ohne Rechtsgrund.
  if position('640' in c.abnahme_hinweis) = 0
     or position('abgenommen' in c.abnahme_hinweis) = 0
     or position('ausgezahlt' in c.abnahme_hinweis) = 0
     or position('Mangel' in c.abnahme_hinweis) = 0 then
    raise exception 'FAIL AC: der Hinweis benennt die Folge nicht vollstaendig: %', c.abnahme_hinweis;
  end if;
  raise notice 'PASS AC: der Hinweis benennt Norm, Wirkung, Auszahlung und den Weg zum Mangel';

end $$;

-- ── AD: zweites Melden verlaengert die Frist nicht ─────────────────────────
-- ACHTUNG, teuer gelernt: die erste Fassung rief hier einfach zweimal
-- fertigstellung_melden auf und verglich die Fristen. Der Test blieb unter der
-- Mutation "Idempotenz-Rueckgabe entfernt" GRUEN — `now()` ist in Postgres die
-- TRANSAKTIONSZEIT, beide Aufrufe im selben Block berechneten also dieselbe
-- Frist. Ein Wertvergleich kann keine Idempotenz belegen, wenn beide Seiten
-- ohnehin denselben Wert ergeben.
-- Deshalb wird die gespeicherte Frist zwischendurch verschoben: laeuft das
-- zweite Melden durch, rechnet es sie auf now()+14d zurueck, und das ist
-- messbar verschieden.
reset role;
update public.contracts set abnahme_faellig_am = now() - interval '3 days'
 where id = '7f000000-0000-0000-0000-000000000001';

set role authenticated;
set request.jwt.claim.sub = 'af000000-0000-0000-0000-000000000001';
do $$
declare c public.contracts%rowtype; vorher timestamptz;
begin
  select abnahme_faellig_am into vorher from public.contracts
   where id = '7f000000-0000-0000-0000-000000000001';

  select * into c from public.fertigstellung_melden('7f000000-0000-0000-0000-000000000001');

  if c.abnahme_faellig_am <> vorher then
    raise exception 'FAIL AD: zweites Melden hat die Frist von % auf % verschoben',
      vorher, c.abnahme_faellig_am;
  end if;
  raise notice 'PASS AD: zweites Melden verlaengert eine laufende Frist nicht';
end $$;

-- ── AE: vor Ablauf keine fiktive Abnahme ───────────────────────────────────
-- AD hat die Frist zum Messen in die Vergangenheit gesetzt; hier wird wieder
-- eine laufende Frist gebraucht.
reset role;
update public.contracts set abnahme_faellig_am = now() + interval '10 days'
 where id = '7f000000-0000-0000-0000-000000000001';
do $$
begin
  if public.abnahme_fiktiv_eingetreten('7f000000-0000-0000-0000-000000000001') then
    raise exception 'FAIL AE: fiktive Abnahme schon vor Fristablauf';
  end if;
  raise notice 'PASS AE: vor Fristablauf tritt sie nicht ein';
end $$;

-- ── AF: nach Ablauf tritt sie ein ──────────────────────────────────────────
reset role;
update public.contracts set abnahme_faellig_am = now() - interval '1 minute'
 where id = '7f000000-0000-0000-0000-000000000001';
do $$
begin
  if not public.abnahme_fiktiv_eingetreten('7f000000-0000-0000-0000-000000000001') then
    raise exception 'FAIL AF: nach Fristablauf trat sie nicht ein';
  end if;
  if not exists (select 1 from public.abnahme_faellige_vertraege(100)
                  where contract_id = '7f000000-0000-0000-0000-000000000001') then
    raise exception 'FAIL AF: der faellige Vertrag fehlt in der Liste';
  end if;
  raise notice 'PASS AF: nach Fristablauf tritt sie ein und der Vertrag steht in der Liste';
end $$;

-- ── AG: ohne gemeldete Fertigstellung nie ──────────────────────────────────
-- Der Fall, den NUR die Bedingung "fertig_gemeldet_am is not null" abfaengt:
-- eine Frist steht, aber gemeldet wurde nie. Ohne diese Teilpruefung waere
-- sie durch die Fristpruefung gedeckt und damit unbelegt.
update public.contracts
   set abnahme_faellig_am = now() - interval '1 minute',
       abnahme_hinweis    = 'irgendein Text',
       fertig_gemeldet_am = null
 where id = '7f000000-0000-0000-0000-000000000002';
do $$
begin
  if public.abnahme_fiktiv_eingetreten('7f000000-0000-0000-0000-000000000002') then
    raise exception 'FAIL AG: fiktive Abnahme ohne gemeldete Fertigstellung';
  end if;
  raise notice 'PASS AG: ohne gemeldete Fertigstellung tritt sie nicht ein';
end $$;

-- ── AH: ohne Hinweistext nie ───────────────────────────────────────────────
-- Der Fall, den NUR "abnahme_hinweis is not null" abfaengt: alles gemeldet,
-- Frist abgelaufen, aber der Hinweis nach § 640 Abs. 2 S. 2 fehlt.
update public.contracts
   set fertig_gemeldet_am = now() - interval '20 days',
       abnahme_faellig_am = now() - interval '6 days',
       abnahme_hinweis    = null
 where id = '7f000000-0000-0000-0000-000000000002';
do $$
begin
  if public.abnahme_fiktiv_eingetreten('7f000000-0000-0000-0000-000000000002') then
    raise exception 'FAIL AH: fiktive Abnahme ohne belegten Hinweis in Textform';
  end if;
  raise notice 'PASS AH: ohne belegten Hinweis tritt sie nicht ein';
end $$;

-- ── AI/AJ: der gemeldete Mangel ────────────────────────────────────────────
insert into public.disputes (contract_id, reporter_id, case_id, category, description)
values ('7f000000-0000-0000-0000-000000000001', 'cf000000-0000-0000-0000-000000000001',
        'FALL-ABNAHME-1', 'quality',
        'Zwei der vier Ventile tropfen weiterhin, das dritte sitzt schief.');
do $$
begin
  if public.abnahme_fiktiv_eingetreten('7f000000-0000-0000-0000-000000000001') then
    raise exception 'FAIL AI: offener Mangel hielt die fiktive Abnahme nicht auf';
  end if;
  raise notice 'PASS AI: ein offener Mangel haelt die fiktive Abnahme auf';
end $$;

update public.disputes set status = 'resolved' where case_id = 'FALL-ABNAHME-1';
do $$
begin
  if not public.abnahme_fiktiv_eingetreten('7f000000-0000-0000-0000-000000000001') then
    raise exception 'FAIL AJ: erledigter Mangel hielt sie weiterhin auf';
  end if;
  raise notice 'PASS AJ: ein erledigter Mangel haelt sie nicht mehr auf';
end $$;

-- ── AK: payout_claim fiktiv verlangt den Eintritt ──────────────────────────
-- v3 hat nichts gemeldet und keine Frist.
do $$
declare fehler text;
begin
  begin
    perform public.payout_claim('7f000000-0000-0000-0000-000000000003', null, true);
    raise exception 'FAIL AK: Auszahlung ohne eingetretene fiktive Abnahme';
  exception when sqlstate 'P0001' then
    get stacked diagnostics fehler = message_text;
    if fehler <> 'abnahme_nicht_eingetreten' then
      raise exception 'FAIL AK: falscher Fehler %', fehler;
    end if;
    raise notice 'PASS AK: ohne eingetretene fiktive Abnahme keine Auszahlung';
  end;
end $$;

-- ── AL: fiktiver Weg mit Aufrufer ist verboten ─────────────────────────────
-- Sonst waere der fiktive Zweig ein Weg, die Eigentumspruefung zu umgehen:
-- ein Fremder setzte einfach p_fiktive_abnahme = true.
do $$
declare fehler text;
begin
  begin
    perform public.payout_claim('7f000000-0000-0000-0000-000000000001',
                                'cf000000-0000-0000-0000-000000000002', true);
    raise exception 'FAIL AL: fiktiver Weg mit Aufrufer war erlaubt';
  exception when sqlstate 'P0001' then
    get stacked diagnostics fehler = message_text;
    if fehler <> 'forbidden' then raise exception 'FAIL AL: falscher Fehler %', fehler; end if;
    raise notice 'PASS AL: der fiktive Weg laesst keinen Aufrufer zu';
  end;
end $$;

-- ── AN: der Fremde kommt weiterhin nicht durch ─────────────────────────────
do $$
declare fehler text;
begin
  begin
    perform public.payout_claim('7f000000-0000-0000-0000-000000000001',
                                'cf000000-0000-0000-0000-000000000002');
    raise exception 'FAIL AN: ein Fremder konnte die Auszahlung beanspruchen';
  exception when sqlstate 'P0001' then
    get stacked diagnostics fehler = message_text;
    if fehler <> 'forbidden' then raise exception 'FAIL AN: falscher Fehler %', fehler; end if;
    raise notice 'PASS AN: ein Fremder kann die Auszahlung weiterhin nicht beanspruchen';
  end;
end $$;

-- ── AO: die fiktive Auszahlung wird vermerkt ───────────────────────────────
do $$
declare op public.payout_operations; c public.contracts%rowtype;
begin
  select * into op from public.payout_claim('7f000000-0000-0000-0000-000000000001', null, true);
  if op.id is null then raise exception 'FAIL AO: keine Operation entstanden'; end if;
  select * into c from public.contracts where id = '7f000000-0000-0000-0000-000000000001';
  if c.abnahme_fiktiv_am is null then
    raise exception 'FAIL AO: die Auszahlung ohne ausdrueckliche Freigabe wurde nicht vermerkt';
  end if;
  raise notice 'PASS AO: die fiktive Auszahlung ist als solche vermerkt';
end $$;

-- ── AM: der Kundenweg funktioniert unveraendert ────────────────────────────
-- Die Migration hat payout_claim ersetzt. Diese Pruefung belegt, dass der
-- bestehende 2-Argument-Aufruf weiterhin genau so wirkt wie vorher.
do $$
declare op public.payout_operations;
begin
  select * into op from public.payout_claim('7f000000-0000-0000-0000-000000000003',
                                            'cf000000-0000-0000-0000-000000000001');
  if op.id is null or op.amount_cents <> 22080 then
    raise exception 'FAIL AM: der Kundenweg lieferte % Cent', op.amount_cents;
  end if;
  raise notice 'PASS AM: der Kundenweg wirkt unveraendert weiter';
end $$;
