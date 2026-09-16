-- 0920: Wie viele Betriebe wurden ueber diesen Auftrag benachrichtigt?
--
-- ANLASS. `docs/markt/wettbewerbsabgleich-2026-09.md`, Luecke 2: "Der leere
-- Zustand ist der Normalzustand, und er verspricht heute nichts, was man
-- halten koennte." In `app/auftrag-detail.tsx` stand:
--
--     "Anbieter koennen jetzt Angebote einreichen.
--      Sie werden benachrichtigt, sobald eines eingegangen ist."
--
-- Kein Zeitraum, keine Zahl, keine Handlung. In den ersten Monaten ist das
-- der Normalfall, und Schweigen liest sich wie ein leerer Marktplatz.
--
-- Die naheliegende Loesung waere eine Zusage gewesen ("wir melden uns nach
-- 48 Stunden"). Die faellt aus: am 15.09.2026 wurden genau solche Fristen aus
-- dem Produkt entfernt, weil niemand sie halten kann, und
-- `scripts/versprechen-check.py` wird seitdem rot dabei. Eine Zusage ohne
-- Mechanismus ist eine Luege mit Verzoegerung.
--
-- Stattdessen eine TATSACHE, die der Kunde heute nicht sieht, obwohl sie
-- existiert: `notify-matching-providers` weiss, wie viele Betriebe es in
-- seinem Postleitzahlenbereich mit passendem Gewerk gibt. Die Funktion gibt
-- die Zahl bisher nur an den Aufrufer zurueck und wirft sie danach weg.
--
-- Der Fall, auf den es ankommt, ist `0`: dann wartet der Kunde auf etwas, das
-- nicht kommen kann, und erfaehrt es erst nach Tagen. Mit der Zahl erfaehrt
-- er es sofort und kann etwas tun (Gewerk weiter fassen, Nachbarschaftshilfe,
-- oder zumindest nicht weiter warten).
--
-- NULL heisst "die Benachrichtigung ist noch nicht gelaufen" und ist nicht
-- dasselbe wie 0. Die Anzeige muss beides unterscheiden, sonst behauptet sie
-- gleich wieder etwas, das sie nicht weiss.

alter table public.jobs
  add column if not exists benachrichtigte_betriebe integer,
  add column if not exists benachrichtigt_am timestamptz;

comment on column public.jobs.benachrichtigte_betriebe is
  'Anzahl der Betriebe, die notify-matching-providers ueber diesen Auftrag '
  'benachrichtigt hat (Gewerk + zweistelliger PLZ-Bereich). NULL = noch nicht '
  'gelaufen, 0 = gelaufen und niemand passte. Nur vom service_role beschreibbar.';

comment on column public.jobs.benachrichtigt_am is
  'Wann die Benachrichtigung lief. Ohne den Zeitpunkt laesst sich nicht sagen, '
  'ob eine 0 frisch ist oder von vor drei Wochen.';

-- Schreiben darf nur der service_role (die Edge Function). Ein Kunde, der die
-- Zahl selbst setzen koennte, koennte sich eine Nachfrage ersparen; ein
-- Anbieter koennte sie faelschen. Lesen darf, wer den Auftrag ohnehin sieht --
-- dafuer genuegen die bestehenden jobs-Policies, die Spalte kommt mit.
--
-- Spaltenrechte wirken NUR, wenn zugleich das Tabellenrecht entzogen wird:
-- ein pauschales `grant update on jobs` ueberschreibt jede spaltengenaue
-- Vergabe. Deshalb erst entziehen, dann Spalte fuer Spalte zurueckgeben.
do $$
declare
  spalte text;
begin
  revoke update on public.jobs from authenticated;
  for spalte in
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'jobs'
      and column_name not in ('benachrichtigte_betriebe', 'benachrichtigt_am')
  loop
    execute format('grant update (%I) on public.jobs to authenticated', spalte);
  end loop;
end $$;

grant update on public.jobs to service_role;
