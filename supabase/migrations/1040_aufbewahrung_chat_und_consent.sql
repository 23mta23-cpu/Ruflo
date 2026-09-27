-- Aufbewahrungsfristen aus der Datenschutzerklaerung, jetzt auch im Code.
--
-- ANLASS (27.09.2026). `app/datenschutz.tsx` nennt fuenf Fristen. Gemessen,
-- wer sie einhaelt:
--
--   Konto-/Profildaten  bis Kontoloeschung   -> delete-account
--   Transaktionsdaten   10 Jahre             -> aufbewahrt (HGB/AO), s. u.
--   IP-Adressen (Logs)  7 Tage               -> 0730, in check_rate_limit
--   Chat-Nachrichten    6 Monate             -> NICHTS
--   Consent-Log         3 Jahre              -> NICHTS
--
-- Die letzten beiden waren eine Zusage ohne jeden Mechanismus. Heute faellt
-- das nicht auf, weil die Plattform juenger als sechs Monate ist -- genau
-- deshalb wird es still falsch, sobald sie es nicht mehr ist
-- (Art. 5 Abs. 1 lit. e DSGVO, und eine unwahre Angabe in der
-- Datenschutzerklaerung).
--
-- BEWUSST OHNE SCHEDULER, wie 0730: pg_cron ist in dieser Instanz nicht
-- eingerichtet. Stattdessen eine Selbstauskunft, die im Pruef-Postfach sagt,
-- wie viele Zeilen ueberfaellig sind -- eine Frist, die niemand sieht, ist
-- dieselbe Klasse wie eine, die niemand anwendet.
--
-- WARUM 10 JAHRE HIER NICHT VORKOMMEN: Transaktionsdaten sind aufzubewahren,
-- nicht zu loeschen. Eine Obergrenze waere richtig, hat aber vor 2036 keinen
-- Anwendungsfall und braucht eine eigene Entscheidung darueber, was genau
-- danach entfaellt. Das steht als offener Punkt im Handoff, nicht hier.

-- ── Chat-Nachrichten: 6 Monate nach Auftragsabschluss ───────────────────────
--
-- AUSNAHME offener Streitfall: waehrend eines Streits ist der Chat das
-- Beweismittel beider Seiten. Art. 17 Abs. 3 lit. e DSGVO deckt das
-- ausdruecklich ("zur Geltendmachung, Ausuebung oder Verteidigung von
-- Rechtsansprüchen"). Der Satz steht seit heute auch in der
-- Datenschutzerklaerung -- eine Ausnahme, die nur im Code steht, ist eine
-- Abweichung von der eigenen Zusage.
create or replace function public.chat_aufbewahrung_anwenden()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_anzahl integer;
begin
  with faellig as (
    select c.job_id
      from public.contracts c
     where c.status = 'completed'
       and c.completed_at is not null
       and c.completed_at < now() - interval '6 months'
       and not exists (
             select 1 from public.disputes d
              where d.contract_id = c.id
                and d.status <> 'resolved')
  )
  delete from public.messages m
   using faellig f
   where m.job_id = f.job_id;
  get diagnostics v_anzahl = row_count;
  return v_anzahl;
end;
$$;

-- ── Consent-Log: 3 Jahre ────────────────────────────────────────────────────
--
-- Die Rechenschaftspflicht (Art. 5 Abs. 2 DSGVO) verlangt den Nachweis, nicht
-- seine ewige Aufbewahrung. Nach drei Jahren ist er entbehrlich, und ihn
-- laenger zu halten waere selbst eine Speicherung ohne Grundlage.
create or replace function public.consent_aufbewahrung_anwenden()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_anzahl integer;
begin
  delete from public.dsgvo_consents
   where erteilt_am < now() - interval '3 years';
  get diagnostics v_anzahl = row_count;
  return v_anzahl;
end;
$$;

-- ── Selbstauskunft fuer das Pruef-Postfach ──────────────────────────────────
drop function if exists public.aufbewahrung_status();

create or replace function public.aufbewahrung_status()
returns table (
  chat_ueberfaellig     integer,
  chat_aelteste_tage    integer,
  consent_ueberfaellig  integer,
  consent_aelteste_tage integer,
  rueckstand            boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_jetzt timestamptz := now();
begin
  select
    count(*)::integer,
    coalesce(max(extract(day from v_jetzt - c.completed_at))::integer, 0)
  into chat_ueberfaellig, chat_aelteste_tage
  from public.contracts c
  where c.status = 'completed'
    and c.completed_at is not null
    and c.completed_at < v_jetzt - interval '6 months'
    and not exists (
          select 1 from public.disputes d
           where d.contract_id = c.id and d.status <> 'resolved')
    and exists (select 1 from public.messages m where m.job_id = c.job_id);

  select
    count(*)::integer,
    coalesce(max(extract(day from v_jetzt - k.erteilt_am))::integer, 0)
  into consent_ueberfaellig, consent_aelteste_tage
  from public.dsgvo_consents k
  where k.erteilt_am < v_jetzt - interval '3 years';

  rueckstand := (chat_ueberfaellig > 0) or (consent_ueberfaellig > 0);
  return next;
end;
$$;

-- Rechte: der Widerruf muss gegen PUBLIC gehen, sonst wirkt er nicht (07.09.).
revoke execute on function public.chat_aufbewahrung_anwenden()    from public, anon, authenticated;
revoke execute on function public.consent_aufbewahrung_anwenden() from public, anon, authenticated;
revoke execute on function public.aufbewahrung_status()           from public, anon, authenticated;
grant  execute on function public.chat_aufbewahrung_anwenden()    to service_role;
grant  execute on function public.consent_aufbewahrung_anwenden() to service_role;
grant  execute on function public.aufbewahrung_status()           to service_role;

comment on function public.chat_aufbewahrung_anwenden() is
  'Loescht Chat-Nachrichten zu Auftraegen, deren Vertrag vor mehr als sechs '
  'Monaten abgeschlossen wurde. Offene Streitfaelle bleiben ausgenommen '
  '(Art. 17 Abs. 3 lit. e DSGVO). Zusage: app/datenschutz.tsx, Aufbewahrung.';
comment on function public.consent_aufbewahrung_anwenden() is
  'Loescht Einwilligungsnachweise, die aelter als drei Jahre sind. '
  'Zusage: app/datenschutz.tsx, Aufbewahrung.';
comment on function public.aufbewahrung_status() is
  'Betreiber-Selbstauskunft: wie viele Zeilen ueber ihre zugesagte '
  'Aufbewahrungsfrist hinaus stehen. Sichtbar unter /pruefung.';
