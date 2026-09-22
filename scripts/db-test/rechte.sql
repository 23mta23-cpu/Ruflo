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
     -- Begruendete Ausnahme (20.09.2026, 0980): beantwortet „gehoert dieses
     -- Gewerk zur Anlage A der HwO?" mit ja/nein. Die Eingabe sind zwei
     -- Kategoriewerte, KEINE Nutzerkennung und keine Zeilen-ID -- die Frage
     -- laesst sich also gar nicht auf einen Fremden richten (dieselbe
     -- Ueberlegung wie bei meine_aktiven_strikes, RD). Die Ausgabe steht im
     -- Gesetz und ausserdem in data/categories.ts im ausgelieferten Bundle.
     -- Sie ist DEFINER, damit die Liste selbst fuer Clients gesperrt bleiben
     -- kann; ohne das braeuchte es eine pauschale Lese-Policy, und die faengt
     -- RG -- zu Recht.
     and p.proname not in ('ist_anbieter_frei', 'auftrag_braucht_meister');

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

-- ── RF ─────────────────────────────────────────────────────────────────────
-- Jede Tabelle in `public` hat RLS eingeschaltet.
--
-- ANLASS (13.09.2026, unmittelbar nach dem Rechte-Befund oben): 0420 setzt
-- `alter default privileges … grant select, insert, update, delete on tables
-- to anon, authenticated`. Der EINZIGE Schutz einer neuen Tabelle ist damit
-- ihre RLS. Wer `alter table … enable row level security` vergisst, legt eine
-- Tabelle an, die fuer JEDEN mit dem oeffentlichen anon-Schluessel les- UND
-- schreibbar ist — ohne Fehlermeldung, ohne roten Test.
--
-- Das ist dieselbe Klasse wie die Funktionsrechte (RA/RB), nur mit schwererer
-- Folge: dort ging es um Aufrufbarkeit, hier um Datenzugriff.
--
-- Gemessen beim Anlegen dieses Tests: alle Tabellen hatten RLS. Der Test
-- haelt diesen Stand, er repariert keinen.
do $$
declare offen text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into offen
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

  if offen is not null then
    raise exception 'FAIL RF: Tabelle(n) ohne RLS, also fuer anon offen: %', offen;
  end if;
  raise notice 'PASS RF: jede Tabelle in public hat RLS eingeschaltet';
end $$;

-- ── RG ─────────────────────────────────────────────────────────────────────
-- Keine LESE-Policy laesst pauschal jeden durch.
--
-- `using (true)` bei SELECT heisst: jede Zeile fuer jeden, der die Tabelle
-- ueberhaupt lesen darf — und das sind ueber 0420 anon und authenticated.
-- Eine solche Policy ist nicht per se falsch, aber sie muss eine bewusste
-- Entscheidung sein und keine Abkuerzung beim Schreiben.
do $$
declare offen text;
begin
  select string_agg(c.relname || '.' || p.polname, ', ' order by c.relname) into offen
    from pg_policy p join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and p.polcmd = 'r'                                   -- nur SELECT
     and pg_get_expr(p.polqual, p.polrelid) in ('true', '(true)')
     -- Begruendete Ausnahme: Bewertungen sind ein oeffentliches
     -- Reputationssignal. Ein Kunde muss sie vor der Beauftragung sehen
     -- koennen, auch ohne Konto. So auch in
     -- docs/security/access-control-matrix.md.
     and (c.relname, p.polname) not in (('reviews', 'reviews_select'));

  if offen is not null then
    raise exception 'FAIL RG: Lese-Policy laesst pauschal jeden durch: %', offen;
  end if;
  raise notice 'PASS RG: keine pauschale Lese-Policy ausser der begruendeten Ausnahme';
end $$;

-- ── RH und RI: spaltengenaue Schreibrechte, mechanisch ─────────────────────
--
-- ANLASS (Selbst-Check 18.09.2026). 0920 und 0960 benutzen dasselbe Muster:
-- `revoke update on <tabelle> from authenticated`, dann eine Schleife, die
-- jede Spalte AUSSER den geschuetzten wieder vergibt. Das Muster hat eine
-- eingebaute Falle:
--
--   Jede Spalte, die eine SPAETERE Migration hinzufuegt, bekommt das Recht
--   NICHT. Sie ist ab dann fuer Angemeldete nicht mehr beschreibbar -- und
--   zwar still. Kein Fehler beim Einspielen, keine rote Pruefung, nur ein
--   Formular, das beim Speichern "permission denied" meldet.
--
-- Genau diesen Ausfall hat die Mutationsprobe zu 0960 gezeigt: nimmt man den
-- Rueckgabe-Teil weg, scheitert `escrow.sql` mit "permission denied for table
-- contracts". Das war Glueck -- der Test stand zufaellig davor.
--
-- Deshalb hier mechanisch statt beispielhaft: JEDE Spalte wird gefragt.
-- Kommt morgen eine dazu und jemand vergisst das Recht, wird diese Zusicherung
-- rot, bevor es ein Nutzer merkt.
--
-- MUTATIONSPROBE 18.09.2026, vier Mutationen und eine Gegenprobe:
--   spaetere Migration fuegt contracts-Spalte ohne Recht hinzu -> RI rot
--   der gesperrte Zeitpunkt wird doch vergeben                 -> RI rot
--   spaetere Migration fuegt jobs-Spalte ohne Recht hinzu      -> RH rot
--   die beiden Zaehlspalten werden doch vergeben               -> RH rot
--   GEGENPROBE: neue Spalte MIT Recht                          -> bleibt gruen
-- Ohne die letzte waere „alles sperren" der bequemste gruene Haken.

-- RH: jobs (0920, 1020). Geschuetzt sind die beiden Zaehlspalten und der
-- Wunschanbieter: der gehoert zum Einstieg, nicht zur Verhandlung.
do $$
declare fehlt text; zuviel text;
begin
  select string_agg(column_name, ', ' order by column_name) into fehlt
    from information_schema.columns
   where table_schema = 'public' and table_name = 'jobs'
     and column_name not in ('benachrichtigte_betriebe', 'benachrichtigt_am',
                             'requested_provider_id')
     and not has_column_privilege('authenticated', 'public.jobs', column_name, 'UPDATE');
  if fehlt is not null then
    raise exception 'FAIL RH: Angemeldete koennen diese jobs-Spalten nicht mehr aendern: %', fehlt;
  end if;

  select string_agg(column_name, ', ' order by column_name) into zuviel
    from information_schema.columns
   where table_schema = 'public' and table_name = 'jobs'
     and column_name in ('benachrichtigte_betriebe', 'benachrichtigt_am',
                         'requested_provider_id')
     and has_column_privilege('authenticated', 'public.jobs', column_name, 'UPDATE');
  if zuviel is not null then
    raise exception 'FAIL RH: diese jobs-Spalten sind wieder offen: %', zuviel;
  end if;
  raise notice 'PASS RH: jobs -- jede Spalte ausser Zaehlern und Wunschanbieter bleibt aenderbar';
end $$;

-- RI: contracts (0960). Geschuetzt ist der belegte Arbeitsbeginn.
do $$
declare fehlt text; zuviel text;
begin
  select string_agg(column_name, ', ' order by column_name) into fehlt
    from information_schema.columns
   where table_schema = 'public' and table_name = 'contracts'
     and column_name <> 'arbeit_begonnen_am'
     and not has_column_privilege('authenticated', 'public.contracts', column_name, 'UPDATE');
  if fehlt is not null then
    raise exception 'FAIL RI: Angemeldete koennen diese contracts-Spalten nicht mehr aendern: %', fehlt;
  end if;

  if has_column_privilege('authenticated', 'public.contracts', 'arbeit_begonnen_am', 'UPDATE') then
    raise exception 'FAIL RI: arbeit_begonnen_am ist wieder von Hand setzbar';
  end if;
  raise notice 'PASS RI: contracts -- nur der belegte Arbeitsbeginn ist gesperrt';
end $$;
