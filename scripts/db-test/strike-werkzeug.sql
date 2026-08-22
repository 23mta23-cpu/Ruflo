-- Werkzeug fuer Strikes von Hand (Migration 0750)
--
-- 0720 hat die Akte gebaut, aber nur der automatische Grund wurde je vergeben.
-- Ein Strike von Hand war ein roher INSERT — und damit ein halber Vorgang:
-- der angezeigte Zaehler blieb stehen, die Begruendung musste nur 20 Zeichen
-- lang sein, und ob sie je zugestellt wurde, stand nirgends.
--
-- (V1)  Zu duenne Tatsachen werden abgewiesen (Art. 4 P2B-VO)
-- (V2)  Unbekannter Grund wird abgewiesen
-- (V3)  Unbekanntes Anbieterprofil wird abgewiesen
-- (V4)  Die Begruendung nennt Grund, Tatsachen, Frist UND Beschwerdeweg
-- (V5)  Das Datum im Text ist DASSELBE wie in der Spalte
-- (V6)  Der Zaehler folgt der Akte beim Erteilen  ← das eigentliche Loch
-- (V7)  Der Zaehler folgt der Akte beim Aufheben (§7(5))
-- (V8)  Aufheben ohne Grund und doppeltes Aufheben werden abgewiesen
-- (V9)  Die Zustellung ist vorher offen und danach belegt (§7(4))
-- (V10) Ein Angemeldeter kann die Werkzeuge NICHT ausfuehren
-- (V11) Drei per Werkzeug erteilte Strikes sperren die Angebotsabgabe
-- (V12) Der Zaehler folgt der Akte auch beim Loeschen
reset role;

alter table auth.users disable trigger user;
alter table public.profiles disable trigger user;
alter table public.jobs disable trigger user;

insert into auth.users (id,email,email_confirmed_at) values
  ('ed000001-0000-0000-0000-000000000000','wk@test.de',now()),   -- Kunde
  ('ed000002-0000-0000-0000-000000000000','wa@test.de',now()),   -- Anbieter A
  ('ed000003-0000-0000-0000-000000000000','wb@test.de',now());   -- Anbieter B (Sperre)
insert into profiles (id,role,email,email_verified_at) values
  ('ed000001-0000-0000-0000-000000000000','customer','wk@test.de',now()),
  ('ed000002-0000-0000-0000-000000000000','provider','wa@test.de',now()),
  ('ed000003-0000-0000-0000-000000000000','provider','wb@test.de',now());
insert into provider_profiles (id,business_name,is_nachbarschaft,strike_count) values
  ('ed000002-0000-0000-0000-000000000000','WA',false,0),
  ('ed000003-0000-0000-0000-000000000000','WB',false,0);
insert into jobs (id,customer_id,title,description,category,address_plz,address_city,track,status) values
  ('ed000004-0000-0000-0000-000000000000','ed000001-0000-0000-0000-000000000000','WOffen','Lang genug beschrieben hier drin.','Elektro','50667','Koeln','handwerker','open');

alter table auth.users enable trigger user;
alter table public.profiles enable trigger user;
alter table public.jobs enable trigger user;

-- TEST V1: Der Spalten-CHECK auf `begruendung` schuetzt hier gar nichts — er
-- misst den ZUSAMMENGESETZTEN Text, und der ist durch das Geruest immer lang
-- genug. Die einzige Schranke gegen "Verstoss." als Begruendung ist die
-- Pruefung im Werkzeug. Der Testtext liegt bewusst zwischen den beiden Werten
-- (28 Zeichen): er faellt durch die 40er-Schranke, aber nicht durch die 20er
-- des CHECKs — sonst koennte der Test nicht unterscheiden, welche von beiden
-- gegriffen hat.
do $$
declare abgewiesen boolean := false;
begin
  begin
    perform strike_erteilen('ed000002-0000-0000-0000-000000000000','preiserhoehung','Preis nachtraeglich erhoeht.');
  exception when others then abgewiesen := true;
  end;
  if not abgewiesen then raise exception 'FAIL: eine Begruendung ohne Tatsachen wurde akzeptiert'; end if;
  raise notice 'PASS V1: zu duenne Tatsachen werden abgewiesen';
end $$;

-- TEST V2: ein Grund, der nicht in AGB §7(2) steht, darf nicht vergeben werden
-- koennen — der Anbieter muss ihn in den veroeffentlichten AGB wiederfinden.
do $$
declare abgewiesen boolean := false;
begin
  begin
    perform strike_erteilen('ed000002-0000-0000-0000-000000000000','unpuenktlich',
      'Der Anbieter kam am 03.08.2026 vierzig Minuten zu spaet zum vereinbarten Termin.');
  exception when others then abgewiesen := true;
  end;
  if not abgewiesen then raise exception 'FAIL: ein Grund ausserhalb der AGB wurde vergeben'; end if;
  raise notice 'PASS V2: Gruende ausserhalb AGB §7(2) werden abgewiesen';
end $$;

-- TEST V3: Strikes treffen Anbieter. Eine Kunden-ID (oder ein Tippfehler)
-- darf keine Akte anlegen, die dann niemandem gehoert.
do $$
declare abgewiesen boolean := false;
begin
  begin
    perform strike_erteilen('ed000001-0000-0000-0000-000000000000','nichterscheinen',
      'Zum Termin am 03.08.2026 um 09:00 Uhr ist niemand erschienen, keine Absage.');
  exception when others then abgewiesen := true;
  end;
  if not abgewiesen then raise exception 'FAIL: Strike auf ein Profil ohne Anbieterrolle angelegt'; end if;
  raise notice 'PASS V3: Strike ohne Anbieterprofil wird abgewiesen';
end $$;

-- TEST V4 + V5 + V6: der Regelfall.
do $$
declare
  v_id       uuid;
  v_text     text;
  v_faellt   timestamptz;
  v_zaehler  int;
begin
  select strike_count into v_zaehler from provider_profiles
   where id='ed000002-0000-0000-0000-000000000000';
  if v_zaehler <> 0 then raise exception 'FAIL: Vorbedingung verletzt, Zaehler war schon %', v_zaehler; end if;

  select strike_erteilen('ed000002-0000-0000-0000-000000000000','nichterscheinen',
    'Zum vereinbarten Termin am 03.08.2026 um 09:00 Uhr ist der Anbieter nicht '
    || 'erschienen und hat weder abgesagt noch auf die Nachfrage des Kunden im '
    || 'Chat reagiert (Auftrag WOffen).') into v_id;

  select begruendung, verfaellt_am into v_text, v_faellt
    from provider_strikes where id = v_id;

  -- Art. 4 P2B-VO: massgeblicher Grund UND massgebliche Tatsachen.
  if position('Nichterscheinen ohne Stornierung' in v_text) = 0 then
    raise exception 'FAIL: die Begruendung nennt den AGB-Grund nicht';
  end if;
  if position('03.08.2026' in v_text) = 0 then
    raise exception 'FAIL: die Begruendung nennt die Tatsachen nicht';
  end if;
  -- AGB §7(3) Frist und §7(5) Beschwerdeweg gehoeren dazu, sonst kann der
  -- Anbieter weder die Dauer noch seinen Rechtsbehelf erkennen.
  if position('§7(3)' in v_text) = 0 then
    raise exception 'FAIL: die Begruendung nennt die 12-Monats-Frist nicht';
  end if;
  if position('kontakt@werkant.de' in v_text) = 0 then
    raise exception 'FAIL: die Begruendung nennt den Beschwerdeweg nicht';
  end if;
  raise notice 'PASS V4: die Begruendung nennt Grund, Tatsachen, Frist und Beschwerdeweg';

  -- Zwei getrennt gerechnete Daten koennen auseinanderlaufen; dann
  -- widerspricht die zugestellte Begruendung der Akte.
  --
  -- GRENZE dieses Tests, damit ihm niemand zu viel zutraut: er faellt, wenn
  -- die FRIST auseinanderlaeuft (Spalte 12 Monate, Text 6) — nachgewiesen per
  -- Mutation. Er faellt NICHT, wenn jemand denselben Ausdruck zweimal
  -- ausrechnet, denn `now()` ist innerhalb einer Transaktion fest und beide
  -- Werte waeren zufaellig gleich. Dass beide aus einer Variablen kommen, ist
  -- eine Quelltext-Frage und laesst sich zur Laufzeit nicht belegen.
  if position(to_char(v_faellt,'DD.MM.YYYY') in v_text) = 0 then
    raise exception 'FAIL: das Verfallsdatum im Text passt nicht zur Spalte (%)', v_faellt;
  end if;
  raise notice 'PASS V5: Verfallsdatum im Text und in der Spalte sind dasselbe';

  -- Das eigentliche Loch: bis 0750 fuehrte nur apply_leak_strikes den Zaehler
  -- nach. Ein Strike von Hand liess die angezeigte Zahl auf 0 stehen, waehrend
  -- die Sperre bereits griff.
  select strike_count into v_zaehler from provider_profiles
   where id='ed000002-0000-0000-0000-000000000000';
  if v_zaehler <> 1 then
    raise exception 'FAIL: Zaehler folgte dem Strike von Hand nicht (%)', v_zaehler;
  end if;
  raise notice 'PASS V6: der Zaehler folgt der Akte beim Erteilen';
end $$;

-- TEST V9: Zustellung. Vorher offen, danach belegt — vor 0750 gab es dafuer
-- ueberhaupt keine Spalte, und §7(4) war nicht nachweisbar.
do $$
declare v_id uuid; v_zu timestamptz; v_weg text;
begin
  select id into v_id from provider_strikes
   where provider_id='ed000002-0000-0000-0000-000000000000' limit 1;

  select begruendung_zugestellt_am into v_zu from provider_strikes where id=v_id;
  if v_zu is not null then raise exception 'FAIL: Zustellung galt ohne Zutun als erledigt'; end if;

  perform strike_zustellung_vermerken(v_id,'E-Mail an wa@test.de am 21.08.2026, 10:15 Uhr');
  select begruendung_zugestellt_am, zustellweg into v_zu, v_weg from provider_strikes where id=v_id;
  if v_zu is null or v_weg is null then raise exception 'FAIL: Zustellvermerk wurde nicht gespeichert'; end if;
  raise notice 'PASS V9: die Zustellung ist vorher offen und danach belegt';
end $$;

-- TEST V7 + V8: Beschwerde nach AGB §7(5).
do $$
declare v_id uuid; v_zaehler int; abgewiesen boolean := false;
begin
  select id into v_id from provider_strikes
   where provider_id='ed000002-0000-0000-0000-000000000000' limit 1;

  begin
    perform strike_aufheben(v_id,'ok');
  exception when others then abgewiesen := true;
  end;
  if not abgewiesen then raise exception 'FAIL: Aufhebung ohne Grund wurde akzeptiert'; end if;

  perform strike_aufheben(v_id,'Beschwerde begruendet: der Termin war nachweislich abgesagt.');

  select strike_count into v_zaehler from provider_profiles
   where id='ed000002-0000-0000-0000-000000000000';
  if v_zaehler <> 0 then
    raise exception 'FAIL: Zaehler folgte der Aufhebung nicht (%)', v_zaehler;
  end if;
  raise notice 'PASS V7: der Zaehler folgt der Akte beim Aufheben';

  abgewiesen := false;
  begin
    perform strike_aufheben(v_id,'Nochmal aufheben, obwohl schon aufgehoben.');
  exception when others then abgewiesen := true;
  end;
  if not abgewiesen then raise exception 'FAIL: ein bereits aufgehobener Strike liess sich erneut aufheben'; end if;
  raise notice 'PASS V8: Aufhebung ohne Grund und doppelte Aufhebung werden abgewiesen';
end $$;

-- TEST V10: `security definer` laeuft als Eigentuemer. Waere die Ausfuehrung
-- nicht ausdruecklich entzogen, koennte jeder Angemeldete sich selbst oder
-- einen Mitbewerber sperren.
set role authenticated;
set request.jwt.claim.sub = 'ed000002-0000-0000-0000-000000000000';
do $$
declare code text := '';
begin
  begin
    perform strike_erteilen('ed000003-0000-0000-0000-000000000000','falsche_angaben',
      'Ein Angemeldeter versucht, einen Mitbewerber mit einem Strike zu belegen.');
  exception when others then code := SQLSTATE;
  end;
  if code <> '42501' then
    raise exception 'FAIL: strike_erteilen war fuer einen Angemeldeten ausfuehrbar (SQLSTATE %)', code;
  end if;

  code := '';
  begin
    perform strike_aufheben(gen_random_uuid(),'Eigenen Strike selbst wegraeumen wollen.');
  exception when others then code := SQLSTATE;
  end;
  if code <> '42501' then
    raise exception 'FAIL: strike_aufheben war fuer einen Angemeldeten ausfuehrbar (SQLSTATE %)', code;
  end if;
  raise notice 'PASS V10: die Werkzeuge sind fuer Angemeldete nicht ausfuehrbar';
end $$;
reset role;

-- TEST V11: End-zu-Ende. Drei per Werkzeug erteilte Strikes muessen dieselbe
-- Sperre ausloesen wie drei automatisch vergebene — sonst waere das Werkzeug
-- eine Akte ohne Wirkung.
do $$
begin
  perform strike_erteilen('ed000003-0000-0000-0000-000000000000','preiserhoehung',
    'Nach Vertragsabschluss am 01.08.2026 den vereinbarten Preis von 200 auf 260 Euro erhoeht.');
  perform strike_erteilen('ed000003-0000-0000-0000-000000000000','nichterscheinen',
    'Zum Termin am 05.08.2026 um 08:00 Uhr nicht erschienen, keine Absage, keine Rueckmeldung.');
  perform strike_erteilen('ed000003-0000-0000-0000-000000000000','falsche_angaben',
    'Der eingereichte Meisterbrief vom 06.08.2026 war nicht auf den Betrieb ausgestellt.');
end $$;
set role authenticated;
set request.jwt.claim.sub = 'ed000003-0000-0000-0000-000000000000';
do $$
begin
  insert into offers (job_id,provider_id,price,status)
  values ('ed000004-0000-0000-0000-000000000000','ed000003-0000-0000-0000-000000000000',90,'pending');
  raise exception 'FAIL: drei per Werkzeug erteilte Strikes sperren nicht!';
exception when insufficient_privilege then
  raise notice 'PASS V11: drei per Werkzeug erteilte Strikes sperren die Angebotsabgabe';
end $$;
reset role;

-- TEST V12: auch das Loeschen einer Akte muss den Zaehler nachfuehren —
-- sonst bliebe nach einer Bereinigung eine Sperranzeige ohne Akte stehen.
do $$
declare v_zaehler int;
begin
  delete from provider_strikes where provider_id='ed000003-0000-0000-0000-000000000000';
  select strike_count into v_zaehler from provider_profiles
   where id='ed000003-0000-0000-0000-000000000000';
  if v_zaehler <> 0 then
    raise exception 'FAIL: Zaehler folgte dem Loeschen der Akte nicht (%)', v_zaehler;
  end if;
  raise notice 'PASS V12: der Zaehler folgt der Akte auch beim Loeschen';
end $$;
