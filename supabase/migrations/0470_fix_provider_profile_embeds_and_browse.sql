-- 0470: Zwei Launch-Blocker aus Founder-Gerätetests 19.07. (abends)
--
-- (1) "Aufträge konnten nicht geladen werden" (Kunde, reproduzierbar):
--     Alle PostgREST-Embeds der Form provider_profiles!provider_id
--     (contracts/offers) scheitern mit PGRST200, weil provider_id per FK
--     nur auf profiles zeigt — PostgREST findet keine Beziehung zu
--     provider_profiles. Betroffen: Kunden-Aufträge-Tab, Home
--     "Zuletzt gebucht", Nachrichten-Liste, Benachrichtigungen,
--     meine-anbieter, Vertrags-Detail.
--     Fix: zusätzliche FKs auf provider_profiles(id). NOT VALID, damit
--     eventuelle Alt-Zeilen ohne provider_profiles-Eintrag die Migration
--     nicht scheitern lassen — für die Embed-Auflösung genügt der
--     Katalog-Eintrag; neue Zeilen werden voll geprüft.
alter table public.contracts
  drop constraint if exists contracts_provider_id_pp_fkey;
alter table public.contracts
  add constraint contracts_provider_id_pp_fkey
  foreign key (provider_id) references public.provider_profiles(id) not valid;

alter table public.offers
  drop constraint if exists offers_provider_id_pp_fkey;
alter table public.offers
  add constraint offers_provider_id_pp_fkey
  foreign key (provider_id) references public.provider_profiles(id) not valid;

-- (2) "Anbieter sieht keine Aufträge": Die Browse-Policy (0410) verlangt
--     auth_email_confirmed() — solange der RESEND_API_KEY fehlt, kann sich
--     aber niemand bestätigen, und JEDER Anbieter sieht null offene
--     Aufträge. Lesen offener Aufträge ist risikoarm (nur Titel/Ort,
--     bewusst öffentlich für registrierte Anbieter); das E-Mail-Gate
--     bleibt für alle SCHREIB-Wege (Auftrag anlegen, Angebot abgeben,
--     Angebot annehmen) unverändert bestehen.
drop policy if exists "Providers browse open jobs" on public.jobs;
create policy "Providers browse open jobs"
  on public.jobs for select
  using (
    status in ('open', 'matched')
    and exists (select 1 from public.provider_profiles pp where pp.id = auth.uid())
  );

-- PostgREST-Schema-Cache sofort neu laden (sonst greifen die neuen FKs
-- erst beim nächsten Reload).
notify pgrst, 'reload schema';
