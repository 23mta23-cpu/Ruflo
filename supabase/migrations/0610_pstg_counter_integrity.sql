-- Migration 061: PStTG-Zähler gegen Umgehung und gegen Race schützen
--
-- ── Befund 1: der Anbieter konnte sich selbst aus der DAC7-Meldung nehmen ────
-- guard_profile_sensitive_cols schützt role, pstg_locked und pstg_year — aber
-- NICHT pstg_tx_count und pstg_revenue. Die WITH-CHECK-Klausel der Policy
-- "Users can update own profile" ist an der Stelle wörtlich `and true`
-- (0050:52), also ohne Wirkung. Damit genügte ein einziger Aufruf
--
--     update profiles set pstg_tx_count = 0, pstg_revenue = 0 where id = auth.uid()
--
-- um die Zähler zurückzusetzen. pstg-annual-report wählt die zu meldenden
-- Anbieter AUSSCHLIESSLICH über diese beiden Spalten aus
-- (`.or('pstg_tx_count.gte.30,pstg_revenue.gte.2000')`), nicht über
-- pstg_locked — der Anbieter verschwand also vollständig aus der Meldung ans
-- BZSt, obwohl die Sperre gesetzt blieb. Die Meldepflicht trifft die Plattform
-- (§ 13 PStTG), das Bußgeld ebenfalls (§ 25 PStTG). Beide Spalten werden
-- ausschliesslich lesend in der App verwendet (lib/pstTg.ts), der Guard bricht
-- also keinen bestehenden Weg.
--
-- ── Befund 2: der Zähler konnte zu niedrig stehen (Race) ────────────────────
-- release-escrow zählte als Read-modify-write in TypeScript hoch
-- (`newCount = baseCount + 1`). Werden zwei verschiedene Verträge gleichzeitig
-- freigegeben, lesen beide denselben Ausgangswert und schreiben denselben
-- Endwert — eine Transaktion geht verloren. Zu niedrig heisst hier: ein
-- Anbieter, der gemeldet werden müsste, wird es womöglich nicht.
--
-- Fix: die Fortschreibung wandert in EINE atomare Anweisung. Unter READ
-- COMMITTED wertet Postgres die SET-Ausdrücke einer wartenden UPDATE-Anweisung
-- nach dem Commit des Konkurrenten neu aus — `spalte = spalte + 1` ist damit
-- verlustfrei, anders als Lesen-Rechnen-Schreiben über zwei Roundtrips.

-- ── Guard erweitern ─────────────────────────────────────────────────────────
-- Zusaetzlich zum neuen Schutz der beiden Zaehler wird die Rollenpruefung auf
-- das Muster aus 0600 umgestellt: NUR Client-Rollen blocken, statt allein
-- service_role zu erlauben.
--
-- Der bisherige Test `current_setting('role') <> 'service_role'` blockierte
-- naemlich auch jede SECURITY-DEFINER-Funktion (die laeuft als Eigentuemer,
-- nicht als service_role) und jede administrative Verbindung. Beim Schreiben
-- dieses Tests hat genau das zugeschlagen: pstg_record_transaction konnte den
-- Zaehler, den sie fortschreiben soll, selbst nicht schreiben. In Produktion
-- waere es nur deshalb gutgegangen, weil PostgREST vorher `set role
-- service_role` absetzt — ein Schutz, der von der Aufrufkette abhaengt, ist
-- kein verlaesslicher Schutz. 0600 hat dieselbe Lehre schon fuer
-- email_verified_at gezogen.
--
-- `role` bleibt bewusst fuer ALLE gesperrt (unveraendert): eine
-- Rollenaenderung ist nach der Kontoerstellung nie vorgesehen.
create or replace function guard_profile_sensitive_cols()
returns trigger language plpgsql security definer as $$
declare
  v_role text := current_setting('role', true);
begin
  if new.role is distinct from old.role then
    raise exception 'role cannot be changed after account creation';
  end if;

  -- Alles ausser den Client-Rollen darf die Compliance-Spalten schreiben:
  -- service_role (Edge Functions), SECURITY-DEFINER-Funktionen, Admin/SQL-Editor.
  if v_role is null or v_role not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.pstg_locked is distinct from old.pstg_locked then
    raise exception 'pstg_locked is managed by the compliance system';
  end if;

  if new.pstg_year is distinct from old.pstg_year then
    raise exception 'pstg_year is managed by the compliance system';
  end if;

  -- NEU: die Zaehler selbst. Ohne diese beiden Bloecke war der Schutz von
  -- pstg_locked/pstg_year wirkungslos — man musste die Sperre gar nicht
  -- anfassen, es genuegte, die Zahlen zu nullen, nach denen gemeldet wird.
  if new.pstg_tx_count is distinct from old.pstg_tx_count then
    raise exception 'pstg_tx_count is managed by the compliance system';
  end if;

  if new.pstg_revenue is distinct from old.pstg_revenue then
    raise exception 'pstg_revenue is managed by the compliance system';
  end if;

  return new;
end;
$$;

-- ── Atomare Fortschreibung ──────────────────────────────────────────────────
-- Ersetzt das Lesen-Rechnen-Schreiben in release-escrow. Erledigt in einer
-- Anweisung: Jahreswechsel (Zähler und Sperre des Vorjahres wirken nicht fort),
-- Hochzählen, Schwellenprüfung, Sperren.
--
-- Schwellen bewusst hier dupliziert (30 Transaktionen / 2000 EUR, § 4 Abs. 5
-- PStTG). Quelle der Wahrheit bleibt lib/pstTgThresholds.ts; Edge Functions
-- können nicht aus lib/ importieren, und plpgsql erst recht nicht. Wer die
-- Schwellen ändert, muss lib/pstTgThresholds.ts, release-escrow,
-- pstg-annual-report UND diese Funktion anfassen.
create or replace function pstg_record_transaction(
  p_provider_id uuid,
  p_payout      numeric
)
returns table (tx_count integer, revenue numeric, locked boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer := extract(year from now())::integer;
begin
  return query
  update public.profiles p
     set pstg_tx_count = (case when p.pstg_year = v_year then p.pstg_tx_count else 0 end) + 1,
         pstg_revenue  = (case when p.pstg_year = v_year then p.pstg_revenue  else 0 end) + p_payout,
         pstg_year     = v_year,
         pstg_locked   =
           case
             when (case when p.pstg_year = v_year then p.pstg_tx_count else 0 end) + 1 >= 30
               or (case when p.pstg_year = v_year then p.pstg_revenue  else 0 end) + p_payout >= 2000
             then true
             -- Sperre des Vorjahres wirkt nicht fort
             else (case when p.pstg_year = v_year then p.pstg_locked else false end)
           end
   where p.id = p_provider_id
  returning p.pstg_tx_count, p.pstg_revenue, p.pstg_locked;
end;
$$;

comment on function pstg_record_transaction(uuid, numeric) is
  'Schreibt den PStTG-Jahresstand eines Anbieters nach einer Escrow-Freigabe '
  'atomar fort (Jahreswechsel, Hochzählen, Schwellenprüfung, Sperre). Ersetzt '
  'das frühere Lesen-Rechnen-Schreiben in release-escrow, bei dem gleichzeitige '
  'Freigaben eine Transaktion verlieren konnten.';

revoke all on function pstg_record_transaction(uuid, numeric) from public, anon, authenticated;
grant execute on function pstg_record_transaction(uuid, numeric) to service_role;
