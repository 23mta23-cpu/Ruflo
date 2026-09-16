-- 0930: Drei Zusagen aus dem Hilfe-Chat bekommen einen Mechanismus
--
-- `app/support-chat.tsx` sagte Nutzern zu:
--   (a) "Sie haben 14 Tage Zeit, um den Anbieter zu bewerten."
--   (b) "Anbieter koennen ebenfalls eine Gegenbewertung abgeben."
--   (c) "Alle Bewertungen werden verifiziert."
--
-- Stand vorher: (c) stimmte (0310 verlangt einen abgeschlossenen Vertrag
-- zwischen genau diesen beiden Parteien). (a) gab es nirgends -- weder als
-- Regel noch als Anzeige; eine Bewertung war Jahre spaeter noch moeglich.
-- (b) war in 0310 erlaubt, hatte aber keinen Eingang in der App.
--
-- Dazu fehlte das, was eine einseitige Bewertung erst ertraeglich macht:
-- ein Antwortrecht. Ein Handwerker mit einer einzigen 1-Stern-Bewertung
-- konnte dazu nichts sagen; die Bewertung stand unwidersprochen auf seinem
-- Profil.
--
-- Diese Migration macht daraus pruefbare Regeln:
--   1. Bewertungsfrist: 14 Tage ab contracts.completed_at (von Edge
--      Functions gesetzt, per Trigger gegen Client-Schreiben geschuetzt).
--   2. Antwortrecht: genau EINE Antwort, nur von der bewerteten Person.
--   3. Der Zeitstempel der Antwort kommt vom Trigger, nicht vom Client.

alter table public.reviews
  add column if not exists antwort    text,
  add column if not exists antwort_am timestamptz;

comment on column public.reviews.antwort is
  'Einmalige oeffentliche Antwort der bewerteten Person. Siehe 0930.';

-- ---------------------------------------------------------------------------
-- 1. Bewertungsfrist: 14 Tage ab Abschluss
-- ---------------------------------------------------------------------------
-- Die Zahl steht GENAU EINMAL in dieser Migration. Eine Frist, die mehrfach
-- dasteht, laesst sich nicht durch eine Mutation widerlegen (Lehre 0720).

drop policy if exists "reviews_insert" on public.reviews;

create policy "reviews_insert" on public.reviews
  for insert with check (
    auth.uid() = reviewer_id
    and exists (
      select 1 from public.contracts c
      where c.id = contract_id
        and c.status = 'completed'
        and (
          (c.customer_id = auth.uid() and c.provider_id = reviewed_id)
          or
          (c.provider_id = auth.uid() and c.customer_id = reviewed_id)
        )
        -- Fehlt der Zeitstempel (Vertraege von vor 0650), sperrt die Frist
        -- niemanden aus. Ein fehlender Wert darf kein Recht nehmen.
        and (
          c.completed_at is null
          or now() <= c.completed_at + interval '14 days'
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Antwortrecht: nur die bewertete Person, genau einmal
-- ---------------------------------------------------------------------------

drop policy if exists "reviews_update_antwort" on public.reviews;

create policy "reviews_update_antwort" on public.reviews
  for update
  using (auth.uid() = reviewed_id and antwort is null)
  with check (auth.uid() = reviewed_id);

-- GRENZE, gemessen am 16.09.2026 und ausdruecklich hingeschrieben:
-- das `with check` oben ist derzeit UNERREICHBAR. Wer das `using` passiert,
-- ist bereits `reviewed_id`, und mehr als `antwort` darf er ohnehin nicht
-- schreiben. Die Mutation "with check (true)" blieb in der gesamten Suite
-- gruen -- kein Test kann sie sehen, weil es keinen Fall gibt, in dem sie
-- wirkt. Sie bleibt trotzdem stehen: wuerde das Spaltenrecht spaeter
-- ausgeweitet, waere sie es, die ein Umhaengen auf eine fremde reviewed_id
-- verhindert. Wer sie fuer geprueft haelt, irrt sich -- deshalb steht es hier
-- und nicht in einem Bericht.

-- Spaltenrechte: ohne sie koennte die bewertete Person ueber dieselbe Policy
-- auch `rating` oder `comment` ueberschreiben -- also die Bewertung, die ihr
-- nicht gefaellt, einfach umschreiben. Das Update-Recht auf der Tabelle wird
-- entzogen und nur fuer `antwort` wieder erteilt.
revoke update on public.reviews from authenticated;
grant  update (antwort) on public.reviews to authenticated;

grant update on public.reviews to service_role;

-- ---------------------------------------------------------------------------
-- 3. Der Zeitstempel kommt vom Server
-- ---------------------------------------------------------------------------

create or replace function public.reviews_antwort_stempeln()
returns trigger
language plpgsql
as $$
begin
  if new.antwort is distinct from old.antwort then
    if old.antwort is not null then
      raise exception 'Eine Antwort laesst sich nicht aendern.';
    end if;
    if new.antwort is null or btrim(new.antwort) = '' then
      raise exception 'Eine leere Antwort wird nicht gespeichert.';
    end if;
    new.antwort    := btrim(new.antwort);
    new.antwort_am := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reviews_antwort_stempeln on public.reviews;

create trigger trg_reviews_antwort_stempeln
  before update on public.reviews
  for each row execute function public.reviews_antwort_stempeln();

-- Trigger-Funktionen brauchen kein EXECUTE fuer den Aufrufer (0907), ein
-- direkter Aufruf soll aber nicht moeglich sein.
revoke execute on function public.reviews_antwort_stempeln() from public, anon, authenticated;
