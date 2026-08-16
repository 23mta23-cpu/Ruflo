-- 0710: Die Widerrufs-Einwilligung wird festgehalten
--
-- ANLASS (Founder-Befund 16.08.2026, am Gerät, beim Zahlungsschritt):
--   „Den verzicht habe ich nicht verstanden was steht da und muss das sein?"
--
-- Beim Nachsehen fiel ein zweiter, schwererer Punkt auf, nach dem niemand
-- gefragt hatte: `app/zahlung.tsx` hält die Zustimmung in einem gewöhnlichen
-- `useState(false)`. `handlePay()` schickt an `create-payment-intent`
-- ausschließlich `contract_id`. Die Einwilligung wurde also NIRGENDS
-- gespeichert — sie existierte nur, solange der Bildschirm offen war.
--
-- Der Haken sperrt damit einen Knopf und sonst nichts. Widerruft ein Kunde
-- nach getaner Arbeit, kann weder Werkant noch der Anbieter belegen, dass er
-- der Klausel je zugestimmt hat. Der Haken schützt in genau dem Moment nicht,
-- für den er gedacht ist.
--
-- Festgehalten wird BEWUSST der WORTLAUT, nicht nur ein Häkchen. Eine
-- Zustimmung zu einem Text, den man später nicht mehr vorlegen kann, ist als
-- Nachweis wenig wert: Textfassungen ändern sich, und was 2027 im Quelltext
-- steht, ist nicht, was der Kunde 2026 gelesen hat.
--
-- ANWALT: Diese Migration hält fest, WAS zugestimmt wurde. Ob die Klausel
-- inhaltlich richtig ist, ist damit NICHT beantwortet und ausdrücklich offen:
--   * §356 Abs. 4 BGB beschreibt das ERLÖSCHEN des Widerrufsrechts nach
--     vollständiger Erbringung, nicht einen vorherigen „Verzicht".
--   * §361 Abs. 2 S. 1 BGB begrenzt Abweichungen zum Nachteil des
--     Verbrauchers.
--   * Der Vertrag kommt laut AGB §1(2) zwischen Kunde und Anbieter zustande,
--     Werkant vermittelt nur — wessen Widerrufsrecht hier erklärt wird, nennt
--     der Text gar nicht.
-- Diese Punkte gehören vor den Marktstart auf einen Anwaltstisch. Bis dahin
-- ändert sich am Wortlaut inhaltlich nichts; er wird nur verständlich erklärt.

create table if not exists public.widerruf_consents (
  id             uuid primary key default gen_random_uuid(),
  -- `restrict`: der Nachweis darf nicht mit dem Vertrag verschwinden.
  contract_id    uuid not null unique references public.contracts(id) on delete restrict,
  customer_id    uuid not null references public.profiles(id),
  -- Kennung der Textfassung, z. B. 'widerruf-2026-08-16'.
  text_version   text not null check (char_length(text_version) between 3 and 64),
  -- Der Wortlaut, den dieser Kunde tatsächlich gesehen hat.
  angezeigter_text text not null check (char_length(angezeigter_text) between 20 and 4000),
  erteilt_am     timestamptz not null default now()
);

create index if not exists idx_widerruf_consents_customer on public.widerruf_consents(customer_id);

alter table public.widerruf_consents enable row level security;

-- Schreiben: nur der Kunde DIESES Vertrags, nur für sich selbst.
drop policy if exists widerruf_consents_insert on public.widerruf_consents;
create policy widerruf_consents_insert on public.widerruf_consents
  for insert
  with check (
    auth.uid() = customer_id
    and exists (
      select 1 from public.contracts c
      where c.id = contract_id and c.customer_id = auth.uid()
    )
  );

-- Lesen: der Kunde sieht seine eigene Erklärung. Anders als bei Meldungen
-- (0700) gibt es hier keinen Grund zur Verdeckung — im Gegenteil, es ist SEINE
-- Erklärung, und Art. 15 DSGVO gibt ihm ohnehin Anspruch darauf.
drop policy if exists widerruf_consents_select_own on public.widerruf_consents;
create policy widerruf_consents_select_own on public.widerruf_consents
  for select using (auth.uid() = customer_id);

-- KEIN update, KEIN delete für Clients: ein Nachweis, den die eine Seite
-- nachträglich ändern kann, ist keiner.
grant select, insert on public.widerruf_consents to authenticated;
