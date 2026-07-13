-- Migration 0420: Basis-Grants wiederherstellen (nach drop schema public cascade)
--
-- Live-Befund 13.07.: authenticated bekam auf jobs-INSERT "permission denied
-- for table jobs" (42501, Tabellen-Ebene — nicht RLS!), und die verify-email
-- Function scheiterte beim Insert in die neue email_verifications-Tabelle.
-- Ursache: Der DB-Reset (drop schema public cascade) hat die Supabase-
-- Standard-Grants der Client-Rollen mit entsorgt; alle seitdem erstellten
-- Tabellen haben keine Grants für anon/authenticated/service_role.
--
-- Sicherheitsmodell bleibt unverändert: Zugriff wird durch RLS gegatet
-- (default deny; email_verifications hat RLS ohne Policies und bleibt damit
-- trotz Grant für Clients unsichtbar). Grants sind im Supabase-Modell
-- bewusst breit — die Policies entscheiden.

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

-- RPCs: Clients brauchen execute nur als authenticated; anon bleibt außen vor.
-- Gezielte revokes einzelner Funktionen (accept_offer etc.) bleiben wirksam
-- ergänzt um deren eigene auth.uid()/Verifikations-Checks.
grant execute on all functions in schema public to authenticated, service_role;

-- Künftige Objekte (SQL-Editor läuft als postgres) automatisch mitversorgen:
alter default privileges for role postgres in schema public
  grant all on tables to service_role;
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant execute on functions to authenticated, service_role;
