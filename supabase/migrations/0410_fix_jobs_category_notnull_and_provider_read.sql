-- Migration 0410: zwei weitere Launch-Blocker im Auftrags-Flow
--
-- (1) jobs.category_id ist NOT NULL ohne Default (0010), aber der Client
--     (lib/jobs.ts) schreibt seit 0180 nur noch `category` — JEDER
--     "Auftrag aufgeben"-Insert scheiterte live an der NOT-NULL-Violation.
--     Fix: Constraint fallen lassen; `category` ist die aktive Spalte,
--     category_id bleibt als Legacy-Spalte lesbar.
-- (2) Anbieter hatten NIE eine SELECT-Policy auf jobs ("Parties read own
--     jobs" ist die einzige) — offene Aufträge waren für Anbieter
--     unsichtbar, und die offers-INSERT-Policy (Subquery auf jobs) konnte
--     nie erfüllt werden: Angebot abgeben war strukturell unmöglich.
--     Fix: registrierte, E-Mail-verifizierte Anbieter dürfen offene/
--     gematchte Aufträge lesen (auth_email_confirmed() aus 0400).

alter table public.jobs alter column category_id drop not null;

drop policy if exists "Providers browse open jobs" on public.jobs;
create policy "Providers browse open jobs"
  on public.jobs for select
  using (
    status in ('open', 'matched')
    and auth_email_confirmed()
    and exists (select 1 from public.provider_profiles pp where pp.id = auth.uid())
  );
