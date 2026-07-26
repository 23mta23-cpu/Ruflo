-- Guard für email_verified_at präzisieren: INSERT mitschützen, aber nur
-- gegenüber CLIENT-Rollen.
--
-- Zwei Befunde aus dem CTO-Review des Verifikations-Deadlocks (26.07.):
--
-- (1) trg_guard_email_verified (0400) war `before update` — der INSERT-Pfad war
--     ungeschützt. 0020 erlaubt „Users can insert own profile", und die
--     UPDATE-Policy auf profiles hat als Spaltenschutz wörtlich `and true`
--     (0050:52); der Trigger ist also die EINZIGE Schutzschicht für diese
--     Spalte. Ausnutzbar wird die Lücke im 0380-Szenario (verwaiste auth.users
--     ohne Profil + Client-Selbstheilung in lib/auth.ts): dort legt der Client
--     die Zeile selbst an und könnte email_verified_at direkt mitsenden — sich
--     also selbst verifizieren und das Gate umgehen, das Auftrag, Angebot und
--     Vertrag schützt.
--
-- (2) Der alte Guard blockte auch `postgres`. Das klang nach mehr Sicherheit,
--     war aber schädlich: Die Notfall-Entsperrung im Runbook musste den Trigger
--     dafür abschalten — und weil er die einzige Schutzschicht ist, öffnete
--     jedes fehlgeschlagene oder abgebrochene Skript ein stilles Zeitfenster,
--     in dem sich JEDER angemeldete Nutzer per PATCH selbst verifizieren kann.
--     Gegen einen Superuser schützt der Trigger ohnehin nicht (er kann ihn
--     droppen). Der Schutz gegenüber postgres war also Illusion mit
--     Nebenwirkung.
--
-- Neu: Der Guard greift genau für die Rollen, über die Clients hereinkommen
-- ('authenticated', 'anon' — PostgREST setzt sie per SET LOCAL ROLE).
-- service_role (verify-email) und administrative Verbindungen bleiben erlaubt.
-- Damit ist die Notfall-Entsperrung ein einfaches, gezieltes UPDATE — ohne
-- Trigger-Abschaltung und ohne Bypass-Fenster.

create or replace function guard_email_verified_col()
returns trigger language plpgsql security definer as $$
declare
  v_role text := current_setting('role', true);
begin
  -- Nur Client-Rollen werden geprüft.
  if v_role is null or v_role not in ('authenticated', 'anon') then
    return new;
  end if;
  -- INSERT: old ist NULL → jeder mitgesendete Wert ist unzulässig.
  -- UPDATE: nur eine tatsächliche Änderung ist unzulässig.
  if new.email_verified_at is distinct from
     (case when tg_op = 'INSERT' then null else old.email_verified_at end) then
    raise exception 'profiles.email_verified_at is managed by the verify-email Edge Function only';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_email_verified on public.profiles;
create trigger trg_guard_email_verified
  before insert or update on public.profiles
  for each row execute function guard_email_verified_col();
