-- 0540: Sensible Anbieter-Spalten vor unauthentifiziertem Zugriff schützen
--
-- Security-Review-Befund H1: Die Policy „Public can read active providers"
-- (0170) erlaubt anon-SELECT auf provider_profiles, und 0420 erteilt
-- `grant select` an anon/authenticated OHNE Spaltenbeschränkung. RLS filtert
-- Zeilen, nicht Spalten — mit dem im Client-Bundle mitgelieferten anon-Key
-- konnte damit JEDER unauthentifiziert Telefonnummer, Steuer-ID,
-- Gewerbeschein-Pfad und interne Zähler jedes freigeschalteten Anbieters
-- auslesen (DSGVO-sensible PII + Geschäftsinterna).
--
-- Fix (präziser Spalten-Revoke, kein View-Umbau nötig): die sensiblen Spalten
-- aus dem anon-Grant entfernen. Öffentliche Suchfelder (business_name, bio,
-- rating, Kategorien, Verfügbarkeit …) bleiben lesbar. `authenticated` behält
-- vorerst Vollzugriff, damit Eigen-Zeilen-Reads (eigenes Profil/Steuer-ID/
-- Strikes) unverändert funktionieren; service_role ohnehin unberührt.
--
-- Hinweis (dokumentierter Rest, kein Blocker für den anon-Harvest): ein
-- EINGELOGGTER Nutzer kann diese Spalten fremder Anbieter weiterhin lesen —
-- die saubere Vollbehebung ist ein Security-Barrier-View für den öffentlichen
-- Browse + Basistabellen-Policy auf Eigen-Zeile/Vertragspartei. Siehe
-- docs/security/GO-LIVE-SECURITY-CHECKLIST.md.

-- WICHTIG: Ein Spalten-`revoke` greift NICHT, solange ein TABELLEN-weiter
-- `grant select` besteht (0420) — Postgres schneidet keine Spalte aus einem
-- Tabellen-Grant heraus. Daher erst den Tabellen-Grant für anon entziehen,
-- dann NUR die öffentlichen Suchfelder spaltenweise neu granten.
revoke select on public.provider_profiles from anon;
grant select (
  id, business_name, bio, min_hourly_rate, radius_km, category_ids,
  available, kyc_verified, kyc_status, meister_verified, is_nachbarschaft,
  trade_id, rating_avg, rating_count, is_pro,
  rating_avg_handwerker, rating_count_handwerker,
  rating_avg_nachbarschaft, rating_count_nachbarschaft, updated_at
) on public.provider_profiles to anon;
-- Ausgeschlossen (nur authenticated/service_role): phone, steuer_id,
-- gewerbeschein_path, meisterbrief_path, psttg_tax_id, psttg_revenue_eur,
-- psttg_job_count, psttg_frozen, strike_count, bad_review_count,
-- stripe_onboarded, pro_expires_at, kyc_submitted_at, kyc_rejected_reason.
