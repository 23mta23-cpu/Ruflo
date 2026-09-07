-- Vorgeschlagene Leistungen (Migration 0780)
--
-- Anlass: Founder am Geraet — "was wenn eine Sache oder Arbeit angeboten wird,
-- was wir noch nicht drin stehen haben?". Es gab dafuer nichts.
--
-- (LA) Ein Anbieter legt einen eigenen Vorschlag an
-- (LB) Auf FREMDEN Namen geht nicht
-- (LC) Derselbe Wortlaut zweimal wird abgewiesen (sonst zaehlt die
--      Haeufigkeit falsch, und die ist der einzige Zweck der Tabelle)
-- (LD) Gross-/Kleinschreibung und Leerzeichen zaehlen als derselbe Wunsch
-- (LE) Zu kurzer Text wird abgewiesen
-- (LF) Zu langer Text wird abgewiesen
-- (LG) Man liest nur die eigenen Vorschlaege

\set anb1 '''ab000000-0000-0000-0000-000000000001'''
\set anb2 '''ab000000-0000-0000-0000-000000000002'''

reset role;
insert into auth.users (id, email) values
  (:anb1,'w1@example.com'), (:anb2,'w2@example.com') on conflict do nothing;
insert into public.profiles (id, role, display_name, email_verified_at) values
  (:anb1,'provider','W1',now()), (:anb2,'provider','W2',now())
  on conflict (id) do update set email_verified_at = now();

set role authenticated;
set request.jwt.claim.sub = 'ab000000-0000-0000-0000-000000000001';

do $$
begin
  insert into public.leistungs_wuensche (provider_id, text)
  values ('ab000000-0000-0000-0000-000000000001', 'Schornsteinfeger');
  raise notice 'PASS LA: Anbieter legt eigenen Vorschlag an';
end $$;

do $$
begin
  begin
    insert into public.leistungs_wuensche (provider_id, text)
    values ('ab000000-0000-0000-0000-000000000002', 'Auf fremden Namen');
    raise exception 'FAIL LB: Vorschlag auf fremden Namen war moeglich';
  exception when insufficient_privilege or check_violation then
    raise notice 'PASS LB: kein Vorschlag auf fremden Namen';
  end;
end $$;

do $$
begin
  begin
    insert into public.leistungs_wuensche (provider_id, text)
    values ('ab000000-0000-0000-0000-000000000001', 'Schornsteinfeger');
    raise exception 'FAIL LC: derselbe Wortlaut kam ein zweites Mal durch';
  exception when unique_violation then
    raise notice 'PASS LC: derselbe Wortlaut wird nur einmal gezaehlt';
  end;
end $$;

do $$
begin
  begin
    -- Gleicher Wunsch, anders geschrieben. Ohne lower(btrim(...)) im Index
    -- zaehlte das als zweiter Wunsch und verfaelschte die Haeufigkeit.
    insert into public.leistungs_wuensche (provider_id, text)
    values ('ab000000-0000-0000-0000-000000000001', '  SCHORNSTEINFEGER ');
    raise exception 'FAIL LD: andere Schreibweise galt als neuer Wunsch';
  exception when unique_violation then
    raise notice 'PASS LD: Schreibweise und Leerzeichen aendern den Wunsch nicht';
  end;
end $$;

do $$
begin
  begin
    insert into public.leistungs_wuensche (provider_id, text)
    values ('ab000000-0000-0000-0000-000000000001', ' a ');
    raise exception 'FAIL LE: zu kurzer Text kam durch';
  exception when check_violation then
    raise notice 'PASS LE: zu kurzer Text wird abgewiesen';
  end;
end $$;

do $$
begin
  begin
    insert into public.leistungs_wuensche (provider_id, text)
    values ('ab000000-0000-0000-0000-000000000001', repeat('x', 121));
    raise exception 'FAIL LF: zu langer Text kam durch';
  exception when check_violation then
    raise notice 'PASS LF: zu langer Text wird abgewiesen';
  end;
end $$;

-- LG: der zweite Anbieter legt etwas an und sieht den ersten NICHT.
set request.jwt.claim.sub = 'ab000000-0000-0000-0000-000000000002';
do $$
declare n integer;
begin
  insert into public.leistungs_wuensche (provider_id, text)
  values ('ab000000-0000-0000-0000-000000000002', 'Photovoltaik');
  select count(*) into n from public.leistungs_wuensche;
  if n <> 1 then
    raise exception 'FAIL LG: Anbieter 2 sah % Zeilen statt nur der eigenen', n;
  end if;
  raise notice 'PASS LG: jeder sieht nur die eigenen Vorschlaege';
end $$;
reset role;
