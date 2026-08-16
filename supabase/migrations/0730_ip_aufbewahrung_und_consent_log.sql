-- 0730: Zwei Zusagen der Datenschutzerklärung einlösen
--
-- ANLASS (16.08.2026): Nach dem AGB-Abgleich denselben Durchgang für die
-- Datenschutzerklärung gemacht. Sie nennt fünf Speicherdauern; zwei davon
-- entsprachen nicht der Wirklichkeit.
--
--   „IP-Adressen (Logs): 7 Tage (Sicherheit)"
--       `rate_limits.key` enthält die IP im Klartext (`ip:1.2.3.4:endpunkt`).
--       Der Schlüssel ist Primärschlüssel, die Zeile wird nur AKTUALISIERT und
--       nie gelöscht. Eine IP, die einmal einen Endpunkt aufgerufen hat, blieb
--       damit unbegrenzt gespeichert — nicht 7 Tage, sondern für immer.
--
--   „Consent-Log: 3 Jahre (Art. 5 Abs. 2 DSGVO Rechenschaftspflicht)"
--       Es gab überhaupt kein Consent-Log. Die DSGVO-Einwilligung lag
--       ausschließlich im `localStorage`/`AsyncStorage` des Nutzergeräts
--       (`werkr_consent_v1`). Der Nutzer kann sie löschen, und Werkant hatte
--       nichts in der Hand. Art. 7 Abs. 1 DSGVO verlangt aber ausdrücklich,
--       dass der Verantwortliche die Einwilligung NACHWEISEN kann — ein Wert
--       auf dem Gerät des Betroffenen ist kein Nachweis.
--
--       Das ist dieselbe Fehlerklasse wie beim Widerrufs-Haken (0710, heute
--       früh): eine Zustimmung, die nur im Bildschirmzustand existiert und im
--       Streitfall nicht vorgelegt werden kann.
--
-- Die dritte offene Zusage („Chat-Nachrichten: 6 Monate nach Auftragsabschluss")
-- ist hier BEWUSST NICHT umgesetzt: sie löscht Inhalte, die Nutzer sehen, und
-- ein automatischer Löschlauf gegen Produktionsdaten ist keine Entscheidung,
-- die nebenbei in einer Migration getroffen wird. Siehe
-- notes/04-Entscheidungen/2026-08-16-datenschutz-gegen-code.md.

-- ── 1. IP-Aufbewahrung: 7 Tage ──────────────────────────────────────────────
-- Bewusst OHNE Scheduler. pg_cron ist in dieser Instanz nicht eingerichtet,
-- und ein zusätzlicher Cron-Weg wäre ein weiterer Teil, der ausfallen kann,
-- ohne dass es jemand merkt. Stattdessen räumt die Funktion bei jedem Aufruf
-- mit auf: sie läuft ohnehin bei jedem geschützten Endpunkt, also mindestens
-- so oft, wie neue IPs hinzukommen.
create or replace function public.check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_now timestamptz := now();
  v_row public.rate_limits;
begin
  -- Alles, was älter als 7 Tage ist, ist für die Ratenbegrenzung ohnehin
  -- wertlos: das längste Fenster im Projekt ist eine Stunde. Die Zeile hat
  -- danach keinen Zweck mehr und enthält eine personenbezogene Angabe.
  delete from public.rate_limits
   where window_start < v_now - interval '7 days';

  insert into public.rate_limits (key, window_start, count)
  values (p_key, v_now, 1)
  on conflict (key) do update
    set count = case
          when public.rate_limits.window_start <= v_now - make_interval(secs => p_window_seconds)
            then 1
          else public.rate_limits.count + 1
        end,
        window_start = case
          when public.rate_limits.window_start <= v_now - make_interval(secs => p_window_seconds)
            then v_now
          else public.rate_limits.window_start
        end
  returning * into v_row;

  return v_row.count <= p_limit;
end;
$$;

comment on function public.check_rate_limit is
  'Atomare Ratenbegrenzung im gleitenden Fenster. Raeumt dabei Zeilen aelter '
  'als 7 Tage ab — der Schluessel enthaelt die IP, und die Datenschutz'
  'erklaerung sagt 7 Tage zu (0730).';

-- ── 2. Consent-Log ──────────────────────────────────────────────────────────
create table if not exists public.dsgvo_consents (
  id            uuid primary key default gen_random_uuid(),
  -- Nullable: die Einwilligung wird VOR der Registrierung eingeholt (das
  -- Consent-Blatt liegt über jedem Bildschirm). Ein anonymer Eintrag ist
  -- besser als gar keiner; sobald ein Konto existiert, wird sie zugeordnet.
  user_id       uuid references public.profiles(id) on delete set null,
  -- Fassungskennung des Textes, dem zugestimmt wurde.
  text_version  text not null check (char_length(text_version) between 3 and 64),
  -- Der Wortlaut, den dieser Nutzer gesehen hat. Ohne ihn ist der Nachweis
  -- wenig wert: Texte ändern sich, und was 2027 im Quelltext steht, ist nicht,
  -- was 2026 auf dem Bildschirm stand.
  angezeigter_text text not null check (char_length(angezeigter_text) between 20 and 4000),
  -- Die einzelnen Haken. `pflicht` ist für den Vertrag erforderlich
  -- (Art. 6 Abs. 1 lit. b), `analytics` ist freiwillig — sie dürfen nicht in
  -- einem Feld zusammenfallen, sonst lässt sich später nicht mehr sagen,
  -- wozu genau jemand ja gesagt hat.
  pflicht       boolean not null,
  analytics     boolean not null,
  pstg          boolean not null,
  erteilt_am    timestamptz not null default now(),
  -- Art. 7 Abs. 3 DSGVO: der Widerruf muss so einfach sein wie die Erteilung.
  -- Festgehalten wird er hier, statt die Zeile zu löschen — sonst ist genau
  -- der Vorgang nicht mehr nachweisbar.
  widerrufen_am timestamptz
);

create index if not exists idx_dsgvo_consents_user on public.dsgvo_consents(user_id);

comment on table public.dsgvo_consents is
  'Nachweis der DSGVO-Einwilligung (Art. 7 Abs. 1 DSGVO). Aufbewahrung laut '
  'Datenschutzerklaerung 3 Jahre. Vorher lag die Einwilligung ausschliesslich '
  'im localStorage des Nutzergeraets und war damit nicht nachweisbar.';

alter table public.dsgvo_consents enable row level security;

-- Schreiben: auch ohne Anmeldung, denn die Einwilligung kommt VOR der
-- Registrierung. Ein Eintrag muss dann entweder anonym sein (user_id null)
-- oder auf den eigenen Account lauten — niemand darf im Namen eines anderen
-- eine Einwilligung erklären.
drop policy if exists dsgvo_consents_insert on public.dsgvo_consents;
create policy dsgvo_consents_insert on public.dsgvo_consents
  for insert
  with check (user_id is null or user_id = auth.uid());

-- Lesen: der Nutzer sieht seine eigenen Einwilligungen (Art. 15 DSGVO).
-- Anonyme Eintraege liest niemand zurueck — sie sind reines Nachweismaterial.
drop policy if exists dsgvo_consents_select_own on public.dsgvo_consents;
create policy dsgvo_consents_select_own on public.dsgvo_consents
  for select using (user_id is not null and user_id = auth.uid());

-- Widerruf eintragen darf nur, wem der Eintrag gehoert — und nur den Widerruf.
-- Der urspruengliche Wortlaut bleibt unveraenderlich; ein Nachweis, den eine
-- Seite spaeter umschreiben kann, ist keiner.
drop policy if exists dsgvo_consents_widerruf on public.dsgvo_consents;
create policy dsgvo_consents_widerruf on public.dsgvo_consents
  for update using (user_id is not null and user_id = auth.uid());

create or replace function public.dsgvo_consent_unveraenderlich()
returns trigger language plpgsql as $$
begin
  if new.text_version is distinct from old.text_version
     or new.angezeigter_text is distinct from old.angezeigter_text
     or new.pflicht is distinct from old.pflicht
     or new.analytics is distinct from old.analytics
     or new.pstg is distinct from old.pstg
     or new.erteilt_am is distinct from old.erteilt_am
     or new.user_id is distinct from old.user_id then
    raise exception
      'An einer erteilten Einwilligung laesst sich nur der Widerruf eintragen (0730)';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_dsgvo_consent_unveraenderlich on public.dsgvo_consents;
create trigger trg_dsgvo_consent_unveraenderlich
  before update on public.dsgvo_consents
  for each row execute function public.dsgvo_consent_unveraenderlich();

grant select, insert, update on public.dsgvo_consents to authenticated;
grant insert on public.dsgvo_consents to anon;
