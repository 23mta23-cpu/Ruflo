-- 0750: Ein Strike von Hand ist heute ein halber Vorgang — das wird behoben
--
-- ANLASS: 0720 hat die Strike-Akte gebaut und alle vier Verstoßgründe aus
-- AGB §7(2) in der Spalte `grund` abgebildet. Vergeben wird automatisch aber
-- weiterhin nur einer (Kontaktdaten-Umgehung). Für die drei anderen stand in
-- der Warteschlange: „hat eine Spalte, aber kein Werkzeug zum Auslösen".
--
-- Beim Nachsehen, was ein Strike von Hand heute tatsächlich bewirkt, kamen
-- drei Lücken heraus — jede davon lässt den Vorgang aussehen wie erledigt:
--
-- 1) `provider_profiles.strike_count` bleibt stehen.
--    `recompute_strike_count()` wird NUR von `apply_leak_strikes` gerufen. Wer
--    von Hand eine Zeile in `provider_strikes` einträgt, ändert die Akte —
--    die angezeigte Zahl im Betriebs-Dashboard bleibt auf dem alten Stand.
--    Die Sperre selbst greift korrekt (die Policy fragt `aktive_strikes()`),
--    der Anbieter sieht also eine Null und kann trotzdem nicht mehr bieten.
--    Dasselbe umgekehrt bei einer Aufhebung nach §7(5).
--
-- 2) Die Begründung ist erzwungen, aber nicht vollständig.
--    Der CHECK verlangt 20 Zeichen. Art. 4 P2B-VO verlangt „die maßgeblichen
--    Tatsachen ODER Umstände UND den einschlägigen Grund" — dazu kommen aus
--    unseren eigenen AGB die Frist (§7(3)) und der Beschwerdeweg (§7(5)).
--    Zwanzig Zeichen freier Text erfüllen das nicht, und im Streitfall ist
--    eine unvollständige Begründung so gut wie keine.
--
-- 3) Zustellung ist nirgends festgehalten.
--    §7(4) schuldet die Begründung „per E-Mail (dauerhafter Datenträger)",
--    spätestens zum Zeitpunkt der Maßnahme. Ob das je geschehen ist, stand
--    nirgends. Das ist dieselbe Klasse wie die Widerrufs-Zustimmung, die im
--    `useState` lag (0710): ein Nachweis, den es im Streitfall nicht gibt.
--
-- Diese Migration macht aus dem rohen INSERT einen vollständigen Vorgang.
-- Sie ändert NICHTS an der Sanktionslogik: Schwelle, Frist und Automatik
-- bleiben wie in 0720.

-- ── 1) Der Zähler folgt der Akte, egal auf welchem Weg ──────────────────────
-- Bewusst ein Trigger und kein weiterer Aufruf in jeder schreibenden Funktion:
-- ein Aufruf, den man vergessen kann, wird irgendwann vergessen — und dann
-- zeigt die App eine Zahl, die nicht stimmt, ohne dass etwas rot wird.
create or replace function public.strike_akte_zaehler_nachfuehren()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Bei DELETE (auch aus dem `on delete cascade` des Profils) steht die
  -- Anbieter-ID nur in OLD. Ist das Profil selbst gerade weg, trifft das
  -- UPDATE null Zeilen — das ist der gewünschte Ausgang, kein Fehler.
  perform public.recompute_strike_count(coalesce(new.provider_id, old.provider_id));
  return null;
end;
$$;

drop trigger if exists trg_strike_akte_zaehler on public.provider_strikes;
create trigger trg_strike_akte_zaehler
  after insert or update or delete on public.provider_strikes
  for each row execute function public.strike_akte_zaehler_nachfuehren();

-- ── 2) Nachweis der Zustellung (AGB §7(4) / Art. 4 P2B-VO) ─────────────────
alter table public.provider_strikes
  add column if not exists begruendung_zugestellt_am timestamptz,
  add column if not exists zustellweg                text;

comment on column public.provider_strikes.begruendung_zugestellt_am is
  'Wann die Begruendung dem Anbieter auf einem dauerhaften Datentraeger '
  'zugegangen ist (AGB §7(4), Art. 4 P2B-VO). NULL heisst: noch nicht '
  'zugestellt — die Massnahme ist dann formal unvollstaendig.';

-- ── 3) Das Werkzeug ────────────────────────────────────────────────────────
-- Die Begründung wird aus einem festen Gerüst und den eingegebenen Tatsachen
-- zusammengesetzt. Grund, Frist und Beschwerdeweg kann der Bedienende damit
-- nicht vergessen; einzugeben sind nur die Tatsachen, die nur er kennt.
create or replace function public.strike_erteilen(
  p_provider  uuid,
  p_grund     text,
  p_tatsachen text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grundtext  text;
  v_verfaellt  timestamptz := now() + interval '12 months';
  v_id         uuid;
begin
  if not exists (select 1 from public.provider_profiles where id = p_provider) then
    raise exception 'Kein Anbieterprofil mit der ID % — Strikes gibt es nur fuer Anbieter.', p_provider;
  end if;

  -- Wortlaut aus AGB §7(2) bzw. §7(1), nicht neu formuliert: der Anbieter muss
  -- den genannten Grund in den veroeffentlichten AGB wiederfinden koennen.
  v_grundtext := case p_grund
    when 'preiserhoehung'        then 'Preiserhoehungen nach Vertragsabschluss (AGB §7(2))'
    when 'nichterscheinen'       then 'Nichterscheinen ohne Stornierung (AGB §7(2))'
    when 'kontaktdaten_umgehung' then 'Beauftragung ausserhalb der Plattform, Umgehung der Gebuehr (AGB §7(2))'
    when 'falsche_angaben'       then 'Falsche Angaben oder gefaelschte Qualifikationsnachweise (AGB §7(2))'
    when 'sonstiges'             then 'Verstoss gegen die AGB oder gegen Treu und Glauben, §242 BGB (AGB §7(1))'
    else null
  end;
  if v_grundtext is null then
    raise exception 'Unbekannter Grund %. Zulaessig: preiserhoehung, nichterscheinen, kontaktdaten_umgehung, falsche_angaben, sonstiges.', p_grund;
  end if;

  -- Untergrenze deutlich ueber dem CHECK der Spalte (20). Der CHECK verhindert
  -- ein leeres Feld; er verhindert nicht "Verstoss". Art. 4 P2B-VO verlangt
  -- die massgeblichen TATSACHEN, und die brauchen mehr als einen Halbsatz.
  if p_tatsachen is null or char_length(btrim(p_tatsachen)) < 40 then
    raise exception 'Die Tatsachen muessen mindestens 40 Zeichen umfassen (was ist wann passiert, woraus ergibt es sich). Art. 4 P2B-VO verlangt die massgeblichen Tatsachen, nicht nur das Ergebnis.';
  end if;
  if char_length(btrim(p_tatsachen)) > 1200 then
    raise exception 'Die Tatsachen sind laenger als 1200 Zeichen. Kuerzen — die Begruendung soll lesbar sein.';
  end if;

  insert into public.provider_strikes (provider_id, grund, begruendung, verfaellt_am)
  values (
    p_provider,
    p_grund,
    'Massgeblicher Grund: ' || v_grundtext || E'.\n\n'
    || 'Massgebliche Tatsachen: ' || btrim(p_tatsachen) || E'\n\n'
    -- Das Datum kommt aus DERSELBEN Variable wie die Spalte. Zwei getrennt
    -- gerechnete Daten koennen auseinanderlaufen, und dann widerspricht die
    -- Begruendung der Akte.
    || 'Dieser Strike verfaellt am ' || to_char(v_verfaellt, 'DD.MM.YYYY')
    || '. Drei aktive Strikes innerhalb von 12 Monaten fuehren nach AGB §7(3) '
    || E'zur dauerhaften Sperrung.\n\n'
    || 'Sie koennen dieser Massnahme nach AGB §7(5) jederzeit widersprechen: '
    || 'kontakt@werkant.de. Werkant prueft jede Beschwerde zeitnah und hebt '
    || 'die Massnahme auf, wenn sie sich als unbegruendet erweist.',
    v_verfaellt
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.strike_erteilen is
  'Vergibt einen Strike mit vollstaendiger Begruendung (Grund, Tatsachen, '
  'Frist, Beschwerdeweg). Ablauf: docs/betrieb/strike-erteilen.md. Die '
  'Zustellung ist damit NICHT erledigt — dafuer strike_zustellung_vermerken().';

-- Aufhebung nach Beschwerde, AGB §7(5). Bewusst KEIN delete: dass eine
-- Beschwerde Erfolg hatte, ist selbst Teil der Akte. Ein geloeschter Strike
-- liesse sich spaeter weder belegen noch erklaeren.
create or replace function public.strike_aufheben(
  p_strike uuid,
  p_grund  text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_betroffen integer;
begin
  if p_grund is null or char_length(btrim(p_grund)) < 20 then
    raise exception 'Die Aufhebung braucht einen Grund (mindestens 20 Zeichen).';
  end if;

  update public.provider_strikes
     set aufgehoben_am    = now(),
         aufgehoben_grund = btrim(p_grund)
   where id = p_strike
     and aufgehoben_am is null;
  get diagnostics v_betroffen = row_count;

  if v_betroffen = 0 then
    raise exception 'Kein offener Strike mit der ID % (nicht vorhanden oder bereits aufgehoben).', p_strike;
  end if;
end;
$$;

-- Zustellung festhalten. Solange RESEND_API_KEY fehlt, versendet die Plattform
-- gar keine Mail — die Begruendung geht dann von Hand hinaus, und genau dann
-- ist ein Vermerk der einzige Nachweis, den es gibt.
create or replace function public.strike_zustellung_vermerken(
  p_strike uuid,
  p_weg    text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_betroffen integer;
begin
  if p_weg is null or char_length(btrim(p_weg)) < 5 then
    raise exception 'Der Zustellweg muss benannt sein (z. B. "E-Mail an anbieter@example.de am 21.08.2026").';
  end if;

  update public.provider_strikes
     set begruendung_zugestellt_am = coalesce(begruendung_zugestellt_am, now()),
         zustellweg                = btrim(p_weg)
   where id = p_strike;
  get diagnostics v_betroffen = row_count;

  if v_betroffen = 0 then
    raise exception 'Kein Strike mit der ID %.', p_strike;
  end if;
end;
$$;

-- ── Zugriff ────────────────────────────────────────────────────────────────
-- Ausdrücklich entzogen, nicht nur „nicht erteilt": `security definer` läuft
-- als Eigentümer, und eine versehentlich ausführbare Funktion wäre damit ein
-- Weg für jeden Angemeldeten, sich selbst oder einen Mitbewerber zu sperren.
revoke all on function public.strike_erteilen(uuid, text, text)         from public, anon, authenticated;
revoke all on function public.strike_aufheben(uuid, text)               from public, anon, authenticated;
revoke all on function public.strike_zustellung_vermerken(uuid, text)   from public, anon, authenticated;

-- Bestand einmal angleichen: Akten, die vor dieser Migration von Hand
-- eingetragen wurden, haben den Zähler nie nachgeführt.
update public.provider_profiles set updated_at = updated_at
 where strike_count <> public.aktive_strikes(id);
