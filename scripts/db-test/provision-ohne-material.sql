-- Provision auf die Arbeitsleistung, nicht auf das Material (0830).
--
-- ANLASS: Founder-Entscheidung 08.09.2026. Geprueft wird die LEBENDE
-- zweiargumentige accept_offer aus 0530/0830, nicht die veraltete
-- dreiargumentige aus 0110.
--
-- Bewusst gegen einen UNBELEGTEN Datensatz gefahren: ein Negativtest, der an
-- einer Unique-Bedingung scheitert statt an der Regel, meldet gruen aus dem
-- falschen Grund (Lehre vom 16.08.2026).

alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;
alter table public.jobs disable trigger user;
alter table public.offers disable trigger user;

insert into auth.users (id, email, email_confirmed_at) values
  ('aa000000-0000-0000-0000-0000000000a1','mat-kunde@test.de', now()),
  ('aa000000-0000-0000-0000-0000000000a2','mat-anbieter@test.de', now());
insert into profiles (id, role, email, email_verified_at) values
  ('aa000000-0000-0000-0000-0000000000a1','customer','mat-kunde@test.de', now()),
  ('aa000000-0000-0000-0000-0000000000a2','provider','mat-anbieter@test.de', now());
insert into provider_profiles (id, business_name) values
  ('aa000000-0000-0000-0000-0000000000a2','Materialbetrieb');

insert into jobs (id, customer_id, title, description, category, address_plz, address_city, track, status) values
  ('aa000000-0000-0000-0000-0000000000b1','aa000000-0000-0000-0000-0000000000a1',
   'Dach','Beschreibung lang genug fuer den Test hier drin.','Dachdecker','50667','Koeln','handwerker','open'),
  ('aa000000-0000-0000-0000-0000000000b2','aa000000-0000-0000-0000-0000000000a1',
   'Ohne Material','Beschreibung lang genug fuer den Test hier drin.','Elektro','50667','Koeln','handwerker','open'),
  ('aa000000-0000-0000-0000-0000000000b3','aa000000-0000-0000-0000-0000000000a1',
   'Fast nur Material','Beschreibung lang genug fuer den Test hier drin.','Elektro','50667','Koeln','handwerker','open'),
  ('aa000000-0000-0000-0000-0000000000b4','aa000000-0000-0000-0000-0000000000a1',
   'Nachbarschaft','Beschreibung lang genug fuer den Test hier drin.','gartenarbeit','50667','Koeln','nachbarschaft','open');

insert into offers (id, job_id, provider_id, price, material_cost, status) values
  -- Der Fall aus dem Bildschirmfoto des Founders: 230 Preis, 100 Material.
  ('aa000000-0000-0000-0000-0000000000c1','aa000000-0000-0000-0000-0000000000b1','aa000000-0000-0000-0000-0000000000a2',230,100,'pending'),
  -- Gegenprobe: ohne Material bleibt alles wie vorher.
  ('aa000000-0000-0000-0000-0000000000c2','aa000000-0000-0000-0000-0000000000b2','aa000000-0000-0000-0000-0000000000a2',230,0,'pending'),
  -- Randfall: Material = Preis, also kein Arbeitsanteil. Der Mindestbetrag
  -- von 3 EUR muss greifen, nicht null.
  ('aa000000-0000-0000-0000-0000000000c3','aa000000-0000-0000-0000-0000000000b3','aa000000-0000-0000-0000-0000000000a2',500,500,'pending'),
  -- Nachbarschaft: Pauschale, Material darf daran nichts aendern.
  ('aa000000-0000-0000-0000-0000000000c4','aa000000-0000-0000-0000-0000000000b4','aa000000-0000-0000-0000-0000000000a2',200,80,'pending');

alter table auth.users enable trigger user;
alter table public.profiles enable trigger user;
alter table public.jobs enable trigger user;
alter table public.offers enable trigger user;

set request.jwt.claim.sub = 'aa000000-0000-0000-0000-0000000000a1';

-- M1: Provision rechnet auf die Arbeitsleistung.
do $$
declare v_c contracts%rowtype;
begin
  select * into v_c from accept_offer(
    'aa000000-0000-0000-0000-0000000000c1','aa000000-0000-0000-0000-0000000000b1');
  -- 8 % von (230 - 100) = 10,40. Vorher waren es 18,40.
  if v_c.provider_commission <> 10.40 then
    raise exception 'FAIL M1: Provision % statt 10.40', v_c.provider_commission;
  end if;
  if v_c.provider_payout <> 219.60 then
    raise exception 'FAIL M1: Auszahlung % statt 219.60', v_c.provider_payout;
  end if;
  raise notice 'PASS M1: Provision auf die Arbeitsleistung (10.40 statt 18.40)';
end $$;

-- M2: Der Materialanteil landet im Vertrag, nicht nur im Angebot.
do $$
declare v_m numeric;
begin
  select material_cost into v_m from contracts
   where job_id = 'aa000000-0000-0000-0000-0000000000b1';
  if v_m <> 100 then
    raise exception 'FAIL M2: material_cost im Vertrag ist %, erwartet 100', v_m;
  end if;
  raise notice 'PASS M2: Materialanteil steht im Vertrag';
end $$;

-- M3: Der KUNDE zahlt unveraendert. Die Aenderung darf ihn nicht betreffen.
do $$
declare v_t numeric;
begin
  select customer_total into v_t from contracts
   where job_id = 'aa000000-0000-0000-0000-0000000000b1';
  -- 230 + max(230*0.025, 1.50) = 230 + 5.75
  if v_t <> 235.75 then
    raise exception 'FAIL M3: Kundenbetrag % statt 235.75', v_t;
  end if;
  raise notice 'PASS M3: Der Kunde zahlt unveraendert 235.75';
end $$;

-- M4: Ohne Materialangabe bleibt die alte Rechnung stehen.
do $$
declare v_c contracts%rowtype;
begin
  select * into v_c from accept_offer(
    'aa000000-0000-0000-0000-0000000000c2','aa000000-0000-0000-0000-0000000000b2');
  if v_c.provider_commission <> 18.40 then
    raise exception 'FAIL M4: Provision ohne Material ist %, erwartet 18.40', v_c.provider_commission;
  end if;
  raise notice 'PASS M4: ohne Material unveraendert 18.40';
end $$;

-- M5: Material gleich Preis. Der Mindestbetrag greift, die Provision wird
--     NICHT null. Sonst waere die Regel eine Einladung.
do $$
declare v_c contracts%rowtype;
begin
  select * into v_c from accept_offer(
    'aa000000-0000-0000-0000-0000000000c3','aa000000-0000-0000-0000-0000000000b3');
  if v_c.provider_commission <> 3.00 then
    raise exception 'FAIL M5: Provision bei reinem Material ist %, erwartet 3.00', v_c.provider_commission;
  end if;
  raise notice 'PASS M5: Mindestbetrag 3.00 greift auch ohne Arbeitsanteil';
end $$;

-- M6: Nachbarschaft bleibt bei der Pauschale.
do $$
declare v_c contracts%rowtype;
begin
  select * into v_c from accept_offer(
    'aa000000-0000-0000-0000-0000000000c4','aa000000-0000-0000-0000-0000000000b4');
  if v_c.provider_commission <> 0 then
    raise exception 'FAIL M6: Nachbarschaft hat Provision %', v_c.provider_commission;
  end if;
  if v_c.werkr_schutz_fee <> 1.99 then
    raise exception 'FAIL M6: Schutzpauschale % statt 1.99', v_c.werkr_schutz_fee;
  end if;
  raise notice 'PASS M6: Nachbarschaft unveraendert bei 1.99 Pauschale';
end $$;

-- M7: Die Datenbank weist unmoegliche Angaben ab, nicht nur der Client.
do $$
declare v_fehler text;
begin
  begin
    insert into offers (id, job_id, provider_id, price, material_cost, status)
    values ('aa000000-0000-0000-0000-0000000000c9','aa000000-0000-0000-0000-0000000000b2',
            'aa000000-0000-0000-0000-0000000000a2', 100, 150, 'pending');
    raise exception 'FAIL M7: Material groesser als Preis wurde angenommen';
  exception when check_violation then
    v_fehler := 'ok';
  end;
  if v_fehler is null then
    raise exception 'FAIL M7: keine check_violation';
  end if;
  raise notice 'PASS M7: Material groesser als Preis wird von der DB abgewiesen';
end $$;
