-- 0480: Track-Trennung bei Angeboten (Founder-Befund 20.07. nachts + §1 HwO)
--
-- Nachbarschaftshelfer (provider_profiles.is_nachbarschaft) sahen und
-- konnten auf HANDWERKS-Auftraege bieten — zulassungspflichtige Gewerke
-- (Meisterpflicht) duerfen aber nicht von Nachbarschaftshelfern ausgefuehrt
-- werden. Clientseitig wird jetzt nach Track gefiltert; diese Policy
-- erzwingt es serverseitig (Defense in Depth).
drop policy if exists "Provider creates offers on open jobs" on public.offers;
create policy "Provider creates offers on open jobs"
  on public.offers for insert
  with check (
    auth.uid() = provider_id
    and auth_email_confirmed()
    and exists (
      select 1 from public.jobs j
      where j.id = job_id
        and j.status in ('open', 'matched')
        -- Handwerks-Auftraege nur fuer Nicht-Nachbarschafts-Anbieter
        and (
          j.track = 'nachbarschaft'
          or not exists (
            select 1 from public.provider_profiles pp
            where pp.id = auth.uid() and pp.is_nachbarschaft
          )
        )
    )
  );
