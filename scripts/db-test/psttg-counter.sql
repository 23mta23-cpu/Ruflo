-- PStTG/DAC7-Zähler (Block A3, Migration 0610)
--
-- Meldeschwelle: 30 Transaktionen ODER 2000 EUR im Kalenderjahr
-- (§ 4 Abs. 5 PStTG, gespiegelt in lib/pstTgThresholds.ts).
--
-- (Z1) knapp unter der Transaktionsschwelle -> nicht gesperrt
-- (Z2) exakt auf der Transaktionsschwelle (30.) -> gesperrt
-- (Z3) Umsatzschwelle greift unabhaengig von der Anzahl
-- (Z4) exakt auf 2000.00 EUR -> gesperrt (>= , nicht >)
-- (Z5) Jahreswechsel setzt Zaehler UND Sperre zurueck
-- (Z6) Anbieter kann seine eigenen Zaehler NICHT nullen (Umgehung)
-- (Z7) Fortschreibung ist verlustfrei (kein Read-modify-write)
reset role;

alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;

insert into auth.users (id,email,email_confirmed_at) values
  ('7a111111-0000-0000-0000-000000000000','pstg-a@test.de',now()),
  ('7a222222-0000-0000-0000-000000000000','pstg-b@test.de',now()),
  ('7a333333-0000-0000-0000-000000000000','pstg-c@test.de',now()),
  ('7a444444-0000-0000-0000-000000000000','pstg-d@test.de',now()),
  ('7a555555-0000-0000-0000-000000000000','pstg-e@test.de',now()),
  ('7a666666-0000-0000-0000-000000000000','pstg-f@test.de',now());
insert into profiles (id,role,email,email_verified_at) values
  ('7a111111-0000-0000-0000-000000000000','provider','pstg-a@test.de',now()),
  ('7a222222-0000-0000-0000-000000000000','provider','pstg-b@test.de',now()),
  ('7a333333-0000-0000-0000-000000000000','provider','pstg-c@test.de',now()),
  ('7a444444-0000-0000-0000-000000000000','provider','pstg-d@test.de',now()),
  ('7a555555-0000-0000-0000-000000000000','provider','pstg-e@test.de',now()),
  ('7a666666-0000-0000-0000-000000000000','provider','pstg-f@test.de',now());

alter table auth.users enable trigger user;
alter table public.profiles enable trigger user;

-- ── TEST Z1: 29 Transaktionen, kleine Betraege -> noch nicht meldepflichtig ──
do $$
declare r record; i int;
begin
  for i in 1..29 loop
    select * into r from pstg_record_transaction('7a111111-0000-0000-0000-000000000000', 10.00);
  end loop;
  if r.tx_count <> 29 then raise exception 'FAIL Z1: tx_count=% statt 29', r.tx_count; end if;
  if r.revenue <> 290.00 then raise exception 'FAIL Z1: revenue=% statt 290.00', r.revenue; end if;
  if r.locked then raise exception 'FAIL Z1: bei 29 Transaktionen / 290 EUR bereits gesperrt'; end if;
  raise notice 'PASS Z1: 29 Transaktionen / 290 EUR — knapp unter beiden Schwellen, nicht gesperrt';
end $$;

-- ── TEST Z2: die 30. Transaktion sperrt (>= 30, nicht > 30) ─────────────────
do $$
declare r record;
begin
  select * into r from pstg_record_transaction('7a111111-0000-0000-0000-000000000000', 10.00);
  if r.tx_count <> 30 then raise exception 'FAIL Z2: tx_count=% statt 30', r.tx_count; end if;
  if not r.locked then raise exception 'FAIL Z2: 30. Transaktion loest die Meldepflicht nicht aus (Schwelle ist >=, nicht >)'; end if;
  raise notice 'PASS Z2: die 30. Transaktion loest die Meldepflicht aus';
end $$;

-- ── TEST Z3: Umsatzschwelle greift unabhaengig von der Anzahl ───────────────
do $$
declare r record;
begin
  select * into r from pstg_record_transaction('7a222222-0000-0000-0000-000000000000', 2500.00);
  if r.tx_count <> 1 then raise exception 'FAIL Z3: tx_count=%', r.tx_count; end if;
  if not r.locked then raise exception 'FAIL Z3: 2500 EUR in EINER Transaktion loest die Meldepflicht nicht aus'; end if;
  raise notice 'PASS Z3: Umsatzschwelle greift auch bei einer einzigen Transaktion';
end $$;

-- ── TEST Z4: exakt 2000.00 EUR ist bereits meldepflichtig ───────────────────
do $$
declare r record;
begin
  select * into r from pstg_record_transaction('7a333333-0000-0000-0000-000000000000', 1999.99);
  if r.locked then raise exception 'FAIL Z4: 1999.99 EUR gilt bereits als meldepflichtig'; end if;
  select * into r from pstg_record_transaction('7a333333-0000-0000-0000-000000000000', 0.01);
  if r.revenue <> 2000.00 then raise exception 'FAIL Z4: revenue=% statt 2000.00', r.revenue; end if;
  if not r.locked then raise exception 'FAIL Z4: exakt 2000.00 EUR loest die Meldepflicht nicht aus (Schwelle ist >=)'; end if;
  raise notice 'PASS Z4: 1999.99 EUR nicht meldepflichtig, exakt 2000.00 EUR schon';
end $$;

-- ── TEST Z5: Jahreswechsel setzt Zaehler UND Sperre zurueck ─────────────────
-- Der Stand des Vorjahres darf nicht fortwirken: ein Anbieter, der 2025
-- meldepflichtig war, startet 2026 wieder bei null.
do $$
declare r record;
begin
  perform pstg_record_transaction('7a444444-0000-0000-0000-000000000000', 2500.00);
  -- Zeile kuenstlich ins Vorjahr versetzen. Als Eigentuemer erlaubt — der
  -- Guard blockt seit 0610 nur noch Client-Rollen.
  update profiles set pstg_year = extract(year from now())::int - 1
   where id = '7a444444-0000-0000-0000-000000000000';

  select * into r from pstg_record_transaction('7a444444-0000-0000-0000-000000000000', 15.00);
  if r.tx_count <> 1 then raise exception 'FAIL Z5: tx_count=% statt 1 — Vorjahr wirkt fort', r.tx_count; end if;
  if r.revenue <> 15.00 then raise exception 'FAIL Z5: revenue=% statt 15.00 — Vorjahresumsatz wirkt fort', r.revenue; end if;
  if r.locked then raise exception 'FAIL Z5: Sperre des Vorjahres wirkt ins neue Jahr fort'; end if;
  raise notice 'PASS Z5: Jahreswechsel setzt Zaehler, Umsatz und Sperre zurueck';
end $$;

-- ── TEST Z6: Anbieter kann seine Zaehler NICHT selbst nullen (Umgehung) ─────
-- Vor 0610 genuegte ein update auf die eigene Profilzeile, um aus der
-- DAC7-Meldung zu verschwinden: pstg-annual-report waehlt die zu meldenden
-- Anbieter ausschliesslich ueber pstg_tx_count/pstg_revenue aus.
set role authenticated;
set request.jwt.claim.sub = '7a222222-0000-0000-0000-000000000000';
do $$
declare n int; c int;
begin
  begin
    update profiles set pstg_tx_count = 0 where id = '7a222222-0000-0000-0000-000000000000';
    raise exception 'FAIL Z6: Anbieter konnte seinen Transaktionszaehler nullen';
  exception when raise_exception then
    if sqlerrm not like '%pstg_tx_count is managed%' then raise; end if;
  end;

  begin
    update profiles set pstg_revenue = 0 where id = '7a222222-0000-0000-0000-000000000000';
    raise exception 'FAIL Z6: Anbieter konnte seinen Umsatzstand nullen';
  exception when raise_exception then
    if sqlerrm not like '%pstg_revenue is managed%' then raise; end if;
  end;

  -- Gegenprobe: harmlose Felder bleiben schreibbar, der Guard ist nicht zu breit
  update profiles set full_name = 'Neuer Name' where id = '7a222222-0000-0000-0000-000000000000';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL Z6: Guard blockiert auch harmlose Profilfelder (% Zeilen)', n; end if;

  select pstg_tx_count into c from profiles where id = '7a222222-0000-0000-0000-000000000000';
  if c <> 1 then raise exception 'FAIL Z6: Zaehler wurde doch veraendert (%)', c; end if;
  raise notice 'PASS Z6: Anbieter kann sich nicht aus der DAC7-Meldung herausschreiben (Name bleibt aenderbar)';
end $$;
reset role;

-- ── TEST Z7: Fortschreibung ist verlustfrei ────────────────────────────────
-- Der alte Weg las den Stand, rechnete in TypeScript und schrieb zurueck.
-- Hier wird belegt, dass jede einzelne Fortschreibung ankommt — 50 Aufrufe
-- muessen exakt 50 ergeben, nicht weniger.
do $$
declare i int; c int; rev numeric;
begin
  for i in 1..50 loop
    perform pstg_record_transaction('7a555555-0000-0000-0000-000000000000', 7.00);
  end loop;
  select pstg_tx_count, pstg_revenue into c, rev
    from profiles where id = '7a555555-0000-0000-0000-000000000000';
  if c <> 50 then raise exception 'FAIL Z7: % von 50 Fortschreibungen angekommen', c; end if;
  if rev <> 350.00 then raise exception 'FAIL Z7: revenue=% statt 350.00', rev; end if;
  raise notice 'PASS Z7: alle 50 Fortschreibungen angekommen (kein Verlust durch Lesen-Rechnen-Schreiben)';
end $$;

-- ── TEST Z8: die Funktion ist nicht fuer Client-Rollen aufrufbar ────────────
set role authenticated;
set request.jwt.claim.sub = '7a666666-0000-0000-0000-000000000000';
do $$
begin
  perform pstg_record_transaction('7a666666-0000-0000-0000-000000000000', 5000.00);
  raise exception 'FAIL Z8: Client konnte die Compliance-Funktion direkt aufrufen';
exception when insufficient_privilege then
  raise notice 'PASS Z8: pstg_record_transaction ist fuer Client-Rollen nicht ausfuehrbar';
end $$;
reset role;
