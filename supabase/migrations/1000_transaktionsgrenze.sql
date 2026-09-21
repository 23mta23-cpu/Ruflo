-- 1000: Die Obergrenze je Auftrag, die bisher nur behauptet wurde
--
-- ANLASS (20.09.2026): Beim Durchzaehlen aller Betraege im sichtbaren Text
-- stand auf `app/garantie.tsx` als Tatsache:
--
--   „Im Beta liegt das Transaktionslimit bei 5.000 € pro Auftrag, beim Launch
--    bei 25.000 €."
--
-- Gemessen: es gab KEINE Grenze. Nicht im Client, nicht in einer Edge
-- Function, nicht hier -- `offers` trug allein `check (price > 0)` aus 0040.
-- Ein Angebot ueber 40.000 € waere durchgegangen, und der Treuhandbetrag
-- haette in derselben Hoehe auf dem Konto gelegen.
--
-- Dieselbe Klasse wie die Haftpflicht (14.09.) und die Meisterpflicht
-- (20.09.): eine Zusage ueber eine Schutzvorrichtung, die es nicht gab.
-- Hier kommt hinzu, dass ein unbegrenzter Treuhandbetrag die offene
-- ZAG-Frage spuerbar verschaerft -- je groesser der gehaltene Betrag, desto
-- naeher liegt die Einordnung als erlaubnispflichtiges Zahlungsgeschaeft.
--
-- WARUM `not valid`: die Bedingung gilt ab sofort fuer jedes neue und jedes
-- geaenderte Angebot, aber der vorhandene Bestand wird nicht nachtraeglich
-- ungueltig. Ein Angebot, das unter der alten Lage zustande kam, soll nicht
-- rueckwirkend unverarbeitbar werden -- ein bestehender Vertrag darf nicht
-- daran scheitern, dass Werkant spaeter eine Grenze eingezogen hat.
--
-- DIE ZAHL steht in lib/transaktionsgrenze.ts und hier. Beide haelt
-- scripts/transaktionsgrenze-check.py aneinander.

alter table public.offers drop constraint if exists chk_offers_price_obergrenze;
alter table public.offers
  add constraint chk_offers_price_obergrenze
  check (price <= 5000) not valid;

comment on constraint chk_offers_price_obergrenze on public.offers is
  'Beta-Obergrenze je Auftrag (5000 EUR). Gespiegelt aus '
  'lib/transaktionsgrenze.ts, abgeglichen von '
  'scripts/transaktionsgrenze-check.py. NOT VALID: gilt fuer neue und '
  'geaenderte Zeilen, nicht rueckwirkend fuer den Bestand.';
