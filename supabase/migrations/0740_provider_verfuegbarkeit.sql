-- 0740: Die Verfügbarkeit des Anbieters wird gespeichert — und beachtet
--
-- ANLASS (16.08.2026): Der Kalender in app/betrieb/kalender.tsx ließ Stunden
-- als „Frei" oder „Gesperrt" markieren. Beim Umbau des Blätterns fiel auf,
-- dass diese Markierungen nur im Bildschirmzustand lagen. Beim Nachsehen kam
-- das Schlimmere heraus:
--
--   Sie wurden von NICHTS gelesen.
--
-- Weder `propose_appointment` noch die Angebotsabgabe noch das Matching haben
-- je gefragt, ob der Anbieter zu dieser Stunde überhaupt kann. Ein Anbieter
-- konnte den Freitag sperren und bekam weiter Terminvorschläge für Freitag.
-- Die Umschaltung war damit dieselbe Klasse wie ein Knopf ohne `onPress`: sie
-- sah aus wie eine Einstellung und war keine.
--
-- Das GLOBALE Feld `provider_profiles.available` ist davon unberührt — es wird
-- sehr wohl beachtet (Startseite, notify-matching-providers) und bleibt, wie
-- es ist. Hier geht es um die einzelnen Stunden.
--
-- VORGABE IST „GESPERRT", NICHT „FREI".
-- Vorher zeigte der Kalender an Mo/Mi/Fr ein paar freie Stunden — fest im
-- Code, von niemandem erklärt. Das behauptet Verfügbarkeit, die kein Anbieter
-- je zugesagt hat, und im Zweifel gegenüber einem Kunden, der darauf einen
-- Termin vorschlägt. Wer verfügbar ist, sagt es; alles andere ist stumm.

create table if not exists public.provider_availability (
  provider_id uuid not null references public.provider_profiles(id) on delete cascade,
  -- Kalendertag in ORTSZEIT (siehe lib/kalenderWoche.ts: toISOString() würde
  -- in deutscher Sommerzeit jeden Eintrag vor 02:00 auf den Vortag schieben).
  tag         date not null,
  stunde      smallint not null check (stunde between 0 and 23),
  -- Nur 'free' wird gespeichert. 'blocked' ist die Vorgabe und braucht keine
  -- Zeile — sonst müsste jeder Anbieter für jede Stunde seines Lebens eine
  -- Zeile tragen, nur um „nein" zu sagen.
  primary key (provider_id, tag, stunde)
);

create index if not exists idx_provider_availability_tag
  on public.provider_availability(provider_id, tag);

comment on table public.provider_availability is
  'Stunden, die ein Anbieter ausdruecklich als frei markiert hat. Fehlt die '
  'Zeile, gilt die Stunde als gesperrt — Verfuegbarkeit wird zugesagt, nicht '
  'unterstellt.';

alter table public.provider_availability enable row level security;

-- Schreiben und Loeschen: nur der Anbieter selbst.
drop policy if exists provider_availability_own_write on public.provider_availability;
create policy provider_availability_own_write on public.provider_availability
  for insert with check (auth.uid() = provider_id);

drop policy if exists provider_availability_own_delete on public.provider_availability;
create policy provider_availability_own_delete on public.provider_availability
  for delete using (auth.uid() = provider_id);

-- Lesen: alle Angemeldeten. Ein Kunde, der einen Termin vorschlagen soll, muss
-- sehen koennen, wann der Anbieter kann — das ist der Sinn der Sache und
-- entspricht dem, was auf jeder Buchungsplattform sichtbar ist. Gespeichert
-- sind ausschliesslich Zusagen zur eigenen Erreichbarkeit, keine Auftraege
-- und keine Kundendaten.
drop policy if exists provider_availability_read on public.provider_availability;
create policy provider_availability_read on public.provider_availability
  for select using (auth.role() = 'authenticated');

grant select, insert, delete on public.provider_availability to authenticated;

-- ── Beachtet werden ─────────────────────────────────────────────────────────
-- Absichtlich als ABFRAGE, nicht als Sperre in propose_appointment.
--
-- Eine harte Sperre waere hier falsch: die beiden koennen sich im Chat auf
-- einen Termin ausserhalb der gemeldeten Zeiten geeinigt haben, und dann
-- duerfte die Plattform ihnen nicht dazwischenfahren. Was gefehlt hat, ist
-- nicht ein Verbot, sondern die INFORMATION — der Vorschlagende sah bisher
-- gar nicht, dass er eine gesperrte Stunde waehlt.
create or replace function public.ist_anbieter_frei(
  p_provider uuid,
  p_zeitpunkt timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.provider_availability
    where provider_id = p_provider
      -- Ortszeit, nicht UTC: der Anbieter hat "Dienstag 9 Uhr" gemeint, nicht
      -- "Dienstag 9 Uhr UTC".
      and tag    = (p_zeitpunkt at time zone 'Europe/Berlin')::date
      and stunde = extract(hour from (p_zeitpunkt at time zone 'Europe/Berlin'))::smallint
  );
$$;

grant execute on function public.ist_anbieter_frei(uuid, timestamptz) to authenticated;

comment on function public.ist_anbieter_frei is
  'Hat der Anbieter diese Stunde als frei markiert? Bewusst nur eine Auskunft: '
  'die Parteien duerfen sich auch ausserhalb einigen.';
