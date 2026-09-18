-- 0960: PIN beim Arbeitsbeginn.
--
-- ANLASS: `docs/markt/wettbewerbsabgleich-2026-09.md`, Punkt 2 der Reihenfolge
-- nach Nutzen, und der Entwurf in `docs/produkt/start-pin-entwurf.md`. Der
-- Kunde nennt dem Betrieb an der Tuer eine vierstellige Zahl. Erst wenn der
-- Betrieb sie eintippt, gilt der Arbeitsbeginn als belegt.
--
-- Das loest drei Dinge auf einmal: der Kunde weiss, dass der Mensch vor der
-- Tuer zu diesem Auftrag gehoert; im Streitfall gibt es einen Zeitpunkt, den
-- keine Seite allein gesetzt hat; und ein Auftrag, der nie eingeloest wird,
-- aber als erledigt abgerechnet werden soll, faellt auf.
--
-- DREI ENTSCHEIDUNGEN, die der Entwurf offen gelassen hat. Getroffen am
-- 17.09.2026 in der Nacht, weil sie sonst die Umsetzung blockieren; jede ist
-- umkehrbar, und jede steht hier mit ihrem Grund.
--
--   1. WER NENNT WEM DIE ZAHL: der Kunde dem Betrieb (Uber-Muster). Der Kunde
--      entscheidet damit, wer seine Tuer passiert. Der umgekehrte Weg gaebe
--      dem Betrieb die Zahl in die Hand und damit den Beleg.
--
--   2. WAS PASSIERT, WENN NIEMAND SIE EINLOEST: NICHTS. Kein Hinweis, kein
--      Pruefsignal, kein Strike. Das ist ausdruecklich so und steht auch so
--      in der Oberflaeche. Eine Folge waere eine Zusage, und eine Zusage ohne
--      Mechanismus ist eine Luege mit Verzoegerung (15.09.). Wer spaeter eine
--      Folge will, baut zuerst den Mechanismus.
--
--   3. NACHBARSCHAFTSHILFE: keine PIN. Dort sind die Betraege klein und die
--      Huerde zaehlt mehr als der Beleg. Der Trigger legt fuer diesen Zweig
--      gar nichts erst an.

-- ── Die Zahl ───────────────────────────────────────────────────────────────
--
-- Eigene Tabelle, nicht eine Spalte in `contracts`. Der Betrieb darf die PIN
-- NICHT lesen koennen, sonst beweist sie nichts -- und Leserechte auf
-- `contracts` gelten zeilenweise, nicht spaltenweise je Person. Beide
-- Parteien lesen dieselbe Zeile.
--
-- Die PIN steht im Klartext, und das ist keine Nachlaessigkeit: der Kunde
-- muss sie VORLESEN koennen. Ein Streuwert waere nicht anzeigbar. Geschuetzt
-- wird sie deshalb ueber die Policy, nicht ueber die Form.
create table if not exists public.vertrag_start_pins (
  contract_id   uuid primary key references public.contracts(id) on delete cascade,
  pin           text not null check (pin ~ '^[0-9]{4}$'),
  fehlversuche  integer not null default 0,
  gesperrt_bis  timestamptz,
  erstellt_am   timestamptz not null default now(),
  eingeloest_am timestamptz
);

alter table public.vertrag_start_pins enable row level security;

-- Lesen darf NUR der Auftraggeber dieses Vertrags.
drop policy if exists start_pin_select_kunde on public.vertrag_start_pins;
create policy start_pin_select_kunde on public.vertrag_start_pins
  for select using (
    exists (
      select 1 from public.contracts c
      where c.id = contract_id and c.customer_id = auth.uid()
    )
  );

-- KEINE insert-, update- oder delete-Policy. Die Zeile entsteht im Trigger,
-- geaendert wird sie ausschliesslich in `arbeit_beginnen()`. Duerfte der
-- Kunde sie aendern, koennte er die Fehlversuche zuruecksetzen; duerfte es
-- der Betrieb, waere die Sperre wirkungslos.

comment on table public.vertrag_start_pins is
  'Vierstellige Zahl, die der Auftraggeber dem Betrieb bei Arbeitsbeginn nennt. Nur der Auftraggeber darf sie lesen. Verglichen wird ausschliesslich serverseitig in arbeit_beginnen().';

-- ── Der belegte Zeitpunkt ──────────────────────────────────────────────────
alter table public.contracts
  add column if not exists arbeit_begonnen_am timestamptz;

comment on column public.contracts.arbeit_begonnen_am is
  'Wann der Betrieb die PIN des Auftraggebers eingeloest hat. Nur ueber arbeit_beginnen() setzbar -- ein Zeitpunkt, den eine Partei allein setzen koennte, belegt nichts.';

-- Spaltenrechte wirken NUR, wenn zugleich das Tabellenrecht entzogen wird
-- (gelernt in 0920): ein pauschales `grant update on contracts` ueberschreibt
-- jede spaltengenaue Vergabe. Also erst entziehen, dann Spalte fuer Spalte
-- zurueckgeben.
--
-- ACHTUNG, Gegenrichtung: ein Fehler hier sperrt JEDE Aenderung an einem
-- Vertrag durch seine Parteien -- Abnahme, Stornierung, Unterschrift. Dafuer
-- gibt es eine eigene Zusicherung im Test (SP3).
do $$
declare spalte text;
begin
  revoke update on public.contracts from authenticated;
  for spalte in
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'contracts'
      and column_name <> 'arbeit_begonnen_am'
  loop
    execute format('grant update (%I) on public.contracts to authenticated', spalte);
  end loop;
end $$;

grant update on public.contracts to service_role;

-- ── Die Zahl entsteht mit dem Vertrag ──────────────────────────────────────
--
-- Zufall aus `gen_random_uuid()` (Kern-PostgreSQL, kein pgcrypto noetig).
-- Acht Hexziffern ergeben 2^32 Werte; der Rest modulo 10000 hat damit eine
-- Ungleichverteilung von etwa zwei Millionstel. Der Zuschlag von 4294967296
-- faengt das Vorzeichen ab: `bit(32)::bigint` kann negativ sein, und ein
-- negativer Rest waere keine PIN.
create or replace function public.start_pin_erzeugen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Nachbarschaftshilfe bekommt keine PIN (Entscheidung 3 oben).
  if coalesce(new.track, 'handwerker') = 'nachbarschaft' then
    return new;
  end if;

  insert into public.vertrag_start_pins (contract_id, pin)
  values (
    new.id,
    lpad(
      (mod(
        ('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint
        + 4294967296,
        10000
      ))::text,
      4, '0'
    )
  )
  on conflict do nothing;   -- zweiter Lauf aendert nichts
  return new;
end;
$$;

drop trigger if exists trg_start_pin_erzeugen on public.contracts;
create trigger trg_start_pin_erzeugen
  after insert on public.contracts
  for each row execute function public.start_pin_erzeugen();

-- ── Der Vergleich, und zwar auf dem Server ─────────────────────────────────
--
-- Wuerde die App die PIN holen und selbst vergleichen, koennte der Betrieb sie
-- im Netzverkehr mitlesen. Der Vergleich gehoert hierher, und
-- zurueckgegeben wird ausschliesslich ein Zustand, nie die Zahl.
--
-- SECURITY DEFINER hebelt die Policy der Tabelle aus (07.09.). Die
-- Einschraenkung steht deshalb IN der Funktion: nur der Betrieb DIESES
-- Vertrags kommt durch.
--
-- Rueckgabe: 'ok' | 'schon_begonnen' | 'gesperrt' | 'falsch' | 'keine_pin'
--            | 'nicht_berechtigt'
create or replace function public.arbeit_beginnen(p_vertrag uuid, p_pin text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_zeile   public.vertrag_start_pins%rowtype;
  v_kunde   uuid;
  v_begonn  timestamptz;
begin
  select c.customer_id, c.arbeit_begonnen_am into v_kunde, v_begonn
    from public.contracts c
   where c.id = p_vertrag and c.provider_id = auth.uid();
  if not found then
    -- Bewusst derselbe Zustand fuer "gibt es nicht" und "gehoert einem
    -- anderen": sonst liesse sich ueber die Antwort herausfinden, welche
    -- Vertragskennungen existieren.
    return 'nicht_berechtigt';
  end if;

  if v_begonn is not null then
    return 'schon_begonnen';
  end if;

  select * into v_zeile from public.vertrag_start_pins
   where contract_id = p_vertrag for update;
  if not found then
    return 'keine_pin';
  end if;

  if v_zeile.gesperrt_bis is not null and v_zeile.gesperrt_bis > now() then
    return 'gesperrt';
  end if;

  -- Die Sperre ist abgelaufen: Zaehler zuruecksetzen, sonst sperrt schon der
  -- naechste Fehlversuch wieder.
  if v_zeile.gesperrt_bis is not null and v_zeile.gesperrt_bis <= now() then
    update public.vertrag_start_pins
       set fehlversuche = 0, gesperrt_bis = null
     where contract_id = p_vertrag;
    v_zeile.fehlversuche := 0;
  end if;

  if v_zeile.pin <> coalesce(p_pin, '') then
    -- Drei Versuche. Vierstellig heisst zehntausend Moeglichkeiten; ohne
    -- Begrenzung waere der Beleg in Sekunden wertlos.
    update public.vertrag_start_pins
       set fehlversuche = v_zeile.fehlversuche + 1,
           gesperrt_bis = case when v_zeile.fehlversuche + 1 >= 3
                               then now() + interval '15 minutes' end
     where contract_id = p_vertrag;

    -- Beim Sperren erfaehrt es der Auftraggeber. Nicht bei jedem Vertipper:
    -- eine Mitteilung, die bei jedem Zahlendreher kommt, wird weggeklickt.
    if v_zeile.fehlversuche + 1 >= 3 then
      perform public.benachrichtigung_anlegen(
        v_kunde,
        'system',
        'Dreimal die falsche Start-PIN',
        'Bei Ihrem Auftrag wurde dreimal eine falsche Start-PIN eingegeben. '
        || 'Die Eingabe ist jetzt fuer 15 Minuten gesperrt. Wenn Sie die Zahl '
        || 'niemandem genannt haben, melden Sie sich bitte bei uns, bevor Sie '
        || 'jemanden hereinlassen.',
        '/vertrag?contractId=' || p_vertrag::text,
        'contracts',
        p_vertrag,
        false
      );
      -- Der dritte Fehlversuch ist zugleich der Moment der Sperre. 'falsch'
      -- zurueckzugeben waere zwar wahr, liesse die App aber sagen "noch ein
      -- Versuch", obwohl keiner mehr kommt. Der Betrieb soll sofort wissen,
      -- woran er ist.
      return 'gesperrt';
    end if;
    return 'falsch';
  end if;

  update public.vertrag_start_pins
     set fehlversuche = 0, gesperrt_bis = null, eingeloest_am = now()
   where contract_id = p_vertrag;
  update public.contracts
     set arbeit_begonnen_am = now()
   where id = p_vertrag;
  return 'ok';
end;
$$;

-- Das Ausfuehrungsrecht kommt ueber PUBLIC, nicht ueber die Rolle (07.09.):
-- erst gegen public/anon/authenticated entziehen, dann gezielt vergeben.
revoke execute on function public.arbeit_beginnen(uuid, text) from public, anon, authenticated;
grant execute on function public.arbeit_beginnen(uuid, text) to authenticated;

revoke execute on function public.start_pin_erzeugen() from public, anon, authenticated;

comment on function public.arbeit_beginnen(uuid, text) is
  'Der Betrieb loest die PIN seines Auftraggebers ein. Vergleicht serverseitig, zaehlt Fehlversuche, sperrt nach drei Versuchen fuer 15 Minuten und gibt nur einen Zustand zurueck, nie die Zahl.';

-- ── Bestand ────────────────────────────────────────────────────────────────
-- Vertraege, die es schon gibt, bekommen ihre PIN nachgereicht. Ohne das
-- haetten genau die laufenden Auftraege keine, bei denen es zuerst gebraucht
-- wird. Idempotent ueber den Primaerschluessel.
insert into public.vertrag_start_pins (contract_id, pin)
select c.id,
       lpad(
         (mod(
           ('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint
           + 4294967296,
           10000
         ))::text,
         4, '0'
       )
  from public.contracts c
 where coalesce(c.track, 'handwerker') <> 'nachbarschaft'
   and not exists (
     select 1 from public.vertrag_start_pins p where p.contract_id = c.id
   );
