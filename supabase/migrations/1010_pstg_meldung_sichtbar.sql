-- 1010: Die DAC7-Jahresmeldung faellt auf, BEVOR die Frist verstreicht.
--
-- BEFUND (21.09.2026, Selbst-Check „wer liest das Ergebnis?"):
-- `pstg-annual-report` ist die einzige Edge Function, die NIEMAND aufruft.
-- Kein Zeitplan, kein Workflow, keine Stelle in der Oberflaeche. Ihr eigener
-- Kopfkommentar sagt „manually by admin POST, or via Supabase scheduled
-- function (cron) on Jan 1" -- den Zeitplan gibt es nicht. Uebrig bleibt: der
-- Founder muss am 1. Januar von sich aus an eine Funktion denken, die in
-- keiner Liste steht, die er liest.
--
-- Das ist dieselbe Klasse wie die drei Warteschlangen, die niemand las
-- (0950/16.09.): gebaut, richtig, geprueft -- und ohne Empfaenger.
-- Hier haengt daran eine Frist: § 13 Abs. 1 PStTG verlangt die Meldung bis
-- zum 31. Januar fuer das Vorjahr, § 25 PStTG stellt das Versaeumnis unter
-- Bussgeld (bis 50.000 EUR).
--
-- Diese Migration baut KEINEN Zeitplan und loest KEINE Meldung aus. Sie macht
-- den Zustand sichtbar, damit `health` ihn ausweist und `wartet-jemand.yml`
-- Alarm schlaegt. Die Meldung an das BZSt bleibt eine bewusste Handlung eines
-- Menschen -- eine Steuermeldung automatisch abzusetzen ist keine Sache, die
-- eine Ueberwachungsfunktion nebenbei entscheidet.
--
-- ZWEI GETRENNTE ZUSTAENDE, und das ist der Punkt:
--   lauf_fehlt   -- pstg-annual-report lief nicht: es gibt meldepflichtige
--                   Anbieter, aber keine (oder zu wenige) Zeilen in
--                   pstg_reports. Nichts ist vorbereitet.
--   abgabe_fehlt -- die Zeilen gibt es, aber submitted_at ist leer: die
--                   XML-Meldung ging nie an das BZSt. Vorbereitet ist nicht
--                   abgegeben.
-- Ein einziges Kennzeichen fuer beides wuerde den zweiten Fall verdecken,
-- sobald der erste behoben ist.

drop function if exists public.pstg_meldung_status();

create or replace function public.pstg_meldung_status()
returns table (
  melde_jahr        integer,
  frist             date,
  tage_bis_frist    integer,
  meldepflichtige   integer,
  vorbereitet       integer,
  abgegeben         integer,
  lauf_fehlt        boolean,
  abgabe_fehlt      boolean,
  frist_verstrichen boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_jahr integer;
begin
  -- Gemeldet wird immer das VORJAHR, und zwar ab dem 1. Januar. Ortszeit,
  -- nicht UTC: am 31.12. um 23:30 Berliner Zeit ist es in UTC schon das neue
  -- Jahr, und die Funktion wuerde einen Tag zu frueh ein Jahr verlangen, das
  -- noch laeuft.
  v_jahr := extract(year from (now() at time zone 'Europe/Berlin'))::integer - 1;

  melde_jahr := v_jahr;
  frist      := make_date(v_jahr + 1, 1, 31);
  tage_bis_frist := (frist - (now() at time zone 'Europe/Berlin')::date)::integer;
  frist_verstrichen := tage_bis_frist < 0;

  -- Schwellen NICHT erneut hinschreiben: pstg_year_totals (0620) traegt sie
  -- als Vorgabewerte, und scripts/schwellen-check.py haelt die vorhandenen
  -- Kopien gleich. Eine vierte Kopie waere die naechste Divergenz.
  select count(*)::integer into meldepflichtige
    from public.pstg_year_totals(v_jahr);

  select count(*)::integer,
         count(*) filter (where r.submitted_at is not null)::integer
    into vorbereitet, abgegeben
    from public.pstg_reports r
   where r.report_year = v_jahr;

  lauf_fehlt   := meldepflichtige > 0 and vorbereitet < meldepflichtige;
  abgabe_fehlt := vorbereitet > 0 and abgegeben < vorbereitet;

  return next;
end;
$$;

comment on function public.pstg_meldung_status() is
  'Stand der DAC7-Jahresmeldung (§ 13 PStTG) fuer das Vorjahr: wie viele '
  'Anbieter meldepflichtig sind, wie viele Zeilen pstg-annual-report dazu '
  'angelegt hat und wie viele davon tatsaechlich an das BZSt abgegeben '
  'wurden. Loest nichts aus -- nur sichtbar machen.';

-- Wer den Meldestand kennt, kennt die Zahl der meldepflichtigen Anbieter.
-- Das ist eine Betriebskennzahl, keine Nutzerangabe -- nur service_role.
revoke all on function public.pstg_meldung_status() from public, anon, authenticated;
grant execute on function public.pstg_meldung_status() to service_role;

do $$
declare r record;
begin
  select * into r from public.pstg_meldung_status();
  raise notice 'PStTG-Meldung %: % meldepflichtig, % vorbereitet, % abgegeben, Frist % (% Tage)',
    r.melde_jahr, r.meldepflichtige, r.vorbereitet, r.abgegeben, r.frist, r.tage_bis_frist;
end $$;
