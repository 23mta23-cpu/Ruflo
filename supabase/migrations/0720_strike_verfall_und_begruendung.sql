-- 0720: Strikes verfallen nach 12 Monaten und tragen eine Begründung
--
-- ANLASS: Der Founder fragte, wie Airbnb mit Verstößen umgeht, und ob sich
-- davon etwas übertragen lässt. Beim Vergleich fiel auf, dass Werkant gar
-- nicht bei Airbnb abschauen muss — es muss erst einmal die eigenen AGB
-- einhalten. Der Code widerspricht ihnen an drei Stellen.
--
-- AGB §7(3): „3 Strikes INNERHALB VON 12 MONATEN führen zur dauerhaften
--            Sperrung."
--   Code bis heute (0500):
--     select count(*) from chat_leak_flags where sender_id = X;   -- ohne Datum
--     set strike_count = greatest(strike_count, v_target)          -- nie weniger
--   Gezählt wurde also über die GESAMTE Kontodauer, und `greatest` sorgt
--   dafür, dass ein Strike nie wieder verschwindet. Ein Anbieter mit einem
--   Fund pro Jahr wird nach neun Jahren gesperrt — obwohl die AGB ihm ein
--   Zwölf-Monats-Fenster zusagen. Das ist kein Härtefall, das ist der
--   Normalfall bei langer Zugehörigkeit: je treuer der Anbieter, desto eher
--   trifft es ihn.
--
-- AGB §7(4): „Wird das Konto eines gewerblichen Anbieters eingeschränkt […],
--            erhält der Anbieter spätestens zum Zeitpunkt der Maßnahme eine
--            BEGRÜNDUNG mit den maßgeblichen Tatsachen […] per E-Mail."
--   Das ist keine Selbstverpflichtung, sondern Art. 4 der P2B-Verordnung
--   (EU) 2019/1150 — unmittelbar geltendes Recht für Plattformen gegenüber
--   gewerblichen Nutzern. Gespeichert war bisher eine EINZELNE ZAHL. Aus
--   einem Integer lässt sich keine Begründung erzeugen: es gab weder einen
--   Zeitpunkt noch einen Anlass noch einen Bezug zum auslösenden Vorgang.
--   Die Pflicht war technisch nicht erfüllbar.
--
-- AGB §7(2) nennt vier Gründe (Preiserhöhung nach Vertragsschluss,
--   Nichterscheinen, Beauftragung außerhalb der Plattform, falsche Angaben).
--   Automatisch vergeben wurde nur der dritte. Die Tabelle bildet jetzt alle
--   vier ab, damit ein manuell gesetzter Strike denselben Weg nimmt und
--   dieselbe Begründung trägt.
--
-- Was aus dem Airbnb-Vergleich NICHT übernommen wird, steht in
-- notes/04-Entscheidungen/2026-08-16-strikes-airbnb-vergleich.md.

-- ── Die Strike-Akte ──────────────────────────────────────────────────────────
create table if not exists public.provider_strikes (
  id           uuid primary key default gen_random_uuid(),
  provider_id  uuid not null references public.provider_profiles(id) on delete cascade,
  grund        text not null check (grund in (
                 'kontaktdaten_umgehung',   -- §7(2) Spiegelstrich 3
                 'preiserhoehung',          -- §7(2) Spiegelstrich 1
                 'nichterscheinen',         -- §7(2) Spiegelstrich 2
                 'falsche_angaben',         -- §7(2) Spiegelstrich 4
                 'sonstiges')),
  -- Der Text, der dem Anbieter zugeht. Pflicht, nicht optional: ohne ihn ist
  -- Art. 4 P2B-VO nicht erfüllt, und ein Strike ohne Begründung ist auch
  -- schlicht nicht überprüfbar.
  begruendung  text not null check (char_length(begruendung) between 20 and 2000),
  erteilt_am   timestamptz not null default now(),
  -- Verfallsdatum ausdrücklich als Spalte, nicht nur gerechnet: verlängert
  -- oder verkürzt die Plattform später die Frist, darf das nicht rückwirkend
  -- Strikes wieder aufleben lassen, die dem Anbieter gegenüber schon als
  -- verfallen galten.
  verfaellt_am timestamptz not null default (now() + interval '12 months'),
  -- Aufhebung nach Beschwerde (AGB §7(5)).
  aufgehoben_am    timestamptz,
  aufgehoben_grund text
);

create index if not exists idx_provider_strikes_provider
  on public.provider_strikes(provider_id);

comment on table public.provider_strikes is
  'Eine Zeile je Strike, mit Anlass, Begruendung und Verfallsdatum. '
  'provider_profiles.strike_count ist nur noch eine Anzeige-Zwischengroesse; '
  'massgeblich ist aktive_strikes().';

alter table public.provider_strikes enable row level security;

-- Lesen: der Anbieter sieht SEINE Strikes. Er muss sie sehen koennen — sonst
-- kann er weder verstehen, warum er eingeschraenkt ist, noch nach §7(5)
-- Beschwerde einlegen. Kein Lesezugriff fuer andere: der Strike-Stand eines
-- Anbieters geht Kunden nichts an.
drop policy if exists provider_strikes_select_own on public.provider_strikes;
create policy provider_strikes_select_own on public.provider_strikes
  for select using (auth.uid() = provider_id);

-- Kein insert/update/delete fuer Clients. Strikes vergibt das System bzw. die
-- Nachpruefung, nicht der Betroffene.
grant select on public.provider_strikes to authenticated;

-- ── Massgebliche Groesse: aktive Strikes ────────────────────────────────────
-- „Aktiv" = erteilt, noch nicht verfallen, nicht aufgehoben. Genau das, was
-- AGB §7(3) mit „innerhalb von 12 Monaten" meint.
create or replace function public.aktive_strikes(p_provider uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer
  from public.provider_strikes
  where provider_id = p_provider
    and aufgehoben_am is null
    and verfaellt_am > now();
$$;

grant execute on function public.aktive_strikes(uuid) to authenticated;

-- ── Anzeige-Zwischengroesse nachfuehren ─────────────────────────────────────
create or replace function public.recompute_strike_count(p_provider uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.provider_profiles
     set strike_count = public.aktive_strikes(p_provider),
         updated_at   = now()
   where id = p_provider;
end;
$$;

-- ── Leak-Funde → Strike, jetzt mit Fenster und Begruendung ──────────────────
-- Unveraendert: erst die Haeufung sanktioniert (drei Funde = ein Strike), ein
-- Einzeltreffer nie (0340: ein Regex-Treffer ist kein Beweis).
-- Neu: nur Funde der letzten 12 Monate zaehlen, und jeder Strike traegt eine
-- Begruendung mit den massgeblichen Tatsachen.
create or replace function apply_leak_strikes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_funde       integer;
  v_soll        integer;
  v_vorhanden   integer;
  v_begruendung text;
begin
  -- Nur Anbieter tragen Strikes; Kunden (Stripe-identifiziert) nicht.
  if not exists (select 1 from public.provider_profiles where id = new.sender_id) then
    return new;
  end if;

  -- HIER lag der Verstoss gegen §7(3): vorher ohne jede Datumsgrenze.
  select count(*) into v_funde
  from public.chat_leak_flags
  where sender_id = new.sender_id
    and created_at > now() - interval '12 months';

  v_soll := floor(v_funde / 3.0);   -- FLAGS_PER_STRIKE = 3

  -- Wie viele Strikes aus DIESEM Anlass gibt es schon (aufgehobene nicht
  -- mitgezaehlt: eine erfolgreiche Beschwerde darf nicht dazu fuehren, dass
  -- der naechste Fund den Strike sofort wieder herstellt).
  select count(*) into v_vorhanden
  from public.provider_strikes
  where provider_id = new.sender_id
    and grund = 'kontaktdaten_umgehung'
    and aufgehoben_am is null
    and verfaellt_am > now();

  if v_soll > v_vorhanden then
    v_begruendung :=
      'In den letzten 12 Monaten wurden in Ihren Chat-Nachrichten '
      || v_funde || ' Mal Kontakt- oder Zahlungsdaten erkannt (zuletzt am '
      || to_char(new.created_at, 'DD.MM.YYYY')
      || '). Nach AGB §7(2) gilt die Beauftragung ausserhalb der Plattform als '
      || 'Verstoss; je drei Feststellungen wird ein Strike vergeben. '
      || 'Dieser Strike verfaellt am '
      || to_char(now() + interval '12 months', 'DD.MM.YYYY')
      || '. Sie koennen nach AGB §7(5) jederzeit Beschwerde an '
      || 'kontakt@werkant.de richten.';

    insert into public.provider_strikes (provider_id, grund, begruendung)
    values (new.sender_id, 'kontaktdaten_umgehung', v_begruendung);

    perform public.recompute_strike_count(new.sender_id);
  end if;

  return new;
end;
$$;

-- ── Sperre auf aktive Strikes umstellen ─────────────────────────────────────
-- Die Policy las `provider_profiles.strike_count`. Diese Spalte wird nur beim
-- Erteilen nachgefuehrt — ein Strike, der durch blossen Zeitablauf verfaellt,
-- loest gar nichts aus, und die Sperre bliebe stehen. Deshalb fragt die Policy
-- jetzt die massgebliche Groesse direkt ab. Alles Uebrige unveraendert
-- gegenueber 0580 (Eigen-Angebot-Sperre, Track-Trennung, E-Mail-Bestaetigung).
drop policy if exists "Provider creates offers on open jobs" on public.offers;
create policy "Provider creates offers on open jobs"
  on public.offers for insert
  with check (
    auth.uid() = provider_id
    and auth_email_confirmed()
    and public.aktive_strikes(auth.uid()) < 3
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

-- ── Bestand uebernehmen ─────────────────────────────────────────────────────
-- Fuer die bisherigen Zaehlerstaende gibt es keine Historie: weder Zeitpunkt
-- noch Anlass wurden je gespeichert. Beides laesst sich nicht rekonstruieren.
-- Im Zweifel zugunsten des Anbieters: die Frist laeuft ab HEUTE, nicht ab
-- einem geschaetzten Datum in der Vergangenheit. Die Begruendung sagt offen,
-- dass der Anlass nicht mehr feststellbar ist — eine erfundene Begruendung
-- waere schlimmer als eine ehrliche Luecke, gerade gegenueber Art. 4 P2B-VO.
do $$
declare r record; i integer;
begin
  for r in select id, strike_count from public.provider_profiles where strike_count > 0 loop
    -- Idempotent: nur uebernehmen, wenn fuer diesen Anbieter noch keine Akte
    -- existiert (sonst verdoppelt ein zweiter Migrationslauf den Bestand).
    if not exists (select 1 from public.provider_strikes where provider_id = r.id) then
      for i in 1..r.strike_count loop
        insert into public.provider_strikes (provider_id, grund, begruendung)
        values (
          r.id, 'sonstiges',
          'Uebernommen aus dem Zaehlerstand vor dem 16.08.2026. Der urspruengliche '
          || 'Anlass und der Zeitpunkt wurden damals nicht gespeichert und lassen '
          || 'sich nicht mehr feststellen. Die 12-Monats-Frist nach AGB §7(3) laeuft '
          || 'daher ab dem 16.08.2026. Bei Fragen oder Beschwerde: kontakt@werkant.de.'
        );
      end loop;
    end if;
  end loop;
end $$;

-- ── strike_count kann nicht mehr von Hand gesetzt werden ────────────────────
-- Die Spalte wird nur noch abgeleitet. Ohne diesen Trigger bliebe sie
-- beschreibbar, ohne zu wirken: wer sie im Supabase-Dashboard auf 3 setzt,
-- erwartet eine Sperre — die Policy fragt aber aktive_strikes() ab und findet
-- keine Akte. Das ist genau das Muster, das diese Sitzung sonst ueberall
-- aufgeraeumt hat: ein Bedienelement, das etwas verspricht und nichts tut.
-- Der Trigger setzt den Wert bei jedem Schreibvorgang auf die abgeleitete
-- Groesse zurueck. Wer einen Strike vergeben will, legt eine Zeile in
-- provider_strikes an — mit Begruendung, wie es AGB §7(4) verlangt.
create or replace function public.strike_count_ableiten()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.strike_count := public.aktive_strikes(new.id);
  return new;
end;
$$;

drop trigger if exists trg_strike_count_ableiten on public.provider_profiles;
create trigger trg_strike_count_ableiten
  before update on public.provider_profiles
  for each row execute function public.strike_count_ableiten();

-- Nach der Bestandsuebernahme einmal alle Zaehlerstaende angleichen.
update public.provider_profiles set updated_at = updated_at
 where strike_count <> public.aktive_strikes(id);

comment on column public.provider_profiles.strike_count is
  'NUR Anzeige-Zwischengroesse. Massgeblich ist aktive_strikes(), weil ein '
  'Strike durch blossen Zeitablauf verfaellt und dabei kein Schreibvorgang '
  'stattfindet, der diese Spalte nachfuehren koennte.';
