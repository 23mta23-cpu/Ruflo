-- Datenexport DSGVO Art. 15/20 (Edge Function export-my-data)
--
-- Die Function laeuft mit service_role, also OHNE RLS: ihr einziger Schutz ist
-- der Filter in jeder einzelnen Query. Genau dort ist schon einmal ein echter
-- Fehler durchgerutscht (PR #142: reviews wurde ueber author_id/provider_id
-- abgefragt — Spalten, die es nie gab). Weil die Function Query-Fehler mit
-- `?? []` verschluckt hat, sah das Ergebnis aus wie "keine Bewertungen".
--
-- Dieser Test spiegelt jeden Filter der Function 1:1 gegen echtes Postgres:
--   * benennt eine Migration eine Spalte um, schlaegt das Statement fehl
--   * liefert ein Filter fremde Zeilen, schlaegt die Mengen-Assertion fehl
-- (R) Kunden-Export: eigene Daten vollstaendig, fremde nicht enthalten
-- (S) Anbieter-Export: nur eigener Thread, KEINE Kundenadresse
-- (T) Unbeteiligter Dritter exportiert nichts von den beiden
reset role;

alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;
alter table public.jobs disable trigger user;

insert into auth.users (id,email,email_confirmed_at) values
  ('b1111111-0000-0000-0000-000000000000','ex-kunde@test.de',now()),
  ('b2222222-0000-0000-0000-000000000000','ex-anbieter@test.de',now()),
  ('b3333333-0000-0000-0000-000000000000','ex-fremd@test.de',now());
insert into profiles (id,role,email,email_verified_at) values
  ('b1111111-0000-0000-0000-000000000000','customer','ex-kunde@test.de',now()),
  ('b2222222-0000-0000-0000-000000000000','provider','ex-anbieter@test.de',now()),
  ('b3333333-0000-0000-0000-000000000000','provider','ex-fremd@test.de',now());
insert into provider_profiles (id,business_name,is_nachbarschaft) values
  ('b2222222-0000-0000-0000-000000000000','ExpP',false),
  ('b3333333-0000-0000-0000-000000000000','FremdP',false);

-- Auftrag des Kunden, vergeben an den Anbieter
insert into jobs (id,customer_id,provider_id,title,description,category,address_plz,address_city,track,status) values
  ('b4444444-0000-0000-0000-000000000000','b1111111-0000-0000-0000-000000000000','b2222222-0000-0000-0000-000000000000',
   'ExportJob','Beschreibung lang genug fuer den Check.','Elektro','50667','Koeln','handwerker','active');
-- Auftrag eines Dritten (darf in keinem der beiden Exporte auftauchen)
insert into jobs (id,customer_id,title,description,category,address_plz,address_city,track,status) values
  ('b5555555-0000-0000-0000-000000000000','b3333333-0000-0000-0000-000000000000',
   'FremdJob','Fremde Beschreibung lang genug hier.','Elektro','50667','Koeln','handwerker','open');

insert into job_addresses (job_id,address_street) values
  ('b4444444-0000-0000-0000-000000000000','Musterstrasse 1');
insert into offers (id,job_id,provider_id,price,status) values
  ('b6666666-0000-0000-0000-000000000000','b4444444-0000-0000-0000-000000000000','b2222222-0000-0000-0000-000000000000',100,'accepted');
insert into contracts (id,job_id,customer_id,provider_id,price_gross,customer_total,provider_payout,track,status) values
  ('b7777777-0000-0000-0000-000000000000','b4444444-0000-0000-0000-000000000000','b1111111-0000-0000-0000-000000000000','b2222222-0000-0000-0000-000000000000',100,102.50,92,'handwerker','completed');
insert into reviews (contract_id,reviewer_id,reviewed_id,rating,comment) values
  ('b7777777-0000-0000-0000-000000000000','b1111111-0000-0000-0000-000000000000','b2222222-0000-0000-0000-000000000000',5,'Alles gut');
insert into disputes (contract_id,reporter_id,case_id,category,description) values
  ('b7777777-0000-0000-0000-000000000000','b1111111-0000-0000-0000-000000000000','EXP-1','quality',
   'Beschreibung mit mindestens dreissig Zeichen Laenge.');
insert into messages (job_id,sender_id,sender_role,body,provider_id) values
  ('b4444444-0000-0000-0000-000000000000','b1111111-0000-0000-0000-000000000000','customer','Hallo','b2222222-0000-0000-0000-000000000000'),
  ('b4444444-0000-0000-0000-000000000000','b2222222-0000-0000-0000-000000000000','provider','Moin','b2222222-0000-0000-0000-000000000000');
-- Konkurrierender Vor-Vertrags-Thread eines anderen Anbieters am SELBEN Auftrag:
-- gehoert in den Kunden-Export, aber NICHT in den des Anbieters (Befund L1).
insert into messages (job_id,sender_id,sender_role,body,provider_id) values
  ('b4444444-0000-0000-0000-000000000000','b3333333-0000-0000-0000-000000000000','provider','Auch Interesse','b3333333-0000-0000-0000-000000000000');
insert into appointment_proposals (job_id,provider_id,proposed_by,proposed_at,status) values
  ('b4444444-0000-0000-0000-000000000000','b2222222-0000-0000-0000-000000000000','b2222222-0000-0000-0000-000000000000',now() + interval '2 days','pending');
insert into pro_subscriptions (provider_id,status) values
  ('b2222222-0000-0000-0000-000000000000','inactive');
insert into pstg_reports (report_year,provider_id,tx_count,revenue,payout) values
  (2026,'b2222222-0000-0000-0000-000000000000',31,2500,2300);
insert into waitlist (email,city,user_id) values
  ('ex-kunde@test.de','Koeln','b1111111-0000-0000-0000-000000000000');

alter table auth.users enable trigger user;
alter table public.profiles enable trigger user;
alter table public.jobs enable trigger user;

-- ── TEST R: Kunden-Export ────────────────────────────────────────────────────
-- Spiegelt die Filter der Function fuer uid = Kunde.
do $$
declare uid uuid := 'b1111111-0000-0000-0000-000000000000';
  n_jobs int; n_adr int; n_off int; n_con int; n_rev int; n_msg int;
  n_app int; n_dis int; n_wl int; n_prof int;
begin
  select count(*) into n_prof from profiles where id = uid;
  select count(*) into n_jobs from jobs where customer_id = uid or provider_id = uid;
  select count(*) into n_adr  from job_addresses
    where job_id in (select id from jobs where customer_id = uid);
  select count(*) into n_off  from offers where provider_id = uid;
  select count(*) into n_con  from contracts where customer_id = uid or provider_id = uid;
  select count(*) into n_rev  from reviews where reviewer_id = uid or reviewed_id = uid;
  select count(*) into n_msg  from messages
    where job_id in (select id from jobs where customer_id = uid or provider_id = uid)
      and (provider_id = uid or job_id in (select id from jobs where customer_id = uid));
  select count(*) into n_app  from appointment_proposals
    where job_id in (select id from jobs where customer_id = uid or provider_id = uid)
      and (provider_id = uid or job_id in (select id from jobs where customer_id = uid));
  select count(*) into n_dis  from disputes where reporter_id = uid;
  select count(*) into n_wl   from waitlist where user_id = uid or email = 'ex-kunde@test.de';

  if n_prof <> 1 then raise exception 'FAIL: Profil nicht im Export (%)', n_prof; end if;
  if n_jobs <> 1 then raise exception 'FAIL: Kunde sieht % Auftraege statt 1 (fremder Auftrag im Export?)', n_jobs; end if;
  if n_adr  <> 1 then raise exception 'FAIL: eigene Auftragsadresse fehlt (%)', n_adr; end if;
  if n_off  <> 0 then raise exception 'FAIL: Kunde hat fremde Angebote im Export (%)', n_off; end if;
  if n_con  <> 1 then raise exception 'FAIL: Vertrag fehlt (%)', n_con; end if;
  if n_rev  <> 1 then raise exception 'FAIL: Bewertung fehlt (%) — Spaltennamen geprueft?', n_rev; end if;
  if n_msg  <> 3 then raise exception 'FAIL: Kunde sieht % Nachrichten statt 3 (alle Threads seines Auftrags)', n_msg; end if;
  if n_app  <> 1 then raise exception 'FAIL: Terminvorschlag fehlt (%)', n_app; end if;
  if n_dis  <> 1 then raise exception 'FAIL: eigene Meldung fehlt (%)', n_dis; end if;
  if n_wl   <> 1 then raise exception 'FAIL: Wartelisten-Eintrag fehlt (%)', n_wl; end if;
  raise notice 'PASS: Kunden-Export vollstaendig (10 Kategorien), fremder Auftrag nicht enthalten';
end $$;

-- ── TEST S: Anbieter-Export ──────────────────────────────────────────────────
do $$
declare uid uuid := 'b2222222-0000-0000-0000-000000000000';
  n_jobs int; n_adr int; n_off int; n_msg int; n_pro int; n_pstg int; n_dis int;
begin
  select count(*) into n_jobs from jobs where customer_id = uid or provider_id = uid;
  -- Adresse: NUR ueber eigene Kunden-Auftraege — der Anbieter hat keine
  select count(*) into n_adr  from job_addresses
    where job_id in (select id from jobs where customer_id = uid);
  select count(*) into n_off  from offers where provider_id = uid;
  select count(*) into n_msg  from messages
    where job_id in (select id from jobs where customer_id = uid or provider_id = uid)
      and (provider_id = uid or job_id in (select id from jobs where customer_id = uid));
  select count(*) into n_pro  from pro_subscriptions where provider_id = uid;
  select count(*) into n_pstg from pstg_reports where provider_id = uid;
  select count(*) into n_dis  from disputes where reporter_id = uid;

  if n_jobs <> 1 then raise exception 'FAIL: Anbieter sieht % Auftraege statt 1', n_jobs; end if;
  if n_adr  <> 0 then raise exception 'FAIL: Kundenadresse im Anbieter-Export (%) — M1/0570 verletzt', n_adr; end if;
  if n_off  <> 1 then raise exception 'FAIL: eigenes Angebot fehlt (%)', n_off; end if;
  if n_msg  <> 2 then raise exception 'FAIL: Anbieter sieht % Nachrichten statt 2 — fremder Thread im Export (L1)', n_msg; end if;
  if n_pro  <> 1 then raise exception 'FAIL: Pro-Mitgliedschaft fehlt (%)', n_pro; end if;
  if n_pstg <> 1 then raise exception 'FAIL: PStTG-Meldung fehlt (%)', n_pstg; end if;
  if n_dis  <> 0 then raise exception 'FAIL: fremde Meldung im Anbieter-Export (%)', n_dis; end if;
  raise notice 'PASS: Anbieter-Export ohne Kundenadresse und ohne fremden Anbieter-Thread (L1/M1)';
end $$;

-- ── TEST T: Unbeteiligter ────────────────────────────────────────────────────
do $$
declare uid uuid := 'b3333333-0000-0000-0000-000000000000';
  n_con int; n_rev int; n_adr int; n_msg int;
begin
  select count(*) into n_con from contracts where customer_id = uid or provider_id = uid;
  select count(*) into n_rev from reviews where reviewer_id = uid or reviewed_id = uid;
  select count(*) into n_adr from job_addresses
    where job_id in (select id from jobs where customer_id = uid);
  -- Er hat einen eigenen Rueckfrage-Thread am fremden Auftrag: den und nur den.
  --
  -- ACHTUNG, hier stand ein falscher Spiegel: `job_id in (eigene Jobs) OR
  -- provider_id = uid`. Die Function machte ein UND (`.in(jobIds).or(filter)`),
  -- nicht ein ODER. Mit der echten Semantik lieferte sie 0 statt 1 — der
  -- Unbeteiligte bekam seinen EIGENEN Thread nicht exportiert (Art. 15 DSGVO),
  -- und genau dieser Test hat die Luecke gruen verdeckt. Die Function filtert
  -- jetzt nur noch ueber den Thread-Filter; der Spiegel bildet das ab.
  select count(*) into n_msg from messages
    where provider_id = uid
       or job_id in (select id from jobs where customer_id = uid);

  if n_con <> 0 then raise exception 'FAIL: Unbeteiligter exportiert fremden Vertrag (%)', n_con; end if;
  if n_rev <> 0 then raise exception 'FAIL: Unbeteiligter exportiert fremde Bewertung (%)', n_rev; end if;
  if n_adr <> 0 then raise exception 'FAIL: Unbeteiligter exportiert fremde Adresse (%)', n_adr; end if;
  if n_msg <> 1 then raise exception 'FAIL: Unbeteiligter exportiert % Nachrichten statt nur seiner eigenen', n_msg; end if;
  raise notice 'PASS: Unbeteiligter exportiert nur den eigenen Rueckfrage-Thread';
end $$;
