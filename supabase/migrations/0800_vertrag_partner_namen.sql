-- Der Vertrag nannte seine eigene Gegenseite nicht
--
-- ANLASS (Founder-Screenshot 07.09.2026): Im „Digitalen Vertrag" stand als
-- Auftragnehmer das Wort „Anbieter". Nachgesehen ist das kein Rueckfall,
-- sondern der einzige Weg: WEDER getContractByIdFull NOCH
-- getMyContractsAsCustomerFull laedt den Anbieter ueberhaupt. Ihre selects
-- holen job und (einmal) customer — provider kommt nicht vor.
-- `contract.provider?.business_name ?? 'Anbieter'` konnte also nie etwas
-- anderes ergeben als 'Anbieter'.
--
-- Ein Werkvertrag, der eine Vertragspartei nicht benennt, ist als Dokument
-- wertlos — und genau darauf beruft man sich im Streitfall.
--
-- WARUM EINE FUNKTION UND KEIN JOIN
-- Naheliegend waere, provider_profiles fuer Vertragsparteien lesbar zu machen
-- (wie profiles es in 0030 ist). Das waere ein Datenleck: in der Tabelle
-- stehen `steuer_id` und `stripe_account_id`. Eine Zeilen-Policy gibt immer
-- die GANZE Zeile frei; PostgREST-Spaltenauswahl ist keine Zugriffskontrolle,
-- weil der Aufrufer die Spaltenliste bestimmt.
--
-- Deshalb SECURITY DEFINER mit ausdruecklicher Pruefung und einer Ausgabe,
-- die nur aus Namen besteht. Was hier nicht drinsteht, kann hierueber auch
-- nicht abfliessen.
--
-- Die bestehende Policy auf provider_profiles ("available = true and
-- kyc_status = 'approved'") haette ausserdem nicht gereicht: sie erlischt,
-- sobald ein Anbieter sich inaktiv schaltet. Der Vertrag muss seine Partei
-- aber dauerhaft nennen, gerade dann.
create or replace function public.vertrag_partner(p_contract_ids uuid[])
returns table (
  contract_id   uuid,
  anbieter_name text,
  kunde_name    text
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id,
         nullif(btrim(coalesce(pp.business_name, '')), ''),
         nullif(btrim(coalesce(kp.full_name, '')), '')
    from public.contracts c
    left join public.provider_profiles pp on pp.id = c.provider_id
    left join public.profiles          kp on kp.id = c.customer_id
   where c.id = any(p_contract_ids)
     -- Nur die eigenen Vertraege. Ohne diese Zeile waere die Funktion ein
     -- Verzeichnis aller Namen: man muesste nur Vertrags-IDs raten.
     and (c.customer_id = auth.uid() or c.provider_id = auth.uid());
$$;

comment on function public.vertrag_partner is
  'Namen der beiden Vertragsparteien, ausschliesslich fuer die Parteien selbst. SECURITY DEFINER mit eigener Pruefung, weil provider_profiles steuer_id und stripe_account_id enthaelt und eine Zeilen-Policy immer die ganze Zeile freigaebe. Leere Namen kommen als NULL zurueck, damit der Bildschirm den Unterschied zwischen "kein Name hinterlegt" und "" sieht.';

revoke all on function public.vertrag_partner(uuid[]) from public, anon;
grant execute on function public.vertrag_partner(uuid[]) to authenticated;
