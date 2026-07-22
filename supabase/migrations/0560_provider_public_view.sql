-- 0560: Anbieter-Sichtbarkeit final härten (Security-Befund H1-voll)
--
-- 0540 schloss nur den unauthentifizierten anon-Harvest. Ein EINGELOGGTER
-- Nutzer konnte sensible Spalten fremder Anbieter weiterhin lesen (Basistabelle
-- hatte die Policy „Public can read active providers" für alle freigeschalteten
-- Zeilen; anbieter.tsx las sogar select('*')).
--
-- Lösung: eine Security-Definer-VIEW mit ausschließlich öffentlichen Feldern
-- (+ booleschen has_*-Flags statt der sensiblen Werte) für Browse/Detail; die
-- Basistabelle wird auf Eigen-Zeile beschränkt (Policy „Providers read own
-- profile" aus 0010 bleibt). Sensible Spalten (phone, steuer_id, psttg_*,
-- gewerbeschein/meisterbrief-Pfade, Strikes) sind damit für Fremde — auch
-- eingeloggt — nicht mehr lesbar; nur der Anbieter selbst (Eigen-Zeile) und
-- service_role sehen sie.

create or replace view public.provider_public
with (security_invoker = false) as   -- definer: liest Basistabelle als Owner (bypass RLS), nur sichere Spalten
select
  pp.id,
  pp.business_name,
  pp.bio,
  pp.category_ids,
  pp.trade_id,
  pp.radius_km,
  pp.min_hourly_rate,
  pp.available,
  pp.is_nachbarschaft,
  pp.is_pro,
  pp.kyc_status,
  pp.kyc_verified,
  pp.meister_verified,
  pp.stripe_onboarded,
  pp.rating_avg,
  pp.rating_count,
  pp.rating_avg_handwerker,
  pp.rating_count_handwerker,
  pp.rating_avg_nachbarschaft,
  pp.rating_count_nachbarschaft,
  pp.updated_at,
  p.created_at,          -- provider_profiles hat kein created_at; „Mitglied seit" aus profiles
  p.display_name,
  (pp.steuer_id is not null)         as has_steuer_id,
  (pp.meisterbrief_path is not null) as has_meisterbrief,
  (pp.gewerbeschein_path is not null) as has_gewerbeschein
from public.provider_profiles pp
join public.profiles p on p.id = pp.id
-- Nur freigeschaltete Anbieter sind öffentlich sichtbar (wie die frühere
-- Policy) — verhindert Enumeration von pending/rejected Betrieben.
where pp.kyc_status = 'approved';

grant select on public.provider_public to anon, authenticated;

-- Basistabelle: öffentlichen Fremd-Zugriff entfernen. Es bleibt nur die
-- Eigen-Zeilen-Policy „Providers read own profile" (0010). Browse/Detail läuft
-- ab jetzt ausschließlich über provider_public.
drop policy if exists "Public can read active providers" on public.provider_profiles;

-- anon liest die Basistabelle gar nicht mehr (der Spalten-Grant aus 0540 wird
-- obsolet) — Discovery kommt aus der View.
revoke select on public.provider_profiles from anon;
