-- 0890: Der sichere Weg soll auch der bequeme sein.
--
-- ANLASS (13.09.2026, Selbst-Check): Die Warteliste hat seit 0360 ein
-- Double-Opt-in — `confirmed_at` wird gesetzt, wenn jemand den Link in der
-- Mail anklickt. Nachgesehen, WER diese Spalte auswertet: **niemand.**
--
-- Es gibt im ganzen Baum keinen Code, der die Warteliste zum Versand liest.
-- Beim Start wuerde sie von Hand aus dem Supabase-Dashboard exportiert — und
-- ein Export der Tabelle enthaelt die unbestaetigten Adressen gleich mit.
--
-- Damit waere das Double-Opt-in eine Maschinerie, die nichts verhindert. Genau
-- die Klasse, die im Projekt schon einmal teuer war: ein Wert, der sich setzen
-- laesst und nicht wirkt (provider_profiles.strike_count). Hier waere die Folge
-- eine Werbemail an Adressen ohne Einwilligung, also § 7 Abs. 2 Nr. 3 UWG.
--
-- Die Loesung ist kein Verbot, sondern eine bequemere richtige Tuer: eine
-- Ansicht, die ausschliesslich bestaetigte Eintraege zeigt. Wer beim Start
-- „die Warteliste" exportiert, greift zu ihr, weil sie so heisst.

create or replace view public.warteliste_versand as
  select id, email, city, plz, source, created_at, confirmed_at
    from public.waitlist
   where confirmed_at is not null;

comment on view public.warteliste_versand is
  'Die Warteliste fuer den Start-Versand: NUR bestaetigte Eintraege (Double-Opt-in aus 0360). Fuer Werbemails ist das die einzige zulaessige Quelle — ein Export der Tabelle public.waitlist enthaelt auch unbestaetigte Adressen, und eine Werbemail an diese waere ein Verstoss gegen § 7 Abs. 2 Nr. 3 UWG.';

comment on column public.waitlist.confirmed_at is
  'Zeitpunkt der Bestaetigung des Double-Opt-in (0360). Fuer den Versand NICHT diese Tabelle verwenden, sondern die Ansicht public.warteliste_versand — sie filtert bereits.';

-- ── Rechte: der `revoke` ist hier das Entscheidende ────────────────────────
--
-- ZWEI Gruende, warum eine neue Ansicht ohne diese Zeile offen staende:
--
-- 1. Eine Ansicht laeuft mit den Rechten ihres EIGENTUEMERS und umgeht damit
--    die RLS der zugrunde liegenden Tabelle. Wer sie lesen darf, sieht alles,
--    was sie zeigt — die Policies von `waitlist` greifen nicht mehr.
--
-- 2. Und lesen duerfte sie zunaechst JEDER: 0420 setzt
--    `alter default privileges for role postgres in schema public
--     grant select, insert, update, delete on tables to anon, authenticated`.
--    Eine Ansicht zaehlt dabei als Tabelle. Jede neue Ansicht in diesem Schema
--    ist also von Haus aus fuer Angemeldete UND fuer anon lesbar, solange
--    niemand ausdruecklich widerruft. Gemessen, nicht vermutet: ohne den
--    `revoke` unten werden WV2 und WV3 rot.
--
-- Wartelisten-Adressen sind fremde Personendaten, und `waitlist` erlaubt
-- absichtlich ein `insert` fuer Nichtangemeldete (offene Anmeldung auf der
-- Startseite). Ein Leserecht darf daraus nicht versehentlich folgen.
revoke all on public.warteliste_versand from public, anon, authenticated;

-- Redundant, und zwar nachgemessen: dieselben Default Privileges aus 0420
-- geben service_role ohnehin `all on tables`. Die Zeile bleibt trotzdem
-- stehen, weil sie die ABSICHT festhaelt — wer 0420 spaeter enger fasst, soll
-- diese Ansicht nicht stillschweigend unbrauchbar machen.
grant select on public.warteliste_versand to service_role;
