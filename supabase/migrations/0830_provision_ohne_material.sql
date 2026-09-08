-- Provision wird auf die ARBEITSLEISTUNG erhoben, nicht auf das Material.
--
-- FOUNDER-ENTSCHEIDUNG (08.09.2026): „Lass uns es ausweisen aber nicht
-- provisionieren das macht ja kein sinn meines erachtens es geht dann in die
-- verarsche."
--
-- Die Zahlen geben ihm recht. Bei 8 % auf den vollen Auftragswert zahlte ein
-- Dachdecker mit 8.000 € Auftrag und 5.000 € Material 640 € Provision. Das
-- sind 21,3 % auf seine tatsaechliche Wertschoepfung, waehrend die Plattform
-- „nur 8 %" bewirbt.
--
-- WICHTIG, weil ich es zunaechst falsch dargestellt hatte: das aendert KEINEN
-- Geldweg. Der Kunde zahlt weiterhin EINEN Betrag, im Escrow liegt EIN
-- Betrag, Storno und Erstattung bleiben unveraendert. Geaendert wird
-- ausschliesslich die Bemessungsgrundlage der Provision.
--
-- Das Material bleibt Teil des Angebotspreises. Ein getrennt berechneter,
-- zusaetzlich zu zahlender Posten waere ein zweiter Geldweg durch
-- accept_offer, release-escrow, cancel-contract und stripe-webhook, und jeder
-- Storno waere ein Einzelfall („Material schon gekauft?"). Ausdruecklich NICHT
-- gebaut.
--
-- FALLE, in die ich beim ersten Anlauf gelaufen bin: `grep` findet
-- accept_offer in 0060, 0110, 0280, 0290, 0390, 0400 und 0530. Lebendig ist
-- die ZWEIARGUMENTIGE Fassung aus 0530 (Kunde kommt aus auth.uid(), nicht als
-- Parameter -- IDOR-Behebung in 0290). Haette ich die dreiargumentige aus 0110
-- ueberschrieben, waere eine unbenutzte Ueberladung entstanden und die
-- Gebuehrenlogik unveraendert geblieben: ein Fehlschlag, der wie Erfolg
-- aussieht. Erkannt am Recht in 0820, das auf (uuid, uuid) lautet.

-- ── Spalten ────────────────────────────────────────────────────────────────
-- `if not exists`, weil Migrationen von Hand im SQL-Editor eingespielt werden
-- und ein zweiter Lauf nach einem Abbruch durchgehen muss.
alter table public.offers
  add column if not exists material_cost numeric(10,2) not null default 0;

alter table public.contracts
  add column if not exists material_cost numeric(10,2) not null default 0;

-- Material kann nicht negativ und nicht groesser als der Preis sein. Die
-- Pruefung steht ZUSAETZLICH im Client (lib/angebotPreis.ts); eine Regel, die
-- nur im Client steht, ist keine Regel.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'offers_material_cost_plausibel'
  ) then
    alter table public.offers
      add constraint offers_material_cost_plausibel
      check (material_cost >= 0 and material_cost <= price);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'contracts_material_cost_plausibel'
  ) then
    alter table public.contracts
      add constraint contracts_material_cost_plausibel
      check (material_cost >= 0 and material_cost <= price_gross);
  end if;
end $$;

comment on column public.offers.material_cost is
  'Im Angebotspreis enthaltener Materialanteil. Bemessungsgrundlage der Provision ist price - material_cost (Founder-Entscheidung 08.09.2026).';
comment on column public.contracts.material_cost is
  'Aus dem angenommenen Angebot uebernommen, damit die Rechnung den Anteil ausweisen kann, ohne das Angebot nachzuschlagen.';

-- ── accept_offer ───────────────────────────────────────────────────────────
-- Vorlage ist 0530, unveraendert uebernommen bis auf drei Stellen:
--   1. v_material und v_arbeitsanteil kommen dazu,
--   2. die Provision rechnet auf v_arbeitsanteil,
--   3. material_cost wandert in den Vertrag.
-- Zusaetzlich: der Gedankenstrich in der System-Nachricht ist raus
-- (Founder-Anweisung 07.09., siehe scripts/gedankenstrich-check.py).
create or replace function accept_offer(
  p_offer_id uuid,
  p_job_id   uuid
) returns setof contracts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid;
  v_offer   offers%rowtype;
  v_job     jobs%rowtype;
  v_price   numeric;
  v_material       numeric;
  v_arbeitsanteil  numeric;
  v_werkr_schutz_fee     numeric;
  v_customer_service_fee numeric;
  v_provider_commission  numeric;
  v_customer_total       numeric;
  v_provider_payout      numeric;
  v_now      timestamptz := now();
  v_contract contracts%rowtype;
begin
  v_customer := auth.uid();
  if v_customer is null then raise exception 'Not authenticated'; end if;
  if not auth_email_confirmed() then raise exception 'Email not verified'; end if;

  select * into v_offer from offers where id = p_offer_id for update;
  if not found then raise exception 'Offer not found'; end if;
  if v_offer.status <> 'pending' then raise exception 'Offer is not pending'; end if;
  if v_offer.job_id <> p_job_id then raise exception 'Offer does not belong to job'; end if;

  select * into v_job from jobs where id = p_job_id;
  if not found then raise exception 'Job not found'; end if;
  if v_job.customer_id <> v_customer then raise exception 'Not the job owner'; end if;

  v_price    := v_offer.price;
  v_material := coalesce(v_offer.material_cost, 0);
  -- greatest(...,0) neben der Tabellenbedingung: eine negative
  -- Bemessungsgrundlage waere hier der teuerste denkbare Fehler.
  v_arbeitsanteil := greatest(v_price - v_material, 0);

  if v_job.track = 'nachbarschaft' then
    -- Unveraendert: Pauschale statt Provision, das Material spielt keine Rolle.
    v_werkr_schutz_fee     := 1.99;
    v_customer_service_fee := 0;
    v_provider_commission  := 0;
    v_customer_total       := round((v_price + 1.99)::numeric, 2);
    v_provider_payout      := v_price;
  else
    -- 8 % auf die Arbeitsleistung statt auf alles.
    v_provider_commission  := round(greatest(v_arbeitsanteil * 0.08, 3.00)::numeric, 2);
    -- Die Servicegebuehr des KUNDEN bleibt auf dem vollen Betrag: sie deckt
    -- Zahlungsabwicklung und Escrow, und die haengen an der bewegten Summe,
    -- nicht an der Wertschoepfung.
    v_customer_service_fee := round(greatest(v_price * 0.025, 1.50)::numeric, 2);
    v_werkr_schutz_fee     := 0;
    v_customer_total       := round((v_price + v_customer_service_fee)::numeric, 2);
    v_provider_payout      := round((v_price - v_provider_commission)::numeric, 2);
  end if;

  insert into contracts (
    job_id, offer_id, customer_id, provider_id, track,
    price_gross, material_cost, werkr_schutz_fee, customer_service_fee,
    provider_commission, customer_total, provider_payout,
    customer_signed_at, provider_signed_at
  ) values (
    p_job_id, p_offer_id, v_customer, v_offer.provider_id, v_job.track,
    v_price, v_material, v_werkr_schutz_fee, v_customer_service_fee,
    v_provider_commission, v_customer_total, v_provider_payout,
    v_now, v_now
  ) returning * into v_contract;

  update offers set status = 'accepted', updated_at = now() where id = p_offer_id;

  update offers set status = 'declined', updated_at = now()
    where job_id = p_job_id and id <> p_offer_id and status = 'pending';

  update jobs set status = 'active', provider_id = v_offer.provider_id where id = p_job_id;

  insert into public.messages (job_id, sender_id, sender_role, body, provider_id, type)
    values (p_job_id, v_customer, 'customer',
            'Angebot angenommen. Der Auftrag ist beauftragt.',
            v_offer.provider_id, 'system');

  return next v_contract;
end;
$$;

-- Rechte neu setzen: 0820 hat das Ausfuehrungsrecht per Voreinstellung
-- entzogen, und nach einem `create or replace` darauf zu vertrauen, dass die
-- alte Rechteliste haengen bleibt, waere geraten statt gewusst.
revoke execute on function accept_offer(uuid, uuid) from public;
grant execute on function accept_offer(uuid, uuid) to authenticated;

comment on function public.accept_offer(uuid, uuid) is
  'Nimmt ein Angebot an und legt den Vertrag an. Provision: 8 % auf price - material_cost, mindestens 3 EUR (Founder-Entscheidung 08.09.2026).';
