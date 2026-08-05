-- Migration 0660: Historie der PaymentIntents je Vertrag
--
-- BEFUND (bestaetigter P0, dokumentiert in
-- docs/architecture/PAYMENT-INTENT-HISTORY-PLAN.md):
-- `contracts.stripe_payment_intent` ist eine EINZELNE Spalte und speichert immer
-- nur den zuletzt erzeugten PaymentIntent. Acht Lesewege im stripe-webhook
-- suchen den Vertrag ueber genau diese Spalte. Trifft ein Ereignis zu einem
-- AELTEREN Intent ein -- eine Erstattung, eine Rueckbuchung, eine
-- Betrugs-Fruehwarnung --, findet es keine Zeile und hinterlaesst weder Spur
-- noch Alarm. Ein Geldvorgang, den das System nicht kennt.
--
-- Ein zweiter Intent entsteht real: `create-payment-intent` gibt einen
-- bestehenden nur zurueck, solange er `requires_payment_method` oder
-- `requires_confirmation` ist. In jedem anderen Zustand faellt der Code durch
-- und erzeugt einen neuen. Der alte bleibt bei Stripe bestehen und ist
-- weiterhin erstattungs- und rueckbuchungsfaehig.
--
-- ZEITPUNKT: Es gibt keine Produktionsdaten. Stripe ist bewusst nicht
-- eingerichtet, es existierte nie ein echter PaymentIntent. Der Backfill hat
-- hoechstens Testzeilen zu beruecksichtigen -- diese Aenderung wird nie wieder
-- so billig sein.

create table if not exists public.contract_payment_intents (
  -- Der natuerliche Schluessel. Bei Stripe global eindeutig, und genau der
  -- Wert, mit dem jedes Webhook-Ereignis ankommt: die Suche wird damit ein
  -- Primaerschluesselzugriff. Ein Vertrag kann denselben Intent nicht zweimal
  -- fuehren, und zwei Vertraege koennen ihn sich nicht teilen -- die Eigenschaft,
  -- die scripts/db-test/webhook-idempotency.sql (Y10) bisher an der alten
  -- Spalte geprueft hat, bleibt damit erhalten.
  payment_intent_id text primary key,
  contract_id       uuid not null references public.contracts(id) on delete restrict,
  -- Betrag in ganzen Cent. numeric/float haben in diesem Projekt schon einmal
  -- eine 1-Cent-Differenz zwischen App und Datenbank erzeugt.
  amount_cents      integer not null check (amount_cents > 0),
  currency          text    not null default 'eur' check (currency = lower(currency)),
  -- Letzter bekannter Stripe-Status. Nur informativ; massgeblich ist Stripe.
  status            text,
  is_current        boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Genau EIN Intent je Vertrag darf aktuell sein. Der partielle Unique-Index
-- ersetzt die alte Spalte semantisch, ohne die Historie zu verlieren.
create unique index if not exists contract_payment_intents_one_current
  on public.contract_payment_intents (contract_id) where is_current;

create index if not exists contract_payment_intents_contract_idx
  on public.contract_payment_intents (contract_id);

-- Wie public.payout_operations (0650) und public.rate_limits (0250): RLS an,
-- ABSICHTLICH keine Policy. Damit haben anon und authenticated per Default-Deny
-- null Zugriff. Die Tabelle enthaelt Zahlungskennungen und Betraege; kein Client
-- hat daran etwas zu suchen.
alter table public.contract_payment_intents enable row level security;

comment on table public.contract_payment_intents is
  'Alle PaymentIntents je Vertrag, nicht nur der letzte. Genau einer ist is_current. contracts.stripe_payment_intent bleibt als Spiegel bestehen. Kein Client-Zugriff (RLS an, keine Policy).';

-- ── Backfill ───────────────────────────────────────────────────────────────
-- Idempotent durch `on conflict`. Der Betrag wird aus customer_total abgeleitet;
-- fuer Altzeilen ist er nicht exakt rekonstruierbar, wenn ein frueherer Intent
-- auf einen anderen Betrag lautete. Hinnehmbar, weil es keine solchen Altzeilen
-- gibt (siehe Kopfkommentar) -- fuer neue Zeilen schreibt create-payment-intent
-- den echten Betrag.
insert into public.contract_payment_intents
  (payment_intent_id, contract_id, amount_cents, currency, status, is_current)
select c.stripe_payment_intent, c.id,
       greatest((round(c.customer_total::numeric, 2) * 100)::integer, 1),
       'eur', null, true
  from public.contracts c
 where c.stripe_payment_intent is not null
   and c.stripe_payment_intent <> ''
on conflict (payment_intent_id) do nothing;

-- ── Registrierung eines Intents ────────────────────────────────────────────
-- Setzt den neuen Intent als aktuell, stuft alle bisherigen des Vertrags zurueck
-- und pflegt den Spiegel in contracts -- alles in EINER Transaktion. Getrennte
-- Schreibvorgaenge haetten genau die Teilfehler-Luecke erzeugt, die im
-- Auszahlungspfad schon einmal Geld gekostet hat (PR #162).
create or replace function public.register_payment_intent(
  p_contract_id uuid,
  p_intent_id   text,
  p_amount_cents integer
)
returns public.contract_payment_intents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.contract_payment_intents;
  v_bestehend uuid;
begin
  if p_intent_id is null or p_intent_id = '' then
    raise exception 'intent_id_required' using errcode = 'P0001';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;

  -- Serialisiert die Vorbedingungspruefung gegen eine gleichzeitige Aenderung
  -- des Vertrags. Die Einmaligkeit des aktuellen Intents haengt NICHT hieran,
  -- sondern am partiellen Unique-Index (contract_id) where is_current -- das
  -- hat die Gegenprobe des QA-Reviews gezeigt, und der Kommentar sagt es jetzt
  -- so, statt mehr zu behaupten.
  perform 1 from public.contracts where id = p_contract_id for update;
  if not found then
    raise exception 'contract_not_found' using errcode = 'P0002';
  end if;

  -- Derselbe Intent an einem ANDEREN Vertrag waere ein Datenfehler, kein
  -- Wechsel. Lieber laut scheitern als still umhaengen.
  select contract_id into v_bestehend
    from public.contract_payment_intents where payment_intent_id = p_intent_id;
  if v_bestehend is not null and v_bestehend <> p_contract_id then
    raise exception 'intent_belongs_to_other_contract' using errcode = 'P0001';
  end if;

  update public.contract_payment_intents
     set is_current = false, updated_at = now()
   where contract_id = p_contract_id
     and is_current
     and payment_intent_id <> p_intent_id;

  insert into public.contract_payment_intents
    (payment_intent_id, contract_id, amount_cents, currency, is_current)
  values (p_intent_id, p_contract_id, p_amount_cents, 'eur', true)
  on conflict (payment_intent_id) do update
    set is_current = true, updated_at = now()
  returning * into v_row;

  -- Spiegel. contracts.stripe_payment_intent bleibt bestehen, weil sie durch
  -- die Trigger aus 0300/0630 geschuetzt ist und von cancel-contract gelesen
  -- wird. Ein abgeleiteter Spiegel ist billiger als eine Migration aller
  -- Lesestellen.
  update public.contracts
     set stripe_payment_intent = p_intent_id
   where id = p_contract_id;

  return v_row;
end;
$$;

comment on function public.register_payment_intent is
  'Registriert einen PaymentIntent als den aktuellen eines Vertrags, stuft frühere zurück und pflegt den Spiegel in contracts -- atomar.';

-- ── Vertrag zu einem BELIEBIGEN Intent finden ──────────────────────────────
-- Der eigentliche Zweck dieser Migration: ein Ereignis zu einem aelteren Intent
-- findet seinen Vertrag.
create or replace function public.contract_for_payment_intent(p_intent_id text)
returns table (contract_id uuid, is_current boolean)
language sql
security definer
set search_path = public
stable
as $$
  select cpi.contract_id, cpi.is_current
    from public.contract_payment_intents cpi
   where cpi.payment_intent_id = p_intent_id;
$$;

comment on function public.contract_for_payment_intent is
  'Findet den Vertrag zu einem PaymentIntent -- auch zu einem nicht mehr aktuellen. Liefert mit, ob es der aktuelle ist.';

revoke execute on function public.register_payment_intent(uuid, text, integer) from public, anon, authenticated;
revoke execute on function public.contract_for_payment_intent(text) from public, anon, authenticated;
grant  execute on function public.register_payment_intent(uuid, text, integer) to service_role;
grant  execute on function public.contract_for_payment_intent(text) to service_role;
