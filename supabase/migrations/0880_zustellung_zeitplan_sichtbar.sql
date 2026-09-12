-- 0880: Ein fehlender Zustell-Zeitplan faellt jetzt auf, BEVOR er weh tut.
--
-- ANLASS (12.09.2026, Selbst-Check): 0850 prueft beim naechtlichen
-- Abnahmefrist-Lauf ZWEIERLEI — ob der Zeitplan ueberhaupt existiert, und ob
-- sich das Symptom staut. Fuer den stuendlichen Zustell-Lauf (0860) gab es nur
-- das Symptom.
--
-- Das ist nicht dieselbe Absicherung. `zustellung_stau` schlaegt erst an, wenn
-- eine Pflichtmitteilung existiert UND 24 Stunden alt ist. Passiert wochenlang
-- kein Strike, bleibt ein nie eingerichteter Zeitplan unsichtbar — und der
-- erste echte Fall laeuft dann in eine Frist, die Werkant schuldet
-- (DSA Art. 17, AGB §7(4) i.V.m. Art. 4 P2B-VO). Ein Ausfall, den man erst am
-- Schaden bemerkt, ist nicht ueberwacht.
--
-- Genau wie in 0850: to_regclass fragt nach pg_cron, ohne zu scheitern. In der
-- Sandbox und auf einer frischen Instanz gibt es die Erweiterung nicht, und
-- ein `select ... from cron.job` waere dort ein harter Fehler.

-- Der Rueckgabetyp aendert sich (neue Spalte), deshalb erst weg damit.
drop function if exists public.zustellung_status();

create or replace function public.zustellung_status()
returns table (
  offene_pflichtmitteilungen integer,
  aelteste_offene_stunden    integer,
  stau                       boolean,
  zeitplan_vorhanden         boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_jobid bigint;
begin
  zeitplan_vorhanden := false;
  if to_regclass('cron.job') is not null then
    execute $q$
      select jobid from cron.job where jobname = 'zustellung-stuendlich' limit 1
    $q$ into v_jobid;
    zeitplan_vorhanden := v_jobid is not null;
  end if;

  select
    count(*)::integer,
    coalesce(max(extract(epoch from now() - n.erstellt_am) / 3600)::integer, 0),
    -- 24 Stunden: eine Pflichtmitteilung, die laenger als einen Tag
    -- unzugestellt liegt, ist ein Rechtsproblem. Kuerzer waere Rauschen,
    -- laenger waere Nachsicht mit sich selbst.
    count(*) > 0 and coalesce(max(extract(epoch from now() - n.erstellt_am) / 3600), 0) >= 24
    into offene_pflichtmitteilungen, aelteste_offene_stunden, stau
    from public.notifications n
   where n.pflicht and n.zugestellt_am is null;

  return next;
end;
$$;

-- Rechte neu setzen: der drop oben hat sie mitgenommen. Und das Recht kommt
-- ueber PUBLIC, nicht ueber die Rolle — ein Widerruf gegen `authenticated`
-- allein wirkt nicht (siehe 0820).
revoke execute on function public.zustellung_status() from public, anon, authenticated;
grant execute on function public.zustellung_status() to service_role;

comment on function public.zustellung_status() is
  'Betriebs-Selbstauskunft zum stuendlichen Zustell-Lauf. Meldet BEIDES: ob der pg_cron-Zeitplan "zustellung-stuendlich" existiert, und ob Pflichtmitteilungen (Strike, DSA-Beschraenkung) unzugestellt herumliegen. Der Stau allein genuegt nicht — er wird erst sichtbar, wenn schon ein Fall offen ist.';
