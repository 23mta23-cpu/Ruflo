-- Migration 0440: Bewertungen nur durch echte Vertragsparteien nach Abschluss
--
-- Audit-Befund 14.07.: reviews_insert prüfte nur reviewer_id = auth.uid() —
-- jeder eingeloggte Nutzer konnte beliebige Bewertungen für beliebige
-- Anbieter zu beliebigen contract_ids einfügen (gefälschte 5-Sterne für
-- sich selbst, 1-Sterne für Konkurrenz). Für die Vertrauens-Marke
-- ("Werkant-geprüft", Rating in Suche/Angeboten) ein direkter
-- Reputations-Betrugsvektor.
--
-- Neu: Bewerten darf nur, wer Partei eines ABGESCHLOSSENEN Vertrags ist,
-- und nur die jeweils andere Partei. Rating-Range (1-5) und ein Review
-- pro (Vertrag, Bewerter) erzwingt die Tabelle bereits (0200).

drop policy if exists "reviews_insert" on public.reviews;
create policy "reviews_insert" on public.reviews
  for insert with check (
    auth.uid() = reviewer_id
    and reviewed_id <> auth.uid()
    and exists (
      select 1 from public.contracts c
      where c.id = contract_id
        and c.status = 'completed'
        and (c.customer_id = auth.uid() or c.provider_id = auth.uid())
        and (c.customer_id = reviewed_id or c.provider_id = reviewed_id)
    )
  );
