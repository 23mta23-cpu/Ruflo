-- Pflichtmitteilungen (0860): entstehen sie mit dem Vorgang, und sieht der
-- Betrieb, wenn sie liegen bleiben?
--
-- Der Kern: ein Strike ohne Mitteilung darf es nicht geben koennen. Deshalb
-- Trigger statt Client-Aufruf -- der Client kann abstuerzen, die Transaktion
-- nicht.

alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;

insert into auth.users (id, email, email_confirmed_at) values
  ('bb000000-0000-0000-0000-0000000000a1','mitteil-anbieter@test.de', now()),
  ('bb000000-0000-0000-0000-0000000000a2','mitteil-fremder@test.de', now());
insert into profiles (id, role, email, email_verified_at) values
  ('bb000000-0000-0000-0000-0000000000a1','provider','mitteil-anbieter@test.de', now()),
  ('bb000000-0000-0000-0000-0000000000a2','provider','mitteil-fremder@test.de', now());
insert into provider_profiles (id, business_name) values
  ('bb000000-0000-0000-0000-0000000000a1','Mitteilungsbetrieb'),
  ('bb000000-0000-0000-0000-0000000000a2','Fremdbetrieb');

alter table auth.users enable trigger user;
alter table public.profiles enable trigger user;

-- BN1: Ein Strike erzeugt die Mitteilung MIT, nicht spaeter.
do $$
declare v_strike uuid; n int; v_text text;
begin
  insert into public.provider_strikes (provider_id, grund, begruendung)
  values ('bb000000-0000-0000-0000-0000000000a1','kontaktdaten_umgehung',
          'In Ihren Nachrichten wurden mehrfach Kontaktdaten erkannt. Nach AGB §7(2) gilt das als Verstoss.')
  returning id into v_strike;

  select count(*), max(text) into n, v_text from public.notifications
   where quelle_tabelle = 'provider_strikes' and quelle_id = v_strike;
  if n <> 1 then
    raise exception 'FAIL BN1: % Mitteilungen zum Strike, erwartet 1', n;
  end if;
  -- Der WORTLAUT muss der der Begruendung sein, nicht eine Zusammenfassung:
  -- im Streitfall wird genau dieser Text vorgelegt (Art. 4 P2B-VO).
  if position('AGB §7(2)' in v_text) = 0 then
    raise exception 'FAIL BN1: die Mitteilung traegt nicht die Begruendung: %', left(v_text, 80);
  end if;
  raise notice 'PASS BN1: ein Strike erzeugt die Pflichtmitteilung im selben Vorgang';
end $$;

-- BN2: Sie ist als Pflicht markiert und unzugestellt. Beides zusammen ist der
-- Rechtszustand: Text vorhanden, Uebermittlung schuldet Werkant noch.
do $$
declare r record;
begin
  select * into r from public.notifications
   where quelle_tabelle = 'provider_strikes' limit 1;
  if not r.pflicht then
    raise exception 'FAIL BN2: Strike-Mitteilung ist nicht als Pflicht markiert';
  end if;
  if r.zugestellt_am is not null then
    raise exception 'FAIL BN2: Mitteilung gilt als zugestellt, ohne dass jemand sie verschickt hat';
  end if;
  raise notice 'PASS BN2: Pflichtmitteilung, noch nicht zugestellt';
end $$;

-- BN3: Eine DSA-Beschraenkung erzeugt die Mitteilung mit dem VOLLSTAENDIGEN
-- Begruendungstext nach Art. 17 Abs. 3.
do $$
declare v_b uuid; v_text text;
begin
  insert into public.beschraenkungen (
    betroffener, art, raeumlicher_umfang, dauer, tatsachen, ausloeser,
    automatisiert, grundlage_art, grundlage, rechtsbehelf
  ) values (
    'bb000000-0000-0000-0000-0000000000a1', 'konto_gesperrt',
    'Gilt in allen Mitgliedstaaten der Europäischen Union.', 'unbefristet',
    'Es wurden wiederholt Kontaktdaten im Chat ausgetauscht, um die Plattform zu umgehen.',
    'eigene_feststellung', false, 'agb', 'AGB §7(2): Umgehung der Plattform',
    'Sie können der Maßnahme widersprechen: kontakt@werkant.de'
  ) returning id into v_b;

  select text into v_text from public.notifications
   where quelle_tabelle = 'beschraenkungen' and quelle_id = v_b;
  if v_text is null then
    raise exception 'FAIL BN3: keine Mitteilung zur Beschraenkung';
  end if;
  -- Die vier Pflichtbestandteile aus Art. 17 Abs. 3 muessen drinstehen.
  if position('1. Art der Maßnahme' in v_text) = 0
     or position('2. Tatsachen und Umstände' in v_text) = 0
     or position('3. Vertragliche Grundlage' in v_text) = 0
     or position('4. Was Sie tun können' in v_text) = 0 then
    raise exception 'FAIL BN3: Begruendung unvollstaendig: %', left(v_text, 120);
  end if;
  raise notice 'PASS BN3: Beschraenkung erzeugt die vollstaendige Art-17-Begruendung';
end $$;

-- BN4: Der Rueckstand ist zunaechst KEINER. Frisch angelegt heisst nicht
-- versaeumt; 24 Stunden Toleranz.
do $$
declare s record;
begin
  select * into s from public.zustellung_status();
  if s.offene_pflichtmitteilungen < 2 then
    raise exception 'FAIL BN4: nur % offene Pflichtmitteilungen, erwartet mindestens 2',
      s.offene_pflichtmitteilungen;
  end if;
  if s.stau then
    raise exception 'FAIL BN4: frisch angelegte Mitteilungen gelten schon als Stau';
  end if;
  raise notice 'PASS BN4: frische Pflichtmitteilungen sind noch kein Stau';
end $$;

-- BN5: Nach 25 Stunden IST es ein Stau. Der Fall, den sonst niemand saehe.
do $$
declare s record;
begin
  update public.notifications set erstellt_am = now() - interval '25 hours'
   where pflicht and zugestellt_am is null;
  select * into s from public.zustellung_status();
  if not s.stau then
    raise exception 'FAIL BN5: 25 Stunden unzugestellt melden keinen Stau (h=%)',
      s.aelteste_offene_stunden;
  end if;
  raise notice 'PASS BN5: unzugestellte Pflichtmitteilung meldet nach 24 h Stau';
end $$;

-- BN6: Ein Fremder darf die Mitteilung nicht lesen. Sie enthaelt
-- Tatsachenvortrag ueber das Verhalten eines anderen.
set request.jwt.claim.sub = 'bb000000-0000-0000-0000-0000000000a2';
set role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.notifications
   where empfaenger = 'bb000000-0000-0000-0000-0000000000a1';
  if n <> 0 then
    raise exception 'FAIL BN6: Fremder sieht % fremde Mitteilungen', n;
  end if;
  raise notice 'PASS BN6: fremde Mitteilungen sind nicht lesbar';
end $$;

-- BN7: Ein Fremder darf auch nicht als gelesen markieren.
do $$
declare v_id uuid; v_gelesen timestamptz;
begin
  reset role;
  select id into v_id from public.notifications
   where empfaenger = 'bb000000-0000-0000-0000-0000000000a1' limit 1;
  set role authenticated;
  perform public.benachrichtigung_gelesen(v_id);
  reset role;
  select gelesen_am into v_gelesen from public.notifications where id = v_id;
  if v_gelesen is not null then
    raise exception 'FAIL BN7: Fremder konnte eine fremde Mitteilung als gelesen markieren';
  end if;
  raise notice 'PASS BN7: Gelesen-Markieren wirkt nur auf eigene Mitteilungen';
end $$;

-- BN8: Der Empfaenger selbst kann sie als gelesen markieren.
set request.jwt.claim.sub = 'bb000000-0000-0000-0000-0000000000a1';
set role authenticated;
do $$
declare v_id uuid; v_gelesen timestamptz;
begin
  select id into v_id from public.notifications limit 1;
  if v_id is null then
    raise exception 'FAIL BN8: der Empfaenger sieht seine eigene Mitteilung nicht';
  end if;
  perform public.benachrichtigung_gelesen(v_id);
  reset role;
  select gelesen_am into v_gelesen from public.notifications where id = v_id;
  if v_gelesen is null then
    raise exception 'FAIL BN8: Gelesen-Markieren hat nicht gewirkt';
  end if;
  raise notice 'PASS BN8: der Empfaenger kann seine Mitteilung als gelesen markieren';
  set role authenticated;
end $$;
reset role;

-- BN9: Der Empfaenger darf `zugestellt_am` NICHT setzen. Sonst loescht er den
-- Nachweis, dass Werkant die Uebermittlung noch schuldet.
set role authenticated;
do $$
declare v_id uuid; n int;
begin
  select id into v_id from public.notifications limit 1;
  update public.notifications set zugestellt_am = now() where id = v_id;
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'FAIL BN9: Empfaenger konnte zugestellt_am setzen (% Zeilen)', n;
  end if;
  raise notice 'PASS BN9: der Empfaenger kann die Zustellung nicht selbst quittieren';
end $$;
reset role;

-- BN10: zustellung_status ist Betriebsauskunft, kein Nutzerwissen.
set role authenticated;
do $$
begin
  begin
    perform public.zustellung_status();
    raise exception 'FAIL BN10: Angemeldeter durfte zustellung_status aufrufen';
  exception when insufficient_privilege then
    null;
  end;
  raise notice 'PASS BN10: zustellung_status ist fuer Nutzer gesperrt';
end $$;
reset role;

-- ── Nachtrag aus dem Selbst-Check ──────────────────────────────────────────
-- Drei Zusagen aus notes/04-Entscheidungen/Benachrichtigungen-Architektur.md,
-- die zunaechst unbelegt waren. Eine Zusage ohne Test ist eine Behauptung.

-- BN11: Kein Schreiben ausserhalb der Transaktion.
--
-- GRENZE, ehrlich benannt: dieser Test bliebe auch ohne Trigger gruen -- ohne
-- Trigger gaebe es ebenfalls keine Mitteilung. Dass der Trigger UEBERHAUPT
-- greift, prueft BN1, nicht dieser Test.
--
-- Was er beweist: die Mitteilung wird nicht nebenher geschrieben. Wuerde
-- jemand den Trigger spaeter durch einen asynchronen Weg ersetzen (Job,
-- Warteschlange, Client-Aufruf nach dem Commit), bliebe hier eine Mitteilung
-- zu einem Strike stehen, den es nie gab -- und genau das faengt er ab.
begin;
insert into public.provider_strikes (id, provider_id, grund, begruendung)
values ('bb000000-0000-0000-0000-0000000000f1',
        'bb000000-0000-0000-0000-0000000000a1','sonstiges',
        'Dieser Strike wird gleich zurueckgerollt und darf keine Spur hinterlassen.');
rollback;
do $$
declare n int;
begin
  select count(*) into n from public.notifications
   where quelle_id = 'bb000000-0000-0000-0000-0000000000f1';
  if n <> 0 then
    raise exception 'FAIL BN11: % Mitteilung(en) zu einem zurueckgerollten Strike', n;
  end if;
  select count(*) into n from public.provider_strikes
   where id = 'bb000000-0000-0000-0000-0000000000f1';
  if n <> 0 then
    raise exception 'FAIL BN11: der zurueckgerollte Strike existiert noch';
  end if;
  raise notice 'PASS BN11: Vorgang und Mitteilung teilen sich die Transaktion';
end $$;

-- BN12: „Ein Vorgang, eine Mitteilung." Ohne das zaehlt der Rueckstand
-- Gespenster: ein zweiter Aufruf nach einem Abbruch erzeugte sonst eine
-- zweite Zeile fuer denselben Vorgang.
do $$
declare v_quelle uuid := 'bb000000-0000-0000-0000-0000000000f2'; n int;
begin
  perform public.benachrichtigung_anlegen(
    'bb000000-0000-0000-0000-0000000000a1', 'system', 'Doppelt haelt nicht',
    'Derselbe Vorgang darf nur eine Mitteilung erzeugen.', null,
    'testvorgang', v_quelle, false);
  perform public.benachrichtigung_anlegen(
    'bb000000-0000-0000-0000-0000000000a1', 'system', 'Doppelt haelt nicht',
    'Derselbe Vorgang darf nur eine Mitteilung erzeugen.', null,
    'testvorgang', v_quelle, false);
  select count(*) into n from public.notifications
   where quelle_tabelle = 'testvorgang' and quelle_id = v_quelle;
  if n <> 1 then
    raise exception 'FAIL BN12: % Mitteilungen fuer denselben Vorgang, erwartet 1', n;
  end if;
  raise notice 'PASS BN12: derselbe Vorgang erzeugt nur eine Mitteilung';
end $$;

-- BN13: Der Rueckstand misst NUR Pflichtmitteilungen. Eine alte
-- Hinweismitteilung ist kein Rechtsproblem, und wenn sie den Stau ausloest,
-- wird die Meldung abgestumpft und irgendwann ignoriert.
do $$
declare s record;
begin
  -- Erst die echten Pflichtmitteilungen als zugestellt vermerken.
  update public.notifications set zugestellt_am = now(), zustellweg = 'test'
   where pflicht and zugestellt_am is null;
  -- Dann die Nicht-Pflichtmitteilung alt machen.
  update public.notifications set erstellt_am = now() - interval '30 hours'
   where quelle_tabelle = 'testvorgang';

  select * into s from public.zustellung_status();
  if s.stau then
    raise exception 'FAIL BN13: eine 30 h alte NICHT-Pflichtmitteilung loest Stau aus';
  end if;
  if s.offene_pflichtmitteilungen <> 0 then
    raise exception 'FAIL BN13: % offene Pflichtmitteilungen nach dem Vermerken',
      s.offene_pflichtmitteilungen;
  end if;
  raise notice 'PASS BN13: nur Pflichtmitteilungen zaehlen in den Rueckstand';
end $$;
