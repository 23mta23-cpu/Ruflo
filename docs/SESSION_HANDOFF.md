> **Neu hier? Lies zuerst `docs/STAND-UND-VISION.md`** — Überblick über Vision,
> technischen Stand, den einen Blocker und was nach Verantwortung vor uns liegt.
> Diese Datei hier ist die Chronik (876+ Zeilen) und die Quelle der
> Arbeits-Warteschlange.

# Stand 2026-08-16 (vormittags) — Strikes: Code widersprach den AGB (PR #181)

**PR #180 ist gemergt.** Danach: `claude/strikes-nach-agb` → **PR #181**.

Anlass war die Founder-Frage "wie macht Airbnb das mit Strikes?". Die
Recherche ergab, dass Airbnb **keine Zahl veroeffentlicht** ("repeated or
severe violations"). Uebertragen liess sich davon wenig — der Vergleich hat
stattdessen aufgedeckt, dass **der Code den eigenen AGB widersprach**:

| AGB §7 | Code bis 16.08. |
|---|---|
| (3) 3 Strikes **innerhalb von 12 Monaten** | zaehlte ueber die gesamte Kontodauer, `greatest()` liess Strikes nie sinken |
| (4) Begruendung (Art. 4 P2B-VO (EU) 2019/1150) | speicherte einen Integer — daraus laesst sich keine erzeugen |
| (2) vier Verstossgruende | automatisch nur einer |

Migration **0720** `provider_strikes`: Akte je Strike mit Anlass, Begruendung,
Verfallsdatum, Aufhebung. Sperre prueft `aktive_strikes()` statt der Spalte
(ein Strike verfaellt durch Zeitablauf — dabei schreibt niemand).
`strike_count` ist nur noch abgeleitet und wird per Trigger ueberschrieben.

**Bewusst NICHT von Airbnb uebernommen:** die Intransparenz. Die
veroeffentlichte Schwelle bleibt — §307 Abs. 1 S. 2 BGB spricht dafuer, und
eine konkrete Zahl ist ueberpruefbar (genau daran ist der Widerspruch
aufgefallen). Begruendung in
`notes/04-Entscheidungen/2026-08-16-strikes-airbnb-vergleich.md`.

**Der Anrede-Pruefer hatte eine sechste Luecke:** er sah `lib/` und
`contexts/` gar nicht an, und nur `*.tsx`. Fuenf Duz-Stellen standen dort,
darunter die Meldung an einen GESPERRTEN Anbieter. Jetzt vier Verzeichnisse,
`*.ts` und `*.tsx`.

Stand: DB-Test **139** Assertions, Jest **385**, Browser 7/7, Anrede 0.

## Offen, unveraendert in dieser Reihenfolge

1. **`RESEND_API_KEY`** — groesster Punkt. Ohne ihn keine Registrierung, und
   jetzt zusaetzlich: die Strike-Begruendung kann nicht per E-Mail zugehen,
   was AGB §7(4)/Art. 4 P2B-VO aber verlangt (dauerhafter Datentraeger; ein
   Dashboard ist keiner).
2. **[ANWALT] Widerrufs-Klausel** — `notes/04-Entscheidungen/2026-08-16-widerruf-klausel.md`.
3. **Founder: Gegenangebot** ja/nein.
4. **Founder: support@ vs kontakt@** — im Produkt gemischt (11x/5x). Welche
   Postfaecher real existieren, weiss ich nicht.
5. **Anbieter-Verfuegbarkeit** wird weiterhin nicht gespeichert.
6. **Die drei anderen AGB-Verstossgruende** haben eine Spalte, aber kein
   Werkzeug zum Ausloesen (bis dahin von Hand, Begruendung erzwungen).

---

# Stand 2026-08-16 — sieben Geraete-Befunde des Founders (PR #180)

**Branch:** `claude/adresse-erheben` · **PR #180**, sieben Bloecke.
Vorher gemergt: **#179** (Rand-Ueberstand, `min-width: auto`).

## Der rote Faden dieser Sitzung

Jeder der sieben Befunde hatte eine gruene Pruefung, die nichts geprueft hat.
Das ist die eigentliche Lehre, nicht die einzelnen Fehler:

| Befund | Was gruen meldete | Was tatsaechlich war |
|---|---|---|
| Adresse fehlte | `tsc` gruen | `addressStreet` war OPTIONAL — Weglassen war kein Fehler |
| Kalender nur eine Woche | Browser-Lauf gruen | Bildschirm ist rollen-gesperrt, wurde nie erreicht |
| Zeitzonen-Fehler | Jest gruen | Jest lief in UTC, Fehler existiert nur ausserhalb |
| Anrede uneinheitlich | Pruefer meldete 0 | sah nur ~1/3 des sichtbaren Texts |
| Widerrufs-Policy | alle Tests gruen | zwei Bedingungen deckten dieselben Faelle |
| Stornotext | niemand prueft Text | Text war unvollstaendig ZULASTEN des Kunden |
| Melden fehlte | Strike-Weg existiert | haengt am Geraet des Taeters |

**Arbeitsregel daraus:** ein gruener Haken zaehlt erst, wenn eine Mutation
belegt, dass er rot werden KANN — und zwar fuer jede Form, in der der Fehler
auftreten kann.

## Was jetzt anders ist

- `jest.config.js` setzt **TZ=Europe/Berlin**. Ohne das verschwinden
  Datumsfehler, die nur ausserhalb von UTC auftreten — also alle echten.
- `scripts/anrede-check.py` liest jetzt auch JSX-Textknoten, kurze
  Zeichenketten, Imperative ohne Pronomen und umgebrochene Prosa.
- `scripts/db-test/run.sh`: **130 Assertions** (vorher 115), neu
  `chat-reports` und `widerruf-consent`.
- Neue Migrationen: **0700** `chat_reports`, **0710** `widerruf_consents`.
- Neue reine Module: `lib/kalenderWoche.ts`, `lib/chatReport.ts`,
  `lib/widerruf.ts` — ausgelagert, damit das Pruefbare pruefbar ist.

## Offen, in dieser Reihenfolge

1. **`RESEND_API_KEY`** — unveraendert der groesste Punkt. Ohne ihn kann sich
   niemand registrieren, und die halbe Marktplatz-Strecke (Angebot → Annahme →
   Vertrag → Escrow → Auszahlung) bleibt ungetestet. Founder-Klick, kein Code.
2. **[ANWALT] Widerrufs-Klausel** — siehe
   `notes/04-Entscheidungen/2026-08-16-widerruf-klausel.md`. Der NACHWEIS
   laeuft jetzt; ob die Klausel inhaltlich richtig ist, ist offen.
3. **Founder-Entscheidung Gegenangebot** — Produktentscheidung, keine
   Fehlerbehebung.
4. **Anbieter-Verfuegbarkeit wird nicht gespeichert.** Der Kalender kann
   blaettern, aber Frei/Gesperrt ueberlebt nur die Sitzung. Es gibt keine
   Tabelle dafuer; "Urlaub eintragen" sagt selbst, dass es fehlt.
5. **Kunden-Strikes?** Bisher tragen nur Anbieter `strike_count`. Ob Kunden
   ebenfalls sanktioniert werden sollen, ist unentschieden.

## Bewusst NICHT gebaut (mit Begruendung, nicht vergessen)

- **Systemnachricht "Strike 1" im Chat.** Der Thread gehoert beiden. Dem
  Kunden anzuzeigen, dass sein Handwerker einen Strike hat, waere eine
  Rufschaedigung durch die Plattform — auf Grundlage eines Regex-Treffers.
  Der Anbieter sieht seinen Stand im eigenen Dashboard.
- **Auto-Strike aus einer Meldung.** Eine Meldung ist frei ausloesbar; drei
  wuerden genuegen, um einen Anbieter aus dem Markt zu nehmen.

---

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

### Agenten-Reviews zu PR #159 — behoben und offen

Drei read-only Reviews (Security/adversarial, QA/Testkritik, Solution-Architect).
Jeder Befund vor Übernahme selbst am Code verifiziert.

**Behoben** (im geänderten Umfang, Tests 13→18):
- fail-open nach drei erfolglosen CAS-Versuchen: Kommentar sagte „nicht
  stillschweigend 200", Code tat genau das. Jetzt 500. „Kein Vertrag zum
  PaymentIntent" davon sauber getrennt (dort bleibt 200, Wiederholen hilft nicht).
- `charge.refund.updated` schrieb ohne CAS und konnte den frisch verbuchten Wert
  wieder überschreiben — dieselbe Schreibinversion über den Nachbarzweig.
- Test 10 war **falsch grün**: `upd.length === 0 ? 0 : …` liess „gar nicht
  geschrieben" als „korrekt 0 geschrieben" durchgehen (per Mutation nachgewiesen).

**OFFEN — ausserhalb des Umfangs von #159, nächste Blöcke:**
- **P0** `charge.dispute.funds_withdrawn`/`funds_reinstated`: Update-Ergebnis wird
  ohne `error`-Prüfung entgegengenommen, danach 200. Geld hat den Plattform-Saldo
  real verlassen, die DB weiss nichts davon, Stripe wiederholt nie. Bankauszug und
  Buchführung driften ohne Alarm auseinander.
- **P0** `contracts.stripe_payment_intent` speichert nur den LETZTEN PaymentIntent.
  Erstattung oder Chargeback auf einen älteren PI findet keine Zeile und
  hinterlässt weder Spur noch Alarm. Braucht eine Schemaänderung (Migration).
- **P1** Subscription-Zweige schreiben ebenfalls ohne `error`-Prüfung.
- **P2** `dispute_state` wird unbedingt überschrieben (verspätete `created`-
  Zustellung nach `closed` setzt zurück auf `open`); `dispute_fee` nur bei Fee > 0.

**Beweisgrad unverändert:** Doubles, nicht Stripe. Kein Stripe-Aufruf ausgeführt.

## Update 2026-08-03 — Webhook-Tests in CI (Block 2)

Neuer Schritt „Stripe-Webhook-Tests ausfuehren" im bestehenden `edge-check`-Job
(Deno ist dort schon eingerichtet — minimale Änderung, keine anderen Workflows).
Bewusst streng, gleiche Fehlerklasse wie bei `scripts/db-test/run.sh`:
expliziter Dateipfad statt Verzeichnis, kein `--allow-none`, Mindest-Testanzahl
wird geprüft statt nur gedruckt. Lokal alle vier Fälle nachgestellt: Normallauf
grün (18), fehlende Datei rot, zu wenige Tests rot, echter Testfehler rot in 2 s
ohne Wiederholung. Ein Review fand keinen Weg zu falschem Grün.

## Update 2026-08-03 — account.updated spiegelt jetzt beidseitig (Block 3)

`stripe_onboarded` war als Spiegel des Connect-Zustands dokumentiert, folgte aber
nur nach oben: einmal `true`, immer `true`. Sperrt Stripe ein Konto nachträglich
(`charges_enabled`/`payouts_enabled` fallen auf false), blieb der Anbieter in der
App voll onboardet — sichtbar auf der Startseite, in der Nachbarschaftsliste und
mit „verifiziert"-Abzeichen in der Suche. Jetzt wird der berechnete Zustand in
beide Richtungen geschrieben; die Sperrung landet auf Fehler-Ebene im Log.
Tests 18–21, vor dem Fix drei davon rot. CI-Mindestzahl 18 → 22.

**Weiterhin offen, gehört zu Block 4:** `release-escrow` prüft `stripe_onboarded`
NICHT — es verlangt nur, dass `stripe_account_id` existiert. Eine Auszahlung an
ein gesperrtes Konto wird also weiterhin versucht.

**Nachtrag Block 3 (Security-Review):** Dadurch, dass jetzt auch `false`
geschrieben wird, entstand eine NEUE Reihenfolge-Lücke — ein verspätetes altes
„gesperrt"-Event hätte einen wieder freigeschalteten Anbieter dauerhaft
unsichtbar gemacht. Gelöst wie beim Erstattungsstand: `stripe.accounts.retrieve()`
liefert den massgeblichen Zustand, Fehlschlag → 500 ohne DB-Änderung.
Tests 22/23. Mindestzahl 24.

## Update 2026-08-03 — release-escrow ausführbar testbar (Block 4)

Extraktion wie beim Webhook: `release-escrow/handler.ts` (neu) enthält die
Logik, `index.ts` schrumpft 256 → 38 Zeilen. Kernblock (207 Z.) maschinell als
zeichengleich nachgewiesen. 23 Tests, CI-Mindestzahl 43 → 47.

**Behoben (eindeutiger Zählfehler):** Das Vertrags-Update war bedingungslos.
Die Guards davor sind Read-then-Act — zwei gleichzeitige Anfragen kommen beide
durch. Der Idempotency-Key schützt den Stripe-Transfer, aber NICHT den
PStTG-Jahreszähler: der stieg zweimal für eine Auszahlung. Zu hoch gezählt
meldet den Anbieter dem BZSt mit einer Vergütung, die er nie erhalten hat
(§ 3 Abs. 5 PStTG). Jetzt CAS auf `escrow_released_at`; wer das Rennen
verliert, zählt nicht und benachrichtigt nicht.

**OFFEN — P0, NICHT behoben, Merge bewusst zurückgehalten:**
Der Stripe-Transfer läuft VOR dem Vertrags-Update. Schlägt das Update fehl
(DB-Timeout), ist das Geld beim Anbieter, `escrow_released_at` bleibt leer, und
der Kunde bekommt 500. Alle Guards lassen einen erneuten Versuch zu. Innerhalb
24 h schützt der Idempotency-Key; danach verwirft Stripe ihn und ein zweiter
echter Transfer ist möglich — **doppelte Auszahlung**. Es gibt keine lokale
Spur der Transfer-ID unabhängig von der `contracts`-Zeile.
Beide denkbaren Lösungen sind Architekturentscheidungen: (a) Ledger-Tabelle vor
dem Transfer (Migration, neue Tabelle, RLS) oder (b) Reihenfolge umkehren
(erst reservieren, dann überweisen) — (b) erzeugt den umgekehrten Fehler, wenn
der Transfer nach der Reservierung scheitert. Der sichere Sollzustand ist
NICHT eindeutig → dokumentiert statt eigenmächtig behoben.

**Ebenfalls offen (Founder-Entscheidung):** `release-escrow` prüft
`stripe_onboarded` nicht. Test 12 hält den Ist-Zustand fest.

## Update 2026-08-03 — Payout-Ledger (Migration 0650), P0 aus #162 geschlossen

**Founder-Entscheidung:** Option A in präzisierter Form — dauerhafte lokale
Auszahlungsoperation mit Reconciliation. Option B (erst completed, dann Transfer)
wurde abgelehnt.

Ablauf: `payout_claim` (atomar, unique auf contract_id, `for update` auf den
Vertrag) → Abgleich bei Stripe über `transfer_group` → nur bei 0 Treffern
`accounts.retrieve` (`payouts_enabled` muss true sein) → `transfers.create` mit
dem in der Operation gespeicherten Idempotency-Key → Transfer-ID festhalten →
`payout_finalize` (Operation, Vertrag, Auftrag, PStTG in EINER Transaktion).
Jeder Teilfehler ist fail-closed und wiederaufnehmbar.

### ZWEI SCHEMA-/CODE-ABWEICHUNGEN beim Replay gefunden — beide gravierend
1. **`provider_profiles.stripe_account_id` existierte NICHT.** Keine Migration
   legte sie an; `release-escrow` las sie (`.select`) und `stripe-webhook`
   filterte darauf (`.eq`). Folge: **jede Auszahlung scheiterte** mit „Provider
   Stripe account not found", und `stripe_onboarded` konnte **nie** true werden
   — womit die Sichtbarkeitsfilter auf Startseite und in der Suche niemanden
   zeigten. Spalte in 0650 ergänzt, mit Schreibschutz im Trigger (sonst könnte
   ein Anbieter sein eigenes Auszahlungsziel bestimmen).
2. **`jobs.completed_at` existiert nicht**, wurde aber geschrieben. Damit
   scheiterte der GESAMTE Update — der Auftrag blieb nach einer Auszahlung auf
   `active`. Der Fehler war nur geloggt.

**Achtung:** Punkt 1 macht Auszahlungen NICHT funktionsfähig. Es gibt im ganzen
Repo **keinen Connect-Onboarding-Pfad**, der die Spalte je füllen würde. Der
Fehler wandert von „unbekannte Spalte" zu einem ehrlichen
„provider_without_stripe_account". Das Onboarding zu bauen ist eine eigene
Aufgabe und berührt Stripe-Konfiguration.

### Reviews (drei, alle Befunde selbst reproduziert und behoben)
- **P0** Ein rückabgewickelter Transfer (`reversed`) galt beim Abgleich als
  passend — der Vertrag wäre als bezahlt geschlossen worden, der Anbieter hätte
  nichts. Jetzt Sperre.
- **P1** Der Sperr-Vermerk (`manual_review`) prüfte keinen Fehler; schlug er
  fehl, entstand nie ein Datensatz für den Support.
- **P1** Das `transferred`-Update konnte eine gleichzeitig gesetzte Sperre
  zurückdrehen. Jetzt `.neq("status","manual_review")`.
- **P2** Der Abgleich blätterte nicht (`has_more`) — jetzt fail-closed.
- **TOCTOU** `payout_finalize` prüft Erstattung und Rückbuchung erneut: zwischen
  Beanspruchen und Finalisieren liegt der Stripe-Aufruf, und in diesem Fenster
  kann ein `charge.refunded` eintreffen.
- **Falsch grün in meinem eigenen Test:** Die beiden `dblink`-Aufrufe liefen
  nacheinander, nicht überlappend — der Test blieb grün, wenn man `for update`
  entfernte. Jetzt `dblink_send_query` (echt gleichzeitig) plus ein Test, der
  eine offene Fremdtransaktion nachstellt. Gegenprobe: ohne `for update` bricht
  er mit einer Unique-Verletzung ab.

Baseline: deno test 62 (24 + 38, Mindestzahl je Datei in CI) · deno check 13/13 ·
tsc 0 · Jest 363/363 · db-test 98. Kein echter Stripe-Aufruf.

## Update 2026-08-05 — cancel-contract testbar, Doppelerstattung geschlossen

Extraktion wie zuvor: `cancel-contract/handler.ts` (neu), `index.ts` 222 → 36 Z.
Kernblock (187 Z.) zeichengleich; einzige Ausnahme ist der injizierte `sendPush`
statt eines inline-`fetch` (sonst löste jeder Testlauf eine echte Netzanfrage aus).
36 Tests.

**Behoben — Doppelerstattung (drei Wege):** Der Handler las **nie**, ob bereits
Geld zurückgeflossen ist. Eine Dashboard-Erstattung, eine Support-Erstattung oder
die proaktive Erstattung nach einer Betrugs-Frühwarnung waren unsichtbar; die
Stornierung erstattete den vollen Quotenbetrag ein zweites Mal. Jetzt Abgleich per
`refunds.list(payment_intent)` vor jeder Erstattung, nur die Differenz wird
erstattet; `failed`/`canceled` zählen nicht; `has_more` → 409; Abgleich-Fehler →
503 ohne DB-Änderung.

**KEINE `refund_operations`-Tabelle gebaut.** Begründung: Anders als beim Transfer
(wo die `transfer_group` erst von der Anwendung gesetzt wird) ist der
PaymentIntent bereits ein dauerhafter Anker auf `contracts`. `refunds.list` liefert
denselben Wiederaufnahme-Schutz ohne Schemaänderung.

**Zwei P0 aus den Reviews:**
1. *Selbst eingebaute Regression:* Ich hatte den Differenzbetrag in den
   Idempotency-Key aufgenommen. Kunde (50 %) und Anbieter (100 %) haben
   unterschiedliche Quoten — mit Betrag im Schlüssel wären es zwei Schlüssel,
   Stripe hätte nicht dedupliziert und 150 % erstattet. Schlüssel wieder
   vertragsweit.
2. Der `unrecordedCapture`-Zweig ließ `escrow_captured_at` leer. Genau darauf
   prüft `stripe-webhook/handler.ts:191` und erstattet bei einem verspäteten
   `payment_intent.succeeded` **nochmals voll**, unter eigenem Schlüssel. Jetzt
   wird die erfasste Zahlung vermerkt.

**Fachlich unverändert und weiterhin offen:** Erstattungsquoten (100/50/0 %),
Stornofristen, Anbieterentschädigung, und wem das bei Null-Erstattung
einbehaltene Geld zusteht. Die Tests halten den Ist-Zustand fest, ohne ihn zu
bestätigen.

**Offen (dokumentiert, nicht behoben):** Erstattung gelaufen, DB-Update
gescheitert, Nutzer bricht ab → Vertrag bleibt aktiv mit erstattetem Geld; ohne
Ledger oder Abgleich-Job findet das niemand ohne erneuten Aufruf. `pending`
gezählte Erstattungen, die später fehlschlagen, werden nicht nachgereicht.

Beweisgrad: mit Doubles getestet. **Kein echter Stripe-Aufruf.**
Baseline: deno test 98 (24+38+36) · deno check 13/13 · tsc 0 · Jest 363 · db-test 98.

## Update 2026-08-05 — offene Webhook-Geldfehler geschlossen (Block 2)

Vier bestätigte Fälle, alle zuerst als roter Test reproduziert:

1./2. **`charge.dispute.funds_withdrawn` / `funds_reinstated`** nahmen das
   Update-Ergebnis ohne Fehlerprüfung entgegen und antworteten 200. Geld hatte
   den Plattform-Saldo real verlassen oder war gutgeschrieben worden, die DB
   wusste nichts davon — und Stripe wiederholte nie. Jetzt 500 bei DB-Fehler;
   „kein Vertrag gefunden" bleibt 200 (Wiederholen hilft dort nicht).
3. **Subscription-Zweige** (drei Schreibvorgänge) prüften ihre Fehler nicht.
   Der Billing-Zustand konnte dauerhaft auseinanderlaufen. Jetzt 500.
4. **`dispute_state` konnte rückwärts.** Ein verspätetes `created` nach einem
   verarbeiteten `closed` setzte den Zustand auf `open` — und `release-escrow`
   sperrt die Auszahlung, solange der offen ist. Ein gewonnener Dispute hätte
   den Anbieter dauerhaft blockiert. Jetzt Bedingung
   `dispute_state.is.null,dispute_state.eq.open` beim Setzen auf `open`;
   Endzustände überschreiben weiterhin unbedingt.

**Zusätzlich, angekündigte Umfangserweiterung — P0 des Architektur-Reviews:**
`release-escrow` blockierte nur `dispute_state === 'open'`, nicht `'lost'`. Bei
einer verlorenen Rückbuchung hat die Bank des Kunden den Betrag endgültig
eingezogen; dabei entsteht **kein** Refund-Objekt, `customer_refunded_amount`
bleibt 0, der Guard darüber griff nicht. Die Auszahlung wäre der zweite Verlust
gewesen. `'won'` und `'closed_other'` blockieren bewusst nicht.

**Falsch grün in eigener Arbeit (QA-Review):** Test 31 prüfte nur, dass
*irgendein* `.or()` den Teilstring `dispute_state` enthält — eine semantisch
verkehrte Bedingung wäre durchgerutscht. Jetzt exakter Vergleich, **und** die
Wirkung ist gegen echtes Postgres belegt (`webhook-idempotency.sql`, 99
Assertions).

**Offen, dokumentiert:** `messages.insert` und das `fraud_warning_at`-Update
prüfen ihre Fehler weiterhin nicht (beide P2, keine Geldbewegung).
`dispute_funds_withdrawn` ist ein Boolean — der Betrag steht nur im Log, für den
Kontenabgleich über zehn Jahre wäre eine Spalte nötig (P1).

Baseline: deno test 111 (34+41+36) · deno check 13/13 · tsc 0 · Jest 363 ·
db-test 99. Beweisgrad: Doubles plus echtes Postgres. Kein echter Stripe-Aufruf.

## Update 2026-08-05 — PaymentIntent-Historie: Plan (Block 3, read-only)

`docs/architecture/PAYMENT-INTENT-HISTORY-PLAN.md`. Kein Code geändert.

Kern: `contracts.stripe_payment_intent` speichert nur den letzten Intent; acht
Lesewege im Webhook filtern darauf. Ein Ereignis zu einem älteren Intent findet
keine Zeile und hinterlässt weder Spur noch Alarm. Vorgeschlagen ist eine
additive Tabelle `contract_payment_intents` mit dem Intent als Primärschlüssel
und einem partiellen Unique-Index für „genau einer ist aktuell"; die alte Spalte
bleibt als Spiegel. **Günstigster Zeitpunkt:** Es gibt keine Produktionsdaten —
Stripe ist nicht eingerichtet, es existierte nie ein PaymentIntent.

Zwei Punkte sind ausdrücklich **nicht** entschieden: was bei einer erkannten
Doppelbelastung geschehen soll, und ob `cancel-contract` beim Abgleich alle
Intents statt nur des letzten heranziehen soll. Beides verändert tatsächlich
fliessendes Geld und ist damit fachlich.

## Update 2026-08-06 — PaymentIntent-Historie umgesetzt (Migration 0660)

Der Plan aus dem letzten Block ist umgesetzt. `contract_payment_intents` hält
**alle** Intents je Vertrag, nicht nur den letzten; der Intent ist
Primärschlüssel, ein partieller Unique-Index erzwingt „genau einer ist aktuell".
`contracts.stripe_payment_intent` bleibt als Spiegel und wird von der RPC
mitgepflegt. Alle acht Webhook-Lesewege lösen jetzt über die Historie auf — ein
Ereignis zu einem **älteren** Intent findet damit seinen Vertrag statt spurlos zu
verschwinden.

**Zwei Entscheidungen, die im Plan offen waren — selbst getroffen und hier
notiert, damit sie umkehrbar bleiben:**
1. *Erkannte Doppelbelastung → sperren, nicht automatisch erstatten.* Eine
   automatische Geldbewegung ohne menschliche Prüfung ist genau das, was bei der
   Betrugs-Frühwarnung bewusst eingefroren wurde.
2. *`cancel-contract` gleicht über alle Intents ab.* Hat der Kunde auf einem
   älteren Intent bereits Geld zurückbekommen, hat er es für diesen Vertrag
   bekommen. Mitzuzählen macht die Differenz kleiner — die sichere Richtung. Die
   Quote selbst bleibt unverändert.

**P0 aus dem Architektur-Review, an der Wurzel behoben:** War ein Intent bereits
`succeeded` (bezahlt, Webhook noch ausstehend), erzeugte
`create-payment-intent` einen **zweiten** — eine Doppelbelastung des Kunden, und
der Spiegel zeigte danach auf einen unbezahlten Intent, während das Geld auf dem
alten lag. Eine spätere Stornierung hätte gegen den falschen Intent erstattet.
Jetzt 409 statt zweitem Intent.

**Falsch grün in eigener Arbeit (QA-Review):** Mein dblink-Nebenläufigkeitstest
blieb auch ohne `for update` grün — der Schutz kommt vom partiellen Unique-Index.
Assertion verschärft (beide Registrierungen erfolgreich, genau zwei Zeilen), und
Kommentar in Test **und** Migration korrigiert, statt mehr zu behaupten.

**Offen, dokumentiert:** Bei zwei real bezahlten Intents am selben Vertrag ist
`customer_refunded_amount` eine Vertragsspalte, wird aber je Charge gesetzt —
ein Ereignis auf dem alten Intent überschreibt den Stand des aktuellen (P1). Eine
erkannte Doppelbelastung ist nur im Log sichtbar, nicht als Datensatz (P1).

Baseline: deno test 134 (40+41+38+15) · deno check 13/13 · tsc 0 · Jest 363 ·
db-test 107. Beweisgrad: Doubles plus echtes Postgres inkl. echter
Nebenläufigkeit. Kein echter Stripe-Aufruf.

---

## Block: Rückbuchungsbetrag + INSERT-Sperre auf `contracts` (2026-08-07)

**Ausgangspunkt** war eine kleine, rein additive Buchhaltungslücke: `contracts.
dispute_funds_withdrawn` ist ein Boolean. Ob Geld geflossen ist, stand in der
Datenbank — wie viel und wann, nur in einer `console.error`-Zeile. Nach der
Log-Rotation ist der Abgleich zwischen Bankauszug und Buchführung aus der
Datenbank allein nicht mehr rekonstruierbar, und zwar über zehn Jahre
Aufbewahrung (HGB § 257).

**Migration 0670** ergänzt `dispute_amount_cents`, `dispute_funds_moved_at` und
`stripe_dispute_id` samt Guard-Blöcken. Der Handler schreibt sie im
Rückbuchungs-Zweig. Drei Entscheidungen, die ich selbst getroffen habe:

1. *Cent als `integer`, obwohl die übrigen Geldspalten `numeric`-Euro sind.*
   Stripe liefert ganze Cent; jede Umrechnung wäre eine Rundungsgelegenheit.
   Präzedenzfall ist `contract_payment_intents.amount_cents` (0660). Geprüft:
   kein Konsument summiert Vertragsspalten generisch, die Spalte kann nirgends
   versehentlich als Euro mitgezählt werden.
2. *Zeitstempel aus `event.created`, nicht aus der eigenen Uhr.* Maßgeblich ist,
   wann Stripe das Geld bewegt hat, nicht wann der Handler das Ereignis
   verarbeitet. Bei einer Zustellwiederholung Stunden später fiele der
   Unterschied sonst genau in die Zeile, die den Bankauszug erklären soll.
3. *Fehlt `dispute.amount`, wird `null` geschrieben statt der alte Wert
   stehengelassen.* Ein alter Betrag neben einem neuen Zeitpunkt wäre eine
   Buchung, die es nie gab — schlimmer als eine erkennbare Lücke.

**Der eigentliche Fund dieses Blocks war ein anderer (P0, Migration 0680).**
Das Security-Review fragte, ob der Guard-Trigger für die neuen Spalten
ausreicht. Er reicht nicht — und zwar für keine der geschützten Spalten:
`trg_guard_contracts_sensitive_cols` ist `before update` und feuert bei INSERT
nie. Die einzige INSERT-Schranke war die RLS-Policy aus 0050, und die prüft nur
`auth.uid() = customer_id` plus Job-Eigentümerschaft, nichts über Spaltenwerte.

Gegen einen frischen Migrations-Replay verifiziert: ein angemeldeter Kunde legt
eine Vertragszeile mit `provider_payout = 9999`, `customer_total = 0.01`,
`status = 'active'`, gesetztem `escrow_captured_at` und erfundenem
`stripe_payment_intent` an. Kein Trigger, keine Policy hält das auf. Und weil
`release-escrow` den PaymentIntent **nicht** gegen Stripe prüft, sondern
`status`, `escrow_captured_at` und `provider_payout` aus der Zeile liest, wäre
daraus ein echter Transfer vom Plattform-Saldo geworden. Geld raus, ohne dass je
Geld reinkam.

0680 entzieht `authenticated` und `anon` das INSERT-Recht. Das kostet keine
Funktionalität: es gibt keinen einzigen clientseitigen `contracts`-Insert, jeder
legitime Vertrag entsteht in `accept_offer()`, und die Funktion ist
`security definer`. Test Z2 sichert genau das ab — ein Fix, der den Annahme-Weg
mitnimmt, wäre kein Fix.

**Zusätzlich:** `export-my-data` listete die neuen Spalten nicht (Art. 15/20
DSGVO) — nachgezogen.

**Alarm-Mails abgestellt (Founder-Anliegen).** Zwei Quellen, nicht eine:
`health.yml` (2×/Tag, rot seit dem 27.07., weil RESEND/Stripe-Secrets bewusst
nicht gesetzt sind) und `loop-heartbeat.yml` (1×/Tag). In beiden ist der
Zeitplan auskommentiert, `workflow_dispatch` bleibt, mit Anleitung zum
Wiederscharfschalten in der Datei. Begründung dort notiert: ein täglicher Alarm
über einen absichtlich herbeigeführten Zustand ist kein Detektor, sondern
Rauschen — und trainiert genau die Alarmblindheit, gegen die diese Workflows
gebaut wurden. Nebeneffekt, der ehrlich dazugehört: solange der Zeitplan aus
ist, bliebe auch ein *neuer* 404 der health-Function unbemerkt.

**Offen, bewusst nicht in diesem Block:**
- *Guard-Trigger deckt weiterhin nur UPDATE ab.* 0680 schließt den Weg dorthin,
  aber ein künftiger pauschaler `grant insert on all tables` (0420 war einer)
  öffnet ihn wieder. Der Trigger auf `before insert or update` zu erweitern ist
  nicht trivial: bei INSERT ist `OLD` nicht zugewiesen, ein Vergleich
  `new.x is distinct from old.x` läuft auf einen Fehler, und `accept_offer`
  schreibt geschützte Spalten legitim. Eigener Block mit eigenem Rot-Test.
- *`release-escrow` prüft den PaymentIntent nicht gegen Stripe.* Nach 0680 fehlt
  der Einstieg, aber die Prüfung selbst wäre die eigentliche Tiefenverteidigung.
- *Keine Reihenfolgesicherung im Rückbuchungs-Zweig (P2, vorbestehend).* Ein
  außer der Reihe zugestelltes `funds_withdrawn` kann ein späteres
  `funds_reinstated` überschreiben. Betrifft `dispute_funds_withdrawn` seit je;
  die neuen Spalten erben es. Ein CAS über `dispute_funds_moved_at` wäre der
  Weg, braucht aber die Unterscheidung „veraltetes Ereignis" (200) von „Zeile
  fehlt" (500) und damit einen eigenen Test.

Baseline: deno test 141 (47+41+38+15) · deno check 13/13 · tsc 0 · Jest 363 ·
db-test 111. Sechs Mutationen geprüft (Betrag weg, Vorgangs-ID weg, eigene Uhr
statt Stripe-Uhr, `undefined` statt `null`, Guard weg, `revoke` weg) — jede
macht ihren Test rot. Beweisgrad: Test-Doubles plus echtes Postgres. Kein echter
Stripe-Aufruf, keine Produktionsänderung.

---

## Block: Guard-Trigger deckt INSERT ab (0690) — 2026-08-09

Der im vorigen Block dokumentierte oberste offene Punkt, jetzt geschlossen.

`0680` hatte Client-Rollen das INSERT-Recht auf `contracts` entzogen und damit
einen verifizierten P0 versperrt. Das war aber **nur eine Rechtevergabe**, und
`0420` enthält `grant select, insert, update, delete on all tables in schema
public to anon, authenticated` — eine weitere Migration dieser Art dreht `0680`
lautlos zurück, und dann greift nichts mehr, weil der Guard seit `0300`
`before update` ist und bei INSERT gar nicht feuert.

`0690` erweitert ihn auf `before insert or update`.

**Zwei Dinge, die der Test aufgedeckt hat und die den Entwurf geändert haben:**

1. *`security definer` machte die Unterscheidung unmöglich.* In einer
   security-definer-Funktion ist `current_user` immer deren Eigentümer — der
   Zweig „ist das ein Client oder `accept_offer`?" hätte nie gegriffen. Über die
   GUC `role` geht es nicht, denn die bleibt auch innerhalb von `accept_offer`
   auf `authenticated`. Lösung: der Trigger ist jetzt **invoker**. Unbedenklich,
   weil er keine Tabelle liest oder schreibt — die erhöhten Rechte hatte er nie
   gebraucht.
2. *Spaltenweiser INSERT-Schutz ist eine Illusion.* Der erste Entwurf verbot
   jede der 25 Spalten einzeln. `status` hat einen Spalten-Default, ist also bei
   JEDEM Insert gesetzt, und der Trigger warf immer dort — die übrigen 24
   Prüfungen wurden nie erreicht und ließen sich einzeln entfernen, ohne dass
   ein Test rot wurde. Ein Schutz, den kein Test von seinem Fehlen unterscheiden
   kann, ist keiner. Jetzt wird der ganze Vorgang abgelehnt: Client-Rollen legen
   nie Verträge an, jeder legitime entsteht in `accept_offer()`.

**Falsch grün in eigener Arbeit, zweimal in Folge gefunden:** Meine erste
Z4-Fassung setzte alle Spalten auf einmal — sie belegte nur, dass *irgendeine*
Prüfung feuert. Die zweite prüfte spaltenweise, fing aber jeden Fehler ab; da
die meisten Spalten `NOT NULL` sind, scheiterte der Minimal-Insert ohnehin, und
der Test blieb grün, obwohl die Prüfung entfernt war. Erst die dritte Fassung
verlangt den Fehler **des Triggers** und dass er `0690` nennt.

**Vier Mutationen geprüft, jede macht den Test rot:** Trigger zurück auf
`before update`; zurück auf `security definer`; INSERT-Zweig entschärft;
INSERT-Zweig entfernt. Die letzte bricht zusätzlich `accept_offer` (38 statt 113
Assertions) — das belegt, dass der Zweig nicht nur schützt, sondern die
Auftragsannahme überhaupt erst durchlässt.

Baseline: deno test 141 · deno check 13/13 · tsc 0 · Jest 363 · db-test 113.
Kein echter Stripe-Aufruf, keine Produktionsänderung.

**Offen, unverändert:** `release-escrow` prüft den PaymentIntent nicht gegen
Stripe. Nach 0680/0690 fehlt der Einstieg, aber die Prüfung selbst wäre die
eigentliche Tiefenverteidigung — nächster Block. Ebenfalls offen: keine
Reihenfolgesicherung im Rückbuchungs-Zweig (P2, vorbestehend).

---

## Block: release-escrow fragt bei Stripe nach (2026-08-09)

Der letzte offene Punkt der Geldpfad-Kette aus 0680/0690.

Bis hierher glaubte die Auszahlung ausschließlich der eigenen Zeile:
`status='active'`, `escrow_captured_at` gesetzt, `provider_payout` — fertig,
Transfer raus. Die Zeile ist seit 0680/0690 gegen direktes Anlegen gesperrt,
aber die gesamte Geldsicherheit an einer einzigen Schranke aufzuhängen ist
genau die Konstruktion, die beim ersten Fehler bricht. Jeder Weg, der je
wieder eine Vertragszeile schreiben kann — ein zurückgedrehter Rechte-Entzug,
ein Fehler in einer Edge Function, ein Datenimport — wäre sofort echter
Geldabfluss.

`release-escrow` prüft jetzt **vor dem Beanspruchen und vor jedem Transfer**:

1. Der Vertrag trägt überhaupt eine PaymentIntent-ID.
2. Stripe kennt sie.
3. `status === 'succeeded'`.
4. `amount_received >= round(customer_total * 100)` — `amount_received`, nicht
   `amount`: letzteres ist nur der angeforderte Betrag und wäre bei einer
   Teilzahlung zu optimistisch.
5. `metadata.contract_id` zeigt auf genau diesen Vertrag — sonst wäre das
   Eintragen einer echten, bezahlten fremden Zahlung der bequemste Weg, alles
   Übrige zu erfüllen.

Nach außen wird zwischen diesen Gründen bewusst **nicht** unterschieden; das
wäre ein Hinweis darauf, wie nah ein Fälschungsversuch dran war. Der Grund
steht im Log.

**Reihenfolge:** Die Prüfung liegt vor `payout_claim`. Sie ist rein lesend, und
eine gescheiterte Prüfung soll keine Auszahlungs-Operation hinterlassen, die
später jemand von Hand auflösen muss.

**Fail-closed bei Stripe-Ausfall:** Ob Stripe die ID nicht kennt oder gerade
nicht erreichbar ist, lässt sich von hier aus nicht sicher unterscheiden (die
Fehlerform hängt an der Bibliothek). Beides führt zu 409 und einem lauten Log.
Im Zweifel kein Geld raus.

**Vier bestehende Tests mussten angepasst werden**, weil sich das Verhalten
echt geändert hat: Test 1 und 27 prüfen exakte Stripe-Aufrufreihenfolgen, 23
und 24 hießen „kein Stripe-Aufruf" und heißen jetzt „kein Transfer" — es gibt
dort genau einen lesenden Aufruf. Angepasst, weil das Verhalten anders ist,
nicht um Rot grün zu machen.

**Falsch grün in eigener Arbeit (Mutationsprobe M3):** Nimmt man die
`status !== 'succeeded'`-Prüfung heraus, blieb die Suite grün — Test 43
scheitert schon am Betrag. Test 48 schließt das. Dort ist ausdrücklich
vermerkt, dass NICHT verifiziert ist, ob Stripe die Kombination „voller Betrag
eingegangen, Status nicht succeeded" real erzeugt; die Prüfung ist an der
Stelle Gürtel-und-Hosenträger.

**`deno check` hat einen echten Fehler gefangen:** Beim Einfügen der
Meldungskonstante ist das `export` von `CORS` abgetrennt worden. `tsc` prüft
`supabase/functions/` nicht — ohne den Deno-Lauf vor dem Commit wäre das rot
in CI gelandet.

Baseline: deno test 148 (47+48+38+15) · deno check 13/13 · tsc 0 · Jest 363 ·
db-test 113. Sechs Mutationen geprüft, jede macht ihren Test rot.

**Stripe-Kategorie:** Die Semantik von `amount_received`, `status` und
`metadata` ist Annahme aus der offiziellen Stripe-Dokumentation (Kategorie 1).
Die eigene Handler-Logik ist mit Doubles belegt (Kategorie 2). Gegen echtes
Stripe-Testmodus ist nichts davon geprüft (Kategorie 3, offen).

**Offen:** Keine Reihenfolgesicherung im Rückbuchungs-Zweig des Webhooks (P2,
vorbestehend).

---

## Block: H1-VOLL nachgewiesen + Reihenfolge im Rückbuchungs-Zweig (2026-08-15)

### H1-VOLL war längst behoben — die Checkliste war veraltet

Der Pentest-Befund vom 22.07. („ein eingeloggter Nutzer kann `phone`,
`steuer_id`, die PStTG-Felder fremder Anbieter lesen") stand noch als offen in
`GO-LIVE-SECURITY-CHECKLIST.md`. Gegen einen frischen Migrations-Replay geprüft:
`0560` hat ihn geschlossen — auf `provider_profiles` ist nur noch die Policy
„Providers read own profile" übrig, der Browse läuft über die
Security-Definer-View `provider_public`. `jobs.address_street` liegt inzwischen
in `job_addresses` mit eigener RLS und ist in `rls-isolation.sql` getestet.

**Ich hätte fast vier redundante Assertions eingebaut.** Erst der Lauf zeigte,
dass `rls-isolation.sql` die Basistabellen-Fälle bereits abdeckt (Zeilen 90 und
102). Zurückgenommen, und nur die eine wirklich fehlende ergänzt:

*Die View führt keine sensible Spalte.* Die beiden bestehenden Assertions
belegen, dass die **Basistabelle** dicht ist. Der zweite Weg zu denselben Daten
ist die View, und die läuft als `security definer`, umgeht die RLS also
bewusst. Ein späteres `select pp.*` beim Erweitern hätte alles auf einmal
wieder geöffnet, ohne dass eine Policy angefasst wurde — und keine bestehende
Assertion hätte das gemerkt. Geprüft wird deshalb das **Schema** der View, nicht
ein Beispielwert. Mutationsprobe: `steuer_id` und `phone` in die View
aufgenommen → `FAIL: provider_public fuehrt sensible Spalten: phone, steuer_id`.

### P2: Reihenfolge der Rückbuchungs-Ereignisse

Stripe garantiert die Zustellreihenfolge nicht. Ein wiederholt zugestelltes
`funds_withdrawn` überschrieb bisher ein späteres `funds_reinstated` — die
Buchführung behauptete danach eine Abbuchung, die längst zurückgenommen war.

Das Update trägt jetzt
`dispute_funds_moved_at.is.null,dispute_funds_moved_at.lt.<Ereigniszeit>`.
Der Vergleich funktioniert nur, weil dort seit `0670` die **Stripe-Zeit** steht
(`event.created`) und nicht die eigene — sonst wäre „älter" keine sinnvolle
Aussage. Der `is.null`-Teil ist nicht kosmetisch: `spalte < wert` ist bei leerer
Spalte NULL, die allererste Buchung ginge sonst verloren. Genau das zeigt die
DB-Mutation.

Trifft das Update keine Zeile, wird jetzt unterschieden: veraltetes Ereignis →
200 (Stripe soll aufhören zu wiederholen, ein 500 baute hier eine
Endlosschleife); Ursache unklar → 500 (Stripe soll wiederholen).

### Ein stilles 200 als Sollverhalten festgeschrieben — von mir

Test 26 hieß „funds_withdrawn ohne zugehörigen Vertrag — 200" und prüfte in
Wahrheit etwas anderes: der Vertrag *wird* aufgelöst (die RPC liefert `c1`), nur
das Update traf keine Zeile — und das ging kommentarlos als Erfolg durch. Genau
die Klasse, die in diesem Projekt seit Wochen systematisch entfernt wird, stand
als Testerwartung im Repo. Der echte „kein Vertrag"-Fall ist in Test 39
abgedeckt. Test 26 ist umgeschrieben.

### Beweisgrad, sauber getrennt

Die Edge-Tests (49–51) belegen, dass die Bedingung **dasteht** und die richtige
Zeit trägt — der Supabase-Doppelgänger wertet Filter nicht aus. Ob sie
**wirkt**, zeigt `Y17` in `webhook-idempotency.sql` gegen echtes Postgres:
Einzug (t1) → Gutschrift (t2) → erneuter Einzug (t1) trifft null Zeilen, Stand
bleibt bei der Gutschrift.

Fünf Mutationen geprüft, jede macht ihren Test rot: `or`-Bedingung weg;
`is.null`-Teil weg; Altersvergleich entschärft; veraltet → 500; unklar → 200.
Dazu die DB-Mutation (`is null` aus Y17 → erste Buchung geht verloren).

Baseline: deno test 151 (50+48+38+15) · deno check 13/13 · tsc 0 · Jest 363 ·
db-test 115. Kein echter Stripe-Aufruf, keine Produktionsänderung.

---

## Block: Anbieter-Routen bekommen ein eigenes Pfad-Segment (2026-08-15)

Die Wurzel des Befunds aus #172, nicht mehr die Abmilderung.

`auftraege`, `nachrichten` und `profil` existierten in **beiden** Routen-Gruppen.
Gruppen erzeugen kein Adress-Segment, also beanspruchten je zwei Dateien
dieselbe sichtbare Adresse. Wer abgemeldet ein Lesezeichen öffnete, bekam unter
`/auftraege` das Handwerker-Dashboard.

`app/(provider)/` → `app/betrieb/`. Die Adressen sind damit eindeutig:
`/betrieb/dashboard`, `/betrieb/auftraege`, `/betrieb/nachrichten`.

**Warum `betrieb` und nicht `anbieter`:** `app/anbieter.tsx` gibt es bereits
(die öffentliche Anbieter-Detailseite) — genau dieselbe Kollision wäre wieder
entstanden.

**Das Ergebnis ist besser als die Abmilderung.** Vorher leitete der Rollen-Riegel
`/auftraege` zur Anmeldung um. Jetzt ist `/auftraege` eindeutig die
Kundenansicht und zeigt „Meine Aufträge · Nicht angemeldet" mit Einloggen-Knopf.
Der Riegel bleibt trotzdem — er hält jetzt den Fall ab, dass ein angemeldeter
**Kunde** `/betrieb/dashboard` öffnet.

**Drei Edge Functions verschickten Push-Nachrichten mit `/(provider)/…`-Zielen**
(`notify-matching-providers`, `cancel-contract`, `pstg-annual-report`). Ohne
Mitziehen hätte jede Benachrichtigung ins Leere gezeigt.

**Dabei aufgefallen:** `pstg-annual-report` verschickte `screen:
"/(provider)/steuer"` — diese Route hat es **nie gegeben**. Der Deeplink der
PStTG-Schwellen-Benachrichtigung zeigte seit jeher ins Leere. Korrigiert auf
`/einstellungen`, wo die PStTG-/DAC7-Daten tatsächlich liegen.

### Falsch grün in eigener Arbeit — die Mutationsprobe hat es aufgedeckt

Erster Lauf der Mutation (Verzeichnis zurück in die Routen-Gruppe):
**alle 6 Routen PASS**, obwohl der gesamte Anbieterbereich nicht mehr
erreichbar war. Grund: `/betrieb/dashboard` lieferte „Unmatched Route | Page
could not be found" — lang genug, um nicht als „leere Seite" zu gelten, und
ohne Anbieter-Marker. Der Test prüfte nur, was er *nicht* sehen wollte, nie ob
die Adresse überhaupt auflöst.

Nach der Verschärfung (tote Adressen zählen als Fehler): dieselbe Mutation →
**3 FEHLER**. Ohne diesen zweiten Lauf hätte ich einen Test committet, der
einen kompletten Bereichsausfall durchwinkt.

Baseline: tsc 0 · Jest 363 · deno test 151 · deno check 13/13 · db-test 115 ·
Routen 6/6 · Gast-Login 7/7 · Entwurf PASS.

**Offen bleibt:** Kein Gerätetest. Die Anbieter-Reise ab „Angebot abgeben" ist
weiterhin ungeprüft — sie hängt am KYC-Upload und damit an einer benutzbaren
Datenbank-Umgebung.
