-- Der Anbieter-Posteingang zeigte jede Zeile als „Kunde"
--
-- ANLASS (Code-Review 07.09.2026): lib/messages.ts setzte
-- `businessName: 'Kunde'` fest, fuer JEDE Konversation. Wer drei Anfragen
-- laufen hatte, sah dreimal dieselbe Ueberschrift und musste die Auftraege an
-- der Zeile darunter auseinanderhalten.
--
-- Die Begruendung im Code lautete: „Der Kundenname bleibt verborgen, solange
-- kein Vertrag besteht — profiles ist erst fuer Vertragsparteien lesbar
-- (Migration 0030)." Der erste Halbsatz stimmt, der Code prueft ihn aber nie:
-- er verbarg den Namen IMMER, auch nach Vertragsschluss, wo die Policy in
-- 0030 ihn ausdruecklich freigibt. Ein Kommentar, der eine Feinheit
-- behauptet, die der Code nicht hat — dieselbe Klasse wie ein gruener Haken,
-- der nichts prueft.
--
-- Wer entscheidet: die Datenbank, nicht der Bildschirm. Die Funktion laeuft
-- als SECURITY INVOKER (kein `security definer` — bewusst so), also greift
-- die Zeilen-Policy auf `profiles` fuer den Aufrufer. Besteht kein Vertrag,
-- liefert der LEFT JOIN schlicht NULL. Es gibt damit keinen Weg, ueber diese
-- Funktion an einen Namen zu kommen, den man nicht ohnehin sehen darf.
--
-- LEFT JOIN und nicht INNER: bei einem INNER JOIN verschwaende die ganze
-- Konversation, sobald das Profil nicht lesbar ist — also genau in dem Fall,
-- der der Normalfall vor Vertragsschluss ist. Das waere dieselbe Sackgasse,
-- die 0590 fuer den Auftragstitel schon einmal beheben musste.
-- `create or replace` genuegt hier NICHT: die Funktion bekommt eine zusaetzliche
-- Ausgabespalte, und Postgres lehnt das ab ("Row type defined by OUT parameters
-- is different"). Aufgefallen beim lokalen Einspielen der Migrationen —
-- in der Produktion waere die Migration mittendrin gescheitert.
drop function if exists public.konversationen_anbieter();

create or replace function public.konversationen_anbieter()
returns table (
  job_id           uuid,
  job_titel        text,
  kunde_name       text,
  letzte_nachricht text,
  letzte_am        timestamptz,
  von_mir          boolean
)
language sql
stable
set search_path = public
as $$
  select t.* from (
    select distinct on (m.job_id)
           m.job_id,
           coalesce(j.title, 'Auftrag nicht mehr verfügbar') as job_titel,
           -- NULL, solange kein Vertrag besteht: dann greift die Policy aus
           -- 0030 nicht und die Zeile ist fuer den Anbieter unsichtbar.
           p.full_name                as kunde_name,
           m.body                     as letzte_nachricht,
           m.created_at               as letzte_am,
           (m.sender_id = auth.uid()) as von_mir
      from public.messages m
      left join public.jobs j     on j.id = m.job_id
      left join public.profiles p on p.id = j.customer_id
     where m.provider_id = auth.uid()
     order by m.job_id, m.created_at desc
  ) t
  order by t.letzte_am desc;
$$;

comment on function public.konversationen_anbieter is
  'Anbieter-Inbox: eine Zeile je Auftrag, neueste zuerst. kunde_name ist NULL, solange kein Vertrag besteht — die Sichtbarkeit entscheidet die profiles-Policy aus 0030, nicht diese Funktion.';

grant execute on function public.konversationen_anbieter() to authenticated;
