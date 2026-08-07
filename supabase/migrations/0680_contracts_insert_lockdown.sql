-- Migration 0680: Direkter contracts-INSERT wird Client-Rollen entzogen
--
-- BEFUND (P0, verifiziert gegen einen frischen Migrations-Replay):
-- `trg_guard_contracts_sensitive_cols` (0300) ist als `before update`
-- registriert. Bei einem INSERT feuert er nicht. Die einzige INSERT-Schranke
-- war damit die RLS-Policy "Customer creates own contracts" (0050) -- und die
-- prueft ausschliesslich `auth.uid() = customer_id` sowie die Eigentuemerschaft
-- am Job. Ueber die Spaltenwerte sagt sie nichts.
--
-- Ein angemeldeter Kunde konnte deshalb per REST-API eine Vertragszeile mit
-- frei gewaehltem `provider_payout`, gesetztem `escrow_captured_at`,
-- erfundenem `stripe_payment_intent` und `status='active'` anlegen. Also einen
-- bezahlten Auftrag behaupten, ohne je bezahlt zu haben.
--
-- Das ist deshalb ein Geldrisiko und nicht bloss ein Datenintegritaetsproblem:
-- `release-escrow` prueft den PaymentIntent NICHT gegen Stripe. Es liest
-- `status`, `escrow_captured_at` und `provider_payout` aus der Zeile und legt
-- auf dieser Grundlage einen Stripe-Transfer vom Plattform-Saldo auf das
-- Connect-Konto des Anbieters. Der erfundene Betrag waere echtes Geld
-- geworden: Geld raus, ohne dass je Geld reinkam.
--
-- FIX: `authenticated` und `anon` das INSERT-Recht auf `contracts` entziehen.
-- Das ist die kleinstmoegliche Aenderung, die den Pfad vollstaendig schliesst,
-- und sie kostet keine Funktionalitaet:
--   * Es existiert kein einziger clientseitiger contracts-Insert
--     (`grep -rn "from('contracts')" app/ lib/ components/` -> kein insert).
--   * Jeder legitime Vertrag entsteht in `accept_offer()` (0060/0390/0400/0530).
--     Die Funktion ist `security definer`, laeuft also unter ihrem Eigentuemer
--     und ist vom Entzug nicht betroffen. Test Z2 in
--     scripts/db-test/contracts-insert-lockdown.sql sichert genau das ab --
--     ein Fix, der den Annahme-Weg mitnimmt, waere kein Fix.
--   * Die Edge Functions arbeiten mit dem service_role-Key und haengen nicht
--     an den Rechten der Client-Rollen.
--
-- Die INSERT-Policy aus 0050 bleibt absichtlich stehen: Rechte-Entzug und
-- RLS sind zwei unabhaengige Schichten, und eine spaetere Migration, die
-- Tabellenrechte pauschal neu vergibt (wie 0420 es tat), laeuft sonst gegen
-- eine Tabelle ganz ohne INSERT-Schranke.

revoke insert on public.contracts from authenticated;
revoke insert on public.contracts from anon;

-- 0420 hat Tabellenrechte schon einmal pauschal ueber `grant ... on all tables`
-- neu verteilt. Damit ein solcher Sammel-Grant diesen Entzug nicht lautlos
-- zurueckdreht, ist die Absicht hier als Kommentar an der Tabelle hinterlegt.
comment on table public.contracts is
  'Vertraege. INSERT ist Client-Rollen bewusst entzogen (0680): Vertraege entstehen ausschliesslich in accept_offer() (security definer). Ein pauschaler "grant insert on all tables" wuerde eine P0-Luecke wieder oeffnen -- siehe scripts/db-test/contracts-insert-lockdown.sql.';
