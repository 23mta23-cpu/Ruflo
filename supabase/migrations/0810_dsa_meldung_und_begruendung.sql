-- DSA (VO (EU) 2022/2065): Melde- und Abhilfeverfahren (Art. 16), Begründung
-- bei Beschränkungen (Art. 17), Verdacht auf Straftaten (Art. 18), Nutzerzahl
-- auf Anfrage (Art. 24 Abs. 3).
--
-- EINSTUFUNG (verifiziert 07.09.2026 gegen den Verordnungstext):
--   Werkant ist eine Online-Plattform: ein Hostingdienst, der Informationen im
--   Auftrag der Nutzer speichert UND öffentlich verbreitet (Anbieterprofile,
--   Aufträge, Bewertungen).
--   Art. 19 nimmt Kleinst- und Kleinunternehmen vom GESAMTEN Abschnitt 3
--   (Art. 19–28) aus — mit Ausnahme von Art. 24 Abs. 3.
--   Art. 29 nimmt sie von Abschnitt 4 (Art. 29–32) aus, also auch von der
--   Händler-Rückverfolgbarkeit.
--   Art. 15 Abs. 2 nimmt sie vom Transparenzbericht aus.
--   VERBINDLICH bleiben damit: Art. 11, 12, 14 (Abschnitt 1) sowie Art. 16, 17,
--   18 (Abschnitt 2) und Art. 24 Abs. 3.
--
-- ABGRENZUNG zu chat_reports (0700), ausdrücklich:
--   chat_reports ist Hausregel-Moderation im Chat — Kontaktdaten, Zahlung
--   außerhalb, Beleidigung, Spam. Fünf Gründe aus den AGB, nur Chat-Nachrichten,
--   nur aus dem Chat erreichbar, nur für angemeldete Beteiligte.
--   Art. 16 DSA verlangt etwas anderes: einen Weg für RECHTSWIDRIGE Inhalte, in
--   JEDER Inhaltsart, offen für „Personen und Einrichtungen" — also auch für
--   Menschen ohne Konto, die gar nicht Partei des Vorgangs sind.
--   Beides in eine Tabelle zu legen hätte zwei Verfahren erzeugt, die sich
--   gegenseitig verdecken. chat_reports bleibt unverändert.

-- ── Art. 16: Melde- und Abhilfeverfahren ───────────────────────────────────
-- Die Pflichtangaben einer Meldung stehen in Art. 16 Abs. 2 lit. a–d. Sie sind
-- hier NOT NULL, damit eine unvollständige Meldung gar nicht erst entsteht —
-- eine Meldung ohne Begründung oder ohne Fundstelle lässt sich nicht bearbeiten
-- und wäre nur ein Datensatz, der Bearbeitung vortäuscht.
create table if not exists public.inhalts_meldungen (
  id uuid primary key default gen_random_uuid(),

  -- Art. 16 Abs. 2 lit. b: genaue elektronische Fundstelle.
  inhalt_art text not null check (inhalt_art in
    ('auftrag', 'profil', 'nachricht', 'bewertung', 'nachweis', 'sonstiges')),
  inhalt_id uuid,
  fundstelle text not null
    check (char_length(btrim(fundstelle)) between 3 and 500),

  -- Art. 16 Abs. 2 lit. a: hinreichend begründete Erläuterung, WARUM der
  -- Inhalt rechtswidrig ist. Die Untergrenze ist kein Schikanewert: eine
  -- Meldung, die nur „ist illegal" sagt, erfüllt lit. a nicht und lässt sich
  -- nach Art. 16 Abs. 6 nicht sorgfältig prüfen.
  begruendung text not null
    check (char_length(btrim(begruendung)) between 30 and 5000),

  -- Art. 16 Abs. 2 lit. c: Name und E-Mail des Melders.
  -- ABSICHTLICH auch ohne Konto möglich (melder_id bleibt dann NULL):
  -- Art. 16 Abs. 1 richtet sich an „Personen und Einrichtungen", nicht an
  -- Nutzer. Ein Meldeweg, der ein Konto verlangt, ist keiner.
  melder_name  text not null check (char_length(btrim(melder_name)) between 2 and 120),
  melder_email text not null check (melder_email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]{2,}$'),
  melder_id    uuid references public.profiles(id) on delete set null,

  -- Art. 16 Abs. 2 lit. d: Erklärung in gutem Glauben. Muss wahr sein — eine
  -- Meldung ohne diese Erklärung ist nach lit. d unvollständig.
  treu_und_glauben boolean not null check (treu_und_glauben = true),

  -- Art. 18: Verdacht auf eine Straftat, die eine Gefahr für das Leben oder
  -- die Sicherheit einer Person begründet. Löst eine Pflicht gegenüber den
  -- Strafverfolgungsbehörden aus, deshalb ein eigenes Feld und nicht nur Prosa
  -- in der Begründung.
  straftat_verdacht boolean not null default false,

  eingegangen_am timestamptz not null default now(),

  -- Art. 16 Abs. 4: unverzügliche Eingangsbestätigung.
  bestaetigt_am timestamptz,

  -- Art. 16 Abs. 5: Entscheidung und Rechtsbehelfsbelehrung.
  entscheidung text check (entscheidung in
    ('entfernt', 'gesperrt', 'herabgestuft', 'keine_massnahme', 'weitergeleitet')),
  entschieden_am timestamptz,
  entscheidung_begruendung text,

  -- Art. 16 Abs. 6: ob automatisierte Mittel eingesetzt wurden. Steht auf
  -- false und bleibt es, solange Meldungen von Hand geprüft werden — die
  -- Angabe ist offenzulegen, nicht zu behaupten.
  automatisiert boolean not null default false,

  -- Art. 18: wann die Behörde unterrichtet wurde.
  behoerde_informiert_am timestamptz,

  constraint inhalts_meldungen_entscheidung_vollstaendig check (
    (entscheidung is null and entschieden_am is null)
    or (entscheidung is not null and entschieden_am is not null)
  )
);

create index if not exists idx_inhalts_meldungen_offen
  on public.inhalts_meldungen (eingegangen_am)
  where entscheidung is null;

create index if not exists idx_inhalts_meldungen_melder
  on public.inhalts_meldungen (melder_id)
  where melder_id is not null;

-- Art. 18 ist eine Frist gegen die Behörde, keine Sortierfrage: die offenen
-- Straftatsverdachte müssen sich in einem Griff finden lassen.
create index if not exists idx_inhalts_meldungen_straftat
  on public.inhalts_meldungen (eingegangen_am)
  where straftat_verdacht = true and behoerde_informiert_am is null;

alter table public.inhalts_meldungen enable row level security;

-- Geschrieben wird ausschließlich über die Edge Function (service_role), die
-- Rate-Limit und Eingabeprüfung durchsetzt. Kein Schreibrecht für anon oder
-- authenticated: ein anonym beschreibbarer Tisch wäre binnen Tagen voll Müll,
-- und Art. 16 Abs. 6 verlangt eine Bearbeitung, die dann niemand leisten kann.
drop policy if exists "melder liest eigene meldungen" on public.inhalts_meldungen;
create policy "melder liest eigene meldungen"
  on public.inhalts_meldungen for select
  to authenticated
  using (melder_id = auth.uid());

comment on table public.inhalts_meldungen is
  'Art. 16 DSA — Meldungen über mutmaßlich rechtswidrige Inhalte. Offen auch für Personen ohne Konto (melder_id NULL). Nicht zu verwechseln mit chat_reports (0700): das ist Hausregel-Moderation im Chat.';

-- ── Art. 17: Begründung bei jeder Beschränkung ─────────────────────────────
-- Art. 17 Abs. 1 gilt für JEDE Beschränkung gegenüber einem Nutzer, nicht nur
-- für Sperren: Entfernen, Sperren und Herabstufen von Inhalten, Aussetzen oder
-- Beenden des Dienstes, Aussetzen oder Beenden des Kontos.
--
-- Die Spalten bilden die Liste aus Art. 17 Abs. 3 lit. a–f ab. Sie sind NOT
-- NULL, weil eine Begründung, der ein Pflichtbestandteil fehlt, keine
-- Begründung im Sinne der Vorschrift ist — und weil genau das im Streitfall
-- geprüft wird.
create table if not exists public.beschraenkungen (
  id uuid primary key default gen_random_uuid(),
  betroffener uuid not null references public.profiles(id) on delete cascade,

  -- lit. a: Art der Beschränkung, räumlicher Umfang, Dauer.
  art text not null check (art in (
    'inhalt_entfernt', 'inhalt_gesperrt', 'inhalt_herabgestuft',
    'konto_gesperrt', 'konto_beendet', 'auszahlung_gesperrt')),
  raeumlicher_umfang text not null,
  dauer text not null check (char_length(btrim(dauer)) >= 3),

  -- lit. b: Tatsachen und Umstände, auf die sich die Entscheidung stützt.
  -- 40 Zeichen wie bei strike_erteilen (0750): der zusammengesetzte Text ist
  -- durch das Gerüst immer lang genug, geprüft werden muss der TATSACHENteil.
  tatsachen text not null check (char_length(btrim(tatsachen)) >= 40),

  -- lit. b: ob die Entscheidung auf einer Meldung oder auf eigener
  -- Feststellung beruht.
  ausloeser text not null check (ausloeser in
    ('meldung', 'eigene_feststellung', 'behoerdliche_anordnung')),
  meldung_id uuid references public.inhalts_meldungen(id) on delete set null,

  -- lit. c: ob automatisierte Mittel eingesetzt wurden.
  automatisiert boolean not null default false,

  -- lit. d ODER lit. e: Rechtsgrundlage (rechtswidriger Inhalt) oder
  -- Vertragsgrundlage (AGB-Verstoß), jeweils mit Begründung.
  grundlage_art text not null check (grundlage_art in ('rechtswidrig', 'agb')),
  grundlage text not null check (char_length(btrim(grundlage)) >= 10),

  -- lit. f: Rechtsbehelfe. Wird von beschraenkung_erteilen() gesetzt, nicht
  -- vom Aufrufer — sonst fehlt sie irgendwann.
  rechtsbehelf text not null,

  erteilt_am timestamptz not null default now(),
  -- Ob die Begründung je zugestellt wurde. Dieselbe Lehre wie bei den Strikes
  -- (0750) und der Widerrufs-Zustimmung (0710): ein Nachweis, der nur im
  -- Bildschirm steht, ist im Streitfall keiner.
  zugestellt_am timestamptz,
  zustellweg text,

  aufgehoben_am timestamptz,
  aufhebungsgrund text,

  constraint beschraenkungen_meldung_passt_zum_ausloeser check (
    (ausloeser = 'meldung' and meldung_id is not null)
    or (ausloeser <> 'meldung')
  ),
  constraint beschraenkungen_aufhebung_vollstaendig check (
    (aufgehoben_am is null and aufhebungsgrund is null)
    or (aufgehoben_am is not null and aufhebungsgrund is not null)
  )
);

create index if not exists idx_beschraenkungen_betroffener
  on public.beschraenkungen (betroffener, erteilt_am desc);

create index if not exists idx_beschraenkungen_unzugestellt
  on public.beschraenkungen (erteilt_am)
  where zugestellt_am is null;

alter table public.beschraenkungen enable row level security;

-- Der Betroffene MUSS seine Begründung lesen können — das ist der Zweck von
-- Art. 17. Schreiben kann niemand über die Tabelle: nur über die Funktion
-- unten, die die Pflichtbestandteile selbst setzt.
drop policy if exists "betroffener liest eigene beschraenkungen" on public.beschraenkungen;
create policy "betroffener liest eigene beschraenkungen"
  on public.beschraenkungen for select
  to authenticated
  using (betroffener = auth.uid());

comment on table public.beschraenkungen is
  'Art. 17 DSA — Begründung bei jeder Beschränkung. Spalten bilden Art. 17 Abs. 3 lit. a–f ab. Schreibzugriff nur über beschraenkung_erteilen().';

-- ── Beschränkung erteilen ──────────────────────────────────────────────────
-- Der Aufrufer übergibt die TATSACHEN. Räumlichen Umfang und
-- Rechtsbehelfsbelehrung setzt die Funktion — beide sind Pflichtbestandteile
-- (Art. 17 Abs. 3 lit. a und lit. f) und beide sind genau die Sorte Angabe, die
-- unter Zeitdruck vergessen wird.
--
-- Zum Rechtsbehelfstext, bewusst zurückhaltend: Art. 20 (internes
-- Beschwerdemanagement) und Art. 21 (außergerichtliche Streitbeilegung) stehen
-- in Abschnitt 3 und gelten für Kleinstunternehmen nach Art. 19 NICHT. Der Text
-- verspricht deshalb KEINE zertifizierte Streitbeilegungsstelle. Genannt wird,
-- was es tatsächlich gibt: der Beschwerdeweg aus AGB §7(5) und der Rechtsweg.
-- Ob Werkant an einer Verbraucherschlichtung nach VSBG teilnimmt, ist noch
-- nicht entschieden — bis dahin darf hier nichts anderes stehen.
create or replace function public.beschraenkung_erteilen(
  p_betroffener   uuid,
  p_art           text,
  p_dauer         text,
  p_tatsachen     text,
  p_grundlage_art text,
  p_grundlage     text,
  p_ausloeser     text default 'eigene_feststellung',
  p_meldung_id    uuid default null,
  p_automatisiert boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.beschraenkungen (
    betroffener, art, raeumlicher_umfang, dauer, tatsachen,
    ausloeser, meldung_id, automatisiert, grundlage_art, grundlage, rechtsbehelf
  ) values (
    p_betroffener,
    p_art,
    -- Werkant richtet sich an Nutzer in Deutschland; die Maßnahme wirkt für den
    -- gesamten Dienst. Art. 17 Abs. 3 lit. a verlangt die Angabe ausdrücklich.
    'Die Maßnahme gilt für den gesamten Dienst von Werkant und damit in allen '
      || 'Mitgliedstaaten der Europäischen Union, in denen der Dienst abrufbar ist.',
    p_dauer,
    p_tatsachen,
    p_ausloeser,
    p_meldung_id,
    p_automatisiert,
    p_grundlage_art,
    p_grundlage,
    'Sie können dieser Entscheidung widersprechen. Schreiben Sie dazu an '
      || 'kontakt@werkant.de und nennen Sie diese Vorgangsnummer. Wir prüfen '
      || 'den Widerspruch und antworten Ihnen begründet. '
      || 'Unabhängig davon steht Ihnen der Rechtsweg zu den ordentlichen '
      || 'Gerichten offen; Ihre Rechte als Verbraucher bleiben unberührt.'
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.beschraenkung_erteilen(uuid, text, text, text, text, text, text, uuid, boolean) is
  'Art. 17 DSA — erteilt eine Beschränkung und setzt räumlichen Umfang und Rechtsbehelfsbelehrung selbst. Nur für den Betreiber (service_role).';

-- ── Die Begründung als zusammenhängender Text ──────────────────────────────
-- Art. 17 Abs. 1 verlangt eine „klare und spezifische Begründung". Sie muss dem
-- Betroffenen ÜBERMITTELT werden — also als Text existieren, nicht nur als
-- neun Spalten, aus denen sich jemand später etwas zusammensetzen müsste.
-- Genau dieser Fehler steckte in den Strikes: gespeichert war ein Integer, aus
-- dem sich keine Begründung erzeugen ließ.
create or replace function public.beschraenkung_begruendung(p_id uuid)
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
  -- Der zweite Zweig ist NICHT redundant. SECURITY DEFINER heißt: die Funktion
  -- läuft mit den Rechten des Eigentümers und die RLS-Policy der Tabelle greift
  -- hier NICHT. Ohne ihn könnte jeder Angemeldete mit einer fremden
  -- Vorgangsnummer die Begründung eines anderen lesen — samt Tatsachenvortrag
  -- über dessen Verhalten.
  where b.id = p_id
    and b.betroffener = auth.uid();
$$;

comment on function public.beschraenkung_begruendung(uuid) is
  'Art. 17 DSA — setzt die Begründung aus den gespeicherten Pflichtbestandteilen zu einem übermittelbaren Text zusammen.';

-- ── Zustellung und Aufhebung ───────────────────────────────────────────────
create or replace function public.beschraenkung_zustellung_vermerken(
  p_id uuid,
  p_weg text
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.beschraenkungen
     set zugestellt_am = coalesce(zugestellt_am, now()),
         zustellweg    = coalesce(zustellweg, p_weg)
   where id = p_id;
$$;

create or replace function public.beschraenkung_aufheben(
  p_id    uuid,
  p_grund text
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.beschraenkungen
     set aufgehoben_am   = now(),
         aufhebungsgrund = p_grund
   where id = p_id
     and aufgehoben_am is null;
$$;

-- ── Art. 16 Abs. 4 und 5: Eingangsbestätigung und Entscheidung ─────────────
create or replace function public.meldung_bestaetigen(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.inhalts_meldungen
     set bestaetigt_am = coalesce(bestaetigt_am, now())
   where id = p_id;
$$;

create or replace function public.meldung_entscheiden(
  p_id          uuid,
  p_entscheidung text,
  p_begruendung  text
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.inhalts_meldungen
     set entscheidung             = p_entscheidung,
         entschieden_am           = now(),
         entscheidung_begruendung = p_begruendung
   where id = p_id
     and entscheidung is null;
$$;

-- ── Art. 24 Abs. 3: Nutzerzahl auf Anfrage ─────────────────────────────────
-- Art. 19 nimmt Kleinstunternehmen vom gesamten Abschnitt 3 aus — AUSSER von
-- Art. 24 Abs. 3. Die Zahl muss also nicht veröffentlicht werden (Abs. 2 ist
-- ausgenommen), aber dem Koordinator für digitale Dienste und der Kommission
-- auf Anfrage unverzüglich mitgeteilt werden können.
--
-- GRENZE, ausdrücklich: gezählt werden angemeldete Nutzer mit einer messbaren
-- Handlung. Anonyme Besucher der Webseite sind NICHT erfasst — dafür gäbe es
-- keine Datengrundlage ohne eine Reichweitenmessung, die es bewusst nicht gibt.
-- Wer die Zahl herausgibt, muss diese Grenze mitnennen; sie steht deshalb im
-- Kommentar der Funktion und nicht nur hier.
create or replace function public.aktive_nutzer_monat(p_monate int default 12)
returns table (monat date, aktive bigint)
language sql
stable
security definer
set search_path = public
as $$
  with handlungen as (
    select customer_id as nutzer, created_at from public.jobs
    union all
    select provider_id, created_at from public.offers
    union all
    select sender_id,   created_at from public.messages
  )
  select date_trunc('month', h.created_at at time zone 'Europe/Berlin')::date as monat,
         count(distinct h.nutzer) as aktive
    from handlungen h
   where h.nutzer is not null
     and h.created_at >= date_trunc('month', now() at time zone 'Europe/Berlin')
                         - make_interval(months => p_monate)
   group by 1
   order by 1 desc;
$$;

comment on function public.aktive_nutzer_monat(int) is
  'Art. 24 Abs. 3 DSA — durchschnittliche monatlich aktive Nutzer, auf Anfrage an den Koordinator für digitale Dienste und die Kommission. GRENZE: zählt angemeldete Nutzer mit Auftrag, Angebot oder Nachricht. Anonyme Besucher sind nicht erfasst; diese Grenze ist bei jeder Herausgabe mitzunennen.';

-- ── Rechte ────────────────────────────────────────────────────────────────
-- Alle Betreiberfunktionen sind für Nutzer gesperrt. Ohne diese Zeilen wäre
-- beispielsweise beschraenkung_aufheben() für jeden Angemeldeten aufrufbar —
-- SECURITY DEFINER heißt „läuft mit den Rechten des Eigentümers", nicht
-- „nur der Eigentümer darf sie rufen".
revoke all on function public.beschraenkung_erteilen(uuid, text, text, text, text, text, text, uuid, boolean) from public, anon, authenticated;
revoke all on function public.beschraenkung_zustellung_vermerken(uuid, text)   from public, anon, authenticated;
revoke all on function public.beschraenkung_aufheben(uuid, text)               from public, anon, authenticated;
revoke all on function public.meldung_bestaetigen(uuid)                        from public, anon, authenticated;
revoke all on function public.meldung_entscheiden(uuid, text, text)            from public, anon, authenticated;
revoke all on function public.aktive_nutzer_monat(int)                         from public, anon, authenticated;

-- Diese eine darf der Betroffene rufen: es ist SEINE Begründung. Die
-- Einschränkung darauf steckt in der Funktion selbst (`b.betroffener =
-- auth.uid()`), nicht in der Policy — die greift bei SECURITY DEFINER nicht.
-- Beim ersten Schreiben dieser Migration fehlte genau diese Zeile, und der
-- Kommentar behauptete den Schutz trotzdem. Geprüft in db-test DS-J.
revoke all on function public.beschraenkung_begruendung(uuid) from public, anon;
grant execute on function public.beschraenkung_begruendung(uuid) to authenticated;
