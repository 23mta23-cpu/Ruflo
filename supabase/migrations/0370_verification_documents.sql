-- Migration 037: Verifizierungs-Dokumente (Gewerbeschein / Meisterbrief)
--
-- Bisher war der Upload in onboarding-kyc.tsx reine UI-Attrappe: kein Storage,
-- keine Pfade, kein Statusübergang. Diese Migration schafft den Unterbau für
-- den manuellen Review-Workflow (docs/verification/REVIEW_WORKFLOW.md):
--   Anbieter lädt Dokumente hoch → kyc_status 'in_review' → Founder prüft
--   (HWK-Handwerksrolle / Sichtprüfung) → 'approved' oder 'rejected'.
--
-- BEWUSST NICHT hier: Ausweis-Kopien (PAuswG §20-Risiko — Altersnachweis läuft
-- über das Geburtsdatum der Stripe-Connect-KYC, nicht über Dokument-Uploads).

-- ── 1. Neue Spalten ─────────────────────────────────────────────────────────
alter table public.provider_profiles
  add column if not exists gewerbeschein_path  text,
  add column if not exists meisterbrief_path   text,
  add column if not exists kyc_submitted_at    timestamptz,
  add column if not exists kyc_rejected_reason text;

-- kyc_status um 'in_review' erweitern (017 kannte nur pending/approved/rejected)
alter table public.provider_profiles
  drop constraint if exists provider_profiles_kyc_status_check;
alter table public.provider_profiles
  add constraint provider_profiles_kyc_status_check
  check (kyc_status in ('pending','in_review','approved','rejected'));

comment on column public.provider_profiles.gewerbeschein_path is
  'Storage-Pfad in verification-docs (nur Owner + service_role lesbar)';
comment on column public.provider_profiles.meisterbrief_path is
  'Storage-Pfad in verification-docs; Pflicht bei MEISTERPFLICHT_IDS-Gewerken';

-- ── 2. Guard: Owner darf GENAU pending/rejected → in_review ────────────────
-- Alle anderen kyc_status-Übergänge bleiben service_role-exklusiv (ADR-0004-
-- Muster). Ownership ist durch RLS gesichert (Update-Policy: auth.uid() = id);
-- der Guard prüft zusätzlich, dass beim Client-Übergang auch wirklich
-- Dokumente gesetzt sind.
create or replace function guard_provider_profile_sensitive_cols()
returns trigger language plpgsql security definer as $$
begin
  if current_setting('role', true) = 'service_role' then
    return new;
  end if;

  if new.stripe_onboarded is distinct from old.stripe_onboarded then
    raise exception 'stripe_onboarded is managed exclusively by the Stripe webhook (ADR-0004)';
  end if;
  if new.kyc_status is distinct from old.kyc_status then
    if old.kyc_status in ('pending','rejected')
       and new.kyc_status = 'in_review'
       and new.gewerbeschein_path is not null then
      -- zulässiger Owner-Übergang: Einreichung zur Prüfung
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

-- ── 3. Privater Storage-Bucket ──────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'verification-docs', 'verification-docs', false,
  10485760,  -- 10 MB, deckungsgleich mit UI-Copy
  array['image/jpeg','image/png','application/pdf']
)
on conflict (id) do nothing;

-- Owner schreibt nur in den eigenen Ordner ({uid}/...), kein Update/Delete
-- (Audit-Trail: Neueinreichung = neue Datei). Lesen: nur Owner; Review-Team
-- liest über service_role (Supabase Dashboard).
create policy "verification-docs owner insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "verification-docs owner read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
