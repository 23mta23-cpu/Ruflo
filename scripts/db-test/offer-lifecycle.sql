-- (A) E-Mail-Gate: unbestätigte Nutzer dürfen KEINE Aufträge anlegen (der
--     Mechanismus, der RESEND_API_KEY zum echten Go-Live-Blocker macht).
-- (B) decline_offer: Job-Owner darf ablehnen, Fremder nicht.
alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;
alter table public.jobs disable trigger user;
alter table public.offers disable trigger user;

insert into auth.users (id,email,email_confirmed_at) values
  ('d1111111-0000-0000-0000-000000000000','v@test.de',now()),   -- verifiziert
  ('d2222222-0000-0000-0000-000000000000','u@test.de',now()),   -- UNbestätigt
  ('d3333333-0000-0000-0000-000000000000','p@test.de',now());   -- Anbieter
insert into profiles (id,role,email,email_verified_at) values
  ('d1111111-0000-0000-0000-000000000000','customer','v@test.de',now()),
  ('d2222222-0000-0000-0000-000000000000','customer','u@test.de',NULL),  -- kein email_verified_at
  ('d3333333-0000-0000-0000-000000000000','provider','p@test.de',now());
insert into provider_profiles (id,business_name) values ('d3333333-0000-0000-0000-000000000000','P');
-- vorhandener Job (vom verifizierten Kunden) + Angebot für decline-Test
insert into jobs (id,customer_id,title,description,category,address_plz,address_city,track,status) values
  ('d4444444-0000-0000-0000-000000000000','d1111111-0000-0000-0000-000000000000','JobV','Lang genug beschrieben hier drin.','Elektro','50667','Koeln','handwerker','open');
insert into offers (id,job_id,provider_id,price,status) values
  ('d5555555-0000-0000-0000-000000000000','d4444444-0000-0000-0000-000000000000','d3333333-0000-0000-0000-000000000000',80,'pending');

alter table auth.users enable trigger user;
alter table public.profiles enable trigger user;
alter table public.jobs enable trigger user;
alter table public.offers enable trigger user;

-- TEST A1: UNbestätigter Kunde darf keinen Job anlegen (RLS with-check greift)
set role authenticated;
set request.jwt.claim.sub = 'd2222222-0000-0000-0000-000000000000';
do $$
begin
  insert into jobs (customer_id,title,description,category,address_plz,address_city,track,status)
  values ('d2222222-0000-0000-0000-000000000000','Verboten','Lang genug beschrieben hier drin.','Elektro','50667','Koeln','handwerker','open');
  raise exception 'FAIL: unbestätigter Nutzer konnte Job anlegen — Gate kaputt!';
exception when insufficient_privilege or check_violation then
  raise notice 'PASS: unbestätigter Nutzer wird beim Auftrag-Anlegen blockiert';
end $$;
reset role;

-- TEST A2: bestätigter Kunde DARF Job anlegen
set role authenticated;
set request.jwt.claim.sub = 'd1111111-0000-0000-0000-000000000000';
do $$
declare n int;
begin
  insert into jobs (customer_id,title,description,category,address_plz,address_city,track,status)
  values ('d1111111-0000-0000-0000-000000000000','Erlaubt','Lang genug beschrieben hier drin.','Elektro','50667','Koeln','handwerker','open');
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: bestätigter Kunde konnte nicht anlegen'; end if;
  raise notice 'PASS: bestätigter Kunde kann Auftrag anlegen';
end $$;
reset role;

-- TEST B1: Fremder darf Angebot NICHT ablehnen
set request.jwt.claim.sub = 'd3333333-0000-0000-0000-000000000000';
do $$
begin
  perform decline_offer('d5555555-0000-0000-0000-000000000000');
  raise exception 'FAIL: Fremder konnte ablehnen';
exception when others then
  if sqlerrm like '%Not the job owner%' then raise notice 'PASS: Fremder kann Angebot nicht ablehnen';
  else raise; end if;
end $$;

-- TEST B2: Job-Owner darf ablehnen
set request.jwt.claim.sub = 'd1111111-0000-0000-0000-000000000000';
select decline_offer('d5555555-0000-0000-0000-000000000000');
do $$
declare st text;
begin
  select status into st from offers where id='d5555555-0000-0000-0000-000000000000';
  if st <> 'declined' then raise exception 'FAIL: Angebot nicht declined (%)', st; end if;
  raise notice 'PASS: Job-Owner kann Angebot ablehnen (declined)';
end $$;

-- TEST C1: Kein Angebot auf den EIGENEN Auftrag (Migration 0580).
-- d1111111 ist der Kunde von d4444444 — er darf darauf nicht bieten, auch
-- nicht, wenn er selbst ein Anbieterprofil hat.
insert into provider_profiles (id) values ('d1111111-0000-0000-0000-000000000000')
  on conflict (id) do nothing;
set request.jwt.claim.sub = 'd1111111-0000-0000-0000-000000000000';
do $$
begin
  insert into offers (job_id, provider_id, price, description)
  values ('d4444444-0000-0000-0000-000000000000',
          'd1111111-0000-0000-0000-000000000000', 100, 'Eigen-Angebot');
  raise exception 'FAIL: Angebot auf eigenen Auftrag war moeglich';
exception when others then
  if sqlerrm like '%FAIL:%' then raise; end if;
  if sqlerrm not like '%eigenen Auftrag ist nicht zulaessig%' then
    raise exception 'FAIL: unerwarteter Fehler statt Guard-Meldung: %', sqlerrm;
  end if;
  raise notice 'PASS: Angebot auf den eigenen Auftrag wird blockiert';
end $$;
reset role;

-- TEST C2: Ein als KUNDE registrierter Nutzer kann Nachbarschaftshilfe
-- anbieten (Founder-Frage 26.07.). Er hat profiles.role='customer' und
-- zunächst KEINE provider_profiles-Zeile — genau der Fall, in dem das alte
-- UPDATE ins Leere lief. Geprüft wird: (a) er darf sich selbst eine
-- Anbieterzeile anlegen, (b) der 0450-Guard erzwingt dabei unverifizierte
-- Startwerte, (c) er darf auf einen fremden Nachbarschafts-Auftrag bieten.
insert into auth.users (id,email,email_confirmed_at) values
  ('d7777777-0000-0000-0000-000000000000','helfer@test.de',now())
  on conflict (id) do nothing;
insert into profiles (id,role,email,email_verified_at) values
  ('d7777777-0000-0000-0000-000000000000','customer','helfer@test.de',now())
  on conflict (id) do nothing;
insert into jobs (id,customer_id,title,description,category,address_plz,address_city,track,status) values
  ('d8888888-0000-0000-0000-000000000000','d1111111-0000-0000-0000-000000000000',
   'NB-Job','Lang genug beschrieben hier drin.','Garten','50667','Koeln','nachbarschaft','open')
  on conflict (id) do nothing;

set request.jwt.claim.sub = 'd7777777-0000-0000-0000-000000000000';
insert into provider_profiles (id, is_nachbarschaft, business_name)
  values ('d7777777-0000-0000-0000-000000000000', true, 'Nachbar Nina');
do $$
declare k text; s boolean;
begin
  select kyc_status, stripe_onboarded into k, s
    from provider_profiles where id='d7777777-0000-0000-0000-000000000000';
  if k <> 'pending' or s then
    raise exception 'FAIL: Selbstanlage umging den 0450-Guard (kyc=%, stripe=%)', k, s;
  end if;
  raise notice 'PASS: Kunde kann Anbieterzeile anlegen, bleibt aber unverifiziert';
end $$;

do $$
begin
  insert into offers (job_id, provider_id, price, description)
  values ('d8888888-0000-0000-0000-000000000000',
          'd7777777-0000-0000-0000-000000000000', 40, 'Helfe gern');
  raise notice 'PASS: als Kunde registrierter Helfer kann auf NB-Auftrag bieten';
exception when others then
  raise exception 'FAIL: NB-Angebot des Kunden-Kontos blockiert: %', sqlerrm;
end $$;
reset role;

-- TEST C3: Das Verifikations-Gate haengt AUSSCHLIESSLICH am eigenen
-- DOI-Stempel (Migration 0430). Diese Assertion haelt das fest, weil die
-- Konsequenz betrieblich hart ist: ohne funktionierenden Mailversand
-- (RESEND_API_KEY) kann sich niemand verifizieren und ALLE Schreibwege sind
-- gesperrt (siehe docs/ops/RESEND-MAIL-GATE.md).
-- Der Fall "nur auth.users.email_confirmed_at gesetzt" ist der Normalzustand
-- JEDER Neuregistrierung, weil Supabase-Confirm deaktiviert ist.
reset role;
alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;
insert into auth.users (id,email,email_confirmed_at) values
  ('cacacaca-0000-0000-0000-000000000000','gate-a@test.de',now());
insert into profiles (id,role,email) values
  ('cacacaca-0000-0000-0000-000000000000','customer','gate-a@test.de');
insert into auth.users (id,email) values
  ('cbcbcbcb-0000-0000-0000-000000000000','gate-b@test.de');
insert into profiles (id,role,email,email_verified_at) values
  ('cbcbcbcb-0000-0000-0000-000000000000','customer','gate-b@test.de',now());
alter table auth.users enable trigger user;
alter table public.profiles enable trigger user;

set role authenticated;
set request.jwt.claim.sub = 'cacacaca-0000-0000-0000-000000000000';
do $$
begin
  if auth_email_confirmed() then
    raise exception 'FAIL: Supabase-Autoconfirm allein schaltet das Gate frei (0430 regressed)';
  end if;
  raise notice 'PASS: Supabase-Autoconfirm allein oeffnet das Gate NICHT (0430)';
end $$;
reset role;

set role authenticated;
set request.jwt.claim.sub = 'cbcbcbcb-0000-0000-0000-000000000000';
do $$
begin
  if not auth_email_confirmed() then
    raise exception 'FAIL: eigener DOI-Stempel oeffnet das Gate nicht — Verifizierung unmoeglich';
  end if;
  raise notice 'PASS: eigener DOI-Stempel oeffnet das Gate';
end $$;
reset role;

-- Guard-Vertrag (0600): CLIENT-Rollen duerfen email_verified_at nicht setzen,
-- administrative Verbindungen schon. Letzteres ist Absicht: der alte Guard
-- blockte auch postgres, weshalb die Notfall-Entsperrung den Trigger abschalten
-- musste — und weil er die einzige Schutzschicht dieser Spalte ist (die
-- UPDATE-Policy hat `and true`, 0050:52), oeffnete das ein stilles
-- Bypass-Fenster. Gegen einen Superuser schuetzt der Trigger ohnehin nicht.

-- (a) Client-Rolle darf NICHT per UPDATE setzen
set role authenticated;
set request.jwt.claim.sub = 'cacacaca-0000-0000-0000-000000000000';
do $$
begin
  update public.profiles set email_verified_at = now()
    where id='cacacaca-0000-0000-0000-000000000000';
  raise exception 'FAIL: Client konnte email_verified_at per UPDATE setzen';
exception when others then
  if sqlerrm like '%FAIL:%' then raise; end if;
  if sqlerrm not like '%managed by the verify-email Edge Function%' then
    raise exception 'FAIL: unerwarteter Fehler statt Guard-Meldung: %', sqlerrm;
  end if;
  raise notice 'PASS: Client kann email_verified_at nicht per UPDATE setzen';
end $$;
reset role;

-- (b) Client-Rolle darf NICHT per INSERT mitsenden (Luecke vor 0600).
-- Szenario 0380: verwaistes auth.users ohne Profil, Client legt es selbst an.
reset role;
alter table auth.users disable trigger user;
insert into auth.users (id,email) values
  ('cdcdcdcd-0000-0000-0000-000000000000','gate-c@test.de');
alter table auth.users enable trigger user;
set role authenticated;
set request.jwt.claim.sub = 'cdcdcdcd-0000-0000-0000-000000000000';
do $$
begin
  insert into public.profiles (id,role,email,email_verified_at)
  values ('cdcdcdcd-0000-0000-0000-000000000000','customer','gate-c@test.de',now());
  raise exception 'FAIL: Client konnte sich per INSERT selbst verifizieren';
exception when others then
  if sqlerrm like '%FAIL:%' then raise; end if;
  if sqlerrm not like '%managed by the verify-email Edge Function%' then
    raise exception 'FAIL: unerwarteter Fehler statt Guard-Meldung: %', sqlerrm;
  end if;
  raise notice 'PASS: Client kann sich nicht per INSERT selbst verifizieren (0600)';
end $$;
reset role;

-- (c) Administrative Verbindung DARF setzen — sonst braeuchte die
-- Notfall-Entsperrung wieder ein disable trigger.
do $$
declare v timestamptz;
begin
  update public.profiles set email_verified_at = now()
    where id='cacacaca-0000-0000-0000-000000000000';
  select email_verified_at into v from public.profiles
    where id='cacacaca-0000-0000-0000-000000000000';
  if v is null then
    raise exception 'FAIL: Notfall-Entsperrung als postgres funktioniert nicht';
  end if;
  raise notice 'PASS: administrative Entsperrung ohne disable trigger moeglich';
end $$;
