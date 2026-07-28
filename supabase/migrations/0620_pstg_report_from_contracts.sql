-- Migration 0620: DAC7-Meldung aus den Vertraegen ableiten, nicht aus dem Zaehler
--
-- BEFUND (Director-Software-Architect-Agent, gegen echtes Postgres nachgestellt):
-- pstg-annual-report waehlt die zu meldenden Anbieter ueber profiles.pstg_year,
-- pstg_tx_count und pstg_revenue aus. Diese drei Spalten sind ein LAUFENDER
-- Zaehler, den pstg_record_transaction (0610) bei der ersten Auszahlung des
-- neuen Jahres zurueckstellt. Damit gilt:
--
--   Anbieter mit 35 Transaktionen / 4200 EUR fuer 2026 -> Meldeabfrage findet ihn.
--   EINE Auszahlung am 2. Januar 2027 -> pstg_year = 2027, Zaehler = 1.
--   Meldeabfrage fuer 2026 (.eq('pstg_year', 2026)) -> findet ihn NICHT MEHR.
--
-- Der Bericht ist also nur korrekt, wenn er laeuft, BEVOR im neuen Jahr die
-- erste Auszahlung stattfindet. Faellt der Lauf am 1.1. aus und wird am 5.1.
-- nachgeholt, fehlen genau die aktivsten Anbieter. Die Meldepflicht trifft die
-- Plattform (§ 13 PStTG), das Bussgeld ebenfalls (§ 25).
--
-- LOESUNG: Die Meldung kommt aus `contracts`. Dort steht sie unveraenderlich —
-- provider_payout wird bei Vertragsschluss gesetzt und danach vom
-- 0300-Guard geschuetzt, escrow_released_at setzt ausschliesslich
-- release-escrow. Kein laufender Zaehler, kein Jahreswechsel, keine
-- Reihenfolge-Abhaengigkeit: die Zahlen fuer 2026 sind auch 2028 noch dieselben.
--
-- profiles.pstg_* bleibt, was es faktisch ist: der Live-Stand fuer die Anzeige
-- beim Anbieter und fuer die Sperre bei Erreichen der Schwelle. Nur die MELDUNG
-- haengt nicht mehr daran.
--
-- Bemessungsgrundlage ist provider_payout (Verguetung nach Abzug der
-- einbehaltenen Gebuehren) — so definiert § 3 Abs. 5 PStTG. Stichtag ist
-- escrow_released_at, also der Zeitpunkt, zu dem das Geld tatsaechlich an den
-- Anbieter ging, nicht der Vertragsschluss.

-- Die Schwelle gehoert IN die Funktion, nicht erst hinter den Aufruf.
-- Sonst liefert sie eine Zeile pro Anbieter mit irgendeiner Auszahlung im Jahr,
-- und PostgREST kappt die Antwort bei `max_rows = 1000` (supabase/config.toml)
-- STILL ab — bei mehr als 1000 auszahlungsaktiven Anbietern fehlen die
-- abgeschnittenen in der Meldung. Das waere exakt die Ausfallklasse, die diese
-- Migration beseitigt, nur eine Groessenordnung spaeter.
--
-- Als Parameter, nicht einbetoniert: die Schwelle steht bereits an drei Stellen
-- (lib/pstTgThresholds.ts, 0610, pstg-annual-report). Eine vierte Kopie waere
-- die naechste Divergenz. Der Aufrufer uebergibt sie; die Defaults hier sind
-- nur das Sicherheitsnetz, falls jemand ohne Argumente aufruft.
--
-- Offen und bewusst nicht hier entschieden: § 4 Abs. 5 Nr. 4 PStTG ist fuer
-- Warenverkaeufer geschrieben. Fuer persoenliche Dienstleistungen (§ 5 Abs. 1
-- Nr. 2) gibt es diese Bagatellgrenze so moeglicherweise nicht — dann waere
-- JEDER Anbieter mit Auszahlung zu melden. Steuerberater-Frage. Weil die
-- Schwelle ein Parameter ist, ist die Antwort eine Zeile und kein Umbau.
drop function if exists pstg_year_totals(integer);

create or replace function pstg_year_totals(
  p_year        integer,
  p_min_tx      integer default 30,
  p_min_revenue numeric default 2000
)
returns table (
  provider_id uuid,
  tx_count    integer,
  revenue     numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select c.provider_id,
         count(*)::integer                            as tx_count,
         round(coalesce(sum(c.provider_payout), 0), 2) as revenue
    from public.contracts c
   where c.status = 'completed'
     and c.escrow_released_at is not null
     and extract(year from (c.escrow_released_at at time zone 'Europe/Berlin')) = p_year
   group by c.provider_id
  having count(*) >= p_min_tx
      or coalesce(sum(c.provider_payout), 0) >= p_min_revenue;
$$;

comment on function pstg_year_totals(integer, integer, numeric) is
  'Meldegrundlage nach PStTG/DAC7 fuer ein Kalenderjahr, abgeleitet aus den '
  'abgeschlossenen Vertraegen (unveraenderlich) statt aus dem laufenden Zaehler '
  'in profiles. Bemessungsgrundlage provider_payout (§ 3 Abs. 5 PStTG), Stichtag '
  'escrow_released_at in Europe/Berlin.';

revoke all on function pstg_year_totals(integer, integer, numeric) from public, anon, authenticated;
grant execute on function pstg_year_totals(integer, integer, numeric) to service_role;
