-- 0910: Untergrenze auf offers.price.
--
-- Die Bedingung ist "die Auszahlung ist positiv", nicht "ein Preis ist
-- sinnvoll". Geprueft wird deshalb genau die Kante bei 3,00.
alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;
alter table public.jobs disable trigger user;
alter table public.offers disable trigger user;

insert into auth.users (id,email,email_confirmed_at) values
  ('a1a11111-0000-0000-0000-0000000000a1','ap-kunde@test.de',now()),
  ('a2a22222-0000-0000-0000-0000000000a2','ap-anbieter@test.de',now());
insert into profiles (id,role,email,email_verified_at) values
  ('a1a11111-0000-0000-0000-0000000000a1','customer','ap-kunde@test.de',now()),
  ('a2a22222-0000-0000-0000-0000000000a2','provider','ap-anbieter@test.de',now());
insert into provider_profiles (id,business_name) values
  ('a2a22222-0000-0000-0000-0000000000a2','AP');
insert into jobs (id,customer_id,title,description,category,address_plz,address_city,track,status) values
  ('a3a33333-0000-0000-0000-0000000000a3','a1a11111-0000-0000-0000-0000000000a1',
   'AP-Job','Lang genug beschrieben hier drin.','Elektro','50667','Koeln','handwerker','open');

-- AP1/AP2: negativ und null. ACHTUNG, diese beiden scheitern an
--      `chk_offers_price_positive` aus 0040, NICHT an der Grenze aus 0910.
--      Nachgemessen: bei ausgehebelter 0910-Grenze bleiben sie gruen. Sie
--      stehen hier als Bestandsschutz, nicht als Nachweis fuer 0910 — ein
--      Negativtest, der am falschen Riegel scheitert, beweist nichts
--      (CLAUDE.md, 16.08.).
do $$
begin
  insert into offers (job_id,provider_id,price,status) values
    ('a3a33333-0000-0000-0000-0000000000a3','a2a22222-0000-0000-0000-0000000000a2',-100,'pending');
  raise exception 'FAIL AP1: negativer Angebotspreis wurde angenommen';
exception when check_violation then
  raise notice 'PASS AP1: negativer Angebotspreis wird abgewiesen';
end $$;

-- AP2: null geht auch nicht (ebenfalls 0040).
do $$
begin
  insert into offers (job_id,provider_id,price,status) values
    ('a3a33333-0000-0000-0000-0000000000a3','a2a22222-0000-0000-0000-0000000000a2',0,'pending');
  raise exception 'FAIL AP2: Angebotspreis 0 wurde angenommen';
exception when check_violation then
  raise notice 'PASS AP2: Angebotspreis 0 wird abgewiesen';
end $$;

-- AP3: DER NACHWEIS FUER 0910. Bei genau 3,00 ist die Gebuehr 3,00 und die
--      Auszahlung 0,00 — der Anbieter arbeitete umsonst. 0040 laesst das
--      durch (3,00 > 0); nur die Grenze aus 0910 faengt es.
do $$
begin
  insert into offers (job_id,provider_id,price,status) values
    ('a3a33333-0000-0000-0000-0000000000a3','a2a22222-0000-0000-0000-0000000000a2',3.00,'pending');
  raise exception 'FAIL AP3: Preis 3,00 wurde angenommen (Auszahlung waere 0,00)';
exception when check_violation then
  raise notice 'PASS AP3: Preis genau 3,00 wird abgewiesen';
end $$;

-- AP4: einen Cent darueber geht, und die Auszahlung ist positiv.
insert into offers (id,job_id,provider_id,price,status) values
  ('a4a44444-0000-0000-0000-0000000000a4','a3a33333-0000-0000-0000-0000000000a3',
   'a2a22222-0000-0000-0000-0000000000a2',3.01,'pending');
do $$
declare v_preis numeric; v_gebuehr numeric;
begin
  select price into v_preis from offers where id='a4a44444-0000-0000-0000-0000000000a4';
  v_gebuehr := round(greatest(v_preis * 0.08, 3.00)::numeric, 2);
  if v_preis - v_gebuehr <= 0 then
    raise exception 'FAIL AP4: Auszahlung waere % bei Preis %', v_preis - v_gebuehr, v_preis;
  end if;
  raise notice 'PASS AP4: Preis 3,01 ergibt eine positive Auszahlung (%)', v_preis - v_gebuehr;
end $$;

-- AP5: ein gewoehnlicher Preis bleibt unberuehrt.
insert into offers (id,job_id,provider_id,price,status) values
  ('a5a55555-0000-0000-0000-0000000000a5','a3a33333-0000-0000-0000-0000000000a3',
   'a2a22222-0000-0000-0000-0000000000a2',850,'pending');
do $$
begin
  if not exists (select 1 from offers where id='a5a55555-0000-0000-0000-0000000000a5') then
    raise exception 'FAIL AP5: ein Angebot ueber 850 EUR kam nicht durch';
  end if;
  raise notice 'PASS AP5: ein gewoehnliches Angebot bleibt unberuehrt';
end $$;

-- AP6: die Einschraenkung gilt auch beim AENDERN, nicht nur beim Anlegen.
do $$
begin
  update offers set price = 1.00 where id='a5a55555-0000-0000-0000-0000000000a5';
  raise exception 'FAIL AP6: ein Angebot liess sich nachtraeglich unter die Grenze setzen';
exception when check_violation then
  raise notice 'PASS AP6: auch ein UPDATE unter die Grenze wird abgewiesen';
end $$;
