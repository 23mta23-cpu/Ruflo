-- 0950: Betritt ein Betrieb den Markt, erfaehrt der wartende Kunde davon.
--
-- Der Fall, auf den es ankommt, ist NICHT "der Trigger feuert". Das ist leicht
-- gruen zu bekommen. Es ist die Frage, ob er bei allem ANDEREN schweigt:
-- fremdes Gewerk, fremder Postleitzahlenbereich, fremder Rechtsraum
-- (§1 HwO), noch nicht freigegeben, eigener Auftrag, geschlossener Auftrag,
-- zweites Speichern. Sieben der zwoelf Zusicherungen unten sind Gegenproben.
-- Ein Trigger, der zu oft feuert, ist schlimmer als keiner: er schreibt dem
-- Kunden eine Zahl hin, die niemanden meint.

-- MUTATIONSPROBE 17.09.2026 (16 Proben gegen 0950, jede einzeln, jede
-- zurueckgesetzt). Was rot wurde, und wodurch:
--   eigener Auftrag zaehlt mit          -> KS11
--   Trennung Handwerk/Nachbarschaft weg -> KS6
--   PLZ-Bereich egal                    -> KS5
--   Gewerk egal                         -> KS4
--   auch vergebene Auftraege            -> KS12
--   auch nicht freigegebene Betriebe    -> KS9
--   Zahl wird nicht nachgezogen         -> KS1
--   Kunde bekommt keine Mitteilung      -> KS2
--   Mitteilung ohne Ziel / ohne Herkunft-> KS2
--   erster Entwurf (hochzaehlen)        -> KS10
--   "NULL bleibt NULL" (verworfene Regel)-> KS7
--   der Betrieb erfaehrt nichts         -> KS3
--
-- GRUEN GEBLIEBEN, und das ist kein Mangel, sondern die Aussage:
--   "if not found then continue" entfernt: nichts wird rot. Die Bedingung
--     verhindert KEINE Doppelzaehlung -- das tut der Nachweis. Sie spart die
--     Arbeit, eine unveraenderte Zahl neu zu schreiben. Steht so im Code.
--   Uebergangsbedingung entfernt: nichts wird rot. Sie ist eine
--     Beschleunigung, keine Absicherung. Steht so im Code.
--   Lese-Policy "using (true)" ergaenzt: kaltstart.sql wird gar nicht mehr
--     erreicht, weil rechte.sql (RG) vorher abbricht. Die Eigenschaft ist
--     also doppelt gehalten.
--
-- GRENZE von KS13: durch keine Mutation an 0950 rot zu bekommen. Die
-- Eindeutigkeit liegt im Index aus 0860. KS13 haelt fest, dass der Trigger
-- eine Herkunft mitgibt, an der dieser Index ueberhaupt greifen kann.

alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;
alter table public.jobs disable trigger user;

-- ── Beteiligte ─────────────────────────────────────────────────────────────
insert into auth.users (id,email,email_confirmed_at) values
  ('cafe0000-0000-0000-0000-00000000c001','ks-kunde@test.de',now()),
  ('cafe0000-0000-0000-0000-00000000c002','ks-kunde2@test.de',now()),
  ('cafe0000-0000-0000-0000-00000000b001','ks-betrieb@test.de',now()),
  ('cafe0000-0000-0000-0000-00000000b002','ks-nachbar@test.de',now());

insert into profiles (id,role,email,email_verified_at,plz) values
  ('cafe0000-0000-0000-0000-00000000c001','customer','ks-kunde@test.de',now(),'50667'),
  ('cafe0000-0000-0000-0000-00000000c002','customer','ks-kunde2@test.de',now(),'50667'),
  ('cafe0000-0000-0000-0000-00000000b001','provider','ks-betrieb@test.de',now(),'50823'),
  ('cafe0000-0000-0000-0000-00000000b002','provider','ks-nachbar@test.de',now(),'50823');

-- Noch NICHT marktfaehig: freigegeben ist er nicht.
insert into provider_profiles (id,available,kyc_verified,category_ids,is_nachbarschaft) values
  ('cafe0000-0000-0000-0000-00000000b001',true,false,array['elektro'],false),
  ('cafe0000-0000-0000-0000-00000000b002',true,false,array['elektro'],true);

-- ── Auftraege ──────────────────────────────────────────────────────────────
-- A: der Fall, um den es geht. Gewerk passt, PLZ-Bereich passt (50), der
--    erste Lauf hat stattgefunden und NIEMANDEN gefunden.
-- B: anderes Gewerk.        C: anderer PLZ-Bereich (40 statt 50).
-- D: Nachbarschaft.         E: Zahl ist NULL (erster Lauf nie gelaufen).
-- F: gehoert dem Betrieb selbst.   G: nicht mehr offen.
insert into jobs (id,customer_id,title,description,category,category_id,address_plz,address_city,track,status,benachrichtigte_betriebe,benachrichtigt_am) values
  ('cafe0000-0000-0000-0000-0000000000aa','cafe0000-0000-0000-0000-00000000c001',
   'KS-A Sicherung','Lang genug beschrieben hier drin.','Elektro','elektro','50667','Koeln','handwerker','open',0,now()),
  ('cafe0000-0000-0000-0000-0000000000bb','cafe0000-0000-0000-0000-00000000c001',
   'KS-B Garten','Lang genug beschrieben hier drin.','Garten','garten','50667','Koeln','handwerker','open',0,now()),
  ('cafe0000-0000-0000-0000-0000000000cc','cafe0000-0000-0000-0000-00000000c001',
   'KS-C Duesseldorf','Lang genug beschrieben hier drin.','Elektro','elektro','40210','Duesseldorf','handwerker','open',0,now()),
  ('cafe0000-0000-0000-0000-0000000000dd','cafe0000-0000-0000-0000-00000000c002',
   'KS-D Nachbarschaft','Lang genug beschrieben hier drin.','Elektro','elektro','50667','Koeln','nachbarschaft','open',0,now()),
  ('cafe0000-0000-0000-0000-0000000000ee','cafe0000-0000-0000-0000-00000000c002',
   'KS-E Ohne Lauf','Lang genug beschrieben hier drin.','Elektro','elektro','50667','Koeln','handwerker','open',null,null),
  ('cafe0000-0000-0000-0000-0000000000ff','cafe0000-0000-0000-0000-00000000b001',
   'KS-F Eigener','Lang genug beschrieben hier drin.','Elektro','elektro','50667','Koeln','handwerker','open',0,now()),
  ('cafe0000-0000-0000-0000-00000000009f','cafe0000-0000-0000-0000-00000000c001',
   'KS-G Vergeben','Lang genug beschrieben hier drin.','Elektro','elektro','50667','Koeln','handwerker','matched',0,now());

-- ── KS9 (Gegenprobe, VOR der Freigabe) ─────────────────────────────────────
-- Ein verfuegbarer, aber nicht freigegebener Betrieb aendert etwas an seinem
-- Profil. Er darf gar nicht bieten, also darf er auch nicht gezaehlt werden.
update provider_profiles set radius_km = 25
  where id = 'cafe0000-0000-0000-0000-00000000b001';
do $$
declare v integer;
begin
  select benachrichtigte_betriebe into v from jobs
   where id = 'cafe0000-0000-0000-0000-0000000000aa';
  if v <> 0 then
    raise exception 'FAIL KS9: ein nicht freigegebener Betrieb wurde mitgezaehlt (%)', v;
  end if;
  raise notice 'PASS KS9: ein nicht freigegebener Betrieb loest nichts aus';
end $$;

-- ── Die Freigabe ───────────────────────────────────────────────────────────
update provider_profiles set kyc_verified = true
  where id = 'cafe0000-0000-0000-0000-00000000b001';

-- ── KS1 ────────────────────────────────────────────────────────────────────
do $$
declare v integer; z timestamptz;
begin
  select benachrichtigte_betriebe, benachrichtigt_am into v, z from jobs
   where id = 'cafe0000-0000-0000-0000-0000000000aa';
  if v <> 1 then
    raise exception 'FAIL KS1: der wartende Auftrag steht auf % statt 1', v;
  end if;
  if z is null then
    raise exception 'FAIL KS1: der Zeitpunkt wurde nicht fortgeschrieben';
  end if;
  raise notice 'PASS KS1: der wartende Auftrag zaehlt den neuen Betrieb mit';
end $$;

-- ── KS2 ────────────────────────────────────────────────────────────────────
do $$
declare v_route text; v_text text;
begin
  select route, text into v_route, v_text from notifications
   where empfaenger = 'cafe0000-0000-0000-0000-00000000c001'
     and quelle_tabelle = 'jobs'
     and quelle_id = 'cafe0000-0000-0000-0000-0000000000aa';
  if v_route is null then
    raise exception 'FAIL KS2: der Kunde hat keine Mitteilung bekommen';
  end if;
  if position('cafe0000-0000-0000-0000-0000000000aa' in v_route) = 0 then
    raise exception 'FAIL KS2: die Mitteilung fuehrt nicht zum Auftrag (%)', v_route;
  end if;
  -- Der Titel des Auftrags gehoert hinein, sonst weiss der Kunde bei mehreren
  -- offenen Auftraegen nicht, welcher gemeint ist.
  if position('KS-A Sicherung' in v_text) = 0 then
    raise exception 'FAIL KS2: die Mitteilung nennt den Auftrag nicht';
  end if;
  raise notice 'PASS KS2: der Kunde bekommt eine Mitteilung, die zum Auftrag fuehrt';
end $$;

-- ── KS4 bis KS6, KS11, KS12: die Gegenproben ───────────────────────────────
do $$
declare v integer;
begin
  select benachrichtigte_betriebe into v from jobs where id = 'cafe0000-0000-0000-0000-0000000000bb';
  if v <> 0 then raise exception 'FAIL KS4: fremdes Gewerk mitgezaehlt (%)', v; end if;
  raise notice 'PASS KS4: ein Auftrag mit anderem Gewerk bleibt unberuehrt';
end $$;

do $$
declare v integer;
begin
  select benachrichtigte_betriebe into v from jobs where id = 'cafe0000-0000-0000-0000-0000000000cc';
  if v <> 0 then raise exception 'FAIL KS5: fremder PLZ-Bereich mitgezaehlt (%)', v; end if;
  raise notice 'PASS KS5: ein Auftrag im anderen Postleitzahlenbereich bleibt unberuehrt';
end $$;

do $$
declare v integer;
begin
  select benachrichtigte_betriebe into v from jobs where id = 'cafe0000-0000-0000-0000-0000000000dd';
  if v <> 0 then
    raise exception 'FAIL KS6: ein Handwerksbetrieb wurde auf einen Nachbarschafts-Auftrag gezaehlt (%)', v;
  end if;
  raise notice 'PASS KS6: die Trennung Handwerk/Nachbarschaft haelt auch hier';
end $$;

do $$
declare v integer;
begin
  select benachrichtigte_betriebe into v from jobs where id = 'cafe0000-0000-0000-0000-0000000000ff';
  if v <> 0 then raise exception 'FAIL KS11: der eigene Auftrag des Betriebs wurde mitgezaehlt (%)', v; end if;
  raise notice 'PASS KS11: der eigene Auftrag des Betriebs zaehlt nicht mit';
end $$;

do $$
declare v integer;
begin
  select benachrichtigte_betriebe into v from jobs where id = 'cafe0000-0000-0000-0000-00000000009f';
  if v <> 0 then raise exception 'FAIL KS12: ein nicht mehr offener Auftrag wurde mitgezaehlt (%)', v; end if;
  raise notice 'PASS KS12: ein vergebener Auftrag bleibt unberuehrt';
end $$;

-- ── KS3 ────────────────────────────────────────────────────────────────────
-- Steht BEWUSST hinter den Gegenproben. psql laeuft mit ON_ERROR_STOP: die
-- erste scheiternde Zusicherung beendet die Datei. Solange KS3 vorne stand,
-- fing es jede Mutation an der Auswahl ab, und KS4 bis KS12 wurden in den
-- Proben nie erreicht -- neun Zusicherungen, von denen keine je bewiesen war.
-- Der Betrieb sieht zwei passende Auftraege (A und E). Die Mitteilung muss
-- die Zahl nennen, sonst ist sie eine Floskel.
do $$
declare v_text text; v_route text;
begin
  select text, route into v_text, v_route from notifications
   where empfaenger = 'cafe0000-0000-0000-0000-00000000b001'
     and quelle_tabelle = 'provider_profiles';
  if v_text is null then
    raise exception 'FAIL KS3: der neue Betrieb hat keine Mitteilung bekommen';
  end if;
  if position('2 offene Aufträge' in v_text) = 0 then
    raise exception 'FAIL KS3: die Mitteilung nennt die Zahl nicht: %', v_text;
  end if;
  if v_route <> '/betrieb/auftraege' then
    raise exception 'FAIL KS3: die Mitteilung fuehrt nach % statt zu den Anfragen', v_route;
  end if;
  raise notice 'PASS KS3: der neue Betrieb erfaehrt, wie viel Arbeit wartet';
end $$;

-- ── KS7 ────────────────────────────────────────────────────────────────────
-- Auftrag E stand auf NULL: der erste Lauf hat nie stattgefunden. Die erste
-- Fassung von 0950 liess NULL deshalb stehen. Mit dem Nachweis aus
-- job_benachrichtigungen ist die Frage beantwortet: genau EIN Betrieb wurde
-- informiert, also ist 1 keine Behauptung, sondern die Zahl der Zeilen.
do $$
declare v integer; v_id uuid;
begin
  select benachrichtigte_betriebe into v from jobs where id = 'cafe0000-0000-0000-0000-0000000000ee';
  if v is distinct from 1 then
    raise exception 'FAIL KS7: der NULL-Auftrag steht auf % statt 1', v;
  end if;
  select id into v_id from notifications
   where quelle_tabelle = 'jobs' and quelle_id = 'cafe0000-0000-0000-0000-0000000000ee';
  if v_id is null then
    raise exception 'FAIL KS7: der Kunde des NULL-Auftrags bekam keine Mitteilung';
  end if;
  raise notice 'PASS KS7: auch ein Auftrag ohne ersten Lauf bekommt die belegte Zahl';
end $$;

-- ── KS8 (Gegenprobe) ───────────────────────────────────────────────────────
-- Zweites Speichern am bereits marktfaehigen Profil. Ohne die
-- Uebergangs-Bedingung liefe die Schleife erneut und der Kunde saehe eine 2,
-- obwohl nur ein Betrieb da ist.
update provider_profiles set radius_km = 30
  where id = 'cafe0000-0000-0000-0000-00000000b001';
do $$
declare v integer;
begin
  select benachrichtigte_betriebe into v from jobs where id = 'cafe0000-0000-0000-0000-0000000000aa';
  if v <> 1 then
    raise exception 'FAIL KS8: zweites Speichern hat erneut gezaehlt (%)', v;
  end if;
  raise notice 'PASS KS8: ein zweites Speichern zaehlt nicht noch einmal';
end $$;

-- ── KS10 ───────────────────────────────────────────────────────────────────
-- Ein bereits marktfaehiger Betrieb nimmt ein Gewerk dazu. Damit wird
-- Nachfrage erreichbar, die es vorher nicht war (Auftrag B). Auftrag A darf
-- dabei NICHT ein zweites Mal zaehlen -- das war der Fehler in meiner ersten
-- Fassung, gefunden beim Schreiben genau dieser Zeile.
update provider_profiles set category_ids = array['elektro','garten']
  where id = 'cafe0000-0000-0000-0000-00000000b001';
do $$
declare v_b integer; v_a integer; v_zeilen integer;
begin
  select benachrichtigte_betriebe into v_b from jobs where id = 'cafe0000-0000-0000-0000-0000000000bb';
  select benachrichtigte_betriebe into v_a from jobs where id = 'cafe0000-0000-0000-0000-0000000000aa';
  select count(*) into v_zeilen from job_benachrichtigungen
   where job_id = 'cafe0000-0000-0000-0000-0000000000aa';
  if v_b <> 1 then
    raise exception 'FAIL KS10: das neue Gewerk erreichte den wartenden Auftrag nicht (%)', v_b;
  end if;
  if v_a <> 1 then
    raise exception 'FAIL KS10: derselbe Betrieb wurde an Auftrag A doppelt gezaehlt (%)', v_a;
  end if;
  if v_zeilen <> 1 then
    raise exception 'FAIL KS10: % Nachweiszeilen fuer einen Betrieb an einem Auftrag', v_zeilen;
  end if;
  raise notice 'PASS KS10: ein neues Gewerk erreicht wartende Auftraege, ohne doppelt zu zaehlen';
end $$;

-- ── KS13 (Gegenprobe) ──────────────────────────────────────────────────────
-- Der Kunde bekommt zu EINEM Auftrag genau EINE Mitteilung, auch nach dem
-- zweiten Anlass. Sonst schaltet er die Glocke ab, und dann ist auch die
-- Pflichtmitteilung aus 0860 nicht mehr zugestellt.
do $$
declare v integer;
begin
  select count(*) into v from notifications
   where quelle_tabelle = 'jobs' and quelle_id = 'cafe0000-0000-0000-0000-0000000000aa';
  if v <> 1 then
    raise exception 'FAIL KS13: % Mitteilungen zu einem Auftrag', v;
  end if;
  raise notice 'PASS KS13: ein Auftrag, eine Mitteilung an den Kunden';
end $$;

-- ── KS14 (Gegenprobe) ──────────────────────────────────────────────────────
-- Der Nachweis gehoert niemandem ausser dem Server. Ein Angemeldeter, der
-- ihn lesen koennte, wuesste, welcher Betrieb welchen Auftrag gesehen hat.
set role authenticated;
do $$
declare v integer;
begin
  -- Zwei zulaessige Ausgaenge: kein Leserecht auf der Tabelle, oder RLS ohne
  -- Policy liefert null Zeilen. Beides ist dicht. Was NICHT sein darf, ist
  -- eine Zeile.
  begin
    select count(*) into v from job_benachrichtigungen;
  exception when insufficient_privilege then
    raise notice 'PASS KS14: der Nachweis ist fuer Angemeldete nicht lesbar (kein Leserecht)';
    return;
  end;
  if v <> 0 then
    raise exception 'FAIL KS14: ein Angemeldeter sieht % Nachweiszeilen', v;
  end if;
  raise notice 'PASS KS14: der Nachweis ist fuer Angemeldete nicht lesbar (RLS ohne Policy)';
end $$;
reset role;
