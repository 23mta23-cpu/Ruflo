-- 1020: Wunschanbieter am Auftrag (Befund 22.09.2026)
--
-- BEFUND: `app/anbieter.tsx` hat unter jedem Anbieterprofil einen Knopf
-- „Unverbindliche Anfrage stellen". Er uebergab seit jeher
-- `params: { providerId: id }` an den Auftrags-Trichter -- und
-- `app/auftrag-aufgeben.tsx` liest diesen Parameter NIRGENDS. Gemessen ueber
-- alle 55 Navigationen mit Parameter-Objekt: genau diese eine war betroffen.
--
-- Wirkung bis heute: Wer sich ein Profil ansieht, den Knopf drueckt und einen
-- Auftrag aufgibt, schreibt eine Ausschreibung an ALLE passenden Betriebe im
-- Postleitzahlenbereich. Der Betrieb, den der Kunde gerade ausgesucht hat,
-- erfaehrt davon nur zufaellig -- naemlich dann, wenn er ohnehin zum Gewerk
-- und zur Region passt und verfuegbar ist. Dieselbe Klasse wie „ein Eingang
-- ohne Wirkung ist ein Knopf ohne onPress" (16.09.).
--
-- Die Spalte ist ein WUNSCH, keine Zuweisung. `jobs.provider_id` bleibt
-- unberuehrt: das ist weiterhin der Anbieter, der den Zuschlag bekommen hat
-- (gesetzt in accept_offer). Ein Wunsch bindet niemanden -- der Betrieb kann
-- schweigen, andere Betriebe duerfen weiter bieten.
--
-- Fremdschluessel auf provider_profiles, nicht auf profiles: was hier steht,
-- muss ein Anbieter sein. Ein Kunde kann sonst eine beliebige Nutzerkennung
-- eintragen. `on delete set null`, damit ein geloeschtes Anbieterprofil den
-- Auftrag nicht mitnimmt.
alter table public.jobs
  add column if not exists requested_provider_id uuid
    references public.provider_profiles(id) on delete set null;

comment on column public.jobs.requested_provider_id is
  'Wunschanbieter aus dem Profil-Einstieg. Keine Zuweisung -- provider_id bleibt der Anbieter mit Zuschlag.';

create index if not exists idx_jobs_requested_provider
  on public.jobs(requested_provider_id)
  where requested_provider_id is not null;

-- RLS: keine neue Policy noetig, und das ist eine Aussage, keine Auslassung.
--   * Lesen: der Kunde liest seinen Auftrag ohnehin (0010 „Parties read own
--     jobs"), verifizierte Anbieter lesen offene Auftraege ohnehin (0470
--     „Providers browse open jobs"). Die Spalte faellt darunter.
--   * Schreiben: der Kunde legt seinen Auftrag an (0010). Der Fremdschluessel
--     begrenzt, WAS er eintragen kann; WEN er sich wuenscht, ist seine Sache.
--   * Aendern: es gibt keinen Weg in der App, den Wunsch nachtraeglich zu
--     setzen, und es soll auch keinen geben -- der Wunsch gehoert zum
--     Einstieg, nicht zur Verhandlung.

-- Der Wunsch gehoert zum EINSTIEG, nicht zur Verhandlung. Beschrieben wird er
-- beim Anlegen (INSERT); nachtraeglich aendern darf ihn niemand ueber den
-- Client. Sonst steht auf der Karte eines Betriebs „Direkt an Sie gerichtet",
-- obwohl der Kunde ihn nie ausgesucht hat -- ein Etikett ohne Gegenstand.
--
-- Dasselbe Muster wie bei den Zaehlspalten aus 0920. Die Zusicherung RH in
-- scripts/db-test/rechte.sql fragt JEDE jobs-Spalte ab und wurde beim ersten
-- Replay dieser Migration prompt rot -- genau wofuer sie gebaut wurde.
revoke update (requested_provider_id) on public.jobs from authenticated;
