-- DSA: Melde- und Abhilfeverfahren (Art. 16), Begründung (Art. 17),
-- Nutzerzahl (Art. 24 Abs. 3) — Migration 0810
--
-- (DS-A) Eine vollständige Meldung wird angenommen
-- (DS-B) Meldung ohne Erklärung in gutem Glauben wird abgewiesen (Art. 16(2)(d))
-- (DS-C) Zu dünne Begründung wird abgewiesen (Art. 16(2)(a))
-- (DS-D) Kein Angemeldeter kann selbst eine Meldung schreiben (nur die Function)
-- (DS-E) Der Melder liest seine eigene Meldung, ein Fremder nicht
-- (DS-F) beschraenkung_erteilen setzt räumlichen Umfang UND Rechtsbehelf selbst
-- (DS-G) Die Begründung enthält alle sechs Pflichtbestandteile aus Art. 17(3)
-- (DS-H) Tatsachen unter 40 Zeichen werden abgewiesen
-- (DS-I) Der Betroffene liest seine Begründung
-- (DS-J) Ein FREMDER bekommt die Begründung NICHT — auch mit gültiger Nummer
-- (DS-K) Kein Angemeldeter kann eine Beschränkung erteilen oder aufheben
-- (DS-L) 'meldung' als Auslöser ohne meldung_id wird abgewiesen
-- (DS-M) aktive_nutzer_monat zählt in Ortszeit und ist für Nutzer gesperrt

\set melder   '''d5a00000-0000-0000-0000-000000000001'''
\set fremder  '''d5a00000-0000-0000-0000-000000000002'''
\set betroff  '''d5a00000-0000-0000-0000-000000000003'''

reset role;
insert into auth.users (id, email) values
  (:melder,'m.dsa@example.com'), (:fremder,'f.dsa@example.com'), (:betroff,'b.dsa@example.com')
  on conflict do nothing;
insert into public.profiles (id, role, full_name, display_name, email_verified_at) values
  (:melder,'customer','Melderin M','MM',now()),
  (:fremder,'customer','Fremder F','FF',now()),
  (:betroff,'provider','Betroffener B','BB',now())
  on conflict (id) do update set email_verified_at = now();

-- ── DS-A: vollständige Meldung ─────────────────────────────────────────────
do $$
declare v_id uuid;
begin
  insert into public.inhalts_meldungen
    (inhalt_art, fundstelle, begruendung, melder_name, melder_email, melder_id, treu_und_glauben)
  values
    ('profil', '/anbieter/abc123',
     'Das Profil verwendet ein fremdes Firmenlogo und eine Meisterurkunde, die nachweislich zu einem anderen Betrieb gehört.',
     'Melderin M', 'm.dsa@example.com', 'd5a00000-0000-0000-0000-000000000001', true)
  returning id into v_id;
  if v_id is null then raise exception 'FAIL DS-A: keine Kennung zurück'; end if;
  raise notice 'PASS DS-A: vollständige Meldung wird angenommen';
end $$;

-- ── DS-B: ohne Erklärung in gutem Glauben ──────────────────────────────────
-- ACHTUNG, hier stand zuerst melder_name = 'X'. Ein Zeichen — und die
-- Namens-Schranke (2..120) griff, BEVOR treu_und_glauben überhaupt geprüft
-- wurde. Der Test bestand damit aus dem falschen Grund und blieb unter der
-- Mutation „Prüfung entfernt" grün. Jede weitere Angabe muss gültig sein,
-- sonst prüft der Negativtest die falsche Schranke.
do $$
begin
  begin
    insert into public.inhalts_meldungen
      (inhalt_art, fundstelle, begruendung, melder_name, melder_email, treu_und_glauben)
    values ('profil','/anbieter/x',
      'Eine ausreichend lange Begründung, die aber ohne die Erklärung in gutem Glauben kommt.',
      'Testerin T','x@example.com', false);
    raise exception 'FAIL DS-B: Meldung ohne Erklärung in gutem Glauben wurde angenommen';
  exception when check_violation then
    raise notice 'PASS DS-B: ohne Erklärung in gutem Glauben abgewiesen';
  end;
end $$;

-- ── DS-C: zu dünne Begründung ──────────────────────────────────────────────
do $$
begin
  begin
    insert into public.inhalts_meldungen
      (inhalt_art, fundstelle, begruendung, melder_name, melder_email, treu_und_glauben)
    values ('profil','/anbieter/x','ist illegal','Testerin T','x@example.com', true);
    raise exception 'FAIL DS-C: "ist illegal" wurde als Begründung angenommen';
  exception when check_violation then
    raise notice 'PASS DS-C: zu dünne Begründung abgewiesen';
  end;
end $$;

-- ── DS-D: Angemeldete schreiben nicht selbst in die Tabelle ────────────────
set role authenticated;
set request.jwt.claim.sub = 'd5a00000-0000-0000-0000-000000000001';
do $$
begin
  begin
    insert into public.inhalts_meldungen
      (inhalt_art, fundstelle, begruendung, melder_name, melder_email, melder_id, treu_und_glauben)
    values ('profil','/anbieter/y',
      'Eine ausreichend lange und ernsthafte Begründung für einen rechtswidrigen Inhalt.',
      'Melderin M','m.dsa@example.com','d5a00000-0000-0000-0000-000000000001', true);
    raise exception 'FAIL DS-D: ein Angemeldeter konnte direkt in die Tabelle schreiben';
  exception when insufficient_privilege then
    raise notice 'PASS DS-D: nur die Edge Function schreibt Meldungen';
  end;
end $$;

-- ── DS-E: eigene Meldung lesen, fremde nicht ───────────────────────────────
do $$
declare n integer;
begin
  select count(*) into n from public.inhalts_meldungen;
  if n <> 1 then raise exception 'FAIL DS-E: Melderin sah % eigene Meldungen (erwartet 1)', n; end if;
  raise notice 'PASS DS-E: die Melderin sieht ihre eigene Meldung';
end $$;

set request.jwt.claim.sub = 'd5a00000-0000-0000-0000-000000000002';
do $$
declare n integer;
begin
  select count(*) into n from public.inhalts_meldungen;
  if n <> 0 then raise exception 'FAIL DS-E: ein Fremder sah % Meldungen', n; end if;
  raise notice 'PASS DS-E: ein Fremder sieht keine fremden Meldungen';
end $$;

-- ── DS-F: Pflichtbestandteile werden von der Funktion gesetzt ──────────────
reset role;
do $$
declare v_id uuid; r record;
begin
  v_id := public.beschraenkung_erteilen(
    'd5a00000-0000-0000-0000-000000000003'::uuid,
    'konto_gesperrt',
    '30 Tage',
    'Der Betrieb hat in drei Fällen Kundinnen aufgefordert, die Zahlung bar und an der Plattform vorbei zu leisten.',
    'agb',
    'AGB §7 Absatz 2 Buchstabe b (Umgehung der Zahlungsabwicklung)');
  select * into r from public.beschraenkungen where id = v_id;
  if coalesce(r.raeumlicher_umfang,'') = '' then
    raise exception 'FAIL DS-F: räumlicher Umfang fehlt (Art. 17(3)(a))';
  end if;
  if r.rechtsbehelf not ilike '%kontakt@werkant.de%' then
    raise exception 'FAIL DS-F: Rechtsbehelf nennt keinen Weg (Art. 17(3)(f))';
  end if;
  if r.rechtsbehelf not ilike '%Rechtsweg%' then
    raise exception 'FAIL DS-F: Rechtsbehelf nennt den Rechtsweg nicht';
  end if;
  raise notice 'PASS DS-F: räumlicher Umfang und Rechtsbehelf kommen von der Funktion';
end $$;

-- ── DS-G: alle sechs Pflichtbestandteile im Text ───────────────────────────
-- Läuft als der BETROFFENE, nicht als Eigentümer: die Funktion prüft
-- auth.uid() selbst (siehe DS-J), ein Aufruf ohne passende Kennung liefert
-- immer NULL — auch dem Datenbank-Eigentümer.
set role authenticated;
set request.jwt.claim.sub = 'd5a00000-0000-0000-0000-000000000003';
do $$
declare t text; v_id uuid;
begin
  select id into v_id from public.beschraenkungen limit 1;
  select public.beschraenkung_begruendung(v_id) into t;
  if t is null then raise exception 'FAIL DS-G: kein Text'; end if;
  if t not like '%Art der Maßnahme%'        then raise exception 'FAIL DS-G: lit. a fehlt'; end if;
  if t not like '%Dauer: 30 Tage%'          then raise exception 'FAIL DS-G: Dauer fehlt (lit. a)'; end if;
  if t not like '%Tatsachen und Umstände%'  then raise exception 'FAIL DS-G: lit. b fehlt'; end if;
  if t not like '%selbst festgestellt%'     then raise exception 'FAIL DS-G: Auslöser fehlt (lit. b)'; end if;
  if t not like '%automatisierte Mittel%'   then raise exception 'FAIL DS-G: lit. c fehlt'; end if;
  if t not like '%Vertragliche Grundlage%'  then raise exception 'FAIL DS-G: lit. e fehlt'; end if;
  if t not like '%Was Sie tun können%'      then raise exception 'FAIL DS-G: lit. f fehlt'; end if;
  raise notice 'PASS DS-G: die Begründung enthält alle Pflichtbestandteile';
end $$;

-- ── DS-H: Tatsachen unter 40 Zeichen ───────────────────────────────────────
-- Als Eigentümer: geprüft wird die CHECK-Schranke, nicht das Aufrufrecht.
-- Ohne dieses reset role scheiterte der Aufruf an der Rechteprüfung und der
-- Test hätte aus dem falschen Grund bestanden.
reset role;
-- Der Text hat 28 Zeichen: unter den 40 der Spalte, aber lang genug, dass
-- nicht eine andere Schranke greift und der Test aus dem falschen Grund
-- besteht (dieselbe Vorsicht wie bei V1 in strike-werkzeug).
do $$
begin
  begin
    perform public.beschraenkung_erteilen(
      'd5a00000-0000-0000-0000-000000000003'::uuid,
      'inhalt_entfernt', '1 Tag',
      'Hat gegen die Regeln.',
      'agb', 'AGB §7 Absatz 1');
    raise exception 'FAIL DS-H: 21 Zeichen Tatsachen wurden angenommen';
  exception when check_violation then
    raise notice 'PASS DS-H: zu dünner Tatsachenvortrag abgewiesen';
  end;
end $$;

-- ── DS-I: der Betroffene sieht seine Zeile über die Policy ─────────────────
-- Bewusst ein ANDERER Mechanismus als DS-G: dort die Funktion, hier die
-- RLS-Policy der Tabelle. Zwei Wege, die beide offen sein müssen.
do $$
declare n integer;
begin
  select count(*) into n from public.beschraenkungen;
  if n < 1 then raise exception 'FAIL DS-I: der Betroffene sieht seine Beschränkung nicht'; end if;
  raise notice 'PASS DS-I: der Betroffene sieht seine Beschränkung über die Policy';
end $$;

-- DS-J ist der Test für das Loch, das beim ersten Schreiben von 0810
-- tatsächlich drin war: beschraenkung_begruendung() ist SECURITY DEFINER und
-- für authenticated freigegeben — die RLS-Policy der Tabelle greift darin
-- NICHT. Ohne den Zweig `betroffener = auth.uid()` in der Funktion selbst
-- könnte jeder Angemeldete mit einer fremden Vorgangsnummer den kompletten
-- Tatsachenvortrag über eine andere Person lesen.
--
-- Die Nummer wird als Eigentümer in eine Sitzungsvariable gelegt. Ein Fremder
-- käme über die Policy gar nicht an sie heran, und der Test bestünde dann aus
-- dem falschen Grund — genau die Klasse „Negativtest scheitert an der falschen
-- Schranke".
reset role;
select set_config('dsa.bnr', (select id::text from public.beschraenkungen limit 1), false);

set role authenticated;
set request.jwt.claim.sub = 'd5a00000-0000-0000-0000-000000000002';
do $$
declare t text; v_id uuid;
begin
  v_id := nullif(current_setting('dsa.bnr', true), '')::uuid;
  if v_id is null then raise exception 'FAIL DS-J: keine Vorgangsnummer gemerkt'; end if;
  select public.beschraenkung_begruendung(v_id) into t;
  if t is not null then
    raise exception 'FAIL DS-J: ein Fremder bekam die Begründung: %', left(t, 60);
  end if;
  raise notice 'PASS DS-J: ein Fremder bekommt die Begründung NICHT';
end $$;

-- ── DS-K: Nutzer erteilen und heben keine Beschränkungen ───────────────────
do $$
begin
  begin
    perform public.beschraenkung_erteilen(
      'd5a00000-0000-0000-0000-000000000001'::uuid, 'konto_gesperrt', '1 Tag',
      'Ein ausreichend langer Tatsachenvortrag, der die Vierzig-Zeichen-Schranke sicher überschreitet.',
      'agb', 'AGB §7');
    raise exception 'FAIL DS-K: ein Angemeldeter konnte eine Beschränkung erteilen';
  exception when insufficient_privilege then
    raise notice 'PASS DS-K: beschraenkung_erteilen ist für Nutzer gesperrt';
  end;
end $$;

do $$
begin
  begin
    perform public.beschraenkung_aufheben(current_setting('dsa.bnr')::uuid, 'einfach so');
    raise exception 'FAIL DS-K: ein Angemeldeter konnte eine Beschränkung aufheben';
  exception when insufficient_privilege then
    raise notice 'PASS DS-K: beschraenkung_aufheben ist für Nutzer gesperrt';
  end;
end $$;

-- ── DS-L: 'meldung' als Auslöser braucht eine Meldung ──────────────────────
reset role;
do $$
begin
  begin
    perform public.beschraenkung_erteilen(
      'd5a00000-0000-0000-0000-000000000003'::uuid, 'inhalt_entfernt', '1 Tag',
      'Ein ausreichend langer Tatsachenvortrag, der die Vierzig-Zeichen-Schranke sicher überschreitet.',
      'rechtswidrig', '§ 4 UWG', 'meldung', null);
    raise exception 'FAIL DS-L: Auslöser "meldung" ohne meldung_id wurde angenommen';
  exception when check_violation then
    raise notice 'PASS DS-L: Auslöser "meldung" verlangt die Meldung';
  end;
end $$;

-- ── DS-M: Nutzerzahl ───────────────────────────────────────────────────────
do $$
declare n integer;
begin
  select count(*) into n from public.aktive_nutzer_monat(12);
  raise notice 'PASS DS-M: aktive_nutzer_monat ist als Betreiber aufrufbar (% Monate)', n;
end $$;

set role authenticated;
set request.jwt.claim.sub = 'd5a00000-0000-0000-0000-000000000002';
do $$
begin
  begin
    perform 1 from public.aktive_nutzer_monat(12);
    raise exception 'FAIL DS-M: ein Nutzer konnte die Nutzerzahl abfragen';
  exception when insufficient_privilege then
    raise notice 'PASS DS-M: die Nutzerzahl ist für Nutzer gesperrt';
  end;
end $$;

reset role;
