-- Ausführungsrechte: Vorgabe von „erlaubt" auf „verboten" drehen.
--
-- ANLASS (Pentest 07.09.2026). 0420 setzt:
--
--     alter default privileges in schema public
--       grant execute on functions to authenticated, service_role;
--
-- Damit ist JEDE seither angelegte Funktion automatisch für jeden Angemeldeten
-- ausführbar. Wer eine Funktion sperren will, muss daran denken zu widerrufen —
-- und wer es vergisst, merkt nichts, weil nichts kaputtgeht.
--
-- Gemessen wurde: 15 SECURITY-DEFINER-Funktionen waren für `authenticated`
-- ausführbar und prüften `auth.uid()` NICHT. Das sind keine 15 Versehen,
-- sondern eine Voreinstellung, die 15 Mal gewirkt hat. AGENTS.md verlangt
-- „default deny"; hier stand default allow.
--
-- ZWEI NACHGEWIESEN AUSNUTZBARE LÜCKEN, lokal gegen Postgres belegt:
--
--   check_rate_limit(p_key, p_limit, p_window_seconds)
--     Ein Angemeldeter konnte einen BELIEBIGEN Schlüssel abrufen — etwa
--     'ip:203.0.113.9:create-payment-intent'. Vier Aufrufe, der vierte kam als
--     false zurück: das Kontingent eines Fremden ist aufgebraucht. Damit ließ
--     sich eine bestimmte Person oder IP gezielt von der Zahlung aussperren.
--     Das ist ein Denial-of-Service gegen einzelne Nutzer, und er hinterlässt
--     im Protokoll nur eine ganz normale 429 beim Opfer.
--
--   aktive_strikes(p_provider)
--     Lieferte die Zahl aktiver Verstöße JEDES Anbieters. Disziplinardaten,
--     abfragbar von jedem Angemeldeten, durchzählbar über alle Anbieter.
--
-- Dazu: recompute_strike_count(p_provider) war auf fremde Konten aufrufbar.
-- Fälschen ließ sich dabei nichts (die Funktion rechnet aus der Akte), aber es
-- ist ein Schreibweg in fremde Zeilen, den es nicht geben muss.
--
-- Trigger-Funktionen sind davon unberührt: PostgreSQL prüft beim Auslösen eines
-- Triggers KEIN Ausführungsrecht. apply_leak_strikes() ließ sich im Test
-- ohnehin nicht direkt rufen („trigger functions can only be called as
-- triggers").

-- ── Schritt 1: die Vorgabe für künftige Funktionen ─────────────────────────
-- Ab hier bekommt eine neue Funktion NICHT mehr automatisch ein Ausführungsrecht
-- für Angemeldete. Wer eine braucht, vergibt sie ausdrücklich — und wird dabei
-- gezwungen, sich zu überlegen, ob die Funktion eine Eigentümerprüfung hat.
-- WICHTIG: der Widerruf muss gegen PUBLIC gehen, nicht gegen `authenticated`.
-- PostgreSQL vergibt bei JEDER neu angelegten Funktion automatisch EXECUTE an
-- PUBLIC — das ist eine eingebaute Vorgabe, die nichts mit 0420 zu tun hat.
-- `authenticated` erbt darüber. Ein `revoke … from authenticated` lässt die
-- PUBLIC-Zuweisung unberührt und wirkt deshalb NICHT.
--
-- Genau daran ist der erste Anlauf dieser Migration gescheitert: alle vier
-- Lücken waren nach dem Widerruf noch offen. Nachgemessen, nicht vermutet.
alter default privileges in schema public
  revoke execute on functions from public;

alter default privileges in schema public
  revoke execute on functions from authenticated;

-- service_role behält die Vorgabe: die Edge Functions rufen mit diesem Recht,
-- und dort ist die Prüfung im Code (Auth, Rate-Limit, Eigentümerschaft).
alter default privileges in schema public
  grant execute on functions to service_role;

-- ── Schritt 2: den Bestand aufräumen ──────────────────────────────────────
-- Erst alles entziehen, dann gezielt zurückgeben. Andersherum bliebe jede
-- Funktion offen, die man beim Aufzählen übersieht — und genau das ist die
-- Fehlerklasse, um die es hier geht.
-- NUR eigene Funktionen, NICHT die von Erweiterungen.
--
-- Der erste Anlauf nahm `revoke execute on all functions in schema public`.
-- Das traf auch uuid-ossp und dblink, die in `public` installiert sind — und
-- `uuid_generate_v4()` steckt in Spalten-Vorgaben. In der Produktion wäre damit
-- jedes Einfügen durch einen Angemeldeten an „permission denied for function
-- uuid_generate_v4" gescheitert. Der Testlauf hat es sofort gezeigt (sieben
-- Dateien rot), aber es ist genau die Sorte Änderung, die man ohne Testlauf
-- ausrollt und dann in der Produktion sucht.
--
-- Die Schleife lässt alles aus, was per pg_depend zu einer Erweiterung gehört.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and not exists (
         select 1 from pg_depend d
          where d.objid = p.oid and d.deptype = 'e'   -- gehört zu einer Erweiterung
       )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
    -- Der Widerruf gegen PUBLIC nimmt service_role das Recht mit — deshalb
    -- gleich zurückgeben. Die Edge Functions rufen mit diesem Recht.
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;

-- ── Schritt 3: zurückgeben, was der Client tatsächlich ruft ────────────────
-- Ermittelt aus den .rpc()-Aufrufen in lib/, app/ und components/. Jede dieser
-- Funktionen prüft auth.uid() selbst — geprüft in scripts/db-test/rechte.sql,
-- das genau diese Bedingung mechanisch nachhält.
grant execute on function public.accept_offer(uuid, uuid)                    to authenticated;
grant execute on function public.decline_offer(uuid)                         to authenticated;
grant execute on function public.auth_email_confirmed()                      to authenticated;
grant execute on function public.beschraenkung_begruendung(uuid)             to authenticated;
grant execute on function public.fertigstellung_melden(uuid)                 to authenticated;
grant execute on function public.konversationen_kunde()                      to authenticated;
grant execute on function public.konversationen_anbieter()                   to authenticated;
grant execute on function public.mark_messages_read(uuid, uuid)              to authenticated;
grant execute on function public.propose_appointment(uuid, uuid, timestamptz) to authenticated;
grant execute on function public.respond_appointment(uuid, boolean)          to authenticated;
grant execute on function public.vertrag_partner(uuid[])                     to authenticated;

-- ist_anbieter_frei ist ABSICHTLICH für jeden Angemeldeten lesbar: der Kunde
-- muss sehen können, ob eine Stunde frei ist, sonst wäre provider_availability
-- nutzlos (so schon in 0740 entschieden und dort begründet). Die Funktion gibt
-- nur „frei ja/nein" zurück, keine Kundendaten und keinen Terminplan.
grant execute on function public.ist_anbieter_frei(uuid, timestamptz)        to authenticated;

-- auth_is_thread_participant wird von RLS-Policies benutzt, nicht vom Client.
-- Policies laufen mit den Rechten des Aufrufers, deshalb braucht sie das Recht.
grant execute on function public.auth_is_thread_participant(uuid)            to authenticated;

-- auth_is_thread_participant wird von RLS-Policies benutzt, nicht direkt vom
-- Client. Policies laufen mit den Rechten des Aufrufers, deshalb das Recht.
--
-- abnahme_frist_tage() gibt eine Zahl zurück, die in AGB §4(2a) steht: 14 Tage.
-- Sie geheim zu halten wäre sinnlos, und die Anzeige der Frist braucht sie.
grant execute on function public.abnahme_frist_tage()                        to authenticated;

-- ── Schritt 4: Strikes nur noch über die eigene Kennung ───────────────────
-- aktive_strikes(p_provider) bleibt die Wahrheitsquelle für Betrieb und
-- Trigger, ist aber für Angemeldete gesperrt. Der Client bekommt einen Weg
-- OHNE Argument: was nicht übergeben werden kann, kann auch nicht auf einen
-- Fremden zeigen. Das ist der Unterschied zu „prüf das Argument" — hier gibt es
-- gar keines mehr, an dem eine Prüfung vergessen werden könnte.
create or replace function public.meine_aktiven_strikes()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
           when auth.uid() is null then 0
           else public.aktive_strikes(auth.uid())
         end;
$$;

comment on function public.meine_aktiven_strikes() is
  'Aktive Strikes des AUFRUFENDEN Anbieters. Ersetzt den Client-Aufruf von aktive_strikes(uuid), mit dem sich die Verstöße jedes Anbieters abfragen ließen (Pentest 07.09.2026).';

revoke execute on function public.meine_aktiven_strikes() from public, anon;
grant  execute on function public.meine_aktiven_strikes() to authenticated;

-- ── Schritt 5: die Angebots-Policy auf die argumentlose Fassung umstellen ──
-- Die Policy aus 0720 rief `aktive_strikes(auth.uid()) < 3`. RLS-Policies laufen
-- mit den Rechten des AUFRUFERS — anders als Trigger, bei denen PostgreSQL kein
-- Ausführungsrecht prüft. Nach Schritt 2 hätte damit KEIN Anbieter mehr ein
-- Angebot abgeben können: der Insert wäre an „permission denied for function
-- aktive_strikes" gescheitert.
--
-- Aufgefallen ist das in scripts/db-test/strike-verfall.sql (Z-b), nicht beim
-- Lesen. Es ist die teuerste Sorte Nebenwirkung: eine Härtung, die die
-- Kernfunktion abschaltet, und zwar nur für den Fall, den man selten testet.
--
-- meine_aktiven_strikes() nimmt kein Argument und liest auth.uid() selbst —
-- inhaltlich identisch, weil die Policy ohnehin nur auth.uid() prüfte.
-- Alles Übrige ist Wort für Wort aus 0720 übernommen.
drop policy if exists "Provider creates offers on open jobs" on public.offers;
create policy "Provider creates offers on open jobs"
  on public.offers for insert
  with check (
    auth.uid() = provider_id
    and auth_email_confirmed()
    and public.meine_aktiven_strikes() < 3
    and exists (
      select 1 from public.jobs j
      where j.id = job_id
        and j.status in ('open', 'matched')
        and j.customer_id <> auth.uid()
        and (
          j.track = 'nachbarschaft'
          or not exists (
            select 1 from public.provider_profiles pp
            where pp.id = auth.uid() and pp.is_nachbarschaft
          )
        )
    )
  );
