-- 0930: Bewertungsfrist (14 Tage) und Antwortrecht
--
-- Geprueft wird das, was die App dem Nutzer ZUSAGT:
--   BF: nach 14 Tagen nimmt der Server keine Bewertung mehr an;
--   BA: nur die bewertete Person darf antworten, genau einmal, und sie kann
--       dabei die Bewertung selbst nicht umschreiben.
--
-- Die Gegenproben sind Pflicht: eine Sperre, die ALLES sperrt, ist der
-- einfachste gruene Haken (CLAUDE.md, 07.09.).

alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;

insert into auth.users (id,email,email_confirmed_at) values
  ('bf111111-0000-0000-0000-0000000000f1','bf-kunde@test.de',now()),
  ('bf222222-0000-0000-0000-0000000000f2','bf-anbieter@test.de',now()),
  ('bf333333-0000-0000-0000-0000000000f3','bf-fremd@test.de',now());
insert into profiles (id,role,email,email_verified_at) values
  ('bf111111-0000-0000-0000-0000000000f1','customer','bf-kunde@test.de',now()),
  ('bf222222-0000-0000-0000-0000000000f2','provider','bf-anbieter@test.de',now()),
  ('bf333333-0000-0000-0000-0000000000f3','provider','bf-fremd@test.de',now());
insert into provider_profiles (id,business_name,is_nachbarschaft) values
  ('bf222222-0000-0000-0000-0000000000f2','BF-Betrieb',false),
  ('bf333333-0000-0000-0000-0000000000f3','BF-Fremd',false);

insert into jobs (id,customer_id,provider_id,title,description,category,address_plz,address_city,track,status) values
  ('bf444444-0000-0000-0000-0000000000f4','bf111111-0000-0000-0000-0000000000f1','bf222222-0000-0000-0000-0000000000f2',
   'BF-Job','Beschreibung lang genug fuer den Check.','Elektro','50667','Koeln','handwerker','active'),
  ('bf555555-0000-0000-0000-0000000000f5','bf111111-0000-0000-0000-0000000000f1','bf222222-0000-0000-0000-0000000000f2',
   'BF-Job-alt','Beschreibung lang genug fuer den Check.','Elektro','50667','Koeln','handwerker','active'),
  ('bf666666-0000-0000-0000-0000000000f6','bf111111-0000-0000-0000-0000000000f1','bf222222-0000-0000-0000-0000000000f2',
   'BF-Job-ohne','Beschreibung lang genug fuer den Check.','Elektro','50667','Koeln','handwerker','active');

-- Drei Vertraege: frisch abgeschlossen, vor 20 Tagen abgeschlossen, und einer
-- ohne Zeitstempel (Altbestand von vor 0650).
insert into contracts (id,job_id,customer_id,provider_id,price_gross,customer_total,provider_payout,track,status,completed_at) values
  ('bf777777-0000-0000-0000-0000000000f7','bf444444-0000-0000-0000-0000000000f4',
   'bf111111-0000-0000-0000-0000000000f1','bf222222-0000-0000-0000-0000000000f2',
   100,102.50,92,'handwerker','completed', now() - interval '1 day'),
  ('bf888888-0000-0000-0000-0000000000f8','bf555555-0000-0000-0000-0000000000f5',
   'bf111111-0000-0000-0000-0000000000f1','bf222222-0000-0000-0000-0000000000f2',
   100,102.50,92,'handwerker','completed', now() - interval '20 days'),
  ('bf999999-0000-0000-0000-0000000000f9','bf666666-0000-0000-0000-0000000000f6',
   'bf111111-0000-0000-0000-0000000000f1','bf222222-0000-0000-0000-0000000000f2',
   100,102.50,92,'handwerker','completed', null);

-- ── Frist ──────────────────────────────────────────────────────────────────
set request.jwt.claim.sub = 'bf111111-0000-0000-0000-0000000000f1';
set role authenticated;

-- BF1 GEGENPROBE zuerst: innerhalb der Frist geht es. Ohne diesen Test waere
--     "gar nichts geht mehr" ein bestandener Fristtest.
do $$
begin
  insert into reviews (contract_id,reviewer_id,reviewed_id,rating,comment) values
    ('bf777777-0000-0000-0000-0000000000f7','bf111111-0000-0000-0000-0000000000f1',
     'bf222222-0000-0000-0000-0000000000f2',5,'Alles gut gelaufen.');
  raise notice 'PASS BF1: innerhalb der Frist wird die Bewertung angenommen';
exception when insufficient_privilege then
  raise exception 'FAIL BF1: die Frist sperrt auch eine fristgerechte Bewertung';
end $$;

-- BF2: nach 20 Tagen nicht mehr. Das ist die Zusage aus dem Hilfe-Chat.
do $$
begin
  insert into reviews (contract_id,reviewer_id,reviewed_id,rating,comment) values
    ('bf888888-0000-0000-0000-0000000000f8','bf111111-0000-0000-0000-0000000000f1',
     'bf222222-0000-0000-0000-0000000000f2',1,'Zwanzig Tage spaeter.');
  raise exception 'FAIL BF2: eine Bewertung nach 20 Tagen wurde angenommen';
exception when insufficient_privilege then
  raise notice 'PASS BF2: nach Ablauf der Frist wird nichts mehr angenommen';
end $$;

-- BF3: fehlt der Zeitstempel, nimmt ein fehlender Wert niemandem sein Recht.
do $$
begin
  insert into reviews (contract_id,reviewer_id,reviewed_id,rating,comment) values
    ('bf999999-0000-0000-0000-0000000000f9','bf111111-0000-0000-0000-0000000000f1',
     'bf222222-0000-0000-0000-0000000000f2',4,'Vertrag ohne Zeitstempel.');
  raise notice 'PASS BF3: ohne completed_at sperrt die Frist niemanden aus';
exception when insufficient_privilege then
  raise exception 'FAIL BF3: ein fehlender Zeitstempel sperrt die Bewertung';
end $$;

reset role;

-- ── Antwortrecht ───────────────────────────────────────────────────────────
-- BA1: ein Fremder darf nicht antworten.
set request.jwt.claim.sub = 'bf333333-0000-0000-0000-0000000000f3';
set role authenticated;
do $$
declare v_zeilen integer;
begin
  update reviews set antwort = 'Ich war das gar nicht.'
    where contract_id = 'bf777777-0000-0000-0000-0000000000f7';
  get diagnostics v_zeilen = row_count;
  if v_zeilen > 0 then
    raise exception 'FAIL BA1: ein Fremder konnte antworten';
  end if;
  raise notice 'PASS BA1: ein Fremder kann nicht antworten';
end $$;
reset role;

-- BA2: der Kunde, der bewertet HAT, darf ebenfalls nicht antworten. Die Policy
--      haengt an reviewed_id, nicht an "irgendwie beteiligt".
set request.jwt.claim.sub = 'bf111111-0000-0000-0000-0000000000f1';
set role authenticated;
do $$
declare v_zeilen integer;
begin
  update reviews set antwort = 'Nachtrag von mir.'
    where contract_id = 'bf777777-0000-0000-0000-0000000000f7';
  get diagnostics v_zeilen = row_count;
  if v_zeilen > 0 then
    raise exception 'FAIL BA2: der Bewertende konnte die Antwort schreiben';
  end if;
  raise notice 'PASS BA2: wer bewertet hat, schreibt nicht die Antwort';
end $$;
reset role;

-- BA3: die bewertete Person darf. Gegenprobe zu BA1/BA2.
set request.jwt.claim.sub = 'bf222222-0000-0000-0000-0000000000f2';
set role authenticated;
do $$
declare v_zeilen integer;
begin
  update reviews set antwort = 'Danke, hat Spass gemacht.'
    where contract_id = 'bf777777-0000-0000-0000-0000000000f7';
  get diagnostics v_zeilen = row_count;
  if v_zeilen <> 1 then
    raise exception 'FAIL BA3: die bewertete Person konnte nicht antworten (% Zeilen)', v_zeilen;
  end if;
  raise notice 'PASS BA3: die bewertete Person darf antworten';
end $$;

-- BA4: der Zeitstempel kommt vom Trigger, nicht vom Client.
do $$
declare v_zeit timestamptz;
begin
  select antwort_am into v_zeit from reviews
    where contract_id = 'bf777777-0000-0000-0000-0000000000f7';
  if v_zeit is null then
    raise exception 'FAIL BA4: antwort_am blieb leer';
  end if;
  raise notice 'PASS BA4: der Zeitstempel der Antwort kommt vom Server';
end $$;

-- BA5: ein zweites Mal geht nicht. Sonst waere "eine Antwort" nur ein Wort.
do $$
declare v_zeilen integer;
begin
  update reviews set antwort = 'Doch noch etwas anderes.'
    where contract_id = 'bf777777-0000-0000-0000-0000000000f7';
  get diagnostics v_zeilen = row_count;
  if v_zeilen > 0 then
    raise exception 'FAIL BA5: die Antwort liess sich ersetzen';
  end if;
  raise notice 'PASS BA5: eine gegebene Antwort laesst sich nicht ersetzen';
end $$;

-- BA6: und die Bewertung selbst bleibt unantastbar. Ohne Spaltenrecht koennte
--      die bewertete Person aus einem Stern fuenf machen.
do $$
begin
  update reviews set rating = 5
    where contract_id = 'bf999999-0000-0000-0000-0000000000f9';
  raise exception 'FAIL BA6: die bewertete Person konnte das rating aendern';
exception when insufficient_privilege then
  raise notice 'PASS BA6: rating bleibt fuer die bewertete Person gesperrt';
end $$;

do $$
begin
  update reviews set comment = 'Klingt jetzt netter.'
    where contract_id = 'bf999999-0000-0000-0000-0000000000f9';
  raise exception 'FAIL BA7: die bewertete Person konnte den Text aendern';
exception when insufficient_privilege then
  raise notice 'PASS BA7: comment bleibt fuer die bewertete Person gesperrt';
end $$;

-- BA8: und antwort_am ebenfalls nicht von Hand.
do $$
begin
  update reviews set antwort_am = now() - interval '5 years'
    where contract_id = 'bf999999-0000-0000-0000-0000000000f9';
  raise exception 'FAIL BA8: der Zeitstempel liess sich von Hand setzen';
exception when insufficient_privilege then
  raise notice 'PASS BA8: antwort_am ist fuer Angemeldete gesperrt';
end $$;
reset role;

-- BA9: eine leere Antwort wird nicht gespeichert. Geprueft ueber service_role,
--      weil nur dort der Trigger und nicht schon die Policy greift.
set role service_role;
do $$
declare v_durch boolean := false;
begin
  begin
    update reviews set antwort = '   '
      where contract_id = 'bf999999-0000-0000-0000-0000000000f9';
    v_durch := true;
  exception when raise_exception then
    null;   -- der Trigger hat abgelehnt, so soll es sein
  end;
  if v_durch then
    raise exception 'FAIL BA9: eine leere Antwort wurde gespeichert';
  end if;
  raise notice 'PASS BA9: eine leere Antwort wird abgelehnt';
end $$;
reset role;

-- BA10: der service_role umgeht RLS (BYPASSRLS). Fuer ihn ist die Policy
--       wirkungslos, und der Trigger ist die EINZIGE Stelle, die eine gegebene
--       Antwort schuetzt. Ohne diesen Test bleibt die Trigger-Bedingung
--       unbelegt: die Policy faengt fuer Angemeldete schon alles ab.
--       Gemessen am 16.09.: die Mutation "Unveraenderlichkeit im Trigger
--       entfernt" blieb ohne BA10 vollstaendig gruen.
set role service_role;
do $$
declare v_durch boolean := false; v_text text;
begin
  update reviews set antwort = 'Erste Antwort ueber den Dienstweg.'
    where contract_id = 'bf999999-0000-0000-0000-0000000000f9';
  begin
    update reviews set antwort = 'Und jetzt doch etwas anderes.'
      where contract_id = 'bf999999-0000-0000-0000-0000000000f9';
    v_durch := true;
  exception when raise_exception then
    null;
  end;
  if v_durch then
    raise exception 'FAIL BA10: der service_role konnte eine Antwort ersetzen';
  end if;
  select antwort into v_text from reviews
    where contract_id = 'bf999999-0000-0000-0000-0000000000f9';
  if v_text is distinct from 'Erste Antwort ueber den Dienstweg.' then
    raise exception 'FAIL BA10: die erste Antwort steht nicht mehr da (%)', v_text;
  end if;
  raise notice 'PASS BA10: auch ueber den Dienstweg bleibt die erste Antwort stehen';
end $$;
reset role;
