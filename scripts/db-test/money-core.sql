-- Seed mit deaktivierten User-Triggern (Gates/Guards) auf den Seed-Tabellen
alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;
alter table public.jobs disable trigger user;
alter table public.offers disable trigger user;

insert into auth.users (id, email, email_confirmed_at) values
  ('11111111-1111-1111-1111-111111111111','kunde@test.de', now()),
  ('22222222-2222-2222-2222-222222222222','anbieter@test.de', now());
insert into profiles (id, role, email, email_verified_at) values
  ('11111111-1111-1111-1111-111111111111','customer','kunde@test.de', now()),
  ('22222222-2222-2222-2222-222222222222','provider','anbieter@test.de', now());
insert into provider_profiles (id, business_name) values
  ('22222222-2222-2222-2222-222222222222','Testbetrieb');
insert into jobs (id, customer_id, title, description, category, address_plz, address_city, track, status)
values ('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111',
        'Test Auftrag','Beschreibung lang genug fuer den Test hier drin.','Elektro','50667','Koeln','handwerker','open'),
       ('66666666-6666-6666-6666-666666666666','11111111-1111-1111-1111-111111111111',
        'J2','Beschreibung lang genug hier drin.','Elektro','50667','Koeln','handwerker','open');
insert into offers (id, job_id, provider_id, price, status) values
  ('44444444-4444-4444-4444-444444444444','33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222',100,'pending'),
  ('55555555-5555-5555-5555-555555555555','33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222',120,'pending'),
  ('77777777-7777-7777-7777-777777777777','66666666-6666-6666-6666-666666666666','22222222-2222-2222-2222-222222222222',50,'pending');

alter table auth.users enable trigger user;
alter table public.profiles enable trigger user;
alter table public.jobs enable trigger user;
alter table public.offers enable trigger user;

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select accept_offer('44444444-4444-4444-4444-444444444444','33333333-3333-3333-3333-333333333333');

do $$
declare c contracts%rowtype; o_other text; j_status text;
begin
  select * into c from contracts where offer_id='44444444-4444-4444-4444-444444444444';
  if not found then raise exception 'FAIL: kein Vertrag'; end if;
  if c.provider_commission <> 8.00 then raise exception 'FAIL commission=%', c.provider_commission; end if;
  if c.customer_service_fee <> 2.50 then raise exception 'FAIL service=%', c.customer_service_fee; end if;
  if c.customer_total <> 102.50 then raise exception 'FAIL total=%', c.customer_total; end if;
  if c.provider_payout <> 92.00 then raise exception 'FAIL payout=%', c.provider_payout; end if;
  if c.customer_signed_at is null or c.provider_signed_at is null then raise exception 'FAIL Signatur fehlt'; end if;
  select status into o_other from offers where id='55555555-5555-5555-5555-555555555555';
  if o_other <> 'declined' then raise exception 'FAIL anderes Angebot=%', o_other; end if;
  select status into j_status from jobs where id='33333333-3333-3333-3333-333333333333';
  if j_status <> 'active' then raise exception 'FAIL job=%', j_status; end if;
  raise notice 'PASS money-math(8/2.50/102.50/92)+signatures+autoreject+jobactive';
end $$;

-- accept_offer legt eine System-Nachricht in den (job, provider)-Thread (0530).
do $$
declare n int;
begin
  select count(*) into n from messages
   where job_id='33333333-3333-3333-3333-333333333333'
     and provider_id='22222222-2222-2222-2222-222222222222'
     and type='system'
     and body='Angebot angenommen — Auftrag ist beauftragt.';
  if n <> 1 then raise exception 'FAIL: keine System-Nachricht nach accept_offer (n=%)', n; end if;
  raise notice 'PASS accept_offer-system-message';
end $$;

set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
begin
  perform accept_offer('77777777-7777-7777-7777-777777777777','66666666-6666-6666-6666-666666666666');
  raise exception 'FAIL: Fremder konnte annehmen';
exception when others then
  if sqlerrm like '%Not the job owner%' then raise notice 'PASS impersonation-blocked';
  else raise; end if;
end $$;
