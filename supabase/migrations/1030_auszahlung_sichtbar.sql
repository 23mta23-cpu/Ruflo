-- 1030: Haengende Auszahlungen sichtbar machen.
--
-- BEFUND (22.09.2026, gemessen). `payout_operations.status` kennt vier Werte
-- (0650). Einer davon, `manual_review`, kommt im GANZEN Projekt nur an zwei
-- Stellen vor: in der Migration, die ihn setzt, und in den Deno-Tests. Kein
-- Bildschirm, keine Selbstauskunft, keine Mitteilung.
--
-- Was er bedeutet, steht in 0650: eine Auszahlung, bei der etwas nicht
-- stimmt. Abweichende Transfer-ID beim Finalisieren, falscher Betrag,
-- fremdes Zielkonto, mehrere passende Transfers, falsche Waehrung, oder eine
-- Erstattung, die waehrend der Auszahlung eintraf. In mehreren dieser Faelle
-- ist der Transfer bei Stripe BEREITS GELAUFEN.
--
-- Wirkung bis heute: der Kunde hat freigegeben, der Vertrag steht auf
-- `active`, das Geld haengt, und NIEMAND erfaehrt es. Der Betrieb sieht in
-- seinem Verdienst-Banner nur, dass nichts ankommt. `release-escrow`
-- antwortet mit 409 und sperrt jeden weiteren Versuch -- richtig so, aber
-- ohne einen Ort, an dem das auffaellt, bleibt es unbefristet liegen.
--
-- Dieselbe Klasse wie die drei Selbstauskuenfte von heute Nacht (0850, 0880,
-- 1010) und schwerer als jede davon: dort ging es um Zeitplaene, hier um
-- konkretes, bereits bewegtes Geld.
--
-- GEMESSEN vor dem Bauen: 71 Statuswerte in check-Listen, 18 davon kennt kein
-- Bildschirm. 17 sind Betreiber-Werkzeuge im SQL-Editor (0810: Art. 17 DSA)
-- oder interne Lebenszyklus-Marken (0650: claimed/transferred/finalized).
-- Genau EINER verlangt eine Handlung. Deshalb KEIN Pruefer fuer die Klasse --
-- er haette 17 Fehlalarme erzeugt -- sondern diese eine Auskunft.

drop function if exists public.auszahlung_status();

create or replace function public.auszahlung_status()
returns table (
  gesperrt              integer,      -- Operationen auf manual_review
  gesperrt_cents        bigint,       -- Summe, die dabei festliegt
  aeltester_fall_stunden integer,     -- seit wann die aelteste haengt
  haengend              integer,      -- beansprucht, nie finalisiert
  haengend_cents        bigint,
  stau                  boolean       -- irgendetwas verlangt eine Handlung
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  -- Eine Auszahlung wird beansprucht und soll binnen Sekunden finalisiert
  -- sein; dazwischen liegt genau EIN Stripe-Aufruf. Eine Stunde ist deshalb
  -- grosszuegig und trotzdem eindeutig: was so lange steht, steht fest.
  v_haenge_grenze constant interval := interval '1 hour';
  v_jetzt timestamptz := now();
begin
  select
    count(*) filter (where o.status = 'manual_review'),
    coalesce(sum(o.amount_cents) filter (where o.status = 'manual_review'), 0),
    -- Ohne gesperrte Operation ist die Frage „seit wann" nicht beantwortbar.
    -- 0 waere hier eine erfundene Zahl; NULL sagt „es gibt keinen Fall".
    coalesce(max(extract(epoch from (v_jetzt - o.updated_at)) / 3600)
             filter (where o.status = 'manual_review'), 0)::integer,
    count(*) filter (where o.status in ('claimed', 'transferred')
                       and o.updated_at < v_jetzt - v_haenge_grenze),
    coalesce(sum(o.amount_cents) filter (where o.status in ('claimed', 'transferred')
                       and o.updated_at < v_jetzt - v_haenge_grenze), 0)
  into gesperrt, gesperrt_cents, aeltester_fall_stunden, haengend, haengend_cents
  from public.payout_operations o;

  stau := (gesperrt > 0) or (haengend > 0);
  return next;
end;
$$;

comment on function public.auszahlung_status() is
  'Betriebs-Selbstauskunft zu Auszahlungen. Meldet BEIDES: Operationen auf manual_review (0650 sperrt sie, der Transfer kann bereits gelaufen sein) und solche, die laenger als eine Stunde beansprucht, aber nie finalisiert wurden. Betraege in Cent, wie payout_operations.amount_cents.';

-- Wie die drei anderen Selbstauskuenfte: nur die Edge Function `pruefung`
-- darf sie rufen. Der Widerruf gegen PUBLIC ist der wirksame Teil -- eine
-- Absage an `authenticated` allein laesst das Recht unberuehrt (07.09.).
revoke execute on function public.auszahlung_status() from public, anon, authenticated;
grant execute on function public.auszahlung_status() to service_role;
