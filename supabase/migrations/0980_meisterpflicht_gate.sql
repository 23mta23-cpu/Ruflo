-- 0980: Die Meisterpflicht wird durchgesetzt, nicht nur behauptet
--
-- ANLASS (20.09.2026, beim Nachgehen der Founder-Frage „wie geht es weiter
-- ohne meine Themen?"). Gesucht war der Weg des EINEN wartenden Betriebs bis
-- zum ersten Angebot. Gefunden wurde, dass die Meisterpflicht nach der
-- Freigabe nirgends mehr geprueft wird.
--
-- WAS DER KUNDE LIEST (app/auftrag-aufgeben.tsx, Schritt 1, woertlich):
--   „Ihr Auftrag wird AUSSCHLIESSLICH an Betriebe mit gueltigem Meisterbrief
--    weitergeleitet."
-- Dasselbe in app/landing.tsx, docs/marketing/store-texte.md und im
-- Akquise-Leitfaden („kommen nicht durchs Onboarding-Gate").
--
-- WAS GEMESSEN DASTAND:
--   * `meister_verified` kommt in KEINER Policy, KEINEM Check und KEINEM
--     Trigger als Bedingung vor. Jedes Vorkommen ist entweder ein Schreibschutz
--     (0050, 0330, 0370, 0450, 0650) oder ein Abzeichen in der Oberflaeche
--     (anbieter.tsx, betrieb/profil.tsx). Ein Feld, das nichts bewirkt.
--   * KEIN Code-Pfad setzt es je auf true. `pruefung` schreibt bei der Freigabe
--     kyc_status und kyc_verified, das Meisterfeld nicht. Es liesse sich nur
--     von Hand im Dashboard setzen.
--   * Die Angebots-Policy (zuletzt 0820) prueft E-Mail, Strikes, Auftragslage,
--     Eigen-Angebot und die Track-Trennung (0480). Die Meisterpflicht nicht.
--   * `notify-matching-providers` filtert `available` und `category_ids`. Die
--     Meisterpflicht nicht.
--
-- Die Pruefung gab es also GENAU EINMAL, beim Onboarding, und sie haengt an
-- `provider_profiles.trade_id` (lib/pruefung.ts, `vorpruefen`). Massgeblich
-- fuers Zuleiten und fuers Bieten ist aber `category_ids`. Und die laesst sich
-- danach in „Mein Profil" (app/betrieb/profil.tsx) frei aendern, ohne dass
-- `trade_id` mitwandert und ohne jede erneute Pruefung.
--
-- Ein als Bodenleger (zulassungsfrei) freigegebener Betrieb konnte sich also
-- anschliessend Elektro eintragen, bekam Elektro-Auftraege zugeleitet und
-- durfte darauf bieten. § 1 HwO Anlage A, und eine Zusage an den Kunden, hinter
-- der kein Mechanismus stand.
--
-- Dieselbe Fehlerklasse wie der Rest dieser Woche, in ihrer schaerfsten Form:
-- gebaut, geprueft, rechtlich sauber formuliert -- und nirgends durchgesetzt.

-- ── Die Liste, EINMAL, in der Datenbank ────────────────────────────────────
--
-- Die Wahrheit steht in `data/categories.ts` (requiredDocs enthaelt
-- 'MEISTERBRIEF'). Eine zweite Liste ist eine Quelle fuer Abweichung, deshalb
-- haelt `scripts/meisterpflicht-beleg-check.py` beide gegeneinander -- dieselbe
-- Loesung wie beim Start-PIN (18.09.): ein Wertvergleich zur Laufzeit koennte
-- die Bindung nicht beweisen, ein Quelltext-Abgleich schon.
--
-- Der Anzeigename steht mit in der Tabelle, weil `jobs.category_id` seit 0410
-- NULL sein darf. Fuer solche Altzeilen bleibt nur der Text in `jobs.category`,
-- und der traegt den Anzeigenamen.
create table if not exists public.meisterpflicht_gewerke (
  gewerk text primary key,
  name   text not null
);

comment on table public.meisterpflicht_gewerke is
  'Gewerke der Anlage A zur HwO (§ 1 Abs. 2 HwO), fuer die ein Meisterbrief '
  'noetig ist. Spiegel von MEISTERPFLICHT_IDS aus data/categories.ts; '
  'abgeglichen von scripts/meisterpflicht-beleg-check.py.';

insert into public.meisterpflicht_gewerke (gewerk, name) values
  ('heizung-sanitaer', 'Heizung & Sanitär'),
  ('elektro',          'Elektro'),
  ('maler',            'Maler'),
  ('tischler',         'Tischler'),
  ('fliesen',          'Fliesen'),
  ('dachdecker',       'Dachdecker'),
  ('zimmerer',         'Zimmerer & Holzbau'),
  ('maurer',           'Maurer & Betonbau'),
  ('metallbau',        'Metallbau & Schlosserei'),
  ('rollladen',        'Rollladen & Sonnenschutz')
on conflict (gewerk) do update set name = excluded.name;

alter table public.meisterpflicht_gewerke enable row level security;

-- KEINE Policy, also fuer Clients vollstaendig gesperrt (Standardverweigerung).
--
-- Der erste Entwurf hatte hier `for select using (true)` -- der Inhalt ist
-- oeffentliches Recht (Anlage A zur HwO), da schien eine pauschale Lese-Policy
-- harmlos. `scripts/db-test/rechte.sql` (RG) hat sie sofort rot gemacht, und
-- die Pruefung hatte recht: eine pauschale Lese-Policy ist nie noetig, wenn
-- ueberhaupt niemand die Tabelle lesen muss.
--
-- Muss auch niemand. Die drei Stellen, die die Liste brauchen, sind eine
-- Policy und zwei Trigger -- alle drei laufen als SECURITY DEFINER und
-- antworten nur mit ja/nein auf Werte, die der Aufrufer ohnehin hat. Die
-- Oberflaeche hat ihre eigene Liste in `data/categories.ts`, und dass beide
-- uebereinstimmen, prueft scripts/meisterpflicht-beleg-check.py.
--
-- Statt einer Ausnahme im Pruefstand also eine engere Loesung. Eingetragen in
-- docs/security/access-control-matrix.md.
revoke all on public.meisterpflicht_gewerke from public, anon, authenticated;
grant select on public.meisterpflicht_gewerke to service_role;

-- ── Braucht dieser Auftrag einen Meisterbrief? ─────────────────────────────
--
-- Getrennt und benannt, damit dieselbe Frage in Policy, Trigger und Test
-- WOERTLICH dieselbe ist. Zwei Formulierungen derselben Bedingung gehen
-- auseinander; das ist im Projekt schon zweimal vorgekommen.
--
-- Der Rueckfall auf `p_category` (den Anzeigenamen) ist kein Luxus: seit 0410
-- darf `jobs.category_id` NULL sein, und genau eine solche Zeile waere sonst
-- der Weg an der Pflicht vorbei.
create or replace function public.auftrag_braucht_meister(
  p_category_id text, p_category text
)
returns boolean
language sql
stable
-- SECURITY DEFINER, damit der Aufrufer die Tabelle NICHT lesen koennen muss.
-- Sie gibt nur ja/nein auf Werte zurueck, die der Aufrufer schon hat, und
-- nimmt keine fremde Kennung entgegen -- die Frage „braucht dieser Auftrag
-- einen Meisterbrief?" laesst sich nicht auf einen anderen Nutzer richten.
security definer
set search_path = public as $$
  select exists (
    select 1 from public.meisterpflicht_gewerke m
    where m.gewerk = p_category_id
       or lower(m.name) = lower(coalesce(p_category, ''))
  );
$$;

comment on function public.auftrag_braucht_meister(text, text) is
  'Gehoert dieser Auftrag zu einem Gewerk der Anlage A? Prueft die Kennung und '
  'ersatzweise den Anzeigenamen, weil jobs.category_id seit 0410 NULL sein darf.';

-- ── Die Freigabe haelt den Meisterbrief fest ───────────────────────────────
--
-- Bis heute setzte NICHTS `meister_verified` auf true. Der Betreiber sah den
-- Meisterbrief im Pruef-Postfach an -- und dieser Blick wurde nirgends
-- festgehalten. Ein Nachweis, der nur im Kopf des Pruefers existiert, ist
-- keiner (dieselbe Lehre wie am 16.08. bei der Widerrufs-Zustimmung).
--
-- ABLEITUNG STATT ZUSATZKLICK: eine Freigabe ist ohne Meisterbrief gar nicht
-- moeglich. `lib/pruefung.ts` gibt bei einem meisterpflichtigen Gewerk ohne
-- `meisterbrief_path` den Befund `sperrt` aus, und das Pruef-Postfach sperrt
-- den Knopf damit. Wer freigibt, hat das Dokument also vorliegen gehabt. Genau
-- das haelt dieser Trigger fest, nicht mehr.
--
-- Der Trigger laeuft VOR dem Schreibschutz aus 0650? Nein -- beide sind BEFORE
-- UPDATE, und die Reihenfolge ist alphabetisch. Deshalb heisst dieser hier
-- `a_meisterbrief_festhalten`: er muss VOR
-- `guard_provider_profile_sensitive_cols` laufen, sonst sieht der Schutz eine
-- Aenderung an `meister_verified`, die der Aufrufer gar nicht geschickt hat,
-- und wirft. Gemessen, nicht angenommen (Test MP9).
create or replace function public.meisterbrief_festhalten()
returns trigger language plpgsql
-- DEFINER: liest meisterpflicht_gewerke, das fuer Clients gesperrt ist.
security definer
set search_path = public as $$
begin
  -- Nur im Moment der Freigabe, und nur von 'in_review' kommend.
  if new.kyc_status = 'approved'
     and old.kyc_status is distinct from 'approved'
     and new.meisterbrief_path is not null
     and exists (select 1 from public.meisterpflicht_gewerke m where m.gewerk = new.trade_id)
  then
    new.meister_verified := true;
  end if;
  return new;
end;
$$;

drop trigger if exists a_meisterbrief_festhalten on public.provider_profiles;
create trigger a_meisterbrief_festhalten
  before update on public.provider_profiles
  for each row execute function public.meisterbrief_festhalten();

-- ── Das Gewerk laesst sich nicht nachtraeglich austauschen ─────────────────
--
-- Der eigentliche Weg an der Pflicht vorbei: `category_ids` ist in „Mein
-- Profil" frei aenderbar. Ein Betrieb ohne geprueften Meisterbrief darf dort
-- kein Anlage-A-Gewerk eintragen.
--
-- BEWUSST EIN TRIGGER UND KEINE POLICY: die UPDATE-Policy aus 0010 gehoert dem
-- Eigentuemer, und eine zweite Policy daneben wuerde ODER-verknuepft -- sie
-- wuerde also nichts sperren. Genau diese Falle steht in CLAUDE.md
-- („zwei Bedingungen, die dieselben Faelle abdecken").
create or replace function public.gewerk_wechsel_pruefen()
returns trigger language plpgsql
-- DEFINER: liest meisterpflicht_gewerke, das fuer Clients gesperrt ist.
-- Die Einschraenkung steht deshalb IN der Funktion (sie prueft NEW/OLD der
-- eigenen Zeile), nicht in einer Policy -- SECURITY DEFINER haette eine
-- Policy ohnehin ausgehebelt.
security definer
set search_path = public as $$
declare
  v_neu text[];
begin
  if current_setting('role', true) = 'service_role' then
    return new;
  end if;
  if new.category_ids is not distinct from old.category_ids then
    return new;
  end if;

  -- Nur das, was NEU dazukommt. Ein Betrieb, der ein Gewerk BEHAELT, das ihm
  -- einmal zugesprochen wurde, wird nicht nachtraeglich ausgesperrt -- sonst
  -- koennte er sein Profil gar nicht mehr speichern.
  select coalesce(array_agg(g), '{}') into v_neu
  from unnest(coalesce(new.category_ids, '{}')) g
  where not (g = any (coalesce(old.category_ids, '{}')));

  if exists (
    select 1 from unnest(v_neu) g
    join public.meisterpflicht_gewerke m on m.gewerk = g
  ) and not coalesce(new.meister_verified, false) then
    raise exception 'Fuer dieses Gewerk ist ein geprüfter Meisterbrief nötig (§ 1 HwO Anlage A). Reichen Sie ihn unter Verifizierung ein.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_gewerk_wechsel_pruefen on public.provider_profiles;
create trigger trg_gewerk_wechsel_pruefen
  before update on public.provider_profiles
  for each row execute function public.gewerk_wechsel_pruefen();

-- ── Und das Angebot selbst ─────────────────────────────────────────────────
--
-- Der Trigger oben deckt den Weg ueber das Profil ab. Diese Bedingung deckt
-- den Auftrag ab: auch ein Betrieb, dem ein Gewerk aus der Vergangenheit
-- verblieben ist, bietet ohne geprueften Meisterbrief nicht auf einen
-- Anlage-A-Auftrag.
--
-- Alles Uebrige ist Wort fuer Wort aus 0820 uebernommen.
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
        and (
          j.track = 'nachbarschaft'
          or not exists (
            select 1 from public.provider_profiles pp
            where pp.id = auth.uid() and pp.is_nachbarschaft
          )
        )
        and (
          not public.auftrag_braucht_meister(j.category_id, j.category)
          or exists (
            select 1 from public.provider_profiles pp
            where pp.id = auth.uid() and pp.meister_verified
          )
        )
    )
  );

-- ── Bestand uebernehmen ────────────────────────────────────────────────────
--
-- Wer BEREITS freigegeben ist und einen Meisterbrief eingereicht hat, wurde
-- unter der alten Regel genau daraufhin geprueft: `lib/pruefung.ts` gibt bei
-- einem Anlage-A-Gewerk ohne `meisterbrief_path` den Befund `sperrt` aus, und
-- das Pruef-Postfach sperrt den Freigabeknopf damit. Eine Freigabe SETZT das
-- Dokument also voraus. Diese Betriebe werden nicht ausgesperrt.
update public.provider_profiles pp
   set meister_verified = true
 where pp.kyc_status = 'approved'
   and pp.meisterbrief_path is not null
   and coalesce(pp.meister_verified, false) = false
   and exists (select 1 from public.meisterpflicht_gewerke m where m.gewerk = pp.trade_id);

-- Und wer freigegeben ist, ein Anlage-A-Gewerk fuehrt, aber KEIN Dokument
-- hinterlegt hat, bekommt hier NICHTS geschenkt. Er kann ab sofort nicht mehr
-- auf Anlage-A-Auftraege bieten, und das ist der Zweck der Uebung. Die Zahl
-- steht im Protokoll des Migrationslaufs, damit sie jemand sieht statt sie zu
-- entdecken.
do $$
declare n int;
begin
  select count(*) into n
    from public.provider_profiles pp
   where pp.kyc_status = 'approved'
     and not coalesce(pp.meister_verified, false)
     and exists (
       select 1 from unnest(coalesce(pp.category_ids, '{}')) g
       join public.meisterpflicht_gewerke m on m.gewerk = g);
  if n > 0 then
    raise notice '0980: % freigegebene(r) Betrieb(e) fuehren ein Anlage-A-Gewerk ohne geprueften Meisterbrief und koennen darauf ab sofort nicht mehr bieten. Meisterbrief anfordern oder Gewerk korrigieren.', n;
  else
    raise notice '0980: kein freigegebener Betrieb ist von der Sperre betroffen.';
  end if;
end $$;

-- ── Ausfuehrungsrechte ─────────────────────────────────────────────────────
--
-- PostgreSQL gibt JEDER neuen Funktion EXECUTE an PUBLIC, unabhaengig von
-- jeder Vorgabe. Ein Widerruf allein gegen die Rolle wirkt nicht (07.09.).
--
-- `auftrag_braucht_meister` BLEIBT fuer Angemeldete ausfuehrbar: sie steht in
-- der Policy oben, und eine Policy laeuft mit den Rechten des Aufrufers. Wird
-- ihr das Recht entzogen, kann KEIN Betrieb mehr bieten -- genau die Falle vom
-- 07.09. Sie gibt nur oeffentliches Recht zurueck und nimmt keine fremde
-- Kennung entgegen.
revoke execute on function public.auftrag_braucht_meister(text, text)
  from public, anon;
grant execute on function public.auftrag_braucht_meister(text, text)
  to authenticated, service_role;

-- Die beiden Trigger-Funktionen braucht niemand direkt. PostgreSQL prueft beim
-- Ausloesen kein EXECUTE.
revoke execute on function public.meisterbrief_festhalten()
  from public, anon, authenticated;
revoke execute on function public.gewerk_wechsel_pruefen()
  from public, anon, authenticated;
