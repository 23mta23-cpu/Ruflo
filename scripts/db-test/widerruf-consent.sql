-- Widerrufs-Einwilligung (Migration 0710)
--
-- Bis 16.08.2026 lag die Zustimmung ausschliesslich in einem `useState` in
-- app/zahlung.tsx. Sie sperrte einen Knopf und verschwand mit dem Bildschirm:
-- widerruft ein Kunde nach getaner Arbeit, konnte niemand belegen, dass er je
-- zugestimmt hat. Ein Nachweis ist aber nur so viel wert, wie er faelschungs-
-- und aenderungssicher ist — genau das wird hier geprueft.
--
-- (O) Der Kunde des Vertrags kann seine Erklaerung festhalten
-- (P) Ein Fremder kann sie NICHT in seinem Namen festhalten
-- (Q) Niemand kann sie fuer einen fremden Vertrag festhalten
-- (R) Pro Vertrag genau eine Erklaerung
-- (S) Der Kunde liest seine eigene Erklaerung (Art. 15 DSGVO)
-- (T) Der Wortlaut ist nachtraeglich NICHT aenderbar
-- (U) Die Erklaerung ist nicht loeschbar
reset role;

alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;
alter table public.jobs disable trigger user;

insert into auth.users (id,email,email_confirmed_at) values
  ('e8000001-0000-0000-0000-000000000000','wc@test.de',now()),   -- Kunde
  ('e8000002-0000-0000-0000-000000000000','wp@test.de',now()),   -- Anbieter
  ('e8000003-0000-0000-0000-000000000000','wf@test.de',now());   -- Fremder
insert into profiles (id,role,email,email_verified_at) values
  ('e8000001-0000-0000-0000-000000000000','customer','wc@test.de',now()),
  ('e8000002-0000-0000-0000-000000000000','provider','wp@test.de',now()),
  ('e8000003-0000-0000-0000-000000000000','customer','wf@test.de',now());
insert into provider_profiles (id,business_name,is_nachbarschaft) values
  ('e8000002-0000-0000-0000-000000000000','WP',false);
insert into jobs (id,customer_id,provider_id,title,description,category,address_plz,address_city,track,status) values
  ('e8000004-0000-0000-0000-000000000000','e8000001-0000-0000-0000-000000000000','e8000002-0000-0000-0000-000000000000','WJob','Lang genug beschrieben hier drin.','Elektro','50667','Koeln','handwerker','active');
insert into contracts (id,job_id,customer_id,provider_id,price_gross,customer_total,provider_payout,track,status) values
  ('e8000005-0000-0000-0000-000000000000','e8000004-0000-0000-0000-000000000000','e8000001-0000-0000-0000-000000000000','e8000002-0000-0000-0000-000000000000',100,102.50,92,'handwerker','pending');
-- Zweiter Auftrag/Vertrag desselben Kunden, auf dem noch KEINE Erklaerung
-- liegt. Ohne ihn wuerden die Tests P und Q am Unique-Index scheitern statt an
-- der RLS-Policy — sie waeren dann gruen, auch wenn die Policy kaputt ist.
insert into jobs (id,customer_id,provider_id,title,description,category,address_plz,address_city,track,status) values
  ('e8000006-0000-0000-0000-000000000000','e8000001-0000-0000-0000-000000000000','e8000002-0000-0000-0000-000000000000','WJob2','Lang genug beschrieben hier drin.','Elektro','50667','Koeln','handwerker','active');
insert into contracts (id,job_id,customer_id,provider_id,price_gross,customer_total,provider_payout,track,status) values
  ('e8000007-0000-0000-0000-000000000000','e8000006-0000-0000-0000-000000000000','e8000001-0000-0000-0000-000000000000','e8000002-0000-0000-0000-000000000000',100,102.50,92,'handwerker','pending');

alter table auth.users enable trigger user;
alter table public.profiles enable trigger user;
alter table public.jobs enable trigger user;

set role authenticated;
set request.jwt.claim.sub = 'e8000001-0000-0000-0000-000000000000';

-- TEST O: der Kunde des Vertrags kann seine Erklaerung festhalten
do $$
begin
  insert into widerruf_consents (contract_id,customer_id,text_version,angezeigter_text)
  values ('e8000005-0000-0000-0000-000000000000','e8000001-0000-0000-0000-000000000000',
          'widerruf-2026-08-16',
          'Ich verzichte auf mein Widerrufsrecht gemaess §356 Abs. 4 BGB und stimme zu, dass die Leistung sofort beginnen kann.');
  raise notice 'PASS: Kunde kann seine Widerrufs-Einwilligung festhalten';
exception when others then
  raise exception 'FAIL: Kunde konnte die Einwilligung NICHT festhalten (%)', sqlerrm;
end $$;

-- TEST R: pro Vertrag genau eine Erklaerung.
-- Ein zweiter Zahlungsanlauf darf den vorhandenen Nachweis nicht verdoppeln
-- und schon gar nicht ueberschreiben.
do $$
begin
  insert into widerruf_consents (contract_id,customer_id,text_version,angezeigter_text)
  values ('e8000005-0000-0000-0000-000000000000','e8000001-0000-0000-0000-000000000000',
          'widerruf-2026-08-16','Ein zweiter Versuch mit abweichendem Wortlaut hier drin.');
  raise exception 'FAIL: zweite Erklaerung zum selben Vertrag ging durch!';
exception when unique_violation then
  raise notice 'PASS: pro Vertrag genau eine Erklaerung';
end $$;

-- TEST S: der Kunde liest seine eigene Erklaerung (Art. 15 DSGVO)
do $$
declare n int;
begin
  select count(*) into n from widerruf_consents
   where customer_id = 'e8000001-0000-0000-0000-000000000000';
  if n <> 1 then raise exception 'FAIL: Kunde sieht seine eigene Erklaerung nicht (%)', n; end if;
  raise notice 'PASS: Kunde liest seine eigene Erklaerung';
end $$;

-- TEST T: der Wortlaut ist nachtraeglich nicht aenderbar.
-- Ein Nachweis, den eine Seite spaeter umschreiben kann, ist keiner.
do $$
declare betroffen int;
begin
  update widerruf_consents
     set angezeigter_text = 'Nachtraeglich umgeschriebener Wortlaut hier drin.'
   where contract_id = 'e8000005-0000-0000-0000-000000000000';
  get diagnostics betroffen = row_count;
  if betroffen <> 0 then raise exception 'FAIL: der Wortlaut liess sich nachtraeglich aendern!'; end if;
  raise notice 'PASS: der Wortlaut ist nachtraeglich nicht aenderbar';
exception when insufficient_privilege then
  raise notice 'PASS: der Wortlaut ist nachtraeglich nicht aenderbar (Recht entzogen)';
end $$;

-- TEST U: die Erklaerung ist nicht loeschbar
do $$
declare betroffen int;
begin
  delete from widerruf_consents where contract_id = 'e8000005-0000-0000-0000-000000000000';
  get diagnostics betroffen = row_count;
  if betroffen <> 0 then raise exception 'FAIL: die Erklaerung liess sich loeschen!'; end if;
  raise notice 'PASS: die Erklaerung ist nicht loeschbar';
exception when insufficient_privilege then
  raise notice 'PASS: die Erklaerung ist nicht loeschbar (Recht entzogen)';
end $$;

-- TEST P: ein Fremder kann keine Erklaerung in fremdem Namen abgeben
set request.jwt.claim.sub = 'e8000003-0000-0000-0000-000000000000';
do $$
begin
  insert into widerruf_consents (contract_id,customer_id,text_version,angezeigter_text)
  values ('e8000007-0000-0000-0000-000000000000','e8000001-0000-0000-0000-000000000000',
          'widerruf-2026-08-16','Von einem Fremden im Namen des Kunden erklaert hier.');
  raise exception 'FAIL: ein Fremder konnte im Namen des Kunden erklaeren!';
exception when insufficient_privilege then
  raise notice 'PASS: ein Fremder kann nicht im Namen des Kunden erklaeren';
end $$;

-- TEST Q: niemand erklaert fuer einen Vertrag, an dem er nicht Kunde ist
do $$
begin
  insert into widerruf_consents (contract_id,customer_id,text_version,angezeigter_text)
  values ('e8000007-0000-0000-0000-000000000000','e8000003-0000-0000-0000-000000000000',
          'widerruf-2026-08-16','Fremder erklaert fuer einen fremden Vertrag hier drin.');
  raise exception 'FAIL: Erklaerung zu einem fremden Vertrag ging durch!';
exception when insufficient_privilege then
  raise notice 'PASS: keine Erklaerung zu einem fremden Vertrag';
end $$;

-- TEST V: der Vertragskunde kann die Erklaerung nicht auf einen ANDEREN
-- Namen buchen.
--
-- Dieser Test existiert wegen einer Mutationsprobe: als `auth.uid() =
-- customer_id` aus der Policy entfernt wurde, blieben ALLE Tests gruen. Die
-- zweite Bedingung (Vertragskunde ist auth.uid()) hatte die Faelle P und Q
-- ohnehin mit abgedeckt — die erste Bedingung war also ungeprueft. Die Luecke,
-- die nur sie schliesst: der echte Vertragskunde erklaert im Namen eines
-- Dritten, und der Nachweis nennt dann den Falschen.
set request.jwt.claim.sub = 'e8000001-0000-0000-0000-000000000000';
do $$
begin
  insert into widerruf_consents (contract_id,customer_id,text_version,angezeigter_text)
  values ('e8000007-0000-0000-0000-000000000000','e8000003-0000-0000-0000-000000000000',
          'widerruf-2026-08-16','Vertragskunde erklaert auf einen fremden Namen hier drin.');
  raise exception 'FAIL: Erklaerung liess sich auf einen FREMDEN Namen buchen!';
exception when insufficient_privilege then
  raise notice 'PASS: Erklaerung nur im eigenen Namen';
end $$;

reset role;
