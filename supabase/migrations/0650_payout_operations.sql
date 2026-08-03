-- Migration 0650: Auszahlungs-Operationen (Payout-Ledger)
--
-- BEFUND (Security-Review zu PR #162, P0): In release-escrow lief der
-- Stripe-Transfer VOR dem Vertrags-Update. Schlug das Update fehl, lag das Geld
-- beim Anbieter, `escrow_released_at` blieb leer, und der Kunde bekam 500.
-- Alle Guards liessen einen erneuten Versuch zu. Innerhalb 24 Stunden schuetzte
-- der Stripe-Idempotency-Key; danach verwirft Stripe ihn und ein zweiter echter
-- Transfer war moeglich -- doppelte Auszahlung. Es gab keine lokale Spur der
-- Transfer-ID unabhaengig von der contracts-Zeile.
--
-- WARUM EINE EIGENE TABELLE UND NICHT EINE SPALTE AN contracts:
-- Die Operation muss existieren, BEVOR der externe Aufruf stattfindet. Nur so
-- gibt es nach einem Absturz zwischen Transfer und DB-Schreibvorgang einen
-- Anker, an dem der naechste Versuch erkennt, dass bereits etwas begonnen wurde.
-- Eine Spalte an contracts haette denselben Schreibvorgang gebraucht, der ja
-- gerade fehlschlaegt.
--
-- KEIN "exactly once": Postgres und Stripe sind zwei Systeme ohne gemeinsame
-- Transaktion. Was hier gebaut wird, ist ein wiederaufnehmbarer Ablauf --
-- beanspruchen, abgleichen, finalisieren -- bei dem jeder Teilfehler zu einem
-- sicheren, erneut versuchbaren Zustand fuehrt.

-- ── 0. FEHLENDE SPALTE: provider_profiles.stripe_account_id ────────────────
--
-- BEFUND beim Replay dieser Migration gegen frisches Postgres: Die Spalte
-- existiert im gesamten Schema NICHT. Keine Migration legt sie an. Zwei Edge
-- Functions lesen sie trotzdem, und `lib/database.types.ts` deklariert sie:
--
--   release-escrow/handler.ts:164  .select("stripe_account_id")
--     -> PostgREST-Fehler auf einer unbekannten Spalte -> profileError
--     -> 400 "Provider Stripe account not found". JEDE Auszahlung scheitert.
--   stripe-webhook/handler.ts:121  .eq("stripe_account_id", account.id)
--     -> Fehler -> throw -> 500 -> Stripe wiederholt endlos.
--        stripe_onboarded konnte dadurch NIE true werden, womit auch die
--        Sichtbarkeitsfilter auf Startseite und in der Suche niemanden zeigen.
--
-- Diese Migration bringt das Schema auf den Stand, den der Code bereits
-- voraussetzt. Sie macht Auszahlungen NICHT funktionsfaehig: es gibt im ganzen
-- Repo keinen Connect-Onboarding-Pfad (kein accounts.create, keine
-- accountLinks, keine Edge Function), der die Spalte je fuellen wuerde. Der
-- Fehler wandert damit von "unbekannte Spalte" zu einem ehrlichen
-- "provider_without_stripe_account". Das Bauen des Onboardings ist eine eigene
-- Aufgabe und beruehrt Stripe-Konfiguration -- ausdruecklich nicht Teil hiervon.
alter table public.provider_profiles
  add column if not exists stripe_account_id text;

comment on column public.provider_profiles.stripe_account_id is
  'Stripe-Connect-Konto des Anbieters (acct_...). Ziel jeder Auszahlung. Wird NIEMALS clientseitig geschrieben (ADR-0004) -- sonst koennte ein Anbieter sein eigenes Auszahlungsziel bestimmen. Aktuell fuellt sie NICHTS: der Connect-Onboarding-Pfad ist nicht gebaut.';

-- Schreibschutz wie fuer stripe_onboarded. Ohne ihn erlaubt die
-- UPDATE-Policy aus 0010 dem Eigentuemer, diese Spalte selbst zu setzen --
-- also frei zu bestimmen, auf welches Stripe-Konto Werkant ueberweist.
create or replace function guard_provider_profile_sensitive_cols()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if current_setting('role', true) = 'service_role' then
    return new;
  end if;

  if new.stripe_onboarded is distinct from old.stripe_onboarded then
    raise exception 'stripe_onboarded is managed exclusively by the Stripe webhook (ADR-0004)';
  end if;
  if new.stripe_account_id is distinct from old.stripe_account_id then
    raise exception 'stripe_account_id is managed exclusively by the Stripe Connect flow (ADR-0004)';
  end if;
  if new.kyc_status is distinct from old.kyc_status then
    if old.kyc_status in ('pending','rejected')
       and new.kyc_status = 'in_review'
       and new.gewerbeschein_path is not null then
      new.kyc_submitted_at := now();
    else
      raise exception 'kyc_status is managed by the KYC review process';
    end if;
  end if;
  if new.meister_verified is distinct from old.meister_verified then
    raise exception 'meister_verified is managed by the verification team';
  end if;
  return new;
end;
$$;

create table if not exists public.payout_operations (
  id                     uuid primary key default gen_random_uuid(),
  -- unique = die atomare Beanspruchung. Zwei gleichzeitige Freigaben desselben
  -- Vertrags koennen nicht zwei Operationen erzeugen.
  contract_id            uuid not null unique references public.contracts(id) on delete restrict,
  status                 text not null default 'claimed'
                           check (status in ('claimed','transferred','finalized','manual_review')),
  -- Geld ausschliesslich in ganzen Cent. numeric/float haben in diesem Projekt
  -- schon einmal eine 1-Cent-Differenz zwischen App und Datenbank erzeugt.
  amount_cents           integer not null check (amount_cents > 0),
  currency               text    not null default 'eur' check (currency = lower(currency)),
  destination_account_id text    not null,
  -- Dauerhaft, nicht neu erzeugt: der Anker fuer Stripes Idempotenz.
  idempotency_key        text    not null unique,
  -- Suchschluessel fuer die Reconciliation bei Stripe.
  transfer_group         text    not null,
  stripe_transfer_id     text    unique,
  attempt_count          integer not null default 0,
  last_error             text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  transferred_at         timestamptz,
  finalized_at           timestamptz
);

create index if not exists payout_operations_status_idx
  on public.payout_operations (status) where status <> 'finalized';

-- Wie public.rate_limits (0250): RLS an, ABSICHTLICH keine Policy. Damit haben
-- anon und authenticated per Default-Deny null Zugriff -- weder lesend noch
-- schreibend. Der Zugriff laeuft ausschliesslich ueber die service_role in den
-- Edge Functions und ueber die beiden SECURITY-DEFINER-Funktionen unten.
-- Die Tabelle enthaelt Auszahlungsbetraege und Stripe-Kontokennungen; kein
-- Client hat daran etwas zu suchen.
alter table public.payout_operations enable row level security;

comment on table public.payout_operations is
  'Wiederaufnehmbare Auszahlungs-Operationen. Wird VOR dem Stripe-Transfer angelegt, damit ein Absturz zwischen Transfer und DB-Schreibvorgang beim naechsten Versuch erkennbar ist. Kein Client-Zugriff (RLS an, keine Policy).';

-- ── Schritt 1: atomar beanspruchen ─────────────────────────────────────────
-- Prueft ALLE Vertragsbedingungen erneut innerhalb der Transaktion und liefert
-- genau eine Operation je Vertrag. Setzt den Vertrag NICHT auf completed und
-- zaehlt PStTG NICHT -- das passiert erst beim Finalisieren.
create or replace function public.payout_claim(
  p_contract_id uuid,
  p_caller      uuid
)
returns public.payout_operations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c        public.contracts%rowtype;
  v_ziel     text;
  v_betrag   integer;
  v_op       public.payout_operations;
begin
  -- for update: sperrt die Vertragszeile fuer die Dauer der Transaktion. Zwei
  -- gleichzeitige Beanspruchungen laufen dadurch nacheinander, nicht parallel.
  select * into v_c from public.contracts where id = p_contract_id for update;
  if not found then raise exception 'contract_not_found' using errcode = 'P0002'; end if;

  if v_c.customer_id is distinct from p_caller then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if v_c.status <> 'active' then
    raise exception 'contract_not_active' using errcode = 'P0001';
  end if;
  if v_c.escrow_captured_at is null then
    raise exception 'escrow_not_captured' using errcode = 'P0001';
  end if;
  if v_c.escrow_released_at is not null then
    raise exception 'already_released' using errcode = 'P0001';
  end if;
  if coalesce(v_c.customer_refunded_amount, 0) > 0 then
    raise exception 'already_refunded' using errcode = 'P0001';
  end if;
  if v_c.dispute_state = 'open' then
    raise exception 'dispute_open' using errcode = 'P0001';
  end if;

  select stripe_account_id into v_ziel
    from public.provider_profiles where id = v_c.provider_id;
  if v_ziel is null or v_ziel = '' then
    raise exception 'provider_without_stripe_account' using errcode = 'P0001';
  end if;

  -- round() auf numeric, nicht Fliesskomma: identisch zu accept_offer.
  v_betrag := (round(v_c.provider_payout::numeric, 2) * 100)::integer;
  if v_betrag <= 0 then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;

  -- Genau eine Operation je Vertrag. Beim zweiten Aufruf gewinnt niemand neu:
  -- es kommt dieselbe Zeile zurueck, nur der Versuchszaehler steigt. Der
  -- Idempotency-Key bleibt damit ueber alle Wiederholungen stabil.
  insert into public.payout_operations (
    contract_id, amount_cents, currency, destination_account_id,
    idempotency_key, transfer_group, attempt_count
  ) values (
    p_contract_id, v_betrag, 'eur', v_ziel,
    'payout-op-' || p_contract_id::text, p_contract_id::text, 1
  )
  on conflict (contract_id) do update
    set attempt_count = public.payout_operations.attempt_count + 1,
        updated_at    = now()
  returning * into v_op;

  return v_op;
end;
$$;

comment on function public.payout_claim is
  'Beansprucht die Auszahlung eines Vertrags atomar. Prueft alle Vertragsbedingungen erneut, liefert genau eine Operation je contract_id. Finalisiert NICHT.';

-- ── Schritt 3: atomar finalisieren ─────────────────────────────────────────
-- Operation, Vertrag, Job und PStTG in EINER Transaktion. Der PStTG-Zaehler
-- steigt ausschliesslich beim ERSTEN Uebergang nach 'finalized'.
create or replace function public.payout_finalize(
  p_operation_id uuid,
  p_transfer_id  text
)
returns public.payout_operations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_op  public.payout_operations;
  v_c   public.contracts%rowtype;
  v_now timestamptz := now();
begin
  select * into v_op from public.payout_operations where id = p_operation_id for update;
  if not found then raise exception 'operation_not_found' using errcode = 'P0002'; end if;

  if v_op.status = 'manual_review' then
    raise exception 'operation_blocked' using errcode = 'P0001';
  end if;

  -- Bereits finalisiert: nichts erneut tun, insbesondere NICHT erneut zaehlen.
  -- Das ist der Wiederaufnahme-Pfad nach einem Absturz.
  if v_op.status = 'finalized' then
    return v_op;
  end if;

  if p_transfer_id is null or p_transfer_id = '' then
    raise exception 'transfer_id_required' using errcode = 'P0001';
  end if;
  -- Ein anderer Transfer als der bereits vermerkte darf nicht stillschweigend
  -- ueberschrieben werden -- das waere ein zweiter Geldfluss ohne Spur.
  --
  -- BEWUSST OHNE `raise`: eine Exception rollt in Postgres den gesamten
  -- Funktionsblock zurueck, also auch die Sperre selbst. Die Operation bliebe
  -- dann auf 'transferred' stehen und der naechste Versuch liefe erneut in
  -- dieselbe Lage. Stattdessen wird gesperrt und die Zeile zurueckgegeben --
  -- der Aufrufer prueft `status` und antwortet sichtbar mit einem Fehler.
  if v_op.stripe_transfer_id is not null and v_op.stripe_transfer_id <> p_transfer_id then
    update public.payout_operations
      set status = 'manual_review', updated_at = v_now,
          last_error = 'abweichende Transfer-ID beim Finalisieren: ' || p_transfer_id
      where id = p_operation_id
      returning * into v_op;
    return v_op;
  end if;

  update public.payout_operations
    set status             = 'finalized',
        stripe_transfer_id = p_transfer_id,
        transferred_at     = coalesce(transferred_at, v_now),
        finalized_at       = v_now,
        updated_at         = v_now,
        last_error         = null
    where id = p_operation_id
    returning * into v_op;

  -- Vertrag nur aus dem noch nicht freigegebenen Zustand heraus schliessen.
  --
  -- Erstattung und Rueckbuchung werden hier ERNEUT geprueft, nicht nur beim
  -- Beanspruchen: zwischen payout_claim und payout_finalize liegt der
  -- Stripe-Aufruf, und in diesem Fenster kann ein charge.refunded oder ein
  -- charge.dispute.created eintreffen. Ohne die erneute Pruefung wuerde ein
  -- Vertrag als bezahlt abgeschlossen, obwohl der Kunde sein Geld inzwischen
  -- zurueckhat. (TOCTOU-Befund des QA-Reviews.)
  update public.contracts
    set escrow_released_at = v_now, status = 'completed', completed_at = v_now
    where id = v_op.contract_id
      and escrow_released_at is null
      and coalesce(customer_refunded_amount, 0) = 0
      and (dispute_state is distinct from 'open')
    returning * into v_c;

  if not found then
    -- Der Vertrag liess sich nicht schliessen. Entweder war er schon
    -- freigegeben (harmlose Wiederholung), oder es ist zwischenzeitlich eine
    -- Erstattung bzw. Rueckbuchung eingetroffen. Letzteres ist ein echter
    -- Konflikt: der Transfer ist gelaufen, das Geld aber ganz oder teilweise
    -- zurueck. Sperren statt stillschweigend abschliessen.
    select * into v_c from public.contracts where id = v_op.contract_id;
    if v_c.escrow_released_at is null then
      update public.payout_operations
        set status = 'manual_review', updated_at = v_now,
            last_error = 'Erstattung oder Rueckbuchung waehrend der Auszahlung'
        where id = p_operation_id
        returning * into v_op;
      return v_op;
    end if;
  else
    -- NUR status: jobs hat KEINE Spalte completed_at. Der alte Handler
    -- schrieb sie trotzdem (release-escrow/handler.ts:240) -- damit scheiterte
    -- der GESAMTE Update, und der Auftrag blieb nach einer Auszahlung auf
    -- 'active' stehen. Der Fehler war dort nur geloggt, nicht behandelt.
    update public.jobs set status = 'completed' where id = v_c.job_id;
    -- PStTG genau hier und nur hier: im selben Transaktionsblock wie der
    -- Uebergang des Vertrags. Migration 0610 macht das Hochzaehlen selbst
    -- atomar; die Einmaligkeit kommt aus der Bedingung oben.
    perform public.pstg_record_transaction(v_c.provider_id, v_c.provider_payout);
  end if;

  return v_op;
end;
$$;

comment on function public.payout_finalize is
  'Finalisiert eine Auszahlung atomar: Operation, Vertrag, Job und PStTG-Jahreszaehler in einer Transaktion. Erneuter Aufruf ist wirkungslos (Wiederaufnahme nach Absturz).';

-- Nur die service_role darf diese Funktionen aufrufen. Kein Client-Weg.
revoke execute on function public.payout_claim(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.payout_finalize(uuid, text) from public, anon, authenticated;
grant  execute on function public.payout_claim(uuid, uuid) to service_role;
grant  execute on function public.payout_finalize(uuid, text) to service_role;
