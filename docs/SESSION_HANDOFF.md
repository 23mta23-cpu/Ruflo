# Session-Handoff (Stand 2026-07-13, abends)

## Infra-Erkenntnisse heute (WICHTIG für alle künftigen Sessions)
- Supabase-GitHub-Integration aktiv: wendet Migrationen aus supabase/migrations
  bei Push auf main AUTOMATISCH an und deployt Edge Functions — aber NUR
  Functions, die in supabase/config.toml deklariert sind (alle 10 jetzt drin).
  Kein manuelles SQL/Dashboard-Deploy mehr noetig!
- Geld-Fluss + Registrierung waren mehrfach kaputt und sind repariert
  (PR #41 accept_offer, #42 Verifikations-Gate, #45 Schema-Grants nach
  drop-schema-Reset + Erst-Deploy aller Functions, #46 Autoconfirm-Gate-Loch).
- Verifikation: eigenes DOI via verify-email Function (Resend);
  Gate = profiles.email_verified_at, DB-erzwungen (0400/0430).
- OFFEN: RESEND_API_KEY als Edge-Function-Secret (Founder, resend.com) —
  bis dahin gehen keine Bestaetigungs-/Wartelisten-Mails raus.


## Zuletzt geliefert (alles gemerged + live)
- 14.07.: Deutschlandweit frei (PR #48). Anbieter-Lead-Flow geschlossen:
  Dashboard zeigt jetzt offene Auftraege ("Neue Auftraege" -> Angebot
  abgeben) statt eigene Angebote als Fake-"Anfragen"; eigene Angebote als
  "Deine offenen Angebote" mit Zurueckziehen. Suche: Skeleton statt Spinner.
  zahlung.tsx ohne contractId sauber abgefangen.
- PR #38: Grouped-Settings-Stil auf Einstellungen + Anbieter-Dashboard
  (Kennzahlen-2er-Raster, gruppierte „Heute geplant"-Liste, Reveal-Staffelung;
  Konto-Tab-Referenz 248a362 war schon in main). tsc 0 · Jest 337/337 ·
  Playwright-verifiziert.
- Hinweis Founder „Motions nicht sichtbar": Reveal respektiert iOS
  „Bewegung reduzieren" — Einstellung prüfen, bevor wir Motion debuggen.
- PR #33/#34/#35/#36: Login-Fix (Backfill 0380 + Selbstheilung), Motion-Layer
  (Reveal), ProgressRing (Auftragsstatus), Gewerke-Katalog 13 + Progressive
  Disclosure, NB-Freitextfeld, Anbieter-Warteliste (statt totem KYC-Funnel),
  illustrierte Empty States (EmptyStateArt), totes app/nachrichten.tsx-Duplikat
  gelöscht, Security-Checkliste, 7 Betriebs-Playbooks, CLAUDE.md −51 %.
- Deploys #34/#35 im Live-Bundle verifiziert; #36 gemerged (Deploy-Pipeline
  lief heute 3/3 — nicht erneut pollen, Founder lädt App einfach neu).

## Offen (nächste Session)
1. Founder-Feedback vom iPhone-Test einsammeln (Warteliste, Ring, Empty States).
2. Login-Test alter Account: Fehlermeldung nennt jetzt echten Grund in Klammern.
3. Security-Dashboard-Klicks des Founders (GO-LIVE-SECURITY-CHECKLIST.md 1–4).
4. Optional als Nächstes: Motion auf Auftrag-Wizard; Skeleton statt Spinner in
   suche.tsx; Wochen-Briefing-Routine (Founder hat noch nicht ja gesagt).
5. Transaktionaler Kern (Angebot→Vertrag→Zahlung) weiterhin ungetestet live.

## Token-Disziplin (Founder: Budget knapp!)
- Kurze Antworten, keine Re-Reads (82 % der Read-Verschwendung), Fixes bündeln,
  EIN Verifikations-Pass pro Feature, Deploy nicht pollen wenn Pipeline grün.

## Update 2026-07-16 (branch claude/grouped-settings-style-xpvyu6, noch offen)
- Zugeschnittenes Werkant-Team als statische Agenten angelegt:
  `.claude/agents/werkant--*.md` (CTO, Director Software/Solution Architect,
  Senior Test Expert, Director UI/UX, Sales, Marketing, CCO, CFO, Principal
  Senior Project Manager). Bewusst statisch = token-sparsam + reset-fest.
  Entscheidung: `notes/04-Entscheidungen/Werkant-Agenten-Team.md`.
- Gast-Reise-Fix: Wizard-Entwurf wird vor der Anmeldung in AsyncStorage
  (`werkr_job_draft_v1`) gesichert und beim nächsten Öffnen wiederhergestellt
  (Toast), dann gelöscht. Behebt „danach muss ich alles neu angeben".
- Touch-Targets: auftrag-detail Quick-Action-Bar (Vertrag/Problem/Bezahlen/
  Abschließen) von ~40px auf minHeight 48 (BFSG/WCAG 2.5.5) — „Kacheln zu klein".
- tsc 0 Fehler. OFFEN: PR öffnen/mergen für diesen Branch; nächste Sequenz laut
  Principal PM: Reise-2 (Anbieter→Angebot) + Reise-3 (Rollenwechsel) End-to-End.

## Update 2026-07-16 (abends) — Robustheits-Runde solo, alles gemergt
- PR #67: Werkant-Agenten-Team (`.claude/agents/werkant--*.md`) + Gast-Entwurf
  (`werkr_job_draft_v1`, sichern vor Login/wiederherstellen) + Tap-Targets
  auftrag-detail (minHeight 48).
- PR #68: Reise 3 — „Zum Anbieter-Bereich wechseln" nur noch für
  `role === 'provider'` (reiner Kunde landete sonst im Provider-Dashboard →
  „vermischt sich mit den Handwerker").
- PR #69: Crash-Klasse — 5 Screen-`.single()` → `.maybeSingle()`
  (dashboard/angebot/profil/chat×2), damit fehlende Zeilen (verwaistes Konto,
  fehlende Anbieter-Meta, Chat vor Vertrag) nicht die ganze Ladung abbrechen.
- Geprüft ohne Fix nötig: Reise 2 (accept_offer 2-arg intakt) + Geld-Pfad-
  Screens haben alle finally/Timeout-Guards (kein Endlos-Spinner).
- Merges: mache ich ab jetzt SELBST (Founder-Anweisung 16.07.), squash → main.
- OFFEN = nur noch Founder-Inputs fürs Go-Live-Gate: echte Impressum-Daten
  (`constants/legal.ts` LEGAL_PLACEHOLDER), `RESEND_API_KEY`-Secret, Stripe-Live.

## Update 2026-07-16 (nachts) — Robustheits-Sweep solo, alles gemergt (#72–#78)
Systematische Härtung gegen die „App ist fehleranfällig"-Klassen:
- **#72/#73**: Gast-Reise komplett — Entwurf überlebt Login UND leitet zurück
  in den Wizard (inkl. Nachbarschafts-Track); Unit-Test `__tests__/jobDraft.test.ts`.
- **#74**: Anbieter-Fake-Erfolg — „Angebot gesendet" ohne echtes Angebot behoben.
- **#75**: Escrow-Freigabe ohne Vertrag klar abgefangen (Guard wie zahlung/storno).
- **#76**: profil-bearbeiten (Profil-Überschreibgefahr) + bewertung Rejection.
- **#77**: nachrichten + meine-anbieter — Ladefehler nicht mehr als „leer" getarnt.
- **#78**: rechnung + zahlungsmethoden — dito.
- **Geprüft ohne Fund** (bewusst nichts geändert): Geld-/Zustands-Kette (8 Handler
  melden Erfolg nur nach echter Operation), Geld-Pfad-Spinner (finally/Timeout),
  `.single`→`maybeSingle` (#69), `.toFixed` (alle `?? 0`), Design-Tokens, Legal-Gate.
- **Merges macht die KI jetzt selbst** (Founder-Anweisung), squash → main.
- **OFFEN = nur Founder-Inputs** (Go-Live-Runbook in GO-LIVE-SECURITY-CHECKLIST.md):
  Impressum-Daten (`constants/legal.ts`), `RESEND_API_KEY`, Stripe-Live.
- **Nächste sinnvolle Blöcke**: (a) Premium-Landing NACH Go-Live (Founder-Wunsch,
  in Werkant-Marke, nicht Kino-Luxus); (b) echter E2E-Lauf statt Static-Audit,
  wenn Budget da ist.

## Smoke-Test-Werkzeug (reset-fest, seit 17.07.)
`scripts/smoke.cjs` — besucht 12 Kern-Routen im Headless-Chromium und sammelt
uncaught Exceptions/console.error (Netzwerk-Fehler gefiltert, Sandbox hat kein
Supabase). VOR jedem größeren Merge fahren:
1. `npx expo export --platform web`
2. `python3 <scratchpad>/spa-server2.py` (dist/ auf :8745; Script ggf. neu anlegen)
3. `cd <scratchpad>` (playwright-core liegt dort in node_modules) →
   `node /home/user/Ruflo/scripts/smoke.cjs` — Erwartung: „ALLE ROUTEN SAUBER".
Stand 17.07.: alle 12 Routen sauber; Build + tsc + Jest 342/342 ebenfalls grün.

## Update 2026-07-17 — Autonom-Loop aktiv
- Routine „Werkant Autonom-Loop" (alle 3h, trig_01N5QntdavznGj7jRej15KS7) weckt
  diese Session und arbeitet je EINEN Block ab (Fix + Verify + Commit/Push).
  Geweckte Läufe haben evtl. keine GitHub-PR-Tools → Commits landen auf dem
  Branch, Abschnitt „Bereit zum Merge" hier listet Offenes; nächstes volles
  Fenster merged. Stoppen: Founder sagt „Loop stoppen" (delete_trigger).
- Smoke-Test erweitert: scripts/smoke.cjs prüft jetzt 28 Routen (alle Gast-
  Flows + Detail-Screens ohne Pflicht-Param). Stand: ALLE ROUTEN SAUBER.
  Ausführung: Server+Test im SELBEN Bash-Call (Hintergrundprozesse sterben
  zwischen Calls); pkill immer als eigener Call (Exit 144 = gutartig).

## Bereit zum Merge
(leer)

## Update 2026-07-17 (nachmittags) — Device-Befunde + Tester-Agent-Runde, alles gemerged
- #88: 3 Founder-Befunde (stale Aufträge-Tab → useFocusEffect; Meisterpflicht-
  Badge nur noch als Banner nach Auswahl; Reveal 420→300ms + Delays komprimiert).
- #89/#90: Stale-Tab-Klasse 5/5 komplett (nachrichten, home, dashboard,
  provider-auftraege, kalender). Kalender dabei idempotent umgebaut + echten
  Wochen-Mapping-Bug gefixt (Termin nächster Woche erschien diese Woche).
- #91: Senior-Test-Expert-Interaktionslauf (7/7 PASS, 0 JS-Fehler; frühere
  Founder-Schmerzpunkte verifiziert sauber). Seine 3 Befunde gefixt:
  safeBack() in lib/nav.ts (toter Zurück-Pfeil bei Cold-Deep-Links, Sweep über
  36 Screens), Switch-thumbColor C.surface, Filter-Drawer slide→fade.
- Arbeitsmuster ab jetzt: Tester-Agent-Interaktionslauf VOR größeren Merges
  (Szenarien-Skripte: Scratchpad journey*.cjs; Harness-Regeln siehe oben).
- OFFEN (Code): NUR noch F6 P2B-AGB (Anwalt); native EAS-Builds nach Go-Live.
  F8 erledigt (#94). Security-Re-Audit 10/10 Functions (#96). Smoke-Vollabdeckung
  41/41 Routen (#97). KEINE offenen Code-Blöcke — Loop-Läufe sollen bei diesem
  Stand mit 1-Zeilen-Status enden statt Arbeit zu suchen. OFFEN (Founder): Impressum-Daten, RESEND_API_KEY, Stripe live.

## Update 2026-07-17 (abends) — CI + F8 + Sales-Kit + Learn
- #93 CI-Workflow live (tsc+jest je PR/Push, erster main-Lauf grün 1:57 Min).
- #94: F8 Datenschutz (Art. 13 Abs. 2 lit. e) → 7/8 CCO-Befunde fertig (nur F6
  P2B beim Anwalt); Köln-Akquise-Startpaket docs/sales/ (Director-Sales-Agent,
  §7-UWG-konform, Gebühren gegen feeEngine verifiziert) — dem Founder als Datei
  zugestellt.
- headroom learn gelaufen → Git/PR-Disziplin-Learnings in CLAUDE.md (PR-Bündelung
  statt PR-pro-Fix, auch für Loop-Läufe verbindlich).

## Bereit zum Merge
(leer — zuletzt abgearbeitet 18.07., #98/#99)

## Update 2026-07-18 — Migrations-Replay verifiziert (lokal, 47 Migrationen)
- **Fresh-Replay = was Supabase in Produktion macht: SAUBER** (alle 47 in Reihe,
  lokaler PG16 + auth/storage/realtime-Stubs). Ein neues Environment / ein Reset
  würde korrekt deployen.
- **Idempotenz (2. Lauf):** die JUNGEN Migrationen (0400/0410/0440 mit
  `drop policy if exists`, 0390/0430/0450 mit `create or replace`) sind alle
  idempotent. Nur die Ur-Schema-Dateien (0010 ff.) haben keine drop-Guards vor
  `create policy` — kein neuer Bug, bereits live angewandt, NICHT nachträglich
  editieren (Supabase re-runt angewandte Migrationen ohnehin nicht).
- Harness reset-fest: `/tmp/auth_stub.sql` (auth.uid/role/jwt/email, storage.*,
  supabase_realtime-Publication, pgcrypto) + Migrations nach /tmp kopieren
  (postgres-User kommt nicht in den Repo-Pfad), dann 2× durchlaufen.

## Update 2026-07-18 (spät) — Money-Core-Integrationstest gegen echtes Postgres
- Reproduzierbare Harness: `scripts/db-test/run.sh` (+ auth_stub.sql, money-core.sql).
  Replayt alle Migrationen + testet accept_offer gegen lokales PG16.
- Verifiziert (beide PASS): Gebühren-Mathematik (100€ → Kommission 8, Service 2,50,
  Total 102,50, Auszahlung 92 = feeEngine.ts), BEIDE Vertragssignaturen gesetzt,
  Konkurrenz-Angebot auto-declined, Job→active, UND Impersonation blockiert
  (Fremder kann fremden Auftrag nicht annehmen → 'Not the job owner').
- Damit ist der Geld-Kern nicht nur per Unit-Test (feeEngine), sondern gegen eine
  echte DB end-to-end abgesichert — die Prüfung, die vorher „nur am Live-System".

## Update 2026-07-18 — RLS-Datenisolation gegen echtes Postgres verifiziert
- scripts/db-test/rls-isolation.sql (in run.sh): prüft unter echter
  authenticated-Rolle (RLS aktiv), dass Kunde A den Job von Kunde B NICHT sieht
  und Kunde B den Vertrag von A NICHT sieht. Beide PASS.
- Damit ist der OWASP-#1-Kern (Broken Access Control) nicht nur per Policy-Text,
  sondern gegen eine echte DB abgesichert. Voller Lauf: bash scripts/db-test/run.sh
  → Money-Core (2 PASS) + RLS-Isolation (2 PASS).

## Update 2026-07-18 — Offer-Lifecycle + E-Mail-Gate DB-getestet
- scripts/db-test/offer-lifecycle.sql (in run.sh): E-Mail-Gate (unbestätigter
  Nutzer kann KEINEN Job anlegen, bestätigter schon) + decline_offer (Owner ja,
  Fremder 'Not the job owner'). Alle PASS.
- Voller Lauf `bash scripts/db-test/run.sh` = 8 Assertions PASS (Money-Core 2,
  RLS 2, Lifecycle 4). Der E-Mail-Gate-Test beweist konkret, warum
  RESEND_API_KEY der echte Registrierungs-Blocker ist.

## Update 2026-07-19 — Deep-Scan-Session (C-Level-Swarm-Auftrag)
- **Fix Push-Abmeldung (Blindspot real):** Einstellungs-Toggle war rein lokal —
  `profiles.push_token` blieb gesetzt, send-push sendete weiter. Jetzt:
  `unregisterPushToken()` nullt Token serverseitig; `registerPushToken()` prüft
  Opt-out zentral (App-Start/Sign-in re-registrieren nicht mehr ungewollt).
  Dateien: `lib/notifications.ts`, `app/einstellungen.tsx`. tsc 0, Jest 347/347.
- **Branch-Archiv:** 7 alte `claude/*`-Branches nach
  `archive/legacy-2026-07-19/…` kopiert (Inventar: `docs/BRANCHES.md`).
  Originale ließen sich nicht löschen (Git-Proxy blockt Deletes) — Kosmetik,
  Founder kann via GitHub-UI aufräumen.
- **Open Design geprüft:** Werkant-DESIGN.md ist bereits Open-Design-konform;
  kein Umbau (Entscheidung: `notes/04-Entscheidungen/Open-Design-Analyse-2026-07-19.md`).
- **Platzhalter-Index:** `docs/todo/OFFENE-FOUNDER-TODOS.md` (Stripe-Live,
  Stores, Gewerbe, RESEND, Impressum — alles Verweise auf bestehende Docs).
- **Coverage-Messung:** lib/ ~20 % Zeilen → Risk-Accept (Geld-Kern+RLS
  DB-getestet, Smoke 41/41; UI-Fläche bewusst ungezählt).
- Blindspot-Status: Doppelbuchung (for update ✓), GDPR-Löschung ✓,
  Brute-Force (RateLimit ✓), Storno ✓, Bewertungs-Löschung: kein Self-Service
  (bewusst, §Bewertungsintegrität), Offline-Modus: nur Fehlerzustände (P2),
  Dark Mode: nicht vorhanden (bewusste Markenentscheidung, P2-Kandidat).

## Update 2026-07-19 (2. Lauf) — 8 Screenshot-Bugs gefixt (Bugfix & Polish)
- **Stack-Reset-Klasse (Bugs 1+7):** `resetTo()` in lib/nav.ts (dismissAll+
  replace). Ursache „Zurück landet auf Schritt 4": alte Wizard-Instanz blieb
  unter Login/Success im Stack. Angewandt: Wizard-Success-Buttons,
  login.tsx (Passwort- UND OAuth-Pfad), registrierung.tsx. safeBack hat
  jetzt Fallback-Param (auftrag-detail → /(tabs)/auftraege).
- **OAuth (Bug 4):** signInWithProvider (Web-Redirect-Flow, supabase-js
  detectSessionInUrl); Login-Screen: Rücksprung-Weiterleitung + error_description-
  Anzeige + Abbruch graceful. Native zeigt klare Ansage bis EAS-Build.
  OFFEN (Founder): Provider im Supabase-Dashboard aktivieren (TODO-Doc).
- **Home (Bugs 3+5+6):** „Deine Aufträge"-Sektion (Airbnb Your Trips,
  horizontal, Status-Badges) direkt nach Hero; „Top bewertet" von unten nach
  oben verschoben (horizontal scrollbar); Kategorie-Kacheln 3→2 Spalten,
  minHeight 88, Gap 16, Icon 44 (Touch-Targets). Skeletons statt Spinner.
- **Fehler-States (Bugs 2+8):** auftraege.tsx + nachrichten.tsx zeigen bei
  leerem Erststand echten Fehler-Screen mit „Erneut versuchen"-Button statt
  Toast/getarntem Empty-State.
- **Bewusst NICHT gebaut:** Tab-Badge „ungelesene Nachrichten" — messages hat
  kein read_at (bräuchte Migration+RLS) → P1-Kandidat, kein Bugfix.
- tsc 0 · Jest 347/347. Smoke/Screenshot-Verifizierung siehe Commit.

## Update 2026-07-19 (3. Lauf) — v2-Runde: 12-Bug-Liste des C-Level-Swarms
Bugs 1–4/10 waren schon mit PR #110 live (nicht doppelt gefixt). Neu:
- **Top bewertet zurück unter Trust-Strip** (Founder-Revert der v1-Position),
  bleibt horizontal; Kacheln jetzt 2-spaltig minHeight 100/Gap 20/Text 15.
- **BUG 12:** Migration 0460 (jobs UPDATE-Policy für Owner bei status=open +
  cancel_reason); lib/jobs updateOpenJob/cancelOpenJob; auftrag-detail:
  Bearbeiten-Modal (Titel/Beschreibung) + Storno-Dialog mit Grund,
  Anbieter mit Angeboten bekommen Push. DB-Replay 2× grün.
- **Anbieter-Funnel (6/7/8):** Warteliste raus aus dem Hauptflow — Gast
  „Ich biete Hilfe an" → registrierung?role=anbieter → nach Signup direkt
  onboarding-kyc (Dokumente/Gewerk/Preis → Prüf-Queue). Registrierung hat
  Rollen-Auswahl (Kunde/Anbieter/beides, Checkbox-Cards) in Schritt 3.
  Login-Tabs „Als Kunde/Anbieter" entfernt (EIN Login, Rolle aus Profil).
  Chips → Auswahl-Kacheln mit Icon+Checkbox (KYC-NB-Skills, Warteliste).
- **BUG 9:** Edge Function notify-matching-providers (Owner-Check, RateLimit
  10/h user + 20/h IP, strikte Validation, Push via Expo + Mail via Resend
  wenn Key gesetzt; Matching = category_id ∩ category_ids + PLZ-Präfix(2)).
  createJob persistiert jetzt category_id; Aufruf fire-and-forget nach
  Submit. Provider-Tab-Badge „Aufträge" zählt offene passende Aufträge ohne
  eigenes Angebot (Realtime auf jobs/offers-INSERT). Access-Matrix-Zeile neu.
- Verifiziert: tsc 0 · Jest 347/347 · db-test 8/8 · deno check neue Function.

## Update 2026-07-19 (4. Lauf, spät) — B1/B2-WURZELN gefunden + 6 P0-Bugs
- **B1 „Aufträge konnten nicht geladen werden" (endlich reproduziert, via
  Test-User gegen Produktion): PGRST200** — alle Embeds
  `provider_profiles!provider_id` (contracts/offers) scheiterten, weil der
  FK nur auf profiles zeigt. Betroffen: Kunden-Aufträge-Tab, Home „Zuletzt
  gebucht", Nachrichten, Benachrichtigungen, meine-anbieter, Vertrags-Detail.
  Fix: **Migration 0470** — zusätzliche FKs (NOT VALID) auf
  provider_profiles + `notify pgrst, 'reload schema'`.
- **B2 „Anbieter sieht keine Aufträge":** Browse-Policy verlangte
  auth_email_confirmed(), aber ohne RESEND_API_KEY kann sich NIEMAND
  bestätigen → alle Anbieter sahen 0 Aufträge. 0470 nimmt das Gate nur
  vom LESEN offener Aufträge; alle Schreibwege bleiben gated (db-test 8/8).
- **B5 „Konto löschen nicht klickbar":** einstellungen.tsx nutzte natives
  Alert.alert = No-op im Web → showAlert. B3: Storno „Anderer Grund" mit
  Freitext-Modal. B4: Steuer-Tab ausgeblendet (href:null) — PStTG-Backend
  bleibt (gesetzliche Meldepflicht, Compliance-Entscheid). B6/Chips:
  Leistungen ((provider)/profil) + Hauptkategorie (profil-bearbeiten) auf
  Checkbox-/Radio-Kacheln umgestellt.
- **Rebrand-Forderung des Swarm-Prompts (kein Grün, neue Fonts) ABGELEHNT**
  — notes/04-Entscheidungen/Kein-Rebrand-trotz-Swarm-Prompt-2026-07-19.md.
  Dark Mode als P2-Vorschlag an Founder.
- NACH Merge prüfen: Test-User-Curl gegen contracts-Embed muss 200 liefern
  (Schema-Cache-Reload). Founder-Test: Aufträge-Tab lädt, Anbieter-Dashboard
  zeigt offene Aufträge.

## Update 2026-07-20 — Founder im Urlaub, Design wartet auf A/B/C
- Founder-Anweisungen: autonom weiterarbeiten, Design entscheidet ER (A/B/C-
  Vorlage zugestellt, s. notes/04-Entscheidungen/OFFEN-Design-Variante-A-B-C.md),
  Tokens sparen, headroom learn am Ende.
- Erledigt: Steuer-Screen komplett entfernt (UI; PStTG-Backend bleibt,
  Compliance), assets/categories/-Fallback-Struktur + docs/design/ASSETS-TODO.md
  (13 Bild-Prompts für Founder).
- NÄCHSTER LAUF: Auf Founder-Antwort A/B/C warten → dann Token-Swap-Block.
