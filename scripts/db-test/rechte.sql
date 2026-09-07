-- Ausführungsrechte: keine ungeschützte Funktion für Angemeldete (0820)
--
-- ANLASS (Pentest 07.09.2026): 0420 setzte `alter default privileges … grant
-- execute on functions to authenticated`, und PostgreSQL vergibt zusätzlich bei
-- jeder neuen Funktion EXECUTE an PUBLIC. Ergebnis: 15 SECURITY-DEFINER-
-- Funktionen waren für jeden Angemeldeten aufrufbar, ohne auth.uid() zu prüfen.
-- Zwei davon nachweislich ausnutzbar (check_rate_limit als gezielter DoS,
-- aktive_strikes als Auskunft über fremde Disziplinarakten).
--
-- Dieser Test hält die Klasse mechanisch nach. Eine Regel in einer Datei wird
-- übersehen; eine rote Assertion nicht.
--
-- (RA) Keine SECURITY-DEFINER-Funktion ohne auth.uid() ist für authenticated
--      ausführbar — bis auf eine benannte, begründete Ausnahmeliste
-- (RB) anon darf im Schema public gar keine Funktion ausführen
-- (RC) Die Funktionen, die der Client wirklich ruft, sind erreichbar
-- (RD) meine_aktiven_strikes braucht kein Argument und kann deshalb nicht
--      auf einen Fremden zeigen
-- (RE) Die Edge-Function-Wege sind für service_role offen geblieben

-- ── RA ─────────────────────────────────────────────────────────────────────
do $$
declare offen text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into offen
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prosecdef
     and has_function_privilege('authenticated', p.oid, 'EXECUTE')
     and pg_get_functiondef(p.oid) not ilike '%auth.uid()%'
     -- Begründete Ausnahme: gibt nur „frei ja/nein" für eine Stunde zurück.
     -- Der Kunde MUSS das sehen können, sonst wäre provider_availability
     -- nutzlos (so entschieden und begründet in 0740). Keine Kundendaten,
     -- kein Terminplan, keine Personenbezüge.
     and p.proname not in ('ist_anbieter_frei');

  if offen is not null then
    raise exception 'FAIL RA: SECURITY DEFINER ohne auth.uid(), fuer authenticated offen: %', offen;
  end if;
  raise notice 'PASS RA: keine ungeschuetzte SECURITY-DEFINER-Funktion fuer Angemeldete';
end $$;

-- ── RB ─────────────────────────────────────────────────────────────────────
-- GRENZE, ausdruecklich: geprueft werden nur EIGENE Funktionen. Erweiterungen
-- (pgcrypto, uuid-ossp, dblink, moddatetime) sind ausgenommen — 0820 fasst sie
-- bewusst nicht an. Der erste Anlauf dieser Migration hat es getan, und
-- `uuid_generate_v4()` steckt in Spalten-Vorgaben: in der Produktion waere damit
-- jedes Einfuegen durch einen Angemeldeten gescheitert.
--
-- Das heisst NICHT, dass die Erweiterungsrechte in Ordnung sind. dblink fuer
-- anon waere ein ernstes Problem — in dieser Testumgebung kommt es aus dem
-- lokalen Aufbau, nicht aus einer Migration. Fuer die Produktion gehoert das
-- einmal im Supabase-Dashboard nachgesehen; dieser Test kann es nicht.
do $$
declare offen text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into offen
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and has_function_privilege('anon', p.oid, 'EXECUTE')
     and not exists (
       select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e'
     );
  if offen is not null then
    raise exception 'FAIL RB: anon darf eigene Funktionen ausfuehren: %', offen;
  end if;
  raise notice 'PASS RB: anon darf keine eigene Funktion im Schema public ausfuehren';
end $$;

-- ── RC ─────────────────────────────────────────────────────────────────────
-- Die Gegenrichtung. Ohne sie wäre „alles gesperrt" die einfachste Art, RA und
-- RB grün zu bekommen — und die App wäre tot.
do $$
declare fehlt text := '';
        fn text;
begin
  foreach fn in array array[
    'accept_offer', 'decline_offer', 'auth_email_confirmed',
    'beschraenkung_begruendung', 'fertigstellung_melden',
    'konversationen_kunde', 'konversationen_anbieter',
    'mark_messages_read', 'propose_appointment', 'respond_appointment',
    'vertrag_partner', 'ist_anbieter_frei', 'meine_aktiven_strikes',
    'auth_is_thread_participant'
  ] loop
    if not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = fn
         and has_function_privilege('authenticated', p.oid, 'EXECUTE')
    ) then
      fehlt := fehlt || ' ' || fn;
    end if;
  end loop;
  if fehlt <> '' then
    raise exception 'FAIL RC: der Client kann diese Funktionen nicht mehr rufen:%', fehlt;
  end if;
  raise notice 'PASS RC: alle 14 Client-Funktionen sind erreichbar';
end $$;

-- ── RD ─────────────────────────────────────────────────────────────────────
do $$
declare n integer;
begin
  select count(*) into n
    from pg_proc p join pg_namespace n2 on n2.oid = p.pronamespace
   where n2.nspname = 'public' and p.proname = 'meine_aktiven_strikes'
     and p.pronargs = 0;
  if n <> 1 then
    raise exception 'FAIL RD: meine_aktiven_strikes hat Argumente — damit laesst sie sich auf einen Fremden richten';
  end if;
  -- Und die Fassung MIT Argument darf der Client nicht mehr haben.
  if exists (
    select 1 from pg_proc p join pg_namespace n3 on n3.oid = p.pronamespace
     where n3.nspname = 'public' and p.proname = 'aktive_strikes'
       and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ) then
    raise exception 'FAIL RD: aktive_strikes(uuid) ist fuer Angemeldete wieder offen';
  end if;
  raise notice 'PASS RD: Strikes nur ueber die eigene Kennung abfragbar';
end $$;

-- ── RE ─────────────────────────────────────────────────────────────────────
do $$
declare fehlt text := '';
        fn text;
begin
  foreach fn in array array[
    'check_rate_limit', 'contract_for_payment_intent', 'payout_claim',
    'payout_finalize', 'pstg_year_totals', 'register_payment_intent'
  ] loop
    if not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = fn
         and has_function_privilege('service_role', p.oid, 'EXECUTE')
    ) then
      fehlt := fehlt || ' ' || fn;
    end if;
  end loop;
  if fehlt <> '' then
    raise exception 'FAIL RE: die Edge Functions koennen diese nicht mehr rufen:%', fehlt;
  end if;
  raise notice 'PASS RE: die Edge-Function-Wege sind fuer service_role offen';
end $$;
