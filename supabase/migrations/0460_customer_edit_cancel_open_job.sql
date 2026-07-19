-- Kunde kann eigenen offenen Auftrag bearbeiten und stornieren (BUG 12, 19.07.).
-- Bisher gab es keinerlei UPDATE-Policy auf jobs für Kunden — Bearbeiten/
-- Stornieren vor Angebots-Annahme war damit unmöglich. Nur solange
-- status='open': sobald ein Vertrag existiert, läuft Stornierung über
-- cancel-contract (Gebührenlogik).
alter table public.jobs add column if not exists cancel_reason text;

drop policy if exists "Customer edits own open job" on public.jobs;
create policy "Customer edits own open job" on public.jobs
  for update
  using (auth.uid() = customer_id and status = 'open')
  with check (auth.uid() = customer_id and status in ('open','cancelled'));
