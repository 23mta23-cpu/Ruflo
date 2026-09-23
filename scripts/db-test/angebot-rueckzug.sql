-- 0260: der Betrieb zieht sein eigenes, noch offenes Angebot zurueck.
--
-- ANLASS (23.09.2026): Der Knopf „Zurueckziehen" auf dem Betriebs-Dashboard
-- setzte das UPDATE ab, LAS DAS ERGEBNIS NICHT und meldete „Angebot
-- zurueckgezogen". Der teure Fall ist AR3: hat der Kunde in der Zwischenzeit
-- angenommen, trifft die Bedingung `status='pending'` KEINE Zeile, und
-- PostgREST meldet dafuer keinen Fehler. Der Betrieb liest eine
-- Erfolgsmeldung und ist in Wahrheit gebunden.
--
-- Die Policy dazu gibt es seit 0260 und sie wurde nie geprueft. Hier steht,
-- was die DATENBANK zusichert; ob der Bildschirm die null Zeilen richtig
-- deutet, misst scripts/reisen/reise16-angebot-rueckzug.cjs, und die Regel
-- selbst __tests__/angebotRueckzug.test.ts.

alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;
alter table public.jobs disable trigger user;
alter table public.provider_profiles disable trigger user;

insert into auth.users (id,email,email_confirmed_at) values
  ('a0d00001-0000-0000-0000-000000000000','ar-kunde@test.de',now()),
  ('a0d00002-0000-0000-0000-000000000000','ar-betrieb@test.de',now()),
  ('a0d00003-0000-0000-0000-000000000000','ar-fremder@test.de',now());
insert into profiles (id,role,email,email_verified_at,plz) values
  ('a0d00001-0000-0000-0000-000000000000','customer','ar-kunde@test.de',now(),'50667'),
  ('a0d00002-0000-0000-0000-000000000000','provider','ar-betrieb@test.de',now(),'50667'),
  ('a0d00003-0000-0000-0000-000000000000','provider','ar-fremder@test.de',now(),'50667');
insert into provider_profiles (id,business_name,is_nachbarschaft) values
  ('a0d00002-0000-0000-0000-000000000000','AR-Betrieb',false),
  ('a0d00003-0000-0000-0000-000000000000','AR-Fremder',false);

insert into jobs (id,customer_id,title,description,category,address_plz,address_city,track,status)
values ('a0d00004-0000-0000-0000-000000000000','a0d00001-0000-0000-0000-000000000000',
        'Verteilerkasten erneuern','Ein Kasten.','Elektro','50667','Köln','handwerker','open');

insert into offers (id,job_id,provider_id,price,status) values
  ('a0d00005-0000-0000-0000-000000000000','a0d00004-0000-0000-0000-000000000000',
   'a0d00002-0000-0000-0000-000000000000',320,'pending'),
  ('a0d00006-0000-0000-0000-000000000000','a0d00004-0000-0000-0000-000000000000',
   'a0d00003-0000-0000-0000-000000000000',340,'pending'),
  -- Bewusst SCHON ANGENOMMEN: der Fall, um den es geht.
  ('a0d00007-0000-0000-0000-000000000000','a0d00004-0000-0000-0000-000000000000',
   'a0d00002-0000-0000-0000-000000000000',300,'accepted');

-- TEST AR1: der Betrieb kann sein eigenes offenes Angebot zurueckziehen,
-- und es ist danach wirklich 'declined'.
do $$
declare n integer; st text;
begin
  set local role authenticated;
  set local request.jwt.claim.sub = 'a0d00002-0000-0000-0000-000000000000';
  update offers set status = 'declined'
   where id = 'a0d00005-0000-0000-0000-000000000000' and status = 'pending';
  get diagnostics n = row_count;
  reset role;
  select status into st from offers where id = 'a0d00005-0000-0000-0000-000000000000';
  if n <> 1 then raise exception 'FAIL AR1: % Zeilen statt einer betroffen', n; end if;
  if st <> 'declined' then raise exception 'FAIL AR1: Status steht auf %', st; end if;
  raise notice 'PASS AR1: der Betrieb kann sein offenes Angebot zurueckziehen';
end $$;

-- TEST AR2: ein fremdes Angebot bleibt unberuehrt. Ohne diese Zusicherung
-- waere „jeder darf jedes Angebot ablehnen" ein bestandener Test.
--
-- GRENZE, gemessen am 23.09.2026 und deshalb hier notiert: Nimmt man die
-- Bedingung `provider_id = auth.uid()` aus dem `using` der UPDATE-Policy
-- heraus, bleibt AR2 TROTZDEM gruen. Nicht weil der Test schwach waere,
-- sondern weil die SELECT-Policy „Offer parties read offers" das fremde
-- Angebot gar nicht erst sichtbar macht -- ein UPDATE scannt dann null
-- Zeilen. Die Bedingung im `using` ist also ein ZWEITES Schloss und fuer
-- sich allein durch keine Mutation nachweisbar. Sie bleibt trotzdem stehen:
-- wuerde die Lesbarkeit je weiter, haenge sonst alles an einer Bedingung.
-- Dieselbe Klasse wie die unerreichbare `with check` in 0930.
do $$
declare n integer; st text;
begin
  set local role authenticated;
  set local request.jwt.claim.sub = 'a0d00002-0000-0000-0000-000000000000';
  -- BEWUSST OHNE `and status = 'pending'`: spiegelte der Test die WHERE-
  -- Klausel des Clients, filterte er die Zeile selbst heraus und die Policy
  -- bliebe ungemessen. Gemessen am 23.09.2026: mit Spiegelung blieb diese
  -- Zusicherung auch dann gruen, wenn die Policy-Bedingung entfernt war.
  update offers set status = 'declined'
   where id = 'a0d00006-0000-0000-0000-000000000000';
  get diagnostics n = row_count;
  reset role;
  select status into st from offers where id = 'a0d00006-0000-0000-0000-000000000000';
  if n <> 0 then raise exception 'FAIL AR2: % fremde Zeilen betroffen', n; end if;
  if st <> 'pending' then raise exception 'FAIL AR2: fremdes Angebot steht auf %', st; end if;
  raise notice 'PASS AR2: ein fremdes Angebot laesst sich nicht zurueckziehen';
end $$;

-- TEST AR3: DER FALL, DER DEN BILDSCHIRM BETRIFFT.
-- Hat der Kunde angenommen, trifft die Bedingung keine Zeile -- und die
-- Datenbank meldet dafuer KEINEN Fehler. Genau deshalb darf der Client nicht
-- vom Ausbleiben eines Fehlers auf Erfolg schliessen.
do $$
declare n integer; st text;
begin
  set local role authenticated;
  set local request.jwt.claim.sub = 'a0d00002-0000-0000-0000-000000000000';
  -- Ebenfalls ohne Spiegelung: die Policy selbst muss das angenommene
  -- Angebot aussperren. Dass die Datenbank dabei KEINEN Fehler meldet,
  -- sondern nur null Zeilen trifft, ist genau der Grund, warum der Client
  -- nicht vom Ausbleiben eines Fehlers auf Erfolg schliessen darf.
  update offers set status = 'declined'
   where id = 'a0d00007-0000-0000-0000-000000000000';
  get diagnostics n = row_count;
  reset role;
  select status into st from offers where id = 'a0d00007-0000-0000-0000-000000000000';
  if n <> 0 then raise exception 'FAIL AR3: % Zeilen betroffen, das Angebot war angenommen', n; end if;
  if st <> 'accepted' then raise exception 'FAIL AR3: angenommenes Angebot steht jetzt auf %', st; end if;
  raise notice 'PASS AR3: ein angenommenes Angebot bleibt angenommen, ohne Fehlermeldung';
end $$;

-- TEST AR4: der Rueckzug ist die EINZIGE Umstellung, die der Betrieb selbst
-- vornehmen darf. Sich das eigene Angebot auf 'accepted' zu setzen, hiesse
-- einen Vertrag an der Annahme des Kunden vorbei zu erzeugen.
do $$
declare n integer; st text;
begin
  insert into offers (id,job_id,provider_id,price,status) values
    ('a0d00008-0000-0000-0000-000000000000','a0d00004-0000-0000-0000-000000000000',
     'a0d00002-0000-0000-0000-000000000000',310,'pending');
  begin
    set local role authenticated;
    set local request.jwt.claim.sub = 'a0d00002-0000-0000-0000-000000000000';
    update offers set status = 'accepted'
     where id = 'a0d00008-0000-0000-0000-000000000000' and status = 'pending';
    get diagnostics n = row_count;
    reset role;
  exception when insufficient_privilege or others then
    reset role;
    n := 0;
  end;
  select status into st from offers where id = 'a0d00008-0000-0000-0000-000000000000';
  if st = 'accepted' then
    raise exception 'FAIL AR4: der Betrieb hat sein eigenes Angebot angenommen';
  end if;
  raise notice 'PASS AR4: der Betrieb kann sein Angebot nicht selbst annehmen (Status %)', st;
end $$;
