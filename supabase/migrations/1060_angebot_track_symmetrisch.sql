-- 1060: Track-Trennung beim Angebot in BEIDE Richtungen (Befund 03.10.2026)
--
-- Anlass: Founder-Frage „Was wenn ein Handwerksbetrieb auch Nachbarschafts-
-- hilfe anbietet, wo ist die Unterteilung?"
--
-- 0480 hat nur EINE Richtung gesperrt: Nachbarschaftshelfer bieten nicht auf
-- Handwerks-Auftraege. Die Gegenrichtung stand nur im Client
-- (`app/betrieb/_layout.tsx`, `auftraege.tsx`, `dashboard.tsx` filtern nach
-- dem eigenen Track). Serverseitig konnte ein Betrieb weiter auf einen
-- Nachbarschafts-Auftrag bieten, etwa ueber einen direkten Link. Folgen:
--   * Gebuehr: im Nachbarschafts-Track faellt keine Provision an (0830).
--     Ein Betrieb haette so die 8 % auf seine Arbeitsleistung umgangen.
--   * Recht: Nachbarschaftshilfe ist nicht gewerblich (§ 1 Abs. 3
--     SchwarzArbG). Der Zahlungsbildschirm sagt dem Kunden im
--     Nachbarschafts-Track, sein Helfer sei Privatperson und es gebe ihm
--     gegenueber kein Widerrufsrecht (lib/widerruf.ts). Bei einem Betrieb
--     waere beides falsch.
--
-- Neu: der Track des Auftrags muss dem Track des Anbieters entsprechen. Ohne
-- Zeile in provider_profiles gilt wie bisher 'handwerker'.
--
-- Bewusst NICHT angefasst: die Nachrichten-Policy (0510). Ein laufender
-- Vertrag eines Betriebs an einem Nachbarschafts-Auftrag aus der Zeit vor
-- dieser Migration soll seinen Chat behalten.
--
-- Alles Uebrige ist Wort fuer Wort aus 0980 uebernommen.
drop policy if exists "Provider creates offers on open jobs" on public.offers;
create policy "Provider creates offers on open jobs"
  on public.offers for insert
  with check (
    auth.uid() = provider_id
    and auth_email_confirmed()
    and public.meine_aktiven_strikes() < 3
    and exists (
      select 1 from public.jobs j
      where j.id = job_id
        and j.status in ('open', 'matched')
        and j.customer_id <> auth.uid()
        and j.track = coalesce(
          (select case when coalesce(pp.is_nachbarschaft, false)
                       then 'nachbarschaft' else 'handwerker' end
             from public.provider_profiles pp
            where pp.id = auth.uid()),
          'handwerker')
        and (
          not public.auftrag_braucht_meister(j.category_id, j.category)
          or exists (
            select 1 from public.provider_profiles pp
            where pp.id = auth.uid() and pp.meister_verified
          )
        )
    )
  );
