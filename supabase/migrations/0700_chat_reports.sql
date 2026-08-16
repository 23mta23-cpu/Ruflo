-- 0700: Der Empfänger kann eine Nachricht melden
--
-- ANLASS (Founder-Befund 16.08.2026, am Gerät):
--   „es wird eine nummer weitergegeben, kein strike erhalten,
--    man kann auch nicht melden — mit strike ist da kein workflow?"
--
-- Nachgeprüft. Der Strike-Weg EXISTIERT (0340 → 0500): drei Kontaktdaten-
-- Funde ergeben einen Strike, drei Strikes sperren das Anbieterkonto. Aber er
-- hat ein Loch, das genau den geschilderten Fall trifft:
--
--   `chat_leak_flags` darf laut RLS ausschließlich der ABSENDER schreiben
--   (`auth.uid() = sender_id`), und geschrieben wird er von `logLeakEvent()`
--   im Client des Absenders.
--
-- Die Erkennung hängt damit vollständig am Gerät desjenigen, gegen den sie
-- sich richtet. Wer die Nummer bewusst weitergibt, ist genau die Person, die
-- kein Interesse daran hat, dass der Fund gespeichert wird — und ein
-- veränderter Client, eine ältere App-Version oder schlicht ein Muster, das
-- die Regex nicht trifft („null eins sieben null …"), erzeugt gar keinen Fund.
-- Der Empfänger sieht die Nummer, kann aber nichts tun.
--
-- Diese Migration gibt ihm den zweiten, unabhängigen Weg.
--
-- BEWUSST KEIN Auto-Strike aus einer Meldung.
-- 0340 begründet das für die Regex-Seite („ein Treffer ist kein Beweis"); für
-- Meldungen wiegt es schwerer, nicht leichter: Meldungen sind vom Melder frei
-- auslösbar. Ein Kunde könnte einen Anbieter mit drei Meldungen sperren und
-- damit einen Wettbewerber oder jemanden, mit dem er sich über den Preis
-- gestritten hat, aus dem Markt nehmen. Eine Meldung ist ein Prüfsignal für
-- die Nachprüfung durch einen Menschen, keine Sanktion.

create table if not exists public.chat_reports (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs(id) on delete cascade,
  -- Bleibt erhalten, wenn die Nachricht später verschwindet: die Meldung soll
  -- den Vorgang überdauern, sonst löscht sich ein Verstoß selbst weg.
  message_id  uuid references public.messages(id) on delete set null,
  reporter_id uuid not null references public.profiles(id),
  reported_id uuid not null references public.profiles(id),
  grund       text not null check (grund in (
                'kontaktdaten', 'zahlung_ausserhalb', 'beleidigung', 'spam', 'sonstiges')),
  notiz       text check (notiz is null or char_length(notiz) <= 500),
  created_at  timestamptz not null default now(),
  constraint chat_reports_nicht_selbst check (reporter_id <> reported_id)
);

create index if not exists idx_chat_reports_reported on public.chat_reports(reported_id);
create index if not exists idx_chat_reports_job on public.chat_reports(job_id);

-- Dieselbe Nachricht nicht mehrfach vom selben Melder: sonst erzeugt
-- wiederholtes Antippen ein verzerrtes Bild in der Nachprüfung.
create unique index if not exists uq_chat_reports_melder_nachricht
  on public.chat_reports(reporter_id, message_id)
  where message_id is not null;

alter table public.chat_reports enable row level security;

-- Schreiben: der Melder ist Partei des Auftrags, der Gemeldete ist die ANDERE
-- Partei desselben Auftrags. Damit kann niemand über einen fremden Auftrag
-- oder gegen einen Unbeteiligten melden.
drop policy if exists chat_reports_insert on public.chat_reports;
create policy chat_reports_insert on public.chat_reports
  for insert
  with check (
    auth.uid() = reporter_id
    and exists (
      select 1 from public.jobs j
      where j.id = job_id
        and (j.customer_id = auth.uid() or j.provider_id = auth.uid())
        and (j.customer_id = reported_id or j.provider_id = reported_id)
    )
  );

-- KEINE select-Policy für `authenticated` — wie bei chat_leak_flags (0340).
-- Weder der Gemeldete noch der Melder liest Meldungen zurück. Sähe der
-- Gemeldete sie, wüsste er sofort, wer ihn gemeldet hat; das schreckt genau
-- die Meldung ab, auf die es ankommt, und lädt zu Vergeltung ein.
-- Default-deny gilt, weil RLS aktiv ist und keine Leseregel existiert.

grant insert on public.chat_reports to authenticated;
