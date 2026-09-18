-- 0960: PIN beim Arbeitsbeginn.
--
-- Der Kern ist NICHT "die richtige PIN wirkt". Das ist leicht gruen zu
-- bekommen. Der Kern ist, dass sie nur wirkt, wenn sie WIRKLICH von der
-- richtigen Person kommt, und dass sie sich nicht durchprobieren laesst:
--   der Betrieb darf die Zahl nicht lesen (SP1), der Kunde schon (SP2),
--   von Hand ist der Zeitpunkt nicht setzbar (SP4),
--   drei Fehlversuche sperren (SP6), und die richtige Zahl wirkt waehrend
--   der Sperre NICHT (SP7).
--
-- Und eine Gegenprobe, die nichts mit der PIN zu tun hat: der Rechteentzug
-- auf `contracts` darf nicht die gewoehnlichen Aenderungen der Parteien
-- mitsperren (SP3). Genau dieser Fehler waere in der Produktion ein
-- Totalausfall von Abnahme, Unterschrift und Stornierung.

-- MUTATIONSPROBE 18.09.2026 (15 Proben gegen 0960, jede einzeln, jede
-- zurueckgesetzt). Jede der vierzehn Zusicherungen ist damit nachweislich in
-- der Lage, rot zu werden:
--   Betrieb darf die PIN lesen            -> SP1
--   niemand darf sie lesen                -> SP2
--   Rechte entzogen, nicht zurueckgegeben -> escrow.sql (permission denied)
--   Spaltenrecht gar nicht entzogen       -> SP4
--   falsche PIN wird angenommen           -> SP5
--   Fehlversuche werden nicht gezaehlt    -> SP6
--   Sperre entfernt                       -> SP7
--   Zeitpunkt wird bei Erfolg nicht gesetzt -> SP8
--   zweiter Aufruf ueberschreibt          -> SP9
--   jeder Angemeldete darf einloesen      -> SP10
--   beide Parteien duerfen einloesen      -> SP11
--   auch die Nachbarschaft bekommt eine   -> SP12
--   der Kunde erfaehrt die Sperre nicht   -> SP13
--   PIN sechsstellig erzeugt              -> SP14
--
-- EINE Mutation wird NICHT hier rot, sondern frueher: nimmt man `auth.uid()`
-- ganz aus der Aufrufer-Pruefung, schlaegt `rechte.sql` (RA) zu, bevor diese
-- Datei ueberhaupt laeuft -- eine SECURITY-DEFINER-Funktion ohne `auth.uid()`,
-- die fuer Angemeldete ausfuehrbar ist. Zwei Schichten fuer dieselbe Sache,
-- und das ist so gewollt.
--
-- GRENZE von SP3: die Probe dazu (Rechte nicht zurueckgegeben) wird in
-- `escrow.sql` rot, weil die frueher laeuft. SP3 benennt trotzdem, WORUM es
-- geht -- ein Rechteentzug, der Abnahme, Unterschrift und Stornierung
-- mitsperrt, waere in der Produktion ein Totalausfall.

alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;
alter table public.jobs disable trigger user;

insert into auth.users (id,email,email_confirmed_at) values
  ('5b111111-0000-0000-0000-0000000000c1','sp-kunde@test.de',now()),
  ('5b222222-0000-0000-0000-0000000000b1','sp-betrieb@test.de',now()),
  ('5b333333-0000-0000-0000-0000000000f1','sp-fremd@test.de',now());
insert into profiles (id,role,email,email_verified_at) values
  ('5b111111-0000-0000-0000-0000000000c1','customer','sp-kunde@test.de',now()),
  ('5b222222-0000-0000-0000-0000000000b1','provider','sp-betrieb@test.de',now()),
  ('5b333333-0000-0000-0000-0000000000f1','provider','sp-fremd@test.de',now());
-- `contracts.provider_id` zeigt seit 0470 auf provider_profiles, nicht nur
-- auf profiles. Ohne diese beiden Zeilen scheitert schon das Anlegen.
insert into provider_profiles (id,available,kyc_verified,category_ids) values
  ('5b222222-0000-0000-0000-0000000000b1',true,true,array['elektro']),
  ('5b333333-0000-0000-0000-0000000000f1',true,true,array['elektro']);

insert into jobs (id,customer_id,title,description,category,category_id,address_plz,address_city,track,status) values
  ('5b444444-0000-0000-0000-0000000000a1','5b111111-0000-0000-0000-0000000000c1',
   'SP-Job','Lang genug beschrieben hier drin.','Elektro','elektro','50667','Koeln','handwerker','active'),
  ('5b444444-0000-0000-0000-0000000000a2','5b111111-0000-0000-0000-0000000000c1',
   'SP-Job2','Lang genug beschrieben hier drin.','Elektro','elektro','50667','Koeln','handwerker','active'),
  ('5b444444-0000-0000-0000-0000000000a3','5b111111-0000-0000-0000-0000000000c1',
   'SP-NB','Lang genug beschrieben hier drin.','Elektro','elektro','50667','Koeln','nachbarschaft','active');

-- Die Vertraege loesen den Trigger aus. Triggern NICHT abschalten: genau ihr
-- Wirken ist hier der Pruefgegenstand (SP14).
insert into contracts (id,job_id,customer_id,provider_id,price_gross,customer_total,provider_payout,track,status) values
  ('5b555555-0000-0000-0000-0000000000e1','5b444444-0000-0000-0000-0000000000a1',
   '5b111111-0000-0000-0000-0000000000c1','5b222222-0000-0000-0000-0000000000b1',
   400,410,368,'handwerker','active'),
  ('5b555555-0000-0000-0000-0000000000e2','5b444444-0000-0000-0000-0000000000a2',
   '5b111111-0000-0000-0000-0000000000c1','5b222222-0000-0000-0000-0000000000b1',
   400,410,368,'handwerker','active'),
  ('5b555555-0000-0000-0000-0000000000e3','5b444444-0000-0000-0000-0000000000a3',
   '5b111111-0000-0000-0000-0000000000c1','5b222222-0000-0000-0000-0000000000b1',
   80,82,74,'nachbarschaft','active');

-- ── SP14 ───────────────────────────────────────────────────────────────────
do $$
declare v text;
begin
  select pin into v from vertrag_start_pins
   where contract_id = '5b555555-0000-0000-0000-0000000000e1';
  if v is null or v !~ '^[0-9]{4}$' then
    raise exception 'FAIL SP14: der Vertrag bekam keine vierstellige PIN (%)', coalesce(v,'NULL');
  end if;
  raise notice 'PASS SP14: jeder Vertrag bekommt beim Anlegen eine vierstellige PIN';
end $$;

-- ── SP12 (Gegenprobe) ──────────────────────────────────────────────────────
-- Nachbarschaftshilfe bekommt keine. Ohne diese Probe waere "die PIN gibt es
-- ueberall" ein bestandener Test.
do $$
declare v integer;
begin
  select count(*) into v from vertrag_start_pins
   where contract_id = '5b555555-0000-0000-0000-0000000000e3';
  if v <> 0 then
    raise exception 'FAIL SP12: auch die Nachbarschaftshilfe bekam eine PIN';
  end if;
  raise notice 'PASS SP12: Nachbarschaftshilfe bekommt keine PIN';
end $$;

-- Die beiden Zahlen EINMAL holen, solange noch niemand die Rolle gewechselt
-- hat. Innerhalb eines DO-Blocks ginge es nicht: eine angemeldete Rolle kann
-- nicht `set role postgres` -- sie ist kein Mitglied. Genau daran waere der
-- erste Entwurf dieses Tests gescheitert.
-- Als Sitzungswert, nicht als psql-Variable: psql ersetzt `:'name'` NICHT
-- innerhalb von Dollar-Quotes, und jeder Pruefblock unten ist einer. Genau
-- daran ist der zweite Entwurf dieses Tests gescheitert.
select set_config('sp.pin_e1', pin, false) from vertrag_start_pins
 where contract_id = '5b555555-0000-0000-0000-0000000000e1';
select set_config('sp.pin_e2', pin, false) from vertrag_start_pins
 where contract_id = '5b555555-0000-0000-0000-0000000000e2';

-- ── SP1: der Betrieb darf die Zahl NICHT lesen ─────────────────────────────
set request.jwt.claim.sub = '5b222222-0000-0000-0000-0000000000b1';
set role authenticated;
do $$
declare v integer;
begin
  select count(*) into v from vertrag_start_pins
   where contract_id = '5b555555-0000-0000-0000-0000000000e1';
  if v <> 0 then
    raise exception 'FAIL SP1: der Betrieb kann die PIN seines Auftrags lesen -- sie belegt damit nichts';
  end if;
  raise notice 'PASS SP1: der Betrieb kann die PIN nicht lesen';
exception when insufficient_privilege then
  raise notice 'PASS SP1: der Betrieb kann die PIN nicht lesen (kein Leserecht)';
end $$;

-- ── SP4: der Zeitpunkt ist von Hand nicht setzbar ──────────────────────────
do $$
begin
  update contracts set arbeit_begonnen_am = now()
   where id = '5b555555-0000-0000-0000-0000000000e1';
  raise exception 'FAIL SP4: der Betrieb konnte den Arbeitsbeginn selbst setzen';
exception when insufficient_privilege then
  raise notice 'PASS SP4: der Arbeitsbeginn ist von Hand nicht setzbar';
end $$;

-- ── SP3 GEGENPROBE: gewoehnliche Aenderungen gehen weiter ──────────────────
do $$
begin
  update contracts set status = 'active'
   where id = '5b555555-0000-0000-0000-0000000000e1';
  raise notice 'PASS SP3: gewoehnliche Vertragsaenderungen bleiben moeglich';
exception when insufficient_privilege then
  raise exception 'FAIL SP3: der Rechteentzug sperrt auch gewoehnliche Aenderungen';
end $$;

-- ── SP5: eine falsche PIN setzt nichts ─────────────────────────────────────
-- Die falschen Zahlen werden aus der echten abgeleitet, nicht geraten. Ein
-- fest eingebautes '0000' waere in einem von zehntausend Laeufen die richtige
-- PIN, und dann prueft dieser Block etwas anderes als sein Name sagt.
do $$
declare v text; z timestamptz; f integer; falsch text;
begin
  falsch := lpad(((current_setting('sp.pin_e1')::int + 1) % 10000)::text, 4, '0');
  select public.arbeit_beginnen('5b555555-0000-0000-0000-0000000000e1', falsch) into v;
  select arbeit_begonnen_am into z from contracts where id = '5b555555-0000-0000-0000-0000000000e1';
  select fehlversuche into f from vertrag_start_pins where contract_id = '5b555555-0000-0000-0000-0000000000e1';
  if v <> 'falsch' then
    raise exception 'FAIL SP5: falsche PIN ergab % statt falsch', v;
  end if;
  if z is not null then
    raise exception 'FAIL SP5: falsche PIN hat den Arbeitsbeginn gesetzt';
  end if;
  if f <> 1 then
    raise exception 'FAIL SP5: der Fehlversuch wurde nicht gezaehlt (%)', f;
  end if;
  raise notice 'PASS SP5: eine falsche PIN setzt nichts und wird gezaehlt';
end $$;

-- ── SP6: drei Fehlversuche sperren ─────────────────────────────────────────
do $$
declare v text; falsch text;
begin
  falsch := lpad(((current_setting('sp.pin_e1')::int + 2) % 10000)::text, 4, '0');
  perform public.arbeit_beginnen('5b555555-0000-0000-0000-0000000000e1', falsch);
  falsch := lpad(((current_setting('sp.pin_e1')::int + 3) % 10000)::text, 4, '0');
  select public.arbeit_beginnen('5b555555-0000-0000-0000-0000000000e1', falsch) into v;
  if v <> 'gesperrt' then
    raise exception 'FAIL SP6: nach drei Fehlversuchen kam % statt gesperrt', v;
  end if;
  raise notice 'PASS SP6: drei Fehlversuche sperren die Eingabe';
end $$;

-- ── SP7: die RICHTIGE Zahl wirkt waehrend der Sperre nicht ─────────────────
-- Ohne diese Probe waere eine Sperre gruen, die den falschen Weg zaehlt und
-- den richtigen durchlaesst -- also gar keine.
do $$
declare v text; z timestamptz;
begin
  select public.arbeit_beginnen('5b555555-0000-0000-0000-0000000000e1', current_setting('sp.pin_e1')) into v;
  select arbeit_begonnen_am into z from contracts where id = '5b555555-0000-0000-0000-0000000000e1';
  if v <> 'gesperrt' or z is not null then
    raise exception 'FAIL SP7: waehrend der Sperre wirkte die richtige PIN (% / %)', v, z;
  end if;
  raise notice 'PASS SP7: waehrend der Sperre wirkt auch die richtige PIN nicht';
end $$;

-- ── SP10 und SP11: wer nicht der Betrieb dieses Vertrags ist ───────────────
set request.jwt.claim.sub = '5b333333-0000-0000-0000-0000000000f1';
do $$
declare v text;
begin
  select public.arbeit_beginnen('5b555555-0000-0000-0000-0000000000e2','1234') into v;
  if v <> 'nicht_berechtigt' then
    raise exception 'FAIL SP10: ein fremder Betrieb bekam % statt nicht_berechtigt', v;
  end if;
  raise notice 'PASS SP10: ein fremder Betrieb kommt nicht durch';
end $$;

set request.jwt.claim.sub = '5b111111-0000-0000-0000-0000000000c1';
do $$
declare v text;
begin
  select public.arbeit_beginnen('5b555555-0000-0000-0000-0000000000e2','1234') into v;
  if v <> 'nicht_berechtigt' then
    raise exception 'FAIL SP11: der Kunde selbst konnte einloesen (%)', v;
  end if;
  raise notice 'PASS SP11: der Kunde kann seine eigene PIN nicht einloesen';
end $$;

-- ── SP2 GEGENPROBE: der Kunde kann die Zahl lesen ──────────────────────────
-- Ohne diese Probe waere "niemand kann sie lesen" ein bestandener Test -- und
-- dann koennte der Kunde sie nicht vorlesen, die Funktion waere tot.
do $$
declare v text;
begin
  select pin into v from vertrag_start_pins
   where contract_id = '5b555555-0000-0000-0000-0000000000e1';
  if v is null then
    raise exception 'FAIL SP2: der Auftraggeber kann seine eigene PIN nicht lesen';
  end if;
  raise notice 'PASS SP2: der Auftraggeber kann seine PIN lesen';
end $$;

-- ── SP8: die richtige PIN wirkt (frischer Vertrag, keine Sperre) ───────────
set request.jwt.claim.sub = '5b222222-0000-0000-0000-0000000000b1';
do $$
declare v text; z timestamptz;
begin
  select public.arbeit_beginnen('5b555555-0000-0000-0000-0000000000e2', current_setting('sp.pin_e2')) into v;
  select arbeit_begonnen_am into z from contracts where id = '5b555555-0000-0000-0000-0000000000e2';
  if v <> 'ok' then raise exception 'FAIL SP8: die richtige PIN ergab %', v; end if;
  if z is null then raise exception 'FAIL SP8: der Arbeitsbeginn wurde nicht gesetzt'; end if;
  raise notice 'PASS SP8: die richtige PIN belegt den Arbeitsbeginn';
end $$;

-- ── SP9: ein zweiter Aufruf aendert den Zeitpunkt nicht ────────────────────
do $$
declare v text; vorher timestamptz; nachher timestamptz;
begin
  select arbeit_begonnen_am into vorher from contracts where id = '5b555555-0000-0000-0000-0000000000e2';
  select public.arbeit_beginnen('5b555555-0000-0000-0000-0000000000e2','9999') into v;
  select arbeit_begonnen_am into nachher from contracts where id = '5b555555-0000-0000-0000-0000000000e2';
  if v <> 'schon_begonnen' then
    raise exception 'FAIL SP9: zweiter Aufruf ergab % statt schon_begonnen', v;
  end if;
  if nachher is distinct from vorher then
    raise exception 'FAIL SP9: der belegte Zeitpunkt wurde ueberschrieben';
  end if;
  raise notice 'PASS SP9: ein zweiter Aufruf verschiebt den Zeitpunkt nicht';
end $$;

reset role;
reset request.jwt.claim.sub;

-- ── SP15: nach dem Einloesen ist die Zahl geloescht (0970) ─────────────────
-- Sie ist ein Zugangsmittel und steht deshalb auch nicht in der Auskunft nach
-- Art. 15. Beides zusammen geht nur, wenn sie wirklich verschwindet.
do $$
declare v_pin text; v_ein timestamptz;
begin
  select pin, eingeloest_am into v_pin, v_ein from vertrag_start_pins
   where contract_id = '5b555555-0000-0000-0000-0000000000e2';
  if v_pin is not null then
    raise exception 'FAIL SP15: die eingeloeste PIN steht noch da';
  end if;
  if v_ein is null then
    raise exception 'FAIL SP15: der Beleg ist mit der Zahl verschwunden';
  end if;
  raise notice 'PASS SP15: nach dem Einloesen ist die Zahl weg, der Beleg bleibt';
end $$;

-- ── SP16: ein beendeter Vertrag traegt keine Zahl mehr ─────────────────────
-- Der Status kommt aus einer Edge Function, nicht vom Client: ein Trigger
-- weist jede andere Rolle ab ("contracts.status is managed by Edge Functions
-- only"). Deshalb hier derselbe Weg wie in der Produktion.
set role service_role;
update contracts set status = 'cancelled'
 where id = '5b555555-0000-0000-0000-0000000000e1';
reset role;
do $$
declare v_pin text; v_f integer;
begin
  select pin, fehlversuche into v_pin, v_f from vertrag_start_pins
   where contract_id = '5b555555-0000-0000-0000-0000000000e1';
  if v_pin is not null then
    raise exception 'FAIL SP16: der stornierte Vertrag traegt seine Zahl weiter';
  end if;
  if v_f is null then
    raise exception 'FAIL SP16: der Beleg ist mitgeloescht worden';
  end if;
  raise notice 'PASS SP16: ein beendeter Vertrag traegt keine Zahl mehr';
end $$;

-- ── SP17: ohne Zahl laesst sich nichts mehr einloesen ──────────────────────
-- Sonst waere eine geloeschte Zahl kein Schutz, sondern nur ein leeres Feld.
set request.jwt.claim.sub = '5b222222-0000-0000-0000-0000000000b1';
set role authenticated;
do $$
declare v text;
begin
  select public.arbeit_beginnen('5b555555-0000-0000-0000-0000000000e1','1234') into v;
  if v <> 'keine_pin' then
    raise exception 'FAIL SP17: ohne Zahl kam % statt keine_pin', v;
  end if;
  raise notice 'PASS SP17: ohne Zahl laesst sich nichts einloesen';
end $$;
reset role;
reset request.jwt.claim.sub;

-- ── SP13: beim Sperren erfaehrt es der Auftraggeber ────────────────────────
-- Steht am Ende, weil `notifications` fuer Angemeldete nur die eigenen Zeilen
-- zeigt und der Pruefer hier der Beobachter ist, nicht der Empfaenger.
do $$
declare v integer;
begin
  select count(*) into v from notifications
   where empfaenger = '5b111111-0000-0000-0000-0000000000c1'
     and quelle_tabelle = 'contracts'
     and quelle_id = '5b555555-0000-0000-0000-0000000000e1';
  if v <> 1 then
    raise exception 'FAIL SP13: der Auftraggeber bekam % Mitteilungen ueber die Sperre', v;
  end if;
  raise notice 'PASS SP13: beim Sperren erfaehrt es der Auftraggeber';
end $$;
