-- 0990: Die 18+-Erklaerung wird festgehalten, und der Nachbarschaftszweig
--       kommt ueberhaupt erst in eine Pruefung
--
-- ANLASS (20.09.2026): Bestandsaufnahme aller Stellen, an denen die
-- Oberflaeche eine PRUEFUNG behauptet. 62 Fundstellen, die meisten in Ordnung.
-- Zwei nicht, und beide betreffen denselben Zweig.
--
-- (1) DIE SELBSTAUSKUNFT WURDE WEGGEWORFEN.
--     `app/onboarding-kyc.tsx` fragt den Nachbarschaftshelfer nach seinem
--     Geburtsdatum, prueft im Browser gegen MINDESTALTER und zeigt einen
--     Fehler. Beim Absenden wird `nbDob` NICHT mitgeschickt: der Aufruf setzt
--     Name, Telefon, Bio, Satz, Gewerke und `is_nachbarschaft`. Das Datum
--     lebte in `useState` und war mit dem Bildschirm weg.
--
--     `app/nachbarschaft-profil.tsx` sagt dem Kunden dazu „18+ verifiziert".
--     Es gab weder eine Pruefung noch einen Nachweis. Dieselbe Klasse wie die
--     Widerrufs-Zustimmung am 16.08. („Nachweise gehoeren in die Datenbank,
--     nicht in useState") -- nur geht es hier darum, wer in eine fremde
--     Wohnung gelassen wird.
--
-- (2) ES GAB KEINE PRUEFUNG, IN DIE ER HAETTE KOMMEN KOENNEN.
--     `submitForReview()` ist der einzige Weg zu `kyc_status = 'in_review'`,
--     und er verlangt einen Gewerbeschein (Guard aus 0370/0650). Der
--     Nachbarschaftszweig ruft ihn gar nicht auf. Ein Helfer blieb also
--     dauerhaft auf `'pending'`, das Pruef-Postfach sah ihn nie, und
--     `provider_public` (nur `approved`) auch nicht.
--
--     `app/bewerbung-eingegangen.tsx` sagt ihm trotzdem woertlich, geprueft
--     wuerden „ihre Profilangaben + 18+-Selbstauskunft". Beschrieben war eine
--     Pruefung, die niemand durchfuehren konnte.
--
-- WAS DIESE MIGRATION NICHT LOEST: `/nachbarschaft` zeigt weiterhin niemanden.
-- Die Abfrage dort verlangt zusaetzlich `stripe_onboarded = true`, und das
-- schreibt ausschliesslich der Stripe-Webhook beim Connect-Onboarding -- ein
-- Weg, der nicht gebaut ist. Das ist ein zweiter, unabhaengiger Grund, und er
-- bleibt beim Founder. Hier geht es darum, dass der Helfer eine ENTSCHEIDUNG
-- bekommt und die Erklaerung einen NACHWEIS hat.

-- ── Der Nachweis ───────────────────────────────────────────────────────────
--
-- Festgehalten wird die ERKLAERUNG, nicht das Geburtsdatum.
--
-- Das ist kein Sparen am falschen Ende, sondern Art. 5 Abs. 1 lit. c DSGVO:
-- belegt werden muss „diese Person hat am TAG mit DIESEM Wortlaut erklaert,
-- volljaehrig zu sein". Dafuer ist das genaue Datum nicht erforderlich, und
-- ein Geburtsdatum ist ein Ausweisdatum, das man nicht auf Vorrat sammelt.
-- Wer die Identitaet WIRKLICH braucht, bekommt sie ueber Stripe bei der
-- Auszahlungs-Einrichtung -- so steht es auch in der Datenschutzerklaerung.
create table if not exists public.volljaehrigkeits_erklaerungen (
  -- Eine Erklaerung je Helfer. Erklaert er erneut, wird die Fassung
  -- aktualisiert; eine Historie braucht es hier nicht, und weniger Zeilen
  -- ueber Minderjaehrigkeit ist die bessere Voreinstellung.
  helfer_id       uuid primary key references public.provider_profiles(id) on delete cascade,
  fassung         text not null check (char_length(fassung) between 3 and 64),
  -- Der Wortlaut, den dieser Helfer tatsaechlich gesehen hat. Ein Haekchen
  -- ohne Text ist im Streitfall unbeweisbar (Lehre vom 16.08.).
  angezeigter_text text not null check (char_length(angezeigter_text) between 20 and 2000),
  erklaert_am     timestamptz not null default now()
);

comment on table public.volljaehrigkeits_erklaerungen is
  'Nachweis der 18+-Selbstauskunft eines Nachbarschaftshelfers: Wortlaut, '
  'Fassung, Zeitpunkt. BEWUSST ohne Geburtsdatum (Art. 5 Abs. 1 lit. c DSGVO). '
  'Es ist eine Erklaerung, keine Pruefung -- die Oberflaeche muss das so sagen.';

alter table public.volljaehrigkeits_erklaerungen enable row level security;

-- Schreiben: nur fuer sich selbst, und nur als Nachbarschaftshelfer.
drop policy if exists volljaehrigkeit_insert on public.volljaehrigkeits_erklaerungen;
create policy volljaehrigkeit_insert on public.volljaehrigkeits_erklaerungen
  for insert
  with check (
    auth.uid() = helfer_id
    and exists (
      select 1 from public.provider_profiles pp
      where pp.id = auth.uid() and pp.is_nachbarschaft
    )
  );

-- Aendern: nur die eigene, und auch dann nur der Wortlaut samt Zeitpunkt.
-- Loeschen nicht: ein Nachweis, den die eine Seite wegnehmen kann, ist keiner.
drop policy if exists volljaehrigkeit_update_own on public.volljaehrigkeits_erklaerungen;
create policy volljaehrigkeit_update_own on public.volljaehrigkeits_erklaerungen
  for update using (auth.uid() = helfer_id) with check (auth.uid() = helfer_id);

drop policy if exists volljaehrigkeit_select_own on public.volljaehrigkeits_erklaerungen;
create policy volljaehrigkeit_select_own on public.volljaehrigkeits_erklaerungen
  for select using (auth.uid() = helfer_id);

grant select, insert, update on public.volljaehrigkeits_erklaerungen to authenticated;

-- ── Der Uebergang in die Pruefung, jetzt auch ohne Gewerbeschein ───────────
--
-- Der Schutz aus 0650 laesst `pending/rejected -> in_review` nur zu, wenn ein
-- `gewerbeschein_path` gesetzt ist. Fuer einen Nachbarschaftshelfer gibt es
-- keinen, und genau daran ist der Zweig haengengeblieben.
--
-- Die Bedingung wird nicht gelockert, sondern um den zweiten Fall ERGAENZT:
-- ein Helfer kommt in die Pruefung, wenn er als Nachbarschaftshelfer gefuehrt
-- ist, mindestens ein Gewerk angegeben hat UND seine 18+-Erklaerung vorliegt.
-- Ohne Nachweis kein Uebergang -- sonst waere die Erklaerung wieder optional,
-- und optionale Nachweise verschwinden (Lehre vom 16.09.).
--
-- Wort fuer Wort aus 0650 uebernommen; geaendert ist allein dieser eine Zweig.
create or replace function guard_provider_profile_sensitive_cols()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if current_setting('role', true) = 'service_role' then
    return new;
  end if;

  if new.stripe_onboarded is distinct from old.stripe_onboarded then
    raise exception 'stripe_onboarded is managed exclusively by the Stripe webhook (ADR-0004)';
  end if;
  if new.stripe_account_id is distinct from old.stripe_account_id then
    raise exception 'stripe_account_id is managed exclusively by the Stripe Connect flow (ADR-0004)';
  end if;
  if new.kyc_status is distinct from old.kyc_status then
    if old.kyc_status in ('pending','rejected')
       and new.kyc_status = 'in_review'
       and (
         new.gewerbeschein_path is not null
         or (
           new.is_nachbarschaft
           and coalesce(array_length(new.category_ids, 1), 0) > 0
           and exists (
             select 1 from public.volljaehrigkeits_erklaerungen v
             where v.helfer_id = new.id
           )
         )
       ) then
      new.kyc_submitted_at := now();
    else
      raise exception 'kyc_status is managed by the KYC review process';
    end if;
  end if;
  if new.meister_verified is distinct from old.meister_verified then
    raise exception 'meister_verified is managed by the verification team';
  end if;
  return new;
end;
$$;
