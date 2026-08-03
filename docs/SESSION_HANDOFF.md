> **Neu hier? Lies zuerst `docs/STAND-UND-VISION.md`** — Überblick über Vision,
> technischen Stand, den einen Blocker und was nach Verantwortung vor uns liegt.
> Diese Datei hier ist die Chronik (876+ Zeilen) und die Quelle der
> Arbeits-Warteschlange.

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

## Update 2026-07-20 — Design C + systematischer Screen-Audit
- Founder-Entscheid: Variante C (Grün bleibt, Bone-Creme-Hintergrund, KEIN
  reines Weiß). Umgesetzt: Bild-Kachel-Verdrahtung (CATEGORY_IMAGES-Fallback),
  schwebende Tab-Bar beide Bereiche. Emojis: nur Ionicons (Regel bestätigt;
  ui-ux-pro-max-Skill genutzt, dessen Lila-Vorschlag verworfen).
- Systematischer Audit über 39 Routen (scratchpad audit.cjs, DOM-Heuristiken:
  JS-Fehler, H-Overflow, undefined/NaN-Texte, Touch-Targets, Mojibake):
  0 JS-Fehler, 0 Overflow, 0 Text-Fehler. 16 zu kleine Zurück-/Share-Buttons
  auf 44px-Minimum gehoben (hitSlop wirkt im Web NICHT — echte Fläche nötig).
- OFFEN (Founder): 13 Kategorie-Bilder (docs/design/ASSETS-TODO.md); RESEND,
  Stripe-Live, Impressum wie gehabt.

## Update 2026-07-20 (mittags) — Eingeloggter E2E gegen Produktion
- Kachel-Label-Fix (#114, „Renovierung" lief an den Rand) gemergt+live.
  Founder: KEINE Kategorie-Bilder geplant — Icon-Fallback ist Normalzustand.
- **E2E-Datenebene (Test-User b1debug1907@example.com gegen Prod-REST):**
  contracts-Embed, jobs+offers(count), Conversations-Basis alle 200;
  E-Mail-Gate beim Job-Insert 403 ✓; notify-matching-providers mit fremder
  job_id 403 ✓. UI-Ebene (Gast): Gate-Meldung im Wizard, Konto-löschen-
  Dialog, Tabs — alles OK (scripts/e2e-live.cjs, gegen :8745 laufen lassen).
- **Sandbox-Grenze dokumentiert:** Headless-Chromium kommt NICHT zu Supabase
  raus (auch nicht mit Proxy-Args) — Browser-Login-E2E geht in dieser Sandbox
  nicht; Datenebene per REST-Token ist der belastbare Ersatz.

## Update 2026-07-20 (vormittags) — Anbieter-Flow-Runde (Founder-Screenshots)
- **„Angebot konnte nicht gesendet werden":** Ursache wurde vom Einheits-Catch
  verschluckt. Jetzt: echte Fehlermeldung (RLS→„Auftrag nicht mehr offen/E-Mail
  unbestätigt", FK 23503→„Verifizierung abschließen"), plus Pre-Check auf
  provider_profiles mit Weg zu /onboarding-kyc. WICHTIG: Client- und DB-Gate
  prüfen dieselben Felder — wenn es wieder auftritt, zeigt die Meldung nun WAS.
- **Doppelte Registrierung:** KYC befüllt Basisdaten aus profiles vor und
  springt (Handwerk-Track) direkt zu Schritt 2; Header heißt jetzt
  „Anbieter-Verifizierung" statt „Registrierung"; Toggle „Handwerk" wie Home.
- **Anbieter sieht Anfragen jetzt auch im Aufträge-Tab:** neuer erster Tab
  „Anfragen" (offene Jobs, CTA „Angebot erstellen") — dorthin zeigt auch der
  Badge. Angebot-Screen: Hinweis „Nur Preis ist Pflicht … nach Annahme öffnet
  sich der Chat".
- Success-Screen-Buttons (Auftrag eingereicht) auf volle Breite.

## Update 2026-07-20 (15 Uhr) — Angebots-Blocker final erklärt
- Neue Fehlermeldung griff und zeigte: RLS lehnt ab. Wurzel: Client-Gate
  akzeptierte noch user.email_confirmed_at (durch Autoconfirm IMMER gesetzt),
  DB-Gate zählt seit 0430 NUR profiles.email_verified_at → Client ließ bis
  Submit durch. Fix: requireVerifiedEmail prüft jetzt exakt wie die DB.
- KONSEQUENZ (P0, nur Founder kann das lösen): Ohne RESEND_API_KEY kann sich
  NIEMAND verifizieren → keine Angebote, keine Auftraege. Workaround für
  Founder-Tests: im Supabase-Dashboard (SQL-Editor)
  `update profiles set email_verified_at = now() where email = '<eigene@mail>';`

## Update 2026-07-20 (nachts) — Track-Trennung Nachbarschaft/Handwerk
- Founder-Befund: NB-Helfer sah Handwerks-Anfragen + konnte bieten (§1-HwO-
  Risiko) und bekam den Handwerks-Text „Dokumentenprüfung". Fixes:
  Migration 0480 (offers-Policy: NB-Anbieter nicht auf Handwerks-Jobs),
  Track-Filter in Anfragen-Tab/Dashboard/Badge/notify-Function,
  bewerbung-eingegangen mit NB-Variante (geprüft werden: Profilangaben +
  18+-Selbstauskunft; Identität via Stripe — keine Dokumente).

## 2026-07-21 — Finalisierung Block 1+2 (Branch claude/ruflo-finalisierung)

- **Datenexport Art. 20 DSGVO LIVE verdrahtet:** neue Edge Function
  `export-my-data` (JWT, Rate-Limit 3/h User + 6/h IP, alle Queries uid-scoped,
  Matrix-Zeile ergänzt) + Einstellungen-Row lädt JSON direkt herunter
  (Web: Blob-Download; Native: Share-Sheet). Toter Toast entfernt.
- **Zahlungsmethoden-Row** führt jetzt zu /zahlungsmethoden statt Toast.
- **Nachrichten-Ungelesen-Status:** Migration 0490 (`messages.read_at` +
  security-definer RPC `mark_messages_read`, Partei-Check serverseitig, kein
  direktes UPDATE-Recht). Chat markiert beim Öffnen + bei Realtime-Eingang als
  gelesen; Kunden-Nachrichtenliste zeigt Grün-Badge + fette Preview.
  Provider-seitig gibt es keine Konversationsliste (Chat via Auftragsdetail) —
  Badge dort bewusst nicht gebaut.
- **Swarm-Prompt v7:** Design-Direktiven (kein Grün, Redesign, Dark Mode)
  abgelehnt — Founder-Entscheidung „Weiterhin C" gilt. Siehe
  notes/04-Entscheidungen/Swarm-v7-Design-Direktiven-abgelehnt-2026-07-21.md.
- Offen (Founder-only): RESEND_API_KEY (P0), Stripe-Live-Keys, Impressum-Daten.

## 2026-07-21 (Founder im Urlaub) — Autonome Testabsicherungs-Runde (#125)
- Ausgangslage: Code Founder-gated (RESEND/Stripe/Impressum), keine offenen
  Code-Bugs. Principal-PM-Agent-Plan → Fokus „jüngste, am schwächsten
  abgesicherte Logik testen".
- **Block 1 (#125): DB-Regressionstests** `scripts/db-test/track-messages.sql`
  (in run.sh): 0480 NB-Track-Trennung (NB-Anbieter kann NICHT auf Handwerks-
  Jobs bieten, wohl auf NB-Jobs) + 0490 mark_messages_read Partei-Check
  (Fremder=No-op, Empfänger markiert). Voller Lauf jetzt **12/12** (vorher 8/8).
- **Block 2 (#125): Unit-Tests** resetTo (lib/nav.ts, Stack-Reset inkl. throw-
  Fall) + isPushOptedOut/registerPushToken (lib/notifications.ts, Push-Opt-out
  schreibt Token nicht neu). Jest **357/357** (vorher 347), 10 Suites.
- **Block 3: Verifikation ohne Fund** — deno check + Security-Matrix-Abgleich
  der zwei neuesten Edge Functions (notify-matching-providers, export-my-data):
  Auth/RateLimit(user+IP 20//6)/Validation/Ownership vollständig, Matrix akkurat.
  Kein Fix nötig (bestätigt 10/10-Standard).
- Baseline auf frischem main verifiziert: tsc 0 · Jest 357/357 · db-test 12/12.
- **Noch offen aus PM-Plan (nicht gemacht, Budget-Disziplin):** Block 4
  Leverkusen-Sales-Paket (analog Köln), Block 5 Marketing-Textbausteine.
  Beides reine Content-Produktion, Founder will Voice evtl. selbst prägen.
- Go-Live-Gate unverändert (nur Founder): RESEND_API_KEY · Stripe-Live · Impressum.

## 2026-07-22 — Founder-Gerätetest: 3 Fixes + Strike/Qualitäts-System
- **#127 iOS-Zoom + Pflichtfeld-Sternchen:** Eingabefelder waren 14px → iOS
  Safari zoomte beim Fokus rein; public/index.html erzwingt jetzt ≥16px
  (input/textarea/select, !important, Pinch-Zoom bleibt). Rote * an Pflicht-
  feldern in auftrag-aufgeben + angebot-erstellen (konsistent zu #120).
- **#128 Strike-System Option C + Schlecht-Bewertungs-Banner** (Founder-
  Entscheid): Migration 0500 — chat_leak_flags→Strike-Trigger (je 3 Versuche
  = 1 Strike, Einzeltreffer nicht), bad_review_count (rating<=2) im Rating-
  Trigger, Sperre bei 3 Strikes in offers-Policy. Dashboard: 3 Banner oben
  (Sperre rot / Strike-Warnung amber / Qualitäts-Info amber). db-test 16/16.
  Bewusste Grenze: Bewertungen lösen KEINEN Auto-Strike (subjektiv/rechtlich).
- **Erklärt (kein Code):** Push aufs iPhone geht nur mit nativem EAS-Build
  (Web-Push auf iOS nur als PWA, eingeschränkt) — Code fertig, wartet auf Build.
- **OFFEN (Founder-Input nötig):** Chat „wie Airbnb" — Chat existiert (Realtime,
  Lesehaken, Anti-Leak); Founder soll sagen, was konkret fehlt (Fotos senden,
  Terminvorschläge im Chat, System-Nachrichten, Push bei neuer Nachricht).
- Go-Live-Gate unverändert Founder-only: RESEND_API_KEY · Stripe-Live · Impressum.

## 2026-07-22 — Chat-Rückfragen vor dem Angebot (#130)
- Founder-Wunsch: Anbieter/NB-Helfer soll unklaren Auftrag schnell nachfragen
  können, OHNE verbindliches Angebot. Migration 0510: messages.provider_id →
  Konversation = (job, provider)-Thread. RLS: Anbieter schreibt auf OFFENEM
  Auftrag im eigenen Thread (verifiziert/nicht gesperrt/Track passend), Kunde
  sieht+beantwortet alle Threads, Anbieter B sieht Anbieter A's Thread NICHT.
  mark_messages_read thread-scoped (p_provider_id 2. Arg).
- lib/messages nach Thread; getConversationList nachrichten-basiert (Rückfragen
  in Kunden-Inbox). chat.tsx: Anbieter=eigener Thread, Kunde=Param-Thread,
  Realtime client-gefiltert. auftraege.tsx: „Rückfrage stellen" an offener Anfrage.
- db-test 21/21 (5 neu, inkl. Datenschutz Anbieter-B). tsc 0, Jest 357/357.
- OFFEN am Chat (Founder kann priorisieren): Fotos senden, Terminvorschläge im
  Chat, System-Nachrichten. Push aufs iPhone weiterhin erst mit EAS-Build.

## 2026-07-22 — Terminvorschläge im Chat (#132) + Architektur-Review
- Founder: Terminvorschläge annehmen/ablehnen, Workflow richtig, Agenten drüber
  schauen lassen. Migration 0520: appointment_proposals + 2 security-definer-RPCs
  (propose_appointment/respond_appointment), messages.type (text/system/appointment).
  Chat: Terminkarten in Timeline, „Termin vorschlagen"-Modal, System-Nachrichten.
- **Director-Software-Architect-Agent-Review** fand echte Fehler (jetzt gefixt):
  K1 (kritisch: Job-Termin wurde aus jedem Anbieter-Thread gesetzt → nur noch
  zugewiesener Anbieter), H1 (konkurrierende Vorschläge → 'superseded'), H2
  (for-update-Lock), M1 (Europe/Berlin in to_char). Vorher hatte der DB-Test
  schon einen Auth-Hole gefangen (jeder als „Anbieter"). db-test 27/27.
- **Foto-Empfehlung an Founder:** Auftrags-Foto-Upload ist auch nur Platzhalter
  (native Build nötig); Bilder → Supabase Storage (nicht Postgres). Fotos
  (Auftrag+Chat) zusammen mit EAS-Build, nicht jetzt.
- OFFEN (Founder wollte, klein): System-Nachrichten „Angebot angenommen" /
  „Zahlung hinterlegt" (accept_offer-RPC + stripe-webhook); Nachrichten-Tab-Badge.
  Push aufs Handy erst mit nativem Build.

## 2026-07-22 — Swarm-Lauf: System-Nachrichten + Tab-Badge + Test-Befunde (#PENDING)
- Founder-Kritik „nutzt die Agenten": npx-Swarm-Daemon hängt in Sandbox; stattdessen
  2 Agenten parallel via Task-Tool (nicht-überlappend).
- **Director Software Architect (Implementierung):** Migration 0530 (accept_offer
  + System-Nachricht „Angebot angenommen"), stripe-webhook System-Nachricht
  „Zahlung hinterlegt (Escrow)", Nachrichten-Tab-Badge app/(tabs)/_layout.tsx
  (Summe ungelesener, Realtime INSERT+UPDATE). Money-Core unverändert (db-test grün).
- **Senior Test Expert (Review):** fand 2 Regressionen aus dem 0510-Umbau (jetzt gefixt):
  H1 = Angebots-Benachrichtigung routete /chat OHNE providerId → Kunde in totem
  Demo-Chat, Nachricht ging still verloren (benachrichtigungen.tsx job-basiert +
  providerId in allen Routen; chat.tsx: kein stilles Fake-Zustellen mehr).
  H2 = doppelte React-Keys in Inbox bei mehreren Anbieter-Threads/Job
  (nachrichten.tsx key = job:provider). M1 = Center zeigt jetzt Vor-Vertrags-
  Rückfragen. M2 = Terminkarte fest Europe/Berlin.
- OFFEN (niedrig, notiert): N1 System-Text als Inbox-Vorschau; N2 job-lose
  Direktchats (nachbarschaft) laufen weiter in lokalen Demo-Modus (vorbestehend).
- Verify: tsc 0 · Jest 357/357 · db-test 28/28.

## 2026-07-22 — Swarm-Vollcheck: Pentest + QA + GTM + Vision (4 Agenten) + Fixes
- Founder: „testen, härten, penetrieren, marketing/sales/vision prüfen, headroom learn".
  4 read-only Fach-Agenten parallel + headroom learn --apply gelaufen.
- **Link-Audit (selbst):** alle push/replace/href-Ziele lösen auf existierende
  Routen auf; keine leeren onPress. Nur bewusste Platzhalter (Impressum/Fotos/
  Pro/„keine Anbieter"-Vorschau). Web-Export baut (dist erzeugt).
- **GEFIXT (dieser PR):**
  - H1 (KRITISCH, Security): provider_profiles exponierte via anon-Key
    unauthentifiziert phone/steuer_id/psttg_revenue/gewerbeschein. Migration 0540:
    Tabellen-Grant für anon entzogen, nur öffentliche Suchfelder spaltenweise
    neu granted. db-test beweist: anon kann steuer_id NICHT, business_name schon.
  - BUG1 (HIGH, QA): Nachbarschaft „Anfragen"/„Nachricht senden" öffnete jobless
    Chat → stiller Nachrichtenverlust. Jetzt → Buchungsweg. chat.tsx: Senden bei
    !jobId deaktiviert (Defense-in-Depth).
  - BUG2 (QA): auftrag-detail zeigte bei totem Deep-Link fingierten „In
    Bearbeitung"-Auftrag → jetzt echter Not-Found-Zustand.
  - L3 (Security, Geld): cancel-contract refund ohne idempotencyKey → Doppel-
    Refund bei Race möglich → idempotencyKey ergänzt.
  - §37a-TKG-Falschzitat in garantie.tsx entfernt (CCO-Befund).
- **OFFEN / dokumentiert (nicht in diesem PR):**
  - H1-VOLL + M1 (Security, mittel): eingeloggter Nutzer kann sensible Spalten
    fremder Anbieter noch lesen; jobs.address_street für alle Anbieter sichtbar.
    Saubere Lösung = Security-Barrier-View für Public-Browse + Basistabellen-
    Policy auf Eigen-Zeile/Vertragspartei. Siehe GO-LIVE-SECURITY-CHECKLIST.
  - L1 (niedrig): export-my-data kann für Anbieter fremde Vor-Vertrags-Threads
    enthalten (provider_id-Filter fehlt).
  - L2 (niedrig): propose_appointment Kunden-Zweig ohne Beteiligungs-Check.
  - AGB §6(3) „Pro 29€" widerspricht §2(4) (keine bezahlte Platzierung) →
    Anwalt/Founder: Klausel streichen oder Feature bauen.
  - Anbieter-Value-Prop im Onboarding dünn; „Werkant-geprüft"-Badge uneinheitlich
    (Marketing, nach Go-Live).
- **CTO-Urteil:** startklar für kontrollierten Köln-Softlaunch (Handwerk-Track)
  sobald Founder-Inputs + Dashboard-Security-Klicks erledigt. Zwei Bedingungen:
  (1) erster echter Vorgang = Founder-Selbsttest mit echter Karte; (2) NB-Track
  im Geld-Pfad gegated lassen bis DRV/PStTG/ZAG geklärt. Reihenfolge: RESEND +
  Site-URL-Fix → Impressum → Dashboard-Security → Stripe Live+Connect → 1-2
  Kölner Anbieter per Concierge → Selbsttest → externe Nutzer.
- Verify: tsc 0 · Jest 357/357 · db-test 30/30 · deno check ok.

## 2026-07-22 (spät) — Pentest-Härtung autonom abgearbeitet (#137, #138)
- **#137 (L1/L2/L4):** propose_appointment Kunden-Zweig-Guard (kein unsolicited
  Kontakt), export-my-data Anbieter-Thread-Isolation, pstg-annual-report Admin-
  Secret timing-safe.
- **#138 (H1-voll):** View provider_public (nur öffentliche Felder + has_*-Flags),
  Public-Read-Policy auf provider_profiles entfernt → Basistabelle nur Eigen-Zeile;
  8 Browse/Counterparty-Reads auf die View umgestellt. **Director-Software-
  Architect-Review** fand 6 übersehene PostgREST-FK-Embeds (Verträge/Meine
  Anbieter kundenseitig leer) → mit lib/providerPublic.ts (fetchPublicProviders,
  .in()+Merge) gefixt; View um `where kyc_status='approved'` ergänzt.
  db-test 33/33 (eingeloggter Fremder sieht Anbieter-Basiszeile NICHT), Web-Build ok.
- **headroom learn --apply** gelaufen (MEMORY.md aktualisiert).
- **OFFEN — letzter Security-Punkt M1** (mittel): jobs.address_street ist für
  alle browsenden Anbieter vor Vergabe sichtbar. Gleiche View-Technik wie H1-voll
  auf die jobs-Browse anwenden (öffentliche Job-Felder ohne Straße; Straße erst
  dem gematchten Anbieter). Nebenbefund: index 'Neu'-Provider-Query nutzte
  provider_profiles.created_at (existiert nicht) — in der View auf profiles.created_at.

## 2026-07-22 (spät nacht) — M1 geschlossen (#140), alle Pentest-Befunde erledigt
- M1: Kundenadresse (Straße) in Tabelle job_addresses ausgelagert (RLS: nur
  Kunde + zugewiesener Anbieter), aus jobs entfernt → Bieter sehen vor Vergabe
  nur Stadt/PLZ. Ansatz B (schmal): keine Browse-Query angefasst; createJob
  schreibt getrennt, Dashboard liest als zugewiesener Anbieter. db-test 36/36
  (browsender Anbieter sieht Straße NICHT). tsc 0, Jest 357/357, Web-Build ok.
- Damit alle Security-Pentest-Befunde geschlossen: H1 (#135), H1-voll (#138),
  L1/L2/L4 (#137), M1 (#140). Kein offener Härtungspunkt mehr.
- GO-LIVE-SECURITY-CHECKLIST: M1-Eintrag ist damit erledigt (nur noch
  Founder-Dashboard-Klicks + RESEND/Stripe/Impressum offen).

## 2026-07-26/27 — nachgetragen: #142–#145 (waren nicht im Handoff)
Dieser Abschnitt schließt die Lücke zwischen dem letzten Eintrag (22.07.) und
dem Stand von `main` (87dcb90). Fünf gemergte PRs fehlten hier komplett — wer
nach einem Reset nur dieses Dokument liest, hätte fünf Tage Arbeit nicht
gekannt und Fehler doppelt gesucht.

- **#142 Gerätetest-Fixes:** Chat-Rolle aus DB-Wahrheit (`jobs.customer_id`)
  statt lokalem `isProvider`-Flag; Kundenprofil bearbeitbar; neuer Screen
  `app/(provider)/statistik.tsx`; Gewerk-Taxonomie vereinheitlicht
  (profil-bearbeiten pflegte eigene IDs → überschrieb still die Meisterpflicht-
  Zuordnung); Support-Chat eskaliert gestaffelt statt derselben Rückfallantwort;
  falsche SLA-Zusagen entfernt; Consent auf Web synchron in localStorage.
- **#143 Anbieter-Posteingang:** Nach Vergabe an einen ANDEREN verschwand der
  Auftrag für den Rückfrage-Anbieter komplett (Policy-Lücke: weder „browse
  open" noch „parties"). Migration 0590 + neuer Tab
  `app/(provider)/nachrichten.tsx`. Merke: `exists (select 1 from messages …)`
  direkt in der jobs-Policy erzeugt Endlos-Rekursion → security-definer-Funktion.
- **#144 Verifikations-Deadlock:** „Chat sendet nicht" und „Mail kommt nicht"
  haben EINE Ursache — `RESEND_API_KEY` fehlt in den Supabase-Secrets. Ohne den
  Schlüssel kann sich niemand verifizieren, damit sind ALLE Schreibwege
  gesperrt. Gate bewusst NICHT gelockert (CTO-Entscheid). Doku:
  `docs/ops/RESEND-MAIL-GATE.md`. Außerdem: Geld falsch angezeigt
  (`provider_commission` statt `provider_payout` — Anbieter sah ~1/12 seines
  Umsatzes), rollenabhängige Fehlerdiagnose, Migration 0600 (Guard präzisiert).
- **#145:** `health`-Function war nie deployt (nicht in `config.toml`) und der
  Workflow wertete 404 als Warnung → der Detektor war selbst tot. Neuer
  CI-Guard: jedes Verzeichnis unter `supabase/functions/` muss deklariert sein.
  AGB-Widerspruch §2(4) vs. §6(3) gestrichen; Pro bleibt eingefroren
  (CFO-Entscheid, Platzierung ist Nullsummenspiel); DSGVO-Nachlauf
  (`auth.users.email` wird beim Löschen ersetzt, nicht nur `profiles.email`).

## 2026-07-27 — Datenexport: stiller Teil-Export beseitigt
Offener Punkt aus #145 war „Ursache des gemeldeten ‚Datenexport fehlgeschlagen'
bleibt offen". Die Function KONNTE die Ursache nicht nennen: jeder Query-Fehler
wurde mit `?? []` verschluckt, die Antwort blieb 200. Ein Nutzer bekam dann eine
Datei, die wie eine vollständige Auskunft aussah, aber Kategorien stillschweigend
ausließ — bei einem Auskunftsersuchen schlimmer als ein klarer Fehler.

- `export-my-data`: Fehler werden pro Kategorie gesammelt; schlägt eine fehl,
  schlägt der ganze Export fehl (500 + `failed_categories`, Details nur ins
  Server-Log). Client nennt den echten Grund (401 = Sitzung abgelaufen,
  500 = betroffene Kategorien) statt „bitte später erneut versuchen".
- **Export war zusätzlich unvollständig** — seit er geschrieben wurde, kamen
  Tabellen dazu, die niemand nachgetragen hat: `job_addresses` (0570),
  `appointment_proposals` (0520), `disputes`, `pro_subscriptions`,
  `pstg_reports`, `waitlist`. Alle jetzt drin, jeweils eigen-gescoped.
- Bewusst NICHT enthalten, im Export selbst benannt (Art. 15 Transparenz):
  `email_verifications` (enthält gültigen Token = Zugangsmittel),
  `chat_leak_flags` (abgeleitete Missbrauchserkennung, nicht Art. 20 Abs. 1).
- iOS-Safari-Download: Anchor hängt jetzt im Dokument, Blob-URL wird nicht mehr
  im selben Tick widerrufen (Safari bricht den Download sonst ab).
- **Regressionsnetz** `scripts/db-test/data-export.sql`: spiegelt JEDEN Filter
  der Function gegen echtes Postgres. Genau diese Bugklasse hat schon zugeschlagen
  (#142: `reviews` über nicht existierende Spalten). Benennt eine Migration eine
  Spalte um, schlägt jetzt der Test fehl statt die Kategorie leer zu liefern.
  Prüft zusätzlich die Isolation: Anbieter bekommt weder die Kundenadresse (M1)
  noch den Thread eines konkurrierenden Anbieters (L1).
- Verifiziert: tsc 0 · Jest 357/357 · **db-test 49/49** (3 neu) · deno check ok.

### Offen (Stand 27.07., unverändert Founder-Sache)
1. **`RESEND_API_KEY`** — P0, blockiert JEDE Schreibaktion (siehe #144).
2. Stripe Live + Connect, Impressum-Daten (`constants/legal.ts`).
3. Security-Dashboard-Klicks (`docs/security/GO-LIVE-SECURITY-CHECKLIST.md`).
4. F6 P2B-AGB beim Anwalt; native EAS-Builds (Push + Foto-Upload) nach Go-Live.

**Wenn der Founder „Datenexport fehlgeschlagen" erneut meldet:** die Meldung
nennt jetzt den Grund. Bei 500 stehen die betroffenen Kategorien in der Meldung
und die Ursache (Spalte/Policy) im Function-Log des Supabase-Dashboards.

## 2026-07-27 — Founder im Urlaub: Arbeitsvorrat für den Autonom-Loop
Founder-Entscheid 27.07.: EIN Block pro Tag, KI mergt selbst (wie 16.07.),
Fokus nur auf Absicherung/Tests + Marketing-Textbausteine. Leverkusen-Sales
bewusst NICHT beauftragt (Tonalität will der Founder selbst prägen).

**Befund beim Aufsetzen:** die alte Routine „Werkant Autonom-Loop" hat zuletzt
am **19.07.** gefeuert und danach still nichts mehr getan — sie zeigte auf den
toten Branch `claude/grouped-settings-style-xpvyu6` und eine alte Session.
Gleiche Klasse wie die tote health-Function aus #145: ein Automatismus, der
ausfällt, ohne dass es jemand merkt. Ersetzt durch eine Routine, die pro Lauf
eine FRISCHE Session startet und ihren Auftrag aus dieser Datei zieht.

### Warteschlange (der Reihe nach, EIN Block pro Lauf)
Reihenfolge = absteigender Wert. Ist ein Block erledigt, hier abhaken und den
Lauf beenden — nicht zwei Blöcke in einem Lauf.

- [x] **A1 Geldpfad-Zustandsmaschine gegen echtes Postgres.** ERLEDIGT 27.07.
  (`scripts/db-test/escrow.sql`, db-test 49 -> 58). Ergebnis: die Gebuehren sind
  ZWEIMAL implementiert (`lib/feeEngine.ts` und nochmal in plpgsql in
  `accept_offer`, 0530:41-52) und `money-core.sql` prueft nur Handwerker/100 EUR
  — dort greift keine der beiden Mindestgebuehren und kein Rundungsfall; die
  `greatest(...)`-Zweige und der ganze Nachbarschafts-Track waren nie geprueft.
  Jetzt Paritaet an den Grenzfaellen (20/60/101 EUR + NB 50 EUR), plus
  0300-Guard (weder Kunde noch Anbieter kann Freigabe/Status/Betrag selbst
  setzen), RLS gegen Unbeteiligte und der status-CHECK als letzte Instanz.
  Gegengeprueft, dass der Test eine echte Divergenz faengt (Mindestgebuehr nur
  in SQL entfernt -> rot). Kein Fehler im aktuellen Stand gefunden.

- [x] **A2 Doppelzustellung beim stripe-webhook.** ERLEDIGT 27.07.
  (`scripts/db-test/webhook-idempotency.sql`, db-test 58 -> 63). **Echter
  Geld-Bug gefunden und behoben:** der Handler fuer `payment_intent.succeeded`
  schrieb bedingungslos `status='active'` + frischen `escrow_captured_at`. Eine
  Doppel- oder Wiederholungszustellung (Stripe liefert dasselbe Event
  ausdruecklich mehrfach und wiederholt bis zu 3 Tage nach einer 500) setzte
  damit auch einen bereits STORNIERTEN Vertrag zurueck auf 'active' — mit noch
  leerem `escrow_released_at`. cancel-contract hatte da schon erstattet, also
  passierten alle drei Vorbedingungen von release-escrow und Werkant haette dem
  Anbieter Geld ueberwiesen, das der Kunde zurueckbekommen hat. Fix:
  Compare-and-Swap (`.eq('status','pending').is('escrow_captured_at', null)`),
  bei 0 Treffern 200 ohne Folgewirkung (kein Push, keine doppelte
  System-Nachricht). Gegenprobe Y5 im Test fuehrt die alte Anweisung aus und
  zeigt die Wiederbelebung.

- [x] **A3 PStTG-Zähler-Grenzfälle.** ERLEDIGT 27.07. (Migration 0610,
  `scripts/db-test/psttg-counter.sql`, db-test 63 -> 71). **Zwei echte Befunde:**
  (1) **Umgehung möglich, schwerer als der ursprüngliche Auftrag:**
  `guard_profile_sensitive_cols` schützte `pstg_locked` und `pstg_year`, aber
  NICHT `pstg_tx_count`/`pstg_revenue`; die WITH-CHECK der Policy ist an der
  Stelle wörtlich `and true` (0050:52). Ein `update profiles set
  pstg_tx_count = 0, pstg_revenue = 0 where id = auth.uid()` genügte, um aus
  der DAC7-Meldung zu verschwinden — `pstg-annual-report` wählt die zu
  meldenden Anbieter ausschliesslich über diese beiden Spalten aus, nicht über
  `pstg_locked`. Meldepflicht und Bußgeld treffen die Plattform (§§ 13, 25
  PStTG). Jetzt gesperrt.
  (2) **Race behoben:** die Fortschreibung wanderte aus `release-escrow` in die
  atomare RPC `pstg_record_transaction` (Jahreswechsel, Hochzählen, Schwelle,
  Sperre in EINER Anweisung), nur für `service_role` ausführbar.
  Nebenbei: die Rollenprüfung im Guard folgt jetzt dem Muster aus 0600 (nur
  Client-Rollen blocken statt nur service_role erlauben) — der alte Test
  blockierte auch SECURITY-DEFINER-Funktionen und Admin-Verbindungen, was beim
  Schreiben des Tests sofort zuschlug.
  Getestet: 29 vs. 30 Transaktionen, 1999.99 vs. exakt 2000.00 EUR,
  Jahreswechsel (Zähler UND Sperre), Umgehungsversuch (mit Gegenprobe, dass
  harmlose Profilfelder änderbar bleiben), Verlustfreiheit über 50
  Fortschreibungen, kein Client-Aufruf der RPC.

- [x] **M1 Store-Texte.** ERLEDIGT 27.07. — `docs/marketing/store-texte.md`.
  App Store (Name/Untertitel/Werbetext/Beschreibung/Keywords/Was-ist-neu) und
  Play (Titel/Kurz-/Vollbeschreibung), deutsch, Stimme wie im Köln-Startpaket.
  Zeichengrenzen maschinell geprüft, alle Felder passen (längstes: Keywords
  94/100). Enthält eine **Verbotsliste** mit Begründung — genau die Fehlerklasse
  (erfundene SLAs, „Trust-Team", Ausweisprüfung) ist in #142/#144 schon zweimal
  live gegangen — plus eine Belegstellen-Tabelle: jede Zahl im Text zeigt auf
  die Datei, aus der sie stammt.
- [x] **M2 Anbieter-Value-Prop im Onboarding.** ERLEDIGT 27.07. Befund war
  „dünn" — sie fehlte tatsächlich ganz: der Betrieb landete nach der
  Registrierung ohne einen einzigen Satz direkt im Dokumenten-Upload. Jetzt drei
  belegte Punkte auf Schritt 1, je Track unterschiedlich (Handwerk: 8 % nur bei
  Erfolg / Escrow / Meisterbrief zählt — Nachbarschaft: keine Provision /
  Escrow / kein Papierkram), plus ein ehrlicher Absatz statt eines Versprechens.
  Kein Redesign, nur bestehende Tokens (Variante C).
  **Nicht verifizierbar in der Sandbox:** ein Screenshot des Screens geht nicht,
  er liegt hinter dem Login und Headless-Chromium kommt hier nicht zu Supabase
  durch. Geprüft sind tsc, Web-Build und die Design-Regeln (keine Emojis, keine
  deprecated Tokens, fontWeight max 700). Optischer Abgleich beim nächsten
  Gerätetest des Founders.

> **Stand 29.07.: die Warteschlange ist WIEDER GEFÜLLT.** Sie stand zwei Tage
> leer, weil ich sie nach M2 selbst als leer markiert und danach jeden neuen
> Block interaktiv abgearbeitet habe, statt ihn hier einzutragen. Die Routine
> hat in dieser Zeit nachweislich **null** Branches erzeugt — alle neun
> `claude/autonom-*`-Branches stammen aus interaktiven Sitzungen. Founder-Ansage
> vom 29.07.: das soll sich ändern.

### SCHRITT 0 JEDES LAUFS — Lebenszeichen (verbindlich, auch bei leerer Liste)
Vor allem anderen eine Zeile an `docs/agents/loop-heartbeat.md` anhängen und
committen:

    <ISO-Datum+Uhrzeit UTC> | Lauf gestartet | offene Blöcke: <n>

Und am Ende des Laufs eine zweite Zeile mit dem Ergebnis:

    <ISO-Datum+Uhrzeit UTC> | <Block-ID erledigt / nichts offen / abgebrochen: Grund>

**Warum das nicht optional ist:** Dieses Projekt hat die Fehlerklasse
„Automatismus fällt still aus" bereits zweimal getroffen — die `health`-Function,
die nie deployt war und deren Workflow 404 als Warnung wertete (#145), und diese
Routine selbst, deren Ausfall vom 19.–27.07. niemandem auffiel, weil
„nichts getan" und „nicht gelaufen" von außen identisch aussehen. Ein
Heartbeat macht den Unterschied sichtbar. Ohne ihn ist jede Aussage über die
Routine eine Vermutung.

### Warteschlange (der Reihenfolge nach, EIN Block pro Lauf)
Alle sechs sind in sich abgeschlossen, lokal verifizierbar und brauchen KEINE
Founder-Entscheidung. Reihenfolge = absteigender Wert.

- [ ] **Q1 — Erstattete Verträge sehen aus wie saubere.** Seit 0630/0640 stehen
  `customer_refunded_amount`, `refunded_at`, `dispute_state` und
  `dispute_funds_withdrawn` auf `contracts`, aber KEIN Screen wertet sie aus.
  Ein `completed`-Vertrag mit zurückgeflossenem Geld ist in jeder Liste von
  einem sauber abgeschlossenen nicht zu unterscheiden. `app/rechnung.tsx` zeigt
  weiterhin den vollen `customer_total` als „du zahlst".
  Zu tun: Korrekturzeile auf der Rechnung („Erstattet: −X,XX €", Restbetrag),
  Hinweis in der Auftragsliste und im Anbieter-Dashboard.
  **Den `status` dabei NICHT ändern** — das würde den Vertrag aus der
  DAC7-Meldung nehmen, obwohl die Vergütung geflossen ist (Begründung in 0630).
  Grenze: ob eine Erstattung umsatzsteuerlich eine Rechnungsberichtigung nach
  § 14c/§ 17 UStG auslöst, ist Steuerberater-Frage — eine schlichte
  Erstattungszeile ist immer richtig und nie schädlich.

- [ ] **Q2 — Betrugsvermerke haben keine Löschfrist.** `fraud_warning_at` und
  `fraud_warning_action` (0640) stehen auf `contracts` und überleben damit die
  Kontolöschung unbegrenzt: `delete-account` pseudonymisiert nur `profiles`.
  `contracts` unterliegt zwar 10 Jahren (HGB § 257 / AO § 147) — ein
  Betrugsvermerk ist aber kein Handelsbuchbeleg, ihn so lange mitzuschleppen ist
  ein Zweckbindungsproblem (Art. 5 Abs. 1 lit. e DSGVO).
  Zu tun: Migration mit einer Funktion, die beide Spalten nach ~13 Monaten
  (Chargeback-Frist) nullt, plus Aufruf in `delete-account`. db-test dazu.

- [ ] **Q3 — Art. 14 DSGVO: die Betrugswarnung fehlt in der
  Datenschutzerklärung.** `app/datenschutz.tsx` nennt Stripe als *Empfänger*,
  nicht als *Quelle einer Bewertung*. Eine vom Kartennetz gemeldete
  Betrugswahrscheinlichkeit ist ein Datum aus fremder Quelle über eine
  identifizierbare Person. Rechtsgrundlage (Art. 6 Abs. 1 lit. f, Betrugsabwehr)
  steht schon dort — die Verarbeitung selbst nicht.
  Zu tun: Absatz ergänzen, Quelle, Zweck, Speicherdauer (siehe Q2), und der
  Hinweis, dass daraus KEINE automatisierte Entscheidung folgt, solange
  `STRIPE_AUTO_REFUND_ON_FRAUD_WARNING` nicht gesetzt ist.

- [ ] **Q4 — Der Anbieter sieht den Zähler statt der Meldezahl.**
  `lib/pstTg.ts` liest `profiles.pstg_*`. Das ist seit 0620 nur noch der
  Live-Stand für das laufende Jahr und die Sperre; gemeldet wird aus
  `contracts` (`pstg_year_totals`). Für abgelaufene Jahre gehört `pstg_reports`
  gelesen. Der Minimalfix (`.eq('pstg_year', y)`, damit nie ein falsches Jahr
  beschriftet wird) ist drin, der Umbau nicht.

- [ ] **Q5 — Echter Nebenläufigkeits-Test per `dblink`.** Z7 in
  `scripts/db-test/psttg-counter.sql` läuft sequenziell und beweist keine
  Nebenläufigkeit; das steht ehrlich im Testkopf, ist aber eine Lücke.
  `dblink 1.2` ist in der Harness verfügbar, kein Docker nötig. Rezept
  (vorgeführt, funktioniert): `dblink_connect` s1/s2 → `dblink_exec('s1','begin')`
  → `dblink('s1','select * from pstg_record_transaction(…)')` →
  `dblink_send_query('s2', …)` → `pg_sleep(1)` + `dblink_is_busy('s2')=1` als
  Blockier-Nachweis → `dblink_exec('s1','commit')` → `dblink_get_result` —
  **zweimal rufen**, sonst scheitert der folgende commit.
  Gegenprobe mit dem alten Lesen-Rechnen-Schreiben muss eine Fortschreibung
  verlieren, sonst beweist der Test nichts.

- [ ] **Q6 — § 15 PStTG verlangt die Vergütung je QUARTAL.** `pstg_reports`
  (0220) speichert nur Jahreswerte. Aus `contracts` ist die Quartalsaufteilung
  seit 0620 trivial ableitbar (`escrow_released_at` in Europe/Berlin), aus dem
  alten Zähler war sie es nie. Gehört zum BZSt-XML.
  Zu tun: `pstg_quarter_totals(jahr)` analog zu `pstg_year_totals`, vier Zeilen
  je Anbieter, Schwelle als Parameter, nur für `service_role`. Tests wie Z9-Z12.

**Ist die Liste abgearbeitet:** Heartbeat-Zeile „nichts offen" schreiben und
enden. NICHT selbst neue Blöcke erfinden — neue Arbeit trägt der Founder ein
oder eine volle Session nach ausdrücklichem Auftrag.

### Regeln für jeden Lauf (verbindlich)
1. **Ist die Liste leer: Einzeiler-Status, Ende.** Keine Arbeit suchen, keine
  Features erfinden. Das ist ausdrücklich erwünscht, nicht Faulheit.
2. Verifikation vor Commit: `tsc` · `jest` · `bash scripts/db-test/run.sh` ·
  bei `supabase/functions/**` zusätzlich `deno check` (siehe AGENTS.md).
3. Merge selbst (squash → main), CI muss grün sein. EIN `get_check_runs`
  nach echter Arbeit — kein Sleep-Polling (AGENTS.md).
4. Diesen Abschnitt aktualisieren: Block abhaken, Ergebnis in einem Satz.
5. **Nicht anfassen ohne den Founder:** Design (Variante C gilt), Preise/
  Take-Rate, AGB/Recht, Rebrand, Pro-Feature (eingefroren, CFO-Entscheid).

### Was der Loop NICHT lösen kann
Jeder verbleibende Go-Live-Punkt ist ein Founder-Klick oder ein Dritter:
`RESEND_API_KEY` (P0 — ohne ihn ist JEDER Schreibweg gesperrt), Stripe Live +
Connect, Impressum, Google/Apple-OAuth, EAS/Store, Anwalt (P2B-AGB), die 10
Dashboard-Klicks der Security-Checkliste. Solange RESEND fehlt, lässt sich
nichts davon end-to-end verifizieren — deshalb ist der Vorrat oben bewusst
Absicherung und Text, nicht neue Features.

## 2026-07-28 — Agenten-Review über die Arbeit vom 27.07. (3 Fachagenten)

Founder-Kritik am Morgen: „ich dachte, du arbeitest autonom mit den Agenten".
Berechtigt — die Blöcke A1–A3 und M1/M2 hatte ich alle selbst geschrieben UND
selbst gemergt. Drei read-only Fachagenten (Director Software Architect,
Senior Test Expert, Werkant CCO) haben nachgeprüft und Substanzielles gefunden.
Muster wie bei #134/#138: Agenten-Review über fremden Code findet, was der
Autor nicht sieht.

**Gefixt in #152** (Details dort): Zahlung ohne DB-Spur (Gegenstück zu meinem
CAS aus #149), 1-Cent-Differenz zwischen angezeigtem und abgebuchtem Betrag
(23 Preise zwischen 1 und 500 EUR, am echten accept_offer verifiziert),
Testharness meldete grün bei leerem Migrationspfad, falsch grüner Export-Test
der eine Art.-15-Lücke verdeckte, sechs Zusagen die der Code nicht einlöst.

### OFFEN — Founder-Entscheidung nötig (nicht einseitig entscheidbar)

1. **„Ohne Nachweis kein Angebot" ist nicht durchgesetzt.** Die INSERT-Policy
   in 0580 prüft E-Mail, Strikes, Track und Job-Status — aber NICHT
   `kyc_status`. `angebot-erstellen.tsx:97` prüft nur, ob eine
   provider_profiles-Zeile existiert, und die legt der Signup-Trigger (0020)
   automatisch an. **Ein Konto ohne ein einziges Dokument kann heute im
   Elektro-Gewerk bieten.** Das ist das Kernversprechen der Marke.
   Die Texte sind vorerst entschärft (#152). Die Policy nachzuziehen
   (`and exists (… kyc_status = 'approved')`) sperrt jeden Anbieter aus, bis du
   ihn per Concierge-Review freigibst — das ist eine Betriebsentscheidung, kein
   Bugfix. Solange sie offen ist, darf die Zusage nirgends wieder auftauchen.

2. ~~Jahreswechsel löscht den Vorjahresstand vor der DAC7-Meldung.~~
   **ERLEDIGT 28.07.** (Migration 0620, db-test 71 -> 74). Die Meldung kommt
   jetzt aus `contracts` — `provider_payout` bei abgeschlossenen, freigegebenen
   Verträgen, gruppiert nach dem Jahr von `escrow_released_at` (Europe/Berlin).
   Diese Zahlen sind unveränderlich: für 2026 stehen sie auch 2028 noch so da.
   `profiles.pstg_*` bleibt Anzeige- und Sperr-Cache, hängt aber nicht mehr an
   der Meldung — ein ausgefallener oder verspäteter Cron-Lauf kann keine
   Meldedaten mehr verlieren. Test Z9 spielt genau den nachgestellten Ausfall
   durch (Zähler steht auf 2027, Meldung für 2026 bleibt vollständig).
3. ~~Demo-Anbieter mit erfundenen Bewertungen.~~ **ERLEDIGT 28.07.** (#153) —
   betraf drei Screens, nicht einen; Details im PR.
   (ursprünglicher Befund:) `app/(tabs)/index.tsx:55-61`
   zeigt bei 0 echten Anbietern `DEMO_TOP_PROVIDERS` — „Marcus Berger, 4,9
   (87)". Erfundene Bewertungen stehen im Anhang zu § 3 Abs. 3 UWG (Nr. 23b/c),
   per se unzulässig, ohne Interessenabwägung. Landen sie auf Store-Screenshots,
   kommt Apple 2.3.3 dazu. Entfernen ändert die Optik einer leeren Startseite —
   deine Entscheidung, aber vor dem ersten echten Nutzer.

4. ~~Steuer-ID wird erhoben und verworfen.~~ **ERLEDIGT 28.07.** (#153) — wird
   gespeichert, bleibt aber optional (GmbH/UG und ausländische Betriebe melden
   nicht über die 11-stellige IdNr). Das IBAN-Feld ist entfernt, sein Wert ging
   nirgendwohin. (ursprünglicher Befund:) `onboarding-kyc.tsx:227-233`
   übergibt `hwSteuerID` nirgends an `updateProviderProfile`. Ausserdem erhebt
   das Formular die Steuer-ID (11-stellig, § 139b AO), nicht die Steuernummer —
   verschiedene Nummern. Für die DAC7-Meldung steht sie damit nicht bereit.
   Entscheidung nötig: Feld wirklich speichern oder Erhebung streichen
   (Datenminimierung). Die Erfolgsmeldung behauptet sie inzwischen nicht mehr.

5. **Nachbarschafts-Flag vor der Store-Einreichung festlegen.** Die
   Release-Checkliste sagt „NACHBARSCHAFT aus in Produktion", `eas.json` setzt
   die Variable aber nicht, und `constants/features.ts:21` ist `!== 'false'` →
   der Produktionsbuild hätte den Track faktisch AN. Ein Sechstel der
   Store-Beschreibung hängt daran.

6. **Anwalt / Steuerberater** (kein Code): „Treuhand" ist aufsichtsrechtlich
   besetzt (§ 1 Abs. 1 ZAG) und das eigene `zagGate.ts` hält Live-Zahlungen
   genau deswegen zu — der Begriff darf nicht ins Store-Marketing, bevor
   gezeichnet ist. Dazu: Leistungsversprechen „Werkant Schutz" (was genau ist
   der Auslöser), USt-Behandlung der Plattformgebühr in beide Richtungen
   (Reverse-Charge-Annahme in feeEngine.ts:13 ist für DE→DE fraglich),
   Trader-/DSA-Status mit echten Impressumsdaten für beide Stores.

### Neu offen aus dem DAC7-Vor-Merge-Review (28.07.)
- ~~Erstattung nach Abschluss lässt die gemeldete Summe zu hoch stehen.~~
  **ERLEDIGT 28.07.** (Migration 0630, db-test 75 -> 79) — **aber anders als
  der Review vorschlug, und das ist der wichtige Teil.** Der Vorschlag lautete,
  den erstatteten Betrag von der DAC7-Summe abzuziehen
  (`sum(provider_payout - refunded_amount)`). Das wäre falsch gewesen: es gibt
  im gesamten Code **keine** Transfer-Rückabwicklung (kein
  `transfers.createReversal`, keine Verrechnung). Nach `release-escrow` liegt
  das Geld auf dem Connect-Konto des Anbieters und bleibt dort — eine
  Erstattung zahlt Werkant aus eigener Tasche. Die Vergütung des Anbieters
  (§ 3 Abs. 5 PStTG, „gezahlt oder gutgeschrieben") ist unverändert. Ein Abzug
  hätte den Anbieter ZU NIEDRIG gemeldet: derselbe Fehlertyp wie der, den 0620
  gerade beseitigt hat, nur in die andere Richtung.
  Gebaut wurde stattdessen: `charge.refunded` und `charge.dispute.*` im
  stripe-webhook, `contracts.customer_refunded_amount` (kumuliert gesetzt, also
  idempotent) + `refunded_at` + `dispute_state`, alle vier durch den
  0300-Guard gesperrt. Eine Erstattung NACH Auszahlung wird auf Fehler-Ebene
  protokolliert — sie ist ein echter Verlust für Werkant und nur manuell
  zurückzuholen.
  **`provider_clawback_amount` ist reserviert und bleibt 0.** Wird je ein
  Rückholmechanismus gebaut, MUSS `pstg_year_totals` genau um diesen Wert
  vermindert werden — und nur um diesen, nie um die Kundenerstattung.
- **Der Anbieter-Screen sollte die Meldezahl zeigen, nicht den Zähler.** Der
  Zähler hat seit 0620 nur noch eine legitime Aufgabe: `pstg_locked` für das
  laufende Jahr. Für abgelaufene Jahre gehört `pstg_reports` gelesen. Der
  Minimalfix (`.eq('pstg_year', y)`, damit nie ein falsches Jahr beschriftet
  wird) ist drin; der Umbau des Screens nicht.
- **§ 15 PStTG will die Vergütung je QUARTAL**, `pstg_reports` (0220) speichert
  nur Jahreswerte. Aus `contracts` ist das jetzt trivial ableitbar, aus dem
  Zähler war es das nie. Gehört zum BZSt-XML.
- **Steuerberater-Frage:** die Bagatellgrenze 30/2000 (§ 4 Abs. 5 Nr. 4 PStTG)
  ist für WARENverkäufer geschrieben. Werkant vermittelt persönliche
  Dienstleistungen (§ 5 Abs. 1 Nr. 2), für die es diese Freistellung so
  möglicherweise nicht gibt — dann wäre JEDER Anbieter mit Auszahlung zu
  melden. Die Schwelle ist deshalb bewusst ein Parameter von
  `pstg_year_totals`: fällt die Antwort auf "alle melden", ist das eine Zeile.
- **Kein Index auf `contracts` nötig** (gemessen, 200.000 Verträge): ohne Index
  73 ms, der naheliegende Partial-Index macht es mit 84 ms *langsamer*, nur ein
  Ausdrucks-Index auf das Berlin-Jahr bringt 26 ms. Bei einem Lauf pro Jahr ist
  das spekulativ — bewusst ohne Index gemergt. Erst nötig, wenn die Funktion
  quartalsweise oder aus einem Dashboard gerufen wird.

### Aus dem CFO-Review zu #155 (28.07.) — Folgeaufgaben
- ~~`radar.early_fraud_warning.created` behandeln.~~ **ERLEDIGT 29.07.**
  (Migration 0640, db-test 81 -> 84). Zusammen mit `charge.refund.updated`
  (fehlgeschlagene Erstattung korrigiert den Stand) und
  `charge.dispute.funds_withdrawn`/`funds_reinstated` (die tatsächlichen
  Cash-Bewegungen, getrennt vom Status).
  **WICHTIG — die Automatik ist bewusst AUS.** Der Mechanismus ist gebaut, aber
  eine Frühwarnung ist eine Wahrscheinlichkeitsaussage, keine Feststellung;
  automatisch zu erstatten hiesse, einem womöglich ehrlichen Kunden
  unaufgefordert zu stornieren und dem Anbieter die Arbeit zu entziehen. Das ist
  eine Geldbewegung ohne menschliche Prüfung und damit Founder-Entscheidung.
  Scharf schalten mit dem Secret `STRIPE_AUTO_REFUND_ON_FRAUD_WARNING=true`;
  Abwägung steht in `docs/todo/OFFENE-FOUNDER-TODOS.md`. Solange es fehlt, wird
  jede Warnung auf Fehler-Ebene protokolliert (mit Betrag und der Angabe, ob
  schon an den Anbieter ausgezahlt wurde) und als `fraud_warning_action='offen'`
  vermerkt — eine Erstattung von Hand im Dashboard wendet den Chargeback genauso ab.
- **`app/rechnung.tsx`:** zeigt nach einer Erstattung unverändert den vollen
  `customer_total` als „du zahlst". Eine Zeile „Erstattet: −X,XX €" ist immer
  richtig. Ob das umsatzsteuerlich eine Rechnungsberichtigung nach § 14c/§ 17
  UStG auslöst, hängt daran, ob Werkant für die Leistung selbst abrechnet oder
  nur für die Provision — **Steuerberater**.
- **Kontotyp der Connect-Konten dokumentieren.** Es gibt im Repo kein
  `accounts.create` — die Konten entstehen offenbar per Hand im Dashboard.
  Damit hängt der Kontotyp (und mit ihm das Haftungsregime) an einer
  Klick-Entscheidung ohne Codebeleg. Gehört nach `notes/04-Entscheidungen/`,
  sonst ist in zwei Jahren nicht mehr rekonstruierbar, unter welchem Regime die
  Altfälle liefen.
- **Steuerberater-Frage zu `provider_clawback_amount`:** wird je zurückgeholt,
  korrigiert das dann das *Meldejahr der ursprünglichen Zahlung* oder mindert es
  das *Jahr der Rückholung*? Auslegung zu § 15 PStTG, entscheidet nicht der Code.

### Aus dem CCO-Review zu #156 (29.07.) — offen
- **Die Betrugs-Automatik darf NICHT eingeschaltet werden**, bis AGB-Klausel,
  Benachrichtigung beider Seiten und Art.-22-Konformität stehen. Details und
  Begründung in `docs/todo/OFFENE-FOUNDER-TODOS.md` — der Eintrag las sich
  vorher wie eine Abwägung, tatsächlich wäre Einschalten heute ein Fehler.
- **Speicherdauer der Betrugsvermerke ungeregelt.** `contracts` unterliegt
  10 Jahren (HGB §257 / AO §147), aber ein Betrugsvermerk ist kein
  Handelsbuchbeleg — ihn 10 Jahre mitzuschleppen ist ein Zweckbindungsproblem
  (Art. 5 Abs. 1 lit. e). `delete-account` pseudonymisiert nur `profiles`,
  `fraud_warning_*` überlebt die Kontolöschung damit unbegrenzt. Vorschlag des
  CCO: eigene Löschfrist, ~13 Monate (an der Chargeback-Frist orientiert).
- **Art. 14 DSGVO:** die Verarbeitung einer vom Kartennetz gemeldeten
  Betrugswahrscheinlichkeit steht nicht in `app/datenschutz.tsx` — Stripe ist
  dort als Empfänger gelistet, nicht als Quelle einer Bewertung.
- **UI wertet die neuen Spalten nicht aus.** Ein `completed`-Vertrag mit
  zurückgeflossenem Geld sieht in jeder Liste aus wie sauber abgeschlossen.
  `status` dafür zu ändern wäre falsch (es würde den Vertrag aus der
  DAC7-Meldung nehmen, obwohl die Vergütung geflossen ist) — der richtige Weg
  ist, `customer_refunded_amount`/`dispute_state` in den Screens zu zeigen.
  Betrifft `app/rechnung.tsx` (bestehender Eintrag) und die Auftragslisten.

### Nächster sinnvoller Testblock (nicht angefangen)
Echter Nebenläufigkeits-Test per `dblink` (in der Harness verfügbar, kein
Docker): zwei Sessions, S1 hält den Row-Lock, S2 blockiert nachweislich
(`dblink_is_busy = 1`), danach commit und `dblink_get_result` — zweimal rufen,
sonst scheitert der folgende commit. Der Test-Experten-Agent hat damit bereits
gezeigt, dass der ALTE Code eine Fortschreibung verliert und der neue nicht.

## Bereit zum Merge
Hier trägt der Autonom-Loop fertige, aber ungemergte Branches ein (er hat in
seinen Läufen keine GitHub-Tools). Format: Branchname — was drin ist —
Verifikations-Ergebnisse. Die nächste volle Session mergt und leert die Liste.

(leer — Stand 27.07., #147 wurde direkt gemergt)

## Update 2026-08-03 — Stripe-Webhook ausführbar testbar + P0-2 behoben

**Warum:** Der gesamte Geldpfad war nie ausgeführt worden — CI prüfte Edge
Functions nur mit `deno check`. 634 Zeilen Stripe-Logik ohne einen einzigen
Testlauf.

- **Extraktion:** `stripe-webhook/handler.ts` (neu) enthält die komplette
  Eventverarbeitung; `index.ts` schrumpft 634 → 57 Zeilen auf Client-Erzeugung,
  Signaturprüfung und Delegation. Der Kernblock ist maschinell als zeichengleich
  zum Vorzustand nachgewiesen (Z. 60–633 des alten `index.ts`).
- **Test-Doubles** (`_shared/testing/`): bewusst KEIN PostgREST-/Stripe-Nachbau.
  Sie protokollieren Aufrufe und liefern skriptierte Antworten. Filter werden
  NICHT ausgewertet — die reale CAS-Wirkung bleibt in
  `scripts/db-test/webhook-idempotency.sql` gegen echtes Postgres belegt.
- **Tests:** `supabase/tests/stripe-webhook_test.ts`, 13 Fälle, kein
  `--allow-none`, kein skip/ignore/todo.

**Behobener Geldfehler (P0-2), zuvor als roter Test reproduziert:**
`charge.refunded` schrieb `customer_refunded_amount` aus dem Event-*Snapshot*.
Folge (a) zwei Teilerstattungen in umgekehrter Zustellreihenfolge senkten den
Stand von 50 auf 30; Folge (b) nach berechtigtem Reset auf 0 durch ein
fehlgeschlagenes Refund hob eine verspätete Wiederholung ihn zurück auf 100 —
der Guard in `release-escrow` sperrte dann dauerhaft: Kunde ohne Geld, Anbieter
nie auszahlbar. `max(alt, neu)` löst (b) NICHT.
**Fix:** autoritativer Stand per `stripe.charges.retrieve()` statt Snapshot,
Schreiben mit CAS auf `customer_refunded_amount` und max. 3 Versuchen. Schlägt
der autoritative Abruf fehl → 500, keine DB-Änderung (Stripe wiederholt).
Mutationsprobe: Rückbau auf den Snapshot lässt genau die zwei Befund-Tests
fallen — die Tests sind nachweislich diskriminierend.

**Beweisgrad — wichtig:** Geprüft ist unsere eigene Handlerlogik gegen
Test-Doubles. Stripe selbst wurde NICHT getestet; es gibt bewusst keine
Stripe-Konfiguration (Founder-Entscheidung). Die Annahmen über Stripe
(kumuliertes `amount_refunded`, Snapshot-Semantik, keine Reihenfolgegarantie)
sind offizielle Semantik, nicht von uns verifiziert. Verifikation gegen den
echten Stripe-Testmodus steht aus.

**Baseline:** deno test 13/13 · deno check 13/13 Functions · tsc 0 · Jest
363/363 · db-test 85/85. `tsconfig.json` musste `supabase/tests/**` ausschließen
(sonst zieht der Import die Deno-Datei in die TS-Prüfung).
