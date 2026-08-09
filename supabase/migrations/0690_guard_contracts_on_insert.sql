-- Migration 0690: Guard-Trigger deckt auch INSERT ab (Tiefenverteidigung zu 0680)
--
-- 0680 hat `authenticated` und `anon` das INSERT-Recht auf `contracts`
-- entzogen und damit einen verifizierten P0 geschlossen: ein Kunde konnte eine
-- Vertragszeile mit frei gewaehltem `provider_payout`, `status='active'` und
-- gesetztem `escrow_captured_at` anlegen, und `release-escrow` haette darauf
-- einen echten Transfer vom Plattform-Saldo ausgeloest.
--
-- Diese Schranke ist aber NUR eine Rechtevergabe, und Rechtevergaben sind in
-- diesem Schema schon einmal pauschal ueberschrieben worden: 0420 enthaelt
-- `grant select, insert, update, delete on all tables in schema public to
-- anon, authenticated`. Eine kuenftige Migration dieser Art dreht 0680 lautlos
-- zurueck. Dann greift nichts mehr, denn
-- `trg_guard_contracts_sensitive_cols` ist seit 0300 `before update` und
-- feuert bei INSERT ueberhaupt nicht.
--
-- Deshalb hier die zweite, unabhaengige Schranke: der Trigger wird auf
-- `before insert or update` erweitert.
--
-- WARUM DIE FALLUNTERSCHEIDUNG UEBER current_user UND NICHT UEBER role:
-- Bei INSERT ist `OLD` nicht zugewiesen -- ein Vergleich `new.x is distinct
-- from old.x` wuerde einen Laufzeitfehler werfen. Der INSERT-Zweig prueft
-- deshalb auf "gesetzt" statt auf "geaendert".
--
-- Wen dieser Zweig treffen darf, ist die heikle Frage. `accept_offer()` legt
-- jeden legitimen Vertrag an und setzt dabei price_gross, provider_payout,
-- customer_total und die Gebuehren -- alles geschuetzte Spalten. Die Funktion
-- ist `security definer`, das aendert aber nur `current_user` (auf den
-- Eigentuemer), NICHT die GUC `role`: die bleibt waehrend des Aufrufs auf
-- 'authenticated' stehen. Eine Pruefung ueber `current_setting('role')` haette
-- accept_offer also mitblockiert und die Auftragsannahme abgeschaltet.
--
-- `current_user` unterscheidet sauber:
--   direkter Client-Insert ueber PostgREST -> current_user = authenticated/anon
--   innerhalb accept_offer (security definer) -> current_user = Eigentuemer
--   Edge Function mit service_role-Key       -> current_user = service_role
-- Nur der erste Fall wird geprueft. scripts/db-test/contracts-insert-lockdown.sql
-- sichert beide Richtungen ab: Z4 (Client wird geblockt, auch wenn das
-- INSERT-Recht zurueckkommt) und Z5 (accept_offer schreibt weiterhin).
--
-- customer_id und provider_id sind bewusst NICHT im INSERT-Zweig: sie
-- identifizieren den Vertrag, statt ihn zu bewerten, und muessen beim Anlegen
-- gesetzt werden. Die RLS-Policy aus 0050 prueft customer_id ohnehin gegen
-- auth.uid().

-- SECURITY INVOKER (kein `security definer` mehr, anders als 0300-0670):
-- In einer security-definer-Funktion ist `current_user` IMMER deren
-- Eigentuemer -- die Unterscheidung "Client oder accept_offer" waere damit
-- unmoeglich, der Zweig haette nie gegriffen. Als invoker laeuft der Trigger
-- im Kontext des Aufrufers: beim Direkt-Insert ist das `authenticated`, beim
-- Aufruf aus accept_offer heraus dessen Eigentuemer.
-- Unbedenklich, weil diese Funktion keine einzige Tabelle liest oder schreibt
-- -- sie vergleicht ausschliesslich NEW/OLD und liest zwei Settings. Sie hatte
-- die erhoehten Rechte also nie gebraucht.
create or replace function guard_contracts_sensitive_cols()
returns trigger language plpgsql as $$
begin
  if current_setting('role', true) = 'service_role' then
    return new;
  end if;

  if TG_OP = 'INSERT' then
    -- KEINE spaltenweise Pruefung, und das ist Absicht.
    --
    -- Ein erster Entwurf verbot hier jede geschuetzte Spalte einzeln. Der
    -- Test zeigte, dass das eine Illusion ist: `status` hat einen
    -- Spalten-Default, ist bei JEDEM Insert also gesetzt, und der Trigger warf
    -- immer dort -- die 24 anderen Pruefungen wurden nie erreicht und liessen
    -- sich einzeln entfernen, ohne dass ein Test rot wurde. Ein Schutz, den
    -- kein Test von seinem Fehlen unterscheiden kann, ist kein Schutz.
    --
    -- Die ehrliche Regel ist ohnehin einfacher: Client-Rollen legen NIE
    -- Vertraege an. Es gibt keinen clientseitigen contracts-Insert im Code,
    -- jeder legitime Vertrag entsteht in accept_offer(). Also wird der ganze
    -- Vorgang abgelehnt statt einzelner Spalten.
    --
    -- current_user unterscheidet sauber (siehe Kopfkommentar zu SECURITY
    -- INVOKER): direkter Client-Insert -> authenticated/anon; aus accept_offer
    -- heraus -> deren Eigentuemer; Edge Function -> service_role.
    if current_user in ('authenticated', 'anon') then
      raise exception
        'Vertraege werden ausschliesslich ueber accept_offer() angelegt, nicht per direktem INSERT (0690)';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    raise exception 'contracts.status is managed by Edge Functions only';
  end if;
  if new.customer_id is distinct from old.customer_id then
    raise exception 'contracts.customer_id cannot be changed';
  end if;
  if new.provider_id is distinct from old.provider_id then
    raise exception 'contracts.provider_id cannot be changed';
  end if;
  if new.price_gross is distinct from old.price_gross then
    raise exception 'contracts.price_gross is managed by Edge Functions only';
  end if;
  if new.customer_total is distinct from old.customer_total then
    raise exception 'contracts.customer_total is managed by Edge Functions only';
  end if;
  if new.provider_payout is distinct from old.provider_payout then
    raise exception 'contracts.provider_payout is managed by Edge Functions only';
  end if;
  if new.werkr_schutz_fee is distinct from old.werkr_schutz_fee then
    raise exception 'contracts.werkr_schutz_fee is managed by Edge Functions only';
  end if;
  if new.customer_service_fee is distinct from old.customer_service_fee then
    raise exception 'contracts.customer_service_fee is managed by Edge Functions only';
  end if;
  if new.provider_commission is distinct from old.provider_commission then
    raise exception 'contracts.provider_commission is managed by Edge Functions only';
  end if;
  if new.stripe_payment_intent is distinct from old.stripe_payment_intent then
    raise exception 'contracts.stripe_payment_intent is managed by Edge Functions only';
  end if;
  if new.escrow_captured_at is distinct from old.escrow_captured_at then
    raise exception 'contracts.escrow_captured_at is managed by Edge Functions only';
  end if;
  if new.escrow_released_at is distinct from old.escrow_released_at then
    raise exception 'contracts.escrow_released_at is managed by Edge Functions only';
  end if;
  if new.completed_at is distinct from old.completed_at then
    raise exception 'contracts.completed_at is managed by Edge Functions only';
  end if;
  if new.cancelled_at is distinct from old.cancelled_at then
    raise exception 'contracts.cancelled_at is managed by the cancel-contract Edge Function only';
  end if;
  if new.cancellation_reason is distinct from old.cancellation_reason then
    raise exception 'contracts.cancellation_reason is managed by the cancel-contract Edge Function only';
  end if;
  if new.customer_refunded_amount is distinct from old.customer_refunded_amount then
    raise exception 'contracts.customer_refunded_amount is managed by the stripe-webhook Edge Function only';
  end if;
  if new.refunded_at is distinct from old.refunded_at then
    raise exception 'contracts.refunded_at is managed by the stripe-webhook Edge Function only';
  end if;
  if new.dispute_state is distinct from old.dispute_state then
    raise exception 'contracts.dispute_state is managed by the stripe-webhook Edge Function only';
  end if;
  if new.provider_clawback_amount is distinct from old.provider_clawback_amount then
    raise exception 'contracts.provider_clawback_amount is managed by Edge Functions only';
  end if;
  if new.stripe_fee_lost is distinct from old.stripe_fee_lost then
    raise exception 'contracts.stripe_fee_lost is managed by the stripe-webhook Edge Function only';
  end if;
  if new.dispute_fee is distinct from old.dispute_fee then
    raise exception 'contracts.dispute_fee is managed by the stripe-webhook Edge Function only';
  end if;
  -- NEU (0640)
  if new.fraud_warning_at is distinct from old.fraud_warning_at then
    raise exception 'contracts.fraud_warning_at is managed by the stripe-webhook Edge Function only';
  end if;
  if new.fraud_warning_action is distinct from old.fraud_warning_action then
    raise exception 'contracts.fraud_warning_action is managed by the stripe-webhook Edge Function only';
  end if;
  if new.dispute_funds_withdrawn is distinct from old.dispute_funds_withdrawn then
    raise exception 'contracts.dispute_funds_withdrawn is managed by the stripe-webhook Edge Function only';
  end if;
  -- NEU (0670)
  if new.dispute_amount_cents is distinct from old.dispute_amount_cents then
    raise exception 'contracts.dispute_amount_cents is managed by the stripe-webhook Edge Function only';
  end if;
  if new.dispute_funds_moved_at is distinct from old.dispute_funds_moved_at then
    raise exception 'contracts.dispute_funds_moved_at is managed by the stripe-webhook Edge Function only';
  end if;
  if new.stripe_dispute_id is distinct from old.stripe_dispute_id then
    raise exception 'contracts.stripe_dispute_id is managed by the stripe-webhook Edge Function only';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_contracts_sensitive_cols on public.contracts;
create trigger trg_guard_contracts_sensitive_cols
  before insert or update on public.contracts
  for each row execute function guard_contracts_sensitive_cols();
