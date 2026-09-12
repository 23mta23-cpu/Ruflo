-- Pflichtmitteilungen entstehen mit dem Vorgang und sind nachweisbar.
--
-- ANLASS (Founder-Frage 12.09.2026 nach Benachrichtigungen). Bei der
-- Bestandsaufnahme kam ein Befund heraus, der schwerer wiegt als die Frage:
--
--   `strike_zustellung_vermerken()` und `beschraenkung_zustellung_vermerken()`
--   existieren seit 0750 bzw. 0810, und NIEMAND ruft sie auf. Es gibt keinen
--   Versandweg. Die Begruendung wird geschrieben und bleibt liegen.
--
-- Das ist kein Komfortmangel:
--   * AGB §7(4) verspricht dem Anbieter eine Begruendung (Art. 4 P2B-VO).
--   * DSA Art. 17 Abs. 1 verlangt, sie dem Betroffenen zu UEBERMITTELN.
--     Ein Text in einer Spalte ist keine Uebermittlung.
-- Der Kommentar in 0750 sagt das selbst („Zustellung ist damit NICHT
-- erledigt"), und danach hat es niemand gebaut.
--
-- Entscheidung und Begruendung:
-- notes/04-Entscheidungen/Benachrichtigungen-Architektur.md

-- ── Tabelle ────────────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  empfaenger uuid not null references public.profiles(id) on delete cascade,

  art text not null check (art in ('strike', 'beschraenkung', 'auszahlung', 'system')),
  titel text not null check (char_length(btrim(titel)) between 3 and 120),
  text  text not null check (char_length(btrim(text))  >= 10),
  route text,

  -- Herkunft, damit eine Mitteilung ihrem Vorgang zuordenbar bleibt und nicht
  -- zweimal entsteht.
  quelle_tabelle text,
  quelle_id uuid,

  -- Pflichtmitteilung? Dann schuldet Werkant die Zustellung, und ein
  -- Rueckstand ist ein Rechtsproblem, kein Komfortproblem.
  pflicht boolean not null default false,

  erstellt_am   timestamptz not null default now(),
  gelesen_am    timestamptz,
  zugestellt_am timestamptz,
  zustellweg    text
);

-- Ein Vorgang, eine Mitteilung. Ohne das erzeugt ein wiederholter Trigger-Lauf
-- (oder ein zweiter Aufruf nach einem Abbruch) eine zweite Zeile, und der
-- Rueckstand im health-Endpunkt zaehlt Gespenster.
create unique index if not exists uq_notifications_quelle
  on public.notifications (quelle_tabelle, quelle_id, art)
  where quelle_id is not null;

create index if not exists idx_notifications_empfaenger
  on public.notifications (empfaenger, erstellt_am desc);

-- Der Index, an dem der Rueckstand gemessen wird.
create index if not exists idx_notifications_unzugestellt
  on public.notifications (erstellt_am)
  where pflicht and zugestellt_am is null;

alter table public.notifications enable row level security;

-- Lesen: nur die eigenen.
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select using (empfaenger = auth.uid());

-- KEINE update-Policy, und das ist Absicht. Duerfte der Empfaenger die Zeile
-- aendern, koennte er `zugestellt_am` selbst setzen und damit den Nachweis
-- loeschen, dass Werkant die Zustellung schuldet. Gelesen-Markieren laeuft
-- ueber benachrichtigung_gelesen() weiter unten, das NUR diese eine Spalte
-- anfasst.
--
-- KEINE insert-Policy: Mitteilungen entstehen ausschliesslich in Triggern und
-- in SECURITY-DEFINER-Funktionen.

comment on table public.notifications is
  'Was einem Nutzer zugestellt werden muss. Pflichtmitteilungen (Strike, DSA-Beschraenkung) entstehen per Trigger in derselben Transaktion wie der Vorgang: einen Strike ohne Mitteilung darf es nicht geben koennen.';

-- ── Anlegen ────────────────────────────────────────────────────────────────
create or replace function public.benachrichtigung_anlegen(
  p_empfaenger uuid,
  p_art        text,
  p_titel      text,
  p_text       text,
  p_route      text default null,
  p_quelle_tabelle text default null,
  p_quelle_id  uuid default null,
  p_pflicht    boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.notifications (
    empfaenger, art, titel, text, route, quelle_tabelle, quelle_id, pflicht
  ) values (
    p_empfaenger, p_art, p_titel, p_text, p_route, p_quelle_tabelle, p_quelle_id, p_pflicht
  )
  -- Zweiter Lauf desselben Vorgangs aendert nichts und scheitert nicht.
  on conflict do nothing
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.benachrichtigung_anlegen(uuid, text, text, text, text, text, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.benachrichtigung_anlegen(uuid, text, text, text, text, text, uuid, boolean)
  to service_role;

-- ── Gelesen markieren ──────────────────────────────────────────────────────
-- Eine eigene Funktion statt einer update-Policy, damit ausschliesslich
-- `gelesen_am` beschreibbar ist. Siehe Begruendung an der Tabelle.
create or replace function public.benachrichtigung_gelesen(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notifications
     set gelesen_am = coalesce(gelesen_am, now())
   where id = p_id
     -- SECURITY DEFINER heisst: die Policy der Tabelle greift hier NICHT.
     -- Ohne diese Zeile markierte jeder Angemeldete fremde Mitteilungen.
     and empfaenger = auth.uid();
end;
$$;

revoke execute on function public.benachrichtigung_gelesen(uuid) from public, anon;
grant execute on function public.benachrichtigung_gelesen(uuid) to authenticated;

-- ── Begruendungstext, ohne Eigentuemerpruefung ─────────────────────────────
-- Herausgezogen aus beschraenkung_begruendung (0810), damit der Trigger
-- denselben Wortlaut verwendet wie die Anzeige. Zwei Textfassungen derselben
-- Begruendung waeren im Streitfall das Gegenteil eines Nachweises.
--
-- Diese Fassung prueft NICHT, wer fragt, und ist deshalb fuer niemanden
-- ausfuehrbar ausser dem Eigentuemer (Trigger) und service_role.
create or replace function public.beschraenkung_begruendung_text(p_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select
    'Begründung zu einer Maßnahme auf Werkant' || E'\n'
    || 'Vorgangsnummer: ' || b.id::text || E'\n'
    || 'Datum: ' || to_char(b.erteilt_am at time zone 'Europe/Berlin', 'DD.MM.YYYY HH24:MI') || ' Uhr' || E'\n\n'
    || '1. Art der Maßnahme' || E'\n'
    || case b.art
         when 'inhalt_entfernt'     then 'Ein von Ihnen eingestellter Inhalt wurde entfernt.'
         when 'inhalt_gesperrt'     then 'Ein von Ihnen eingestellter Inhalt wurde gesperrt.'
         when 'inhalt_herabgestuft' then 'Ein von Ihnen eingestellter Inhalt wird weniger sichtbar angezeigt.'
         when 'konto_gesperrt'      then 'Ihr Konto wurde gesperrt.'
         when 'konto_beendet'       then 'Ihr Konto wurde beendet.'
         when 'auszahlung_gesperrt' then 'Auszahlungen an Sie wurden ausgesetzt.'
       end || E'\n'
    || b.raeumlicher_umfang || E'\n'
    || 'Dauer: ' || b.dauer || E'\n\n'
    || '2. Tatsachen und Umstände' || E'\n'
    || b.tatsachen || E'\n'
    || case b.ausloeser
         when 'meldung'               then 'Grundlage war eine Meldung, die uns zugegangen ist.'
         when 'eigene_feststellung'   then 'Wir haben den Sachverhalt selbst festgestellt.'
         when 'behoerdliche_anordnung' then 'Grundlage war eine behördliche oder gerichtliche Anordnung.'
       end || E'\n'
    || case when b.automatisiert
         then 'Bei der Feststellung wurden automatisierte Mittel eingesetzt.'
         else 'Die Entscheidung wurde von einem Menschen getroffen; automatisierte Mittel wurden nicht eingesetzt.'
       end || E'\n\n'
    || case b.grundlage_art
         when 'rechtswidrig' then '3. Rechtsgrundlage' || E'\n' ||
              'Der Inhalt ist nach unserer Einschätzung rechtswidrig. Grundlage: '
         else '3. Vertragliche Grundlage' || E'\n' ||
              'Der Inhalt oder das Verhalten verstößt gegen unsere Allgemeinen Geschäftsbedingungen. Grundlage: '
       end || b.grundlage || E'\n\n'
    || '4. Was Sie tun können' || E'\n'
    || b.rechtsbehelf
  from public.beschraenkungen b
  where b.id = p_id;
$$;

revoke execute on function public.beschraenkung_begruendung_text(uuid)
  from public, anon, authenticated;
grant execute on function public.beschraenkung_begruendung_text(uuid) to service_role;

-- Die oeffentliche Fassung benutzt jetzt dieselbe Quelle und behaelt ihre
-- Eigentuemerpruefung. Der zweite Zweig ist NICHT redundant: SECURITY DEFINER
-- setzt die RLS-Policy der Tabelle ausser Kraft.
create or replace function public.beschraenkung_begruendung(p_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select public.beschraenkung_begruendung_text(b.id)
    from public.beschraenkungen b
   where b.id = p_id
     and b.betroffener = auth.uid();
$$;

grant execute on function public.beschraenkung_begruendung(uuid) to authenticated;

-- ── Trigger: Strike ────────────────────────────────────────────────────────
create or replace function public.strike_benachrichtigen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.benachrichtigung_anlegen(
    new.provider_id,
    'strike',
    'Verstoß gegen die Nutzungsbedingungen',
    new.begruendung,
    '/betrieb/dashboard',
    'provider_strikes',
    new.id,
    true
  );
  return new;
end;
$$;

drop trigger if exists trg_strike_benachrichtigen on public.provider_strikes;
create trigger trg_strike_benachrichtigen
  after insert on public.provider_strikes
  for each row execute function public.strike_benachrichtigen();

-- ── Trigger: DSA-Beschraenkung ─────────────────────────────────────────────
create or replace function public.beschraenkung_benachrichtigen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.benachrichtigung_anlegen(
    new.betroffener,
    'beschraenkung',
    'Maßnahme zu Ihrem Konto oder Inhalt',
    public.beschraenkung_begruendung_text(new.id),
    '/einstellungen',
    'beschraenkungen',
    new.id,
    true
  );
  return new;
end;
$$;

drop trigger if exists trg_beschraenkung_benachrichtigen on public.beschraenkungen;
create trigger trg_beschraenkung_benachrichtigen
  after insert on public.beschraenkungen
  for each row execute function public.beschraenkung_benachrichtigen();

-- ── Rueckstand sichtbar machen ─────────────────────────────────────────────
-- Dieselbe Bauart wie abnahme_lauf_status (0850): gemessen wird, ob die
-- Zustellung WIRKT, nicht ob ein Versender existiert.
-- Der Rueckgabetyp waechst spaeter (0880 nimmt zeitplan_vorhanden dazu).
-- Ohne den drop scheitert ein zweiter Lauf dieser Datei mit
-- "cannot change return type of existing function" — genau so gefunden
-- durch den Pflicht-Wiederholungslauf in scripts/db-test/run.sh.
drop function if exists public.zustellung_status();

create or replace function public.zustellung_status()
returns table (
  offene_pflichtmitteilungen integer,
  aelteste_offene_stunden    integer,
  stau                       boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*)::integer,
    coalesce(max(extract(epoch from now() - n.erstellt_am) / 3600)::integer, 0),
    -- 24 Stunden: eine Pflichtmitteilung, die laenger als einen Tag
    -- unzugestellt liegt, ist ein Rechtsproblem. Kuerzer waere Rauschen,
    -- laenger waere Nachsicht mit sich selbst.
    count(*) > 0 and coalesce(max(extract(epoch from now() - n.erstellt_am) / 3600), 0) >= 24
  from public.notifications n
  where n.pflicht and n.zugestellt_am is null;
$$;

revoke execute on function public.zustellung_status() from public, anon, authenticated;
grant execute on function public.zustellung_status() to service_role;

comment on function public.zustellung_status() is
  'Betriebs-Selbstauskunft: liegen Pflichtmitteilungen (Strike, DSA-Beschraenkung) unzugestellt herum? Art. 17 DSA und AGB §7(4) schulden die Uebermittlung, nicht nur den Text.';

-- ── Der Versandweg ─────────────────────────────────────────────────────────
-- Holt die offenen Pflichtmitteilungen samt Empfaengeradresse. Nur
-- service_role: die Adressen anderer Nutzer gehen niemanden sonst etwas an.
create or replace function public.unzugestellte_pflichtmitteilungen(p_limit integer default 50)
returns table (
  id uuid,
  empfaenger uuid,
  email text,
  art text,
  titel text,
  text text,
  quelle_tabelle text,
  quelle_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select n.id, n.empfaenger, p.email, n.art, n.titel, n.text,
         n.quelle_tabelle, n.quelle_id
    from public.notifications n
    join public.profiles p on p.id = n.empfaenger
   where n.pflicht
     and n.zugestellt_am is null
     -- Ohne Adresse ist nichts zu versenden. Die Zeile bleibt offen und
     -- taucht weiter im Rueckstand auf, statt still als erledigt zu gelten.
     and p.email is not null
     and btrim(p.email) <> ''
   order by n.erstellt_am
   limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

revoke execute on function public.unzugestellte_pflichtmitteilungen(integer)
  from public, anon, authenticated;
grant execute on function public.unzugestellte_pflichtmitteilungen(integer) to service_role;

-- Quittiert die Zustellung an EINER Stelle: in der Mitteilung und im
-- Ursprungsvorgang. Getrennt zu quittieren hiesse, dass die beiden
-- auseinanderlaufen koennen, und dann ist keiner von beiden ein Nachweis.
create or replace function public.zustellung_quittieren(p_id uuid, p_weg text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_n public.notifications%rowtype;
begin
  update public.notifications
     set zugestellt_am = coalesce(zugestellt_am, now()),
         zustellweg    = coalesce(zustellweg, btrim(p_weg))
   where id = p_id
  returning * into v_n;

  if not found then
    raise exception 'Mitteilung % nicht gefunden', p_id;
  end if;

  -- Den Ursprungsvorgang mitfuehren, damit strike_zustellung_vermerken und
  -- beschraenkung_zustellung_vermerken nicht laenger ungenutzt herumliegen.
  if v_n.quelle_tabelle = 'provider_strikes' and v_n.quelle_id is not null then
    update public.provider_strikes
       set begruendung_zugestellt_am = coalesce(begruendung_zugestellt_am, now()),
           zustellweg                = coalesce(zustellweg, btrim(p_weg))
     where id = v_n.quelle_id;
  elsif v_n.quelle_tabelle = 'beschraenkungen' and v_n.quelle_id is not null then
    update public.beschraenkungen
       set zugestellt_am = coalesce(zugestellt_am, now()),
           zustellweg    = coalesce(zustellweg, btrim(p_weg))
     where id = v_n.quelle_id;
  end if;
end;
$$;

revoke execute on function public.zustellung_quittieren(uuid, text)
  from public, anon, authenticated;
grant execute on function public.zustellung_quittieren(uuid, text) to service_role;

comment on function public.zustellung_quittieren(uuid, text) is
  'Quittiert die Zustellung in der Mitteilung UND im Ursprungsvorgang. Getrennt quittiert koennten beide auseinanderlaufen, und dann ist keiner ein Nachweis.';
