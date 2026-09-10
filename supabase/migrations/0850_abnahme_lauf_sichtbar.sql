-- Ein ausgefallener naechtlicher Lauf soll auffallen, bevor sich jemand
-- beschwert.
--
-- ANLASS: docs/betrieb/abnahmefrist-lauf.md benennt die Luecke selbst:
--
--   "Was NICHT nach einem Fehler aussieht, aber einer ist: status_code = 401
--    heisst, das Gateway hat abgewiesen ... Beides bleibt sonst unbemerkt,
--    weil der Auftrag selbst 'erfolgreich' gelaufen ist."
--
-- Genau die Fehlerklasse, an der dieses Projekt schon mehrfach haengen
-- geblieben ist: eine Pruefung meldet gruen, ohne den Fehler sehen zu koennen.
-- Ohne diesen Lauf wird kein Escrow automatisch freigegeben. Das Geld bleibt
-- liegen, der Betrieb wartet, und niemand merkt es.
--
-- Gemessen wird deshalb NICHT, ob pg_cron "gelaufen" ist, sondern das
-- SYMPTOM: liegen faellige Vertraege laenger herum, als ein taeglicher Lauf
-- zulassen wuerde? Das faengt auch die Faelle ab, in denen der Auftrag
-- pflichtschuldig laeuft und das Gateway ihn jedes Mal abweist.

create or replace function public.abnahme_lauf_status()
returns table (
  zeitplan_vorhanden        boolean,
  letzter_lauf_am           timestamptz,
  letzter_lauf_erfolgreich  boolean,
  faellige_vertraege        integer,
  aeltester_faelliger_tage  integer,
  stau                      boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hat_cron boolean;
  v_jobid    bigint;
begin
  -- pg_cron gibt es in der Sandbox nicht, und auf einer frischen Instanz auch
  -- nicht, bevor jemand die Erweiterung anlegt. Ein `select ... from cron.job`
  -- waere dort ein harter Fehler; to_regclass fragt, ohne zu scheitern.
  v_hat_cron := to_regclass('cron.job') is not null;

  zeitplan_vorhanden       := false;
  letzter_lauf_am          := null;
  letzter_lauf_erfolgreich := false;

  if v_hat_cron then
    execute $q$
      select jobid from cron.job where jobname = 'abnahmefrist-taeglich' limit 1
    $q$ into v_jobid;
    zeitplan_vorhanden := v_jobid is not null;

    if v_jobid is not null and to_regclass('cron.job_run_details') is not null then
      execute $q$
        select start_time, status = 'succeeded'
          from cron.job_run_details
         where jobid = $1
         order by start_time desc
         limit 1
      $q$ into letzter_lauf_am, letzter_lauf_erfolgreich using v_jobid;
    end if;
  end if;

  select count(*)::integer,
         coalesce(max(extract(day from now() - c.abnahme_faellig_am))::integer, 0)
    into faellige_vertraege, aeltester_faelliger_tage
    from public.contracts c
   where c.status = 'active'
     and c.escrow_released_at is null
     and c.abnahme_faellig_am is not null
     and c.abnahme_faellig_am <= now();

  -- Zwei Tage Toleranz: der Lauf ist taeglich, ein einzelner Ausfall ist
  -- ausdruecklich unkritisch (die Vertraege bleiben faellig). Erst wenn
  -- mehrere Laeufe hintereinander nichts bewirkt haben, ist etwas kaputt.
  stau := faellige_vertraege > 0 and aeltester_faelliger_tage >= 2;

  return next;
end;
$$;

comment on function public.abnahme_lauf_status() is
  'Betriebs-Selbstauskunft zum naechtlichen Abnahmefrist-Lauf. Misst das Symptom (liegen faellige Vertraege zu lange?), nicht nur ob pg_cron gelaufen ist: ein Auftrag, den das Gateway jedes Mal mit 401 abweist, laeuft erfolgreich und bewirkt nichts.';

-- Nur der Betrieb, nicht der Nutzer. 0820 entzieht das Ausfuehrungsrecht per
-- Voreinstellung; hier wird es ausdruecklich NUR service_role gegeben.
revoke execute on function public.abnahme_lauf_status() from public, anon, authenticated;
grant execute on function public.abnahme_lauf_status() to service_role;
