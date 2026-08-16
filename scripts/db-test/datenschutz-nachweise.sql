-- Datenschutz-Zusagen gegen den Code (Migration 0730)
--
-- Die Datenschutzerklaerung nennt fuenf Speicherdauern. Zwei entsprachen nicht
-- der Wirklichkeit:
--   "IP-Adressen (Logs): 7 Tage"      rate_limits.key enthaelt die IP; die
--                                     Zeile wurde nie geloescht.
--   "Consent-Log: 3 Jahre"            existierte gar nicht — die Einwilligung
--                                     lag nur im localStorage des Geraets.
--
-- (AA) Alte rate_limits-Zeilen (IP im Schluessel) verschwinden nach 7 Tagen
-- (AB) Die Ratenbegrenzung funktioniert dabei unveraendert weiter
-- (AC) Einwilligung laesst sich VOR der Registrierung anonym festhalten
-- (AD) Niemand erklaert eine Einwilligung im Namen eines anderen
-- (AE) Der Nutzer liest seine eigene Einwilligung (Art. 15 DSGVO)
-- (AF) Der Wortlaut ist nachtraeglich nicht aenderbar
-- (AG) Der Widerruf (Art. 7 Abs. 3 DSGVO) laesst sich eintragen
reset role;

alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;

insert into auth.users (id,email,email_confirmed_at) values
  ('eb000001-0000-0000-0000-000000000000','dsa@test.de',now()),
  ('eb000002-0000-0000-0000-000000000000','dsb@test.de',now());
insert into profiles (id,role,email,email_verified_at) values
  ('eb000001-0000-0000-0000-000000000000','customer','dsa@test.de',now()),
  ('eb000002-0000-0000-0000-000000000000','customer','dsb@test.de',now());

alter table auth.users enable trigger user;
alter table public.profiles enable trigger user;

-- TEST AA: eine acht Tage alte Zeile mit IP im Schluessel muss verschwinden.
insert into rate_limits (key, window_start, count)
values ('ip:203.0.113.7:create-payment-intent', now() - interval '8 days', 5);
do $$
declare vorher int; nachher int; erlaubt boolean;
begin
  select count(*) into vorher from rate_limits
   where key = 'ip:203.0.113.7:create-payment-intent';
  if vorher <> 1 then raise exception 'FAIL: Aufbau stimmt nicht (%)', vorher; end if;

  -- Irgendein Aufruf der Funktion raeumt mit auf.
  select public.check_rate_limit('ip:198.51.100.9:test', 10, 60) into erlaubt;

  select count(*) into nachher from rate_limits
   where key = 'ip:203.0.113.7:create-payment-intent';
  if nachher <> 0 then
    raise exception 'FAIL: IP-Zeile aelter als 7 Tage blieb stehen (Datenschutz sagt 7 Tage)';
  end if;
  raise notice 'PASS AA: rate_limits-Zeilen mit IP verschwinden nach 7 Tagen';
end $$;

-- TEST AB: die eigentliche Ratenbegrenzung darf davon nicht kaputtgehen.
-- Ein Aufraeumen, das nebenbei die Sperre aushebelt, waere schlimmer als das
-- Datenschutzproblem, das es loest.
do $$
declare erlaubt boolean;
begin
  perform public.check_rate_limit('ip:198.51.100.10:eng', 2, 3600);  -- 1
  perform public.check_rate_limit('ip:198.51.100.10:eng', 2, 3600);  -- 2
  select public.check_rate_limit('ip:198.51.100.10:eng', 2, 3600) into erlaubt;  -- 3
  if erlaubt then raise exception 'FAIL: Ratenbegrenzung greift nicht mehr'; end if;
  raise notice 'PASS AB: Ratenbegrenzung funktioniert unveraendert (3. Aufruf abgewiesen)';
end $$;

-- TEST AB2: das Aufraeumen darf ein LAUFENDES Fenster nicht wegloeschen.
--
-- Dieser Test existiert wegen einer Mutationsprobe: die Aufraeum-Frist von
-- 7 Tagen auf 1 Sekunde zu setzen blieb GRUEN. Grund: `now()` ist in einer
-- Transaktion eingefroren, und AB fuehrt alle drei Aufrufe darin aus — die
-- Zeile ist dort nie "aelter" als der Schwellwert. In Produktion liegen
-- zwischen den Aufrufen aber Sekunden bis Minuten, und eine zu kurze Frist
-- wuerde den Zaehler jedes Mal zuruecksetzen: die Ratenbegrenzung waere
-- praktisch abgeschaltet, ohne dass ein Test rot wird.
--
-- Deshalb hier mit einem KUENSTLICH in die Vergangenheit gesetzten
-- window_start, das noch im Fenster liegt (30 Sekunden bei 3600 Sekunden
-- Fensterbreite).
do $$
declare erlaubt boolean; c int;
begin
  insert into rate_limits (key, window_start, count)
  values ('ip:198.51.100.11:lauf', now() - interval '30 seconds', 2);

  select public.check_rate_limit('ip:198.51.100.11:lauf', 2, 3600) into erlaubt;

  select count into c from rate_limits where key = 'ip:198.51.100.11:lauf';
  if c < 3 then
    raise exception 'FAIL: laufendes Fenster wurde weggeraeumt (Zaehler bei % statt 3) — Ratenbegrenzung waere wirkungslos', c;
  end if;
  if erlaubt then
    raise exception 'FAIL: 3. Aufruf im laufenden Fenster wurde erlaubt (Grenze 2)';
  end if;
  raise notice 'PASS AB2: das Aufraeumen laesst laufende Fenster unberuehrt';
end $$;

-- TEST AC: Einwilligung VOR der Registrierung — das Consent-Blatt liegt ueber
-- jedem Bildschirm, also auch vor jedem Konto.
set role anon;
do $$
begin
  insert into dsgvo_consents (user_id, text_version, angezeigter_text, pflicht, analytics, pstg)
  values (null, 'dsgvo-2026-08-16',
          'Werkant verarbeitet Ihre Daten gemaess Datenschutzerklaerung und AGB.',
          true, false, true);
  raise notice 'PASS AC: Einwilligung laesst sich vor der Registrierung festhalten';
exception when others then
  raise exception 'FAIL: anonyme Einwilligung ging nicht (%)', sqlerrm;
end $$;
reset role;

set role authenticated;
set request.jwt.claim.sub = 'eb000001-0000-0000-0000-000000000000';

-- TEST AD: niemand erklaert im Namen eines anderen
do $$
begin
  insert into dsgvo_consents (user_id, text_version, angezeigter_text, pflicht, analytics, pstg)
  values ('eb000002-0000-0000-0000-000000000000', 'dsgvo-2026-08-16',
          'Im Namen eines anderen erklaert — das darf nicht durchgehen.',
          true, true, true);
  raise exception 'FAIL: Einwilligung im Namen eines anderen ging durch!';
exception when insufficient_privilege then
  raise notice 'PASS AD: keine Einwilligung im Namen eines anderen';
end $$;

-- Eigene Einwilligung anlegen
insert into dsgvo_consents (user_id, text_version, angezeigter_text, pflicht, analytics, pstg)
values ('eb000001-0000-0000-0000-000000000000', 'dsgvo-2026-08-16',
        'Werkant verarbeitet Ihre Daten gemaess Datenschutzerklaerung und AGB.',
        true, false, true);

-- TEST AE: eigene lesen, fremde nicht (Art. 15 DSGVO)
do $$
declare eigene int; fremde int;
begin
  select count(*) into eigene from dsgvo_consents
   where user_id = 'eb000001-0000-0000-0000-000000000000';
  select count(*) into fremde from dsgvo_consents
   where user_id is distinct from 'eb000001-0000-0000-0000-000000000000';
  if eigene <> 1 then raise exception 'FAIL: eigene Einwilligung nicht lesbar (%)', eigene; end if;
  if fremde <> 0 then raise exception 'FAIL: fremde/anonyme Einwilligungen lesbar (%)', fremde; end if;
  raise notice 'PASS AE: Nutzer liest seine eigene Einwilligung, sonst keine';
end $$;

-- TEST AF: der Wortlaut ist nachtraeglich nicht aenderbar
do $$
begin
  update dsgvo_consents
     set angezeigter_text = 'Nachtraeglich umgeschriebener Wortlaut hier drin.'
   where user_id = 'eb000001-0000-0000-0000-000000000000';
  raise exception 'FAIL: der Wortlaut liess sich nachtraeglich aendern!';
exception when raise_exception then
  if sqlerrm like 'FAIL:%' then raise; end if;
  raise notice 'PASS AF: der Wortlaut ist nachtraeglich nicht aenderbar';
end $$;

-- TEST AG: der Widerruf laesst sich eintragen (Art. 7 Abs. 3 DSGVO).
-- Bewusst als Eintrag, nicht als Loeschung: sonst ist genau der Vorgang, um
-- den es geht, hinterher nicht mehr nachweisbar.
do $$
declare n int;
begin
  update dsgvo_consents set widerrufen_am = now()
   where user_id = 'eb000001-0000-0000-0000-000000000000';
  select count(*) into n from dsgvo_consents
   where user_id = 'eb000001-0000-0000-0000-000000000000' and widerrufen_am is not null;
  if n <> 1 then raise exception 'FAIL: Widerruf liess sich nicht eintragen (%)', n; end if;
  raise notice 'PASS AG: Widerruf der Einwilligung laesst sich eintragen';
end $$;

reset role;
