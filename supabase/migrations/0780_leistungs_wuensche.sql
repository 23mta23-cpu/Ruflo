-- Vorgeschlagene Leistungen, die es im Katalog noch nicht gibt
--
-- ANLASS (Founder am Geraet, 07.09.2026): "was wenn eine Sache oder Arbeit
-- gemacht oder angeboten wird, was wir noch nicht drin stehen haben?"
--
-- Bisher gab es dafuer NICHTS. Ein Schornsteinfeger, ein Photovoltaik-Bauer
-- oder ein Kaminbauer fand sein Gewerk nicht und stand vor einer
-- geschlossenen Tuer — ohne dass wir je erfahren haetten, dass er da war.
-- Das ist doppelt teuer: der Betrieb geht, und uns fehlt genau das Signal,
-- an dem sich ablesen liesse, welche Kategorie als naechste gebraucht wird.
--
-- BEWUSST KEINE eigene Kategorie: ein Eintrag hier wird NICHT vermittelt.
-- Er hat kein Gebuehrenmodell (data/categories.ts: pricingModel,
-- minHourlyRate), keine Nachweispflicht (requiredDocs) und keine
-- Meisterpflicht-Zuordnung. Ihn stillschweigend ins Matching zu lassen hiesse,
-- einen Auftrag ueber eine Leistung zu vermitteln, fuer die niemand
-- festgelegt hat, was gilt. Der Bildschirm sagt das dem Anbieter auch so.
create table if not exists public.leistungs_wuensche (
  id          uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  text        text not null check (char_length(btrim(text)) between 3 and 120),
  erledigt    boolean not null default false,
  created_at  timestamptz not null default now()
);

comment on table public.leistungs_wuensche is
  'Von Anbietern vorgeschlagene Leistungen, die der Katalog noch nicht kennt. Reines Signal fuer die Katalogpflege — nichts davon wird vermittelt.';
comment on column public.leistungs_wuensche.erledigt is
  'true, wenn daraus eine echte Kategorie in data/categories.ts geworden ist (oder bewusst nicht).';

-- Ein Anbieter, ein Vorschlag je Wortlaut: sonst sammeln sich beim
-- mehrfachen Tippen auf den Knopf Dubletten, und die Haeufigkeit — das
-- einzige, was diese Tabelle interessant macht — waere verfaelscht.
create unique index if not exists idx_leistungs_wuensche_einmalig
  on public.leistungs_wuensche (provider_id, lower(btrim(text)));

-- Fuer die Auswertung "was wird am haeufigsten gewuenscht".
create index if not exists idx_leistungs_wuensche_offen
  on public.leistungs_wuensche (created_at desc)
  where erledigt = false;

alter table public.leistungs_wuensche enable row level security;

-- Anlegen nur im eigenen Namen. Ohne diese Bedingung koennte jeder
-- Angemeldete Vorschlaege auf fremde Konten buchen und damit die Statistik
-- faelschen, an der spaeter Katalog-Entscheidungen haengen.
create policy "anbieter legt eigenen wunsch an"
  on public.leistungs_wuensche for insert
  to authenticated
  with check (provider_id = auth.uid());

-- Lesen nur die eigenen. Was andere Betriebe vermissen, ist deren Sache —
-- und in Summe eine Geschaeftszahl, die nicht in die App gehoert.
create policy "anbieter liest eigene wuensche"
  on public.leistungs_wuensche for select
  to authenticated
  using (provider_id = auth.uid());

-- Kein update, kein delete: der Zeitpunkt und der Wortlaut sind das Signal.
-- Wer sich vertippt hat, schreibt einen zweiten Vorschlag.
