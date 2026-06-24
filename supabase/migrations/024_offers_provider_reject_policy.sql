-- WERKR Migration 024 — offers: allow provider to reject their own pending offer
--
-- Previously the offers table had SELECT and INSERT policies only.
-- A provider tapping "Ablehnen" on the dashboard ran an UPDATE that silently
-- returned 0 rows (no UPDATE policy → RLS blocks it, no error raised).
-- On the next pull-to-refresh the offer reappeared because the DB was unchanged.
--
-- Policy: provider can flip status pending → rejected for their own offer only.
-- USING  — row must belong to this provider and currently be pending.
-- WITH CHECK — resulting row must also belong to this provider with status rejected.
-- Providers cannot change any other field through this policy path.

create policy "Provider rejects own pending offer"
  on public.offers for update
  using (
    provider_id = auth.uid()
    and status = 'pending'
  )
  with check (
    provider_id = auth.uid()
    and status = 'rejected'
  );
