-- Migration 0450: INSERT-Guard für provider_profiles (Pentest-Befund 15.07.)
--
-- KRITISCH (Reputations-/Auszahlungs-Betrug): Der Schutz-Trigger
-- guard_provider_profile_sensitive_cols (0330) läuft nur BEFORE UPDATE.
-- Die INSERT-Policy (0020) prüft nur auth.uid() = id — NICHT die Werte.
-- Ein beliebiger eingeloggter Nutzer konnte daher per direktem REST-INSERT
-- eine eigene Anbieter-Zeile mit kyc_status='approved', stripe_onboarded=true,
-- meister_verified=true anlegen und erschien SOFORT als „Werkant-geprüft"
-- in der öffentlichen Suche (verifiziert: anonym sichtbar) — ohne KYC, ohne
-- Ausweis, ohne Stripe-Onboarding. Auszahlungen an einen so gefälschten
-- Account wären der direkte Schaden.
--
-- Fix: Ein BEFORE INSERT-Trigger erzwingt für Nicht-service_role sichere
-- Startwerte. Der legitime Pfad (lib/auth.ts: insert({ id })) nutzt ohnehin
-- nur Defaults und bleibt unberührt. Freischaltung passiert weiterhin
-- ausschließlich über KYC-Review / Stripe-Webhook (service_role).

create or replace function guard_provider_profile_insert()
returns trigger language plpgsql security definer as $$
begin
  if current_setting('role', true) = 'service_role' then
    return new;
  end if;
  -- Privilegierte Felder auf sichere Defaults zwingen — egal was der Client sendet.
  new.kyc_status      := 'pending';
  new.stripe_onboarded := false;
  new.meister_verified := false;
  if new.available is null then
    new.available := true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_provider_profile_insert on public.provider_profiles;
create trigger trg_guard_provider_profile_insert
  before insert on public.provider_profiles
  for each row execute function guard_provider_profile_insert();

-- Bereinigung: etwaige selbst-approbierte Zeilen (die nie einen KYC-Review
-- durchlaufen haben) auf 'pending' zurücksetzen. Trifft nur Accounts, deren
-- kyc_status approved ist, obwohl kein Verifikationsdokument vorliegt.
-- Der UPDATE-Guard (0050) blockt kyc_status-Aenderungen fuer Nicht-service_role;
-- im SQL-Editor/Migrations-Runner laeuft dies aber als postgres. Deshalb den
-- Guard-Trigger fuer genau diese einmalige Bereinigung kurz deaktivieren.
alter table public.provider_profiles disable trigger trg_guard_provider_profile_sensitive_cols;
update public.provider_profiles p
  set kyc_status = 'pending', stripe_onboarded = false, meister_verified = false
  where p.kyc_status = 'approved'
    and p.gewerbeschein_path is null
    and p.meisterbrief_path is null
    and p.kyc_submitted_at is null;
alter table public.provider_profiles enable trigger trg_guard_provider_profile_sensitive_cols;
