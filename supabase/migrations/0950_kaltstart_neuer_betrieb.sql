-- 0950: Wenn ein Betrieb dazukommt, erfaehrt der wartende Kunde davon.
--
-- ANLASS (Selbst-Check 17.09.2026, Kaltstart-Block). `notify-matching-providers`
-- laeuft GENAU EINMAL, beim Anlegen des Auftrags (lib/jobs.ts ->
-- lib/notifications.ts). Danach ruft sie niemand mehr auf. Daraus folgt eine
-- Luege, die mit jedem Tag groesser wird:
--
--   Tag 0: Kunde stellt einen Auftrag ein. Kein Betrieb passt.
--          jobs.benachrichtigte_betriebe = 0 (0920).
--          Der Bildschirm sagt: "In Ihrer Gegend ist noch kein passender
--          Betrieb dabei." Das stimmt.
--   Tag 3: Ein Betrieb meldet sich an, wird freigegeben, hat das Gewerk und
--          sitzt im selben Postleitzahlenbereich. Er SIEHT den Auftrag sogar
--          (app/betrieb/auftraege.tsx listet alle offenen Auftraege).
--          jobs.benachrichtigte_betriebe steht weiter auf 0.
--          Der Bildschirm sagt weiter: "In Ihrer Gegend ist noch kein
--          passender Betrieb dabei." Das stimmt nicht mehr.
--
-- Das ist dieselbe Fehlerklasse wie die ganze Woche: eine Tatsache wird als
-- aktuell angezeigt, und es gibt keinen Mechanismus, der sie aktuell haelt.
-- 0920 hat die Zahl eingefuehrt, aber nur einen Schreiber dafuer gebaut.
--
-- ENTSCHEIDUNG. Die Gegenrichtung fehlt: nicht nur "Auftrag sucht Betriebe",
-- sondern auch "Betrieb trifft auf wartende Auftraege". Genau das ist der
-- Kaltstart eines Marktplatzes, und es ist der Teil, den man ohne Geld, ohne
-- Mailversand und ohne Zeitplan bauen kann -- deshalb hier als Trigger und
-- nicht als Edge Function. Er laeuft in derselben Transaktion wie die
-- Freigabe und braucht kein einziges Secret des Founders.
--
-- BEWUSST KEIN Push und KEINE Mail an dieser Stelle. Beides haengt an
-- Schluesseln, die noch fehlen; ein Weg, der erst spaeter funktioniert, ist
-- hier kein Weg. Die Mitteilungen landen in `notifications` -- und beide
-- Empfaenger haben seit 0860 bzw. PR #208 eine Glocke, die dorthin fuehrt
-- (app/(tabs)/index.tsx fuer den Kunden, app/betrieb/dashboard.tsx fuer den
-- Betrieb). Eine Mitteilung ohne Empfaenger-Bildschirm waere der Fehler vom
-- 16.09. noch einmal.

-- ── Wann gilt ein Betrieb als marktfaehig? ─────────────────────────────────
-- Absichtlich eine eigene Funktion und keine Bedingung im Trigger: sie wird
-- zweimal gebraucht (Zustand vorher, Zustand nachher), und zwei Kopien
-- derselben Bedingung gehen irgendwann auseinander.
--
-- Die Postleitzahl steht NICHT hier drin, obwohl sie fuer das Treffen noetig
-- ist: sie liegt in `profiles`, nicht in `provider_profiles`, und ein
-- Tabellenzugriff pro Zeile in einer Bedingung, die zweimal ausgewertet wird,
-- ist es nicht wert. Sie wird in der Auswahl unten geprueft.
create or replace function public.betrieb_marktfaehig(
  p_kyc boolean, p_verfuegbar boolean, p_gewerke text[]
)
returns boolean
language sql
immutable
as $$
  select coalesce(p_kyc, false)
     and coalesce(p_verfuegbar, false)
     and coalesce(array_length(p_gewerke, 1), 0) > 0;
$$;

comment on function public.betrieb_marktfaehig(boolean, boolean, text[]) is
  'Kann dieser Betrieb ueberhaupt ein Angebot abgeben? Freigegeben, verfuegbar, mindestens ein Gewerk. Ohne alle drei ist er fuer einen Kunden nicht vorhanden.';

-- ── Wer wurde ueber welchen Auftrag informiert? ────────────────────────────
--
-- ANLASS, und zwar aus dem eigenen Entwurf von heute: die erste Fassung hat
-- `benachrichtigte_betriebe` einfach hochgezaehlt. Beim Schreiben des Tests
-- kam heraus, dass derselbe Betrieb dann ZWEIMAL zaehlt, sobald er spaeter
-- ein Gewerk dazunimmt -- und dreimal, wenn er zwischendurch auf unsichtbar
-- stand und zurueckkommt. Der Kunde saehe "3 Betriebe wurden informiert",
-- wo einer steht.
--
-- Ein Zaehler, der nicht weiss, WEN er zaehlt, kann nicht doppelt zaehlen
-- verhindern. Also wird festgehalten, wer informiert wurde, und die Zahl
-- daraus abgeleitet. Damit ist sie nachpruefbar statt frei laufend.
create table if not exists public.job_benachrichtigungen (
  job_id      uuid not null references public.jobs(id) on delete cascade,
  provider_id uuid not null references public.provider_profiles(id) on delete cascade,
  erstellt_am timestamptz not null default now(),
  primary key (job_id, provider_id)
);

create index if not exists idx_job_benachrichtigungen_provider
  on public.job_benachrichtigungen (provider_id);

alter table public.job_benachrichtigungen enable row level security;

-- KEINE Policy, und das ist Absicht. Die Zeilen entstehen ausschliesslich in
-- der Edge Function (service_role) und im Trigger unten (SECURITY DEFINER).
-- Fuer die Anzeige genuegt die abgeleitete Zahl an `jobs`; wer wen gesehen
-- hat, geht weder den Kunden noch einen anderen Betrieb etwas an.
comment on table public.job_benachrichtigungen is
  'Welcher Betrieb wurde ueber welchen Auftrag informiert. Grundlage fuer jobs.benachrichtigte_betriebe -- ohne diesen Nachweis laesst sich ein doppeltes Zaehlen desselben Betriebs nicht ausschliessen.';

-- Die Zahl an einem Auftrag aus dem Nachweis neu setzen.
create or replace function public.benachrichtigte_betriebe_nachziehen(p_job uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_anzahl integer;
begin
  select count(*) into v_anzahl
    from public.job_benachrichtigungen where job_id = p_job;
  update public.jobs
     set benachrichtigte_betriebe = v_anzahl,
         benachrichtigt_am = now()
   where id = p_job;
  return v_anzahl;
end;
$$;

revoke execute on function public.benachrichtigte_betriebe_nachziehen(uuid)
  from public, anon, authenticated;
grant execute on function public.benachrichtigte_betriebe_nachziehen(uuid) to service_role;

-- ── Der Trigger ────────────────────────────────────────────────────────────
create or replace function public.betrieb_betritt_markt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plz_bereich text;
  v_track       text;
  v_auftrag     record;
  v_anzahl      integer := 0;
begin
  -- Nur der UEBERGANG zaehlt, damit nicht jedes Speichern des Profils eine
  -- Schleife ueber die offenen Auftraege ausloest. Das ist eine
  -- Beschleunigung, KEINE Absicherung: richtig bleibt das Ergebnis auch ohne
  -- diese Bedingung, dafuer sorgt der Nachweis in job_benachrichtigungen.
  --
  -- Ein zweiter Fall zaehlt mit: ein bereits marktfaehiger Betrieb nimmt ein
  -- GEWERK dazu. Damit wird Nachfrage erreichbar, die es vorher nicht war.
  -- Der Fall "war unsichtbar, ist wieder da" faellt unter die erste
  -- Bedingung: waehrend der Unsichtbarkeit hat ihn niemand benachrichtigt
  -- (notify-matching-providers filtert auf available), also sind die
  -- Auftraege aus dieser Zeit fuer ihn neu.
  if not public.betrieb_marktfaehig(new.kyc_verified, new.available, new.category_ids) then
    return new;
  end if;
  if public.betrieb_marktfaehig(old.kyc_verified, old.available, old.category_ids)
     and new.category_ids is not distinct from old.category_ids then
    return new;
  end if;

  select left(coalesce(p.plz, ''), 2) into v_plz_bereich
    from public.profiles p where p.id = new.id;
  -- Ohne Postleitzahl passt niemand. Lieber keine Mitteilung als eine an alle:
  -- dieselbe Entscheidung wie in notify-matching-providers/auswahl.ts.
  if v_plz_bereich is null or length(v_plz_bereich) <> 2 then
    return new;
  end if;

  -- Die Trennung der beiden Rechtsraeume (§1 HwO) gilt auch hier. Sie ist
  -- KEIN Anzeigedetail: ein Nachbarschaftshelfer darf meisterpflichtige
  -- Arbeiten nicht angeboten bekommen. Wortgleich zu auswahl.ts.
  v_track := case when coalesce(new.is_nachbarschaft, false)
                  then 'nachbarschaft' else 'handwerker' end;

  for v_auftrag in
    select j.id, j.customer_id, j.title
      from public.jobs j
     where j.status = 'open'
       and j.track = v_track
       and j.category_id is not null
       and j.category_id = any (new.category_ids)
       and left(coalesce(j.address_plz, ''), 2) = v_plz_bereich
       and j.customer_id <> new.id
     order by j.created_at desc
     limit 50                      -- dieselbe Obergrenze wie in der Funktion
  loop
    -- Der Nachweis entscheidet, nicht der Zaehler.
    --
    -- GEMESSEN (Mutationsprobe 17.09.): nimmt man das `if not found` weg,
    -- wird KEINE Zusicherung rot. Die Bedingung verhindert also nicht die
    -- Doppelzaehlung -- das tut die abgeleitete Zahl. Sie spart die Arbeit,
    -- eine unveraenderte Zahl neu zu schreiben, und sonst nichts. Sie steht
    -- hier mit diesem Wissen, nicht als vermeintliche Absicherung.
    insert into public.job_benachrichtigungen (job_id, provider_id)
    values (v_auftrag.id, new.id)
    on conflict do nothing;
    if not found then
      continue;
    end if;

    v_anzahl := v_anzahl + 1;
    perform public.benachrichtigte_betriebe_nachziehen(v_auftrag.id);

    -- Der Kunde erfaehrt es. Einmal pro Auftrag: die Eindeutigkeit in 0860
    -- laeuft ueber (quelle_tabelle, quelle_id, art), und ein Kunde, dem bei
    -- jedem Neuzugang dieselbe Nachricht zugestellt wird, schaltet die
    -- Glocke ab.
    perform public.benachrichtigung_anlegen(
      v_auftrag.customer_id,
      'system',
      'Ein passender Betrieb ist dazugekommen',
      'Zu Ihrem Auftrag "' || left(coalesce(v_auftrag.title, 'Ihr Auftrag'), 60)
        || '" ist jetzt ein Betrieb in Ihrem Postleitzahlenbereich angemeldet '
        || 'und wurde informiert. Ob er ein Angebot schreibt, entscheidet er '
        || 'selbst.',
      '/auftrag-detail?jobId=' || v_auftrag.id::text,
      'jobs',
      v_auftrag.id,
      false
    );
  end loop;

  -- Und der Betrieb erfaehrt, dass Arbeit auf ihn wartet. Das ist die Haelfte,
  -- die den Kaltstart ueberhaupt aufloest: der erste Betrieb in einem Gebiet
  -- darf nicht auf einen leeren Bildschirm treffen, wenn die Nachfrage
  -- laengst da ist.
  --
  -- Deutsche Mehrzahl ausgeschrieben, nicht zusammengesetzt (CLAUDE.md,
  -- 08.09.: "Auftrage").
  if v_anzahl > 0 then
    perform public.benachrichtigung_anlegen(
      new.id,
      'system',
      'Es warten Aufträge in Ihrem Gebiet',
      case when v_anzahl = 1
        then 'In Ihrem Postleitzahlenbereich ist ein offener Auftrag '
             || 'ausgeschrieben, der zu Ihren Gewerken passt. Sie finden ihn '
             || 'unter Anfragen.'
        else 'In Ihrem Postleitzahlenbereich sind ' || v_anzahl
             || ' offene Aufträge ausgeschrieben, die zu Ihren Gewerken '
             || 'passen. Sie finden sie unter Anfragen.'
      end,
      '/betrieb/auftraege',
      'provider_profiles',
      new.id,
      false
    );
  end if;

  return new;
end;
$$;

comment on function public.betrieb_betritt_markt() is
  'Betritt ein Betrieb den Markt (Freigabe, Verfuegbarkeit, neues Gewerk), bekommen die wartenden Kunden im selben PLZ-Bereich eine Mitteilung und ihre Zahl aus 0920 wird fortgeschrieben. Ohne das zeigt der Kunden-Bildschirm auf Dauer eine Tatsache von gestern.';

drop trigger if exists trg_betrieb_betritt_markt on public.provider_profiles;
create trigger trg_betrieb_betritt_markt
  after update on public.provider_profiles
  for each row execute function public.betrieb_betritt_markt();

-- Ausfuehrungsrechte. PostgreSQL gibt JEDER neuen Funktion EXECUTE an PUBLIC,
-- unabhaengig von jeder Vorgabe -- ein Widerruf gegen die Rolle allein wirkt
-- nicht (07.09.). Deshalb hier gegen public, anon und authenticated.
--
-- Die Trigger-Funktion braucht kein Ausfuehrungsrecht: PostgreSQL prueft es
-- beim Ausloesen nicht.
--
-- `betrieb_marktfaehig` ist eine reine Rechenregel ohne Datenzugriff und
-- koennte deshalb offen bleiben. Sie wird trotzdem entzogen, weil sie heute
-- NUR im Trigger gebraucht wird. Sollte sie einmal in einer Policy stehen,
-- muss das Recht bewusst wieder vergeben werden -- sonst koennte kein
-- Anbieter mehr bieten, genau die Falle vom 07.09.
revoke execute on function public.betrieb_betritt_markt() from public, anon, authenticated;
revoke execute on function public.betrieb_marktfaehig(boolean, boolean, text[])
  from public, anon, authenticated;
