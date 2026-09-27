-- 1040: Aufbewahrungsfristen aus der Datenschutzerklaerung.
--
-- ANLASS: Die Datenschutzerklaerung nennt fuenf Fristen. Fuer zwei davon gab
-- es bis zum 27.09.2026 keinen Mechanismus: Chat-Nachrichten (6 Monate nach
-- Auftragsabschluss) und das Consent-Log (3 Jahre). Eine zugesagte Frist ohne
-- Code ist eine unwahre Angabe, sobald die Plattform aelter ist als die Frist.
--
-- Hier geprueft wird, was die DATENBANK tut. Ob die Zusage im Text mit dem
-- Code uebereinstimmt, prueft scripts/aufbewahrung-check.py; ob der Betreiber
-- den Rueckstand SIEHT, Reise 15.

alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;
alter table public.jobs disable trigger user;
alter table public.provider_profiles disable trigger user;

insert into auth.users (id,email,email_confirmed_at) values
  ('a0e00001-0000-0000-0000-000000000000','af-kunde@test.de',now()),
  ('a0e00002-0000-0000-0000-000000000000','af-betrieb@test.de',now());
insert into profiles (id,role,email,email_verified_at,plz) values
  ('a0e00001-0000-0000-0000-000000000000','customer','af-kunde@test.de',now(),'50667'),
  ('a0e00002-0000-0000-0000-000000000000','provider','af-betrieb@test.de',now(),'50667');
insert into provider_profiles (id,business_name,is_nachbarschaft) values
  ('a0e00002-0000-0000-0000-000000000000','AF-Betrieb',false);

-- Drei Auftraege: alt, frisch, alt-mit-Streit.
insert into jobs (id,customer_id,title,description,category,address_plz,address_city,track,status) values
  ('a0e00011-0000-0000-0000-000000000000','a0e00001-0000-0000-0000-000000000000','Alt','Lange her.','Elektro','50667','Köln','handwerker','completed'),
  ('a0e00012-0000-0000-0000-000000000000','a0e00001-0000-0000-0000-000000000000','Frisch','Gerade eben.','Elektro','50667','Köln','handwerker','completed'),
  ('a0e00013-0000-0000-0000-000000000000','a0e00001-0000-0000-0000-000000000000','Streit','Mit Streitfall.','Elektro','50667','Köln','handwerker','completed');

insert into contracts (id,job_id,customer_id,provider_id,price_gross,customer_total,provider_payout,track,status,completed_at) values
  ('a0e00021-0000-0000-0000-000000000000','a0e00011-0000-0000-0000-000000000000','a0e00001-0000-0000-0000-000000000000','a0e00002-0000-0000-0000-000000000000',100,102.50,92,'handwerker','completed',now() - interval '7 months'),
  ('a0e00022-0000-0000-0000-000000000000','a0e00012-0000-0000-0000-000000000000','a0e00001-0000-0000-0000-000000000000','a0e00002-0000-0000-0000-000000000000',100,102.50,92,'handwerker','completed',now() - interval '2 months'),
  ('a0e00023-0000-0000-0000-000000000000','a0e00013-0000-0000-0000-000000000000','a0e00001-0000-0000-0000-000000000000','a0e00002-0000-0000-0000-000000000000',100,102.50,92,'handwerker','completed',now() - interval '8 months');

insert into disputes (contract_id,reporter_id,case_id,category,description,status) values
  ('a0e00023-0000-0000-0000-000000000000','a0e00001-0000-0000-0000-000000000000','AF-1','quality',
   'Beschreibung mit mindestens dreissig Zeichen Laenge.','open');

insert into messages (job_id,sender_id,sender_role,body) values
  ('a0e00011-0000-0000-0000-000000000000','a0e00001-0000-0000-0000-000000000000','customer','Alter Chat'),
  ('a0e00012-0000-0000-0000-000000000000','a0e00001-0000-0000-0000-000000000000','customer','Frischer Chat'),
  ('a0e00013-0000-0000-0000-000000000000','a0e00001-0000-0000-0000-000000000000','customer','Chat im Streit');

insert into dsgvo_consents (id,user_id,text_version,angezeigter_text,pflicht,analytics,pstg,erteilt_am) values
  ('a0e00031-0000-0000-0000-000000000000','a0e00001-0000-0000-0000-000000000000','1.0',
   'Der angezeigte Einwilligungstext, alt genug fuer die Frist.',true,false,true, now() - interval '4 years'),
  ('a0e00032-0000-0000-0000-000000000000','a0e00001-0000-0000-0000-000000000000','1.0',
   'Der angezeigte Einwilligungstext, noch innerhalb der Frist.',true,false,true, now() - interval '1 year');

-- TEST AF1: die Selbstauskunft meldet den Rueckstand, BEVOR etwas geloescht
-- wird. Ohne sie waere eine Frist ohne Scheduler unsichtbar.
do $$
declare r record;
begin
  select * into r from public.aufbewahrung_status();
  if r.chat_ueberfaellig < 1 then
    raise exception 'FAIL AF1: kein ueberfaelliger Chat gemeldet (%)', r.chat_ueberfaellig;
  end if;
  if r.consent_ueberfaellig < 1 then
    raise exception 'FAIL AF1: keine ueberfaellige Einwilligung gemeldet (%)', r.consent_ueberfaellig;
  end if;
  if not r.rueckstand then
    raise exception 'FAIL AF1: Rueckstand steht auf falsch, obwohl Zeilen ueberfaellig sind';
  end if;
  raise notice 'PASS AF1: die Selbstauskunft meldet den Rueckstand (% Chat, % Consent)',
    r.chat_ueberfaellig, r.consent_ueberfaellig;
end $$;

-- TEST AF2: der Chat des alten Auftrags wird geloescht.
do $$
declare n integer; v_da integer;
begin
  n := public.chat_aufbewahrung_anwenden();
  select count(*) into v_da from messages where job_id = 'a0e00011-0000-0000-0000-000000000000';
  if v_da <> 0 then
    raise exception 'FAIL AF2: % alte Nachrichten stehen noch', v_da;
  end if;
  if n < 1 then raise exception 'FAIL AF2: es wurden % Zeilen gemeldet', n; end if;
  raise notice 'PASS AF2: Chat nach sechs Monaten geloescht (% Zeilen)', n;
end $$;

-- TEST AF3 (Gegenprobe): der frische Auftrag bleibt unberuehrt. Ohne diese
-- Zusicherung waere "alles loeschen" der bequemste gruene Haken.
do $$
declare v_da integer;
begin
  select count(*) into v_da from messages where job_id = 'a0e00012-0000-0000-0000-000000000000';
  if v_da <> 1 then
    raise exception 'FAIL AF3: der frische Chat wurde mitgeloescht (% uebrig)', v_da;
  end if;
  raise notice 'PASS AF3: ein Auftrag innerhalb der Frist behaelt seinen Chat';
end $$;

-- TEST AF4: waehrend eines offenen Streitfalls bleibt der Chat stehen.
-- Er ist dort das Beweismittel beider Seiten (Art. 17 Abs. 3 lit. e DSGVO).
do $$
declare v_da integer;
begin
  select count(*) into v_da from messages where job_id = 'a0e00013-0000-0000-0000-000000000000';
  if v_da <> 1 then
    raise exception 'FAIL AF4: der Chat eines offenen Streitfalls wurde geloescht';
  end if;
  raise notice 'PASS AF4: offener Streitfall schuetzt den Chat vor der Frist';
end $$;

-- TEST AF5: ist der Streit beigelegt, greift die Frist wieder. Ohne diese
-- Zusicherung waere ein einziger Streitfall eine unbefristete Aufbewahrung.
do $$
declare v_da integer;
begin
  update disputes set status = 'resolved'
   where contract_id = 'a0e00023-0000-0000-0000-000000000000';
  perform public.chat_aufbewahrung_anwenden();
  select count(*) into v_da from messages where job_id = 'a0e00013-0000-0000-0000-000000000000';
  if v_da <> 0 then
    raise exception 'FAIL AF5: nach Beilegung steht der Chat weiter (% uebrig)', v_da;
  end if;
  raise notice 'PASS AF5: nach Beilegung des Streits greift die Frist';
end $$;

-- TEST AF6: Einwilligungen aelter als drei Jahre werden geloescht, juengere
-- bleiben. Beides in EINER Zusicherung, weil genau die Abgrenzung der Punkt
-- ist.
do $$
declare n integer; v_alt integer; v_neu integer;
begin
  n := public.consent_aufbewahrung_anwenden();
  select count(*) into v_alt from dsgvo_consents where id = 'a0e00031-0000-0000-0000-000000000000';
  select count(*) into v_neu from dsgvo_consents where id = 'a0e00032-0000-0000-0000-000000000000';
  if v_alt <> 0 then raise exception 'FAIL AF6: die alte Einwilligung steht noch'; end if;
  if v_neu <> 1 then raise exception 'FAIL AF6: die junge Einwilligung wurde mitgeloescht'; end if;
  raise notice 'PASS AF6: Einwilligungen verfallen nach drei Jahren, nicht frueher (% geloescht)', n;
end $$;

-- TEST AF7 (Gegenprobe): nach dem Anwenden meldet die Selbstauskunft keinen
-- Rueckstand mehr. Ohne das koennte sie eine feste Zahl zurueckgeben.
do $$
declare r record;
begin
  select * into r from public.aufbewahrung_status();
  if r.chat_ueberfaellig <> 0 or r.consent_ueberfaellig <> 0 then
    raise exception 'FAIL AF7: Rueckstand bleibt gemeldet (% Chat, % Consent)',
      r.chat_ueberfaellig, r.consent_ueberfaellig;
  end if;
  if r.rueckstand then
    raise exception 'FAIL AF7: Rueckstand steht auf wahr, obwohl nichts ueberfaellig ist';
  end if;
  raise notice 'PASS AF7: nach dem Anwenden meldet die Auskunft keinen Rueckstand';
end $$;
