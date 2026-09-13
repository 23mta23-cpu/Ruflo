-- Die Warteliste fuer den Versand zeigt NUR bestaetigte Eintraege (0890).
--
-- ANLASS: Das Double-Opt-in aus 0360 setzt `confirmed_at`, und niemand wertete
-- die Spalte aus. Beim Start wuerde die Tabelle von Hand exportiert, und ein
-- Export enthaelt die unbestaetigten Adressen gleich mit — eine Werbemail an
-- diese waere ein Verstoss gegen § 7 Abs. 2 Nr. 3 UWG.

-- WV1: Die Ansicht filtert.
do $$
declare
  v_bestaetigt integer;
  v_offen      integer;
begin
  insert into public.waitlist (email, city, confirmed_at) values
    ('wv-bestaetigt@example.com', 'Köln', now()),
    ('wv-offen@example.com',      'Köln', null);

  select count(*) into v_bestaetigt from public.warteliste_versand
   where email = 'wv-bestaetigt@example.com';
  select count(*) into v_offen from public.warteliste_versand
   where email = 'wv-offen@example.com';

  if v_bestaetigt <> 1 then
    raise exception 'FAIL WV1: bestaetigter Eintrag fehlt in der Versand-Ansicht';
  end if;
  if v_offen <> 0 then
    raise exception 'FAIL WV1: UNBESTAETIGTER Eintrag steht in der Versand-Ansicht';
  end if;
  raise notice 'PASS WV1: die Versand-Ansicht zeigt nur bestaetigte Eintraege';
end $$;

-- WV2: Die Ansicht ist kein Schlupfloch um die RLS der Tabelle.
--
-- Eine Ansicht laeuft mit den Rechten ihres Eigentuemers und umgeht damit die
-- Policies der zugrunde liegenden Tabelle. Waere sie fuer `authenticated`
-- lesbar, koennte jeder Angemeldete die Wartelisten-Adressen abrufen — und
-- `waitlist` erlaubt absichtlich ein insert fuer Nichtangemeldete.
do $$
begin
  set local role authenticated;
  begin
    perform 1 from public.warteliste_versand limit 1;
    raise exception 'FAIL WV2: ein Angemeldeter durfte die Versand-Ansicht lesen';
  exception when insufficient_privilege then
    null;
  end;
  reset role;
  raise notice 'PASS WV2: die Versand-Ansicht ist fuer Angemeldete gesperrt';
end $$;

-- WV3: Auch anon kommt nicht heran.
do $$
begin
  set local role anon;
  begin
    perform 1 from public.warteliste_versand limit 1;
    raise exception 'FAIL WV3: anon durfte die Versand-Ansicht lesen';
  exception when insufficient_privilege then
    null;
  end;
  reset role;
  raise notice 'PASS WV3: die Versand-Ansicht ist fuer anon gesperrt';
end $$;
