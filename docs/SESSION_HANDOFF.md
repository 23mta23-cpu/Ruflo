# WERKR Session Handoff

> Stand: 2026-07-03, Ende Session `claude/werkr-platform-context-b088z6` (HEAD `905657a`).
> Zweck: Neue Session versteht Stand, Entscheidungen und Richtung OHNE Chat-Historie
> und OHNE erledigte Arbeit zu wiederholen. Zuerst CLAUDE.md lesen, dann diese Datei.

## 1. Executive State
- **Was:** Deutscher Trust-first-Vermittlungsmarktplatz für Handwerk (Expo SDK 56 /
  Supabase / Stripe Connect). Angebots-basierte Transaktion: Kunde stellt Anfrage →
  Anbieter macht verbindliches Angebot → digitaler Vertrag → (später) Escrow.
- **Positionierung (verbindlich):** „Handwerk für Privat & Gewerbe — fair geregelt."
  B2C UND B2B, von der Reparatur bis zum großen Projekt. KEINE Kleinauftrags-Nische.
- **Phase:** Fokussierter MVP, Web-Build live (https://23mta23-cpu.github.io/Ruflo/),
  Beta/Demo-Modus, Stripe Testmodus, kein Prod-Backend-Traffic.
- **Reifegrad:** Kern-Journey E2E funktionsfähig und designt (7 Playwright-Checkpoints
  grün), tsc 0 Fehler, Jest 323/323, keine toten Links (47 Routen).
- **NICHT validiert:** echte Nachfrage, echte Anbieter, Provisions-Zahlungsbereitschaft,
  Dispute-Ablauf, jede Umsatz-Hypothese. Es gab noch nie eine echte Transaktion.

## 2. Binding Product Decisions
Quellen: `notes/04-Entscheidungen/` (v. a. `Fokus-Schnitt-MVP.md`,
`Design-Sprache-Skills.md`, `Dark-Hero-und-Deploy-Konsolidierung.md`).

**Verbindlich entschieden:**
- **KEEP & NARROW, kein Rewrite.** Repo bleibt; nur sichtbare Schicht wurde fokussiert.
- **Fokus-Schnitt:** ein aktiver Track (Handwerker). Eingefroren via
  `constants/features.ts`: `NACHBARSCHAFT=false`, `PRO_ABO=false`.
  Wiederauftau-Kriterien stehen IM Flag-File: Nachbarschaft erst ab ≥50 echten
  bezahlten Handwerker-Aufträgen UND eingeleiteter DRV-Statusfeststellung;
  Pro-Abo erst ab ≥20 aktiven Anbietern mit regelmäßigen Aufträgen.
- **Festpreis-/Sofortpreis-Modell ist VERWORFEN.** Kein „Festpreis"/„Sofortpreis"
  als Versprechen, CTA oder Positionierung — nirgends. Erlaubt: neutrale
  Angebotslogik („Anfrage stellen", „verbindliches Angebot", „vereinbarter Preis").
  `archive/instant-preise.tsx` = konserviertes verworfenes Konzept, nicht reaktivieren.
- **Ehrlichkeit:** Bot heißt „Automatischer Assistent" (Keyword-Matcher, kein LLM);
  keine erfundenen Zahlen (à la „400+ Handwerker"), keine Superlative
  („vertrauenswürdigste"), keine unhaltbaren Zeitversprechen („Angebote in 30 Min").
  Demo-Inhalte sind immer als Vorschau/Beispiel gekennzeichnet.
- **Design-Sprache:** Bone-Palette + dunkelgrüne HERO-Momente (nur Landing-Hero +
  Home-Kopf; `HERO` in `constants/colors.ts`). Skills verbindlich vor UI-Arbeit:
  minimalist-ui + ui-ux-pro-max (v2.6.2) + Referenzen `.claude/design-references/`
  (airbnb, warm-editorial); Polish/Review-Skills installiert. Regeln + bewusste
  Abweichungen: `Design-Sprache-Skills.md`. Ionicons only, fontWeight ≤'700',
  shadowColor immer C.ink.
- **Deploy:** GitHub Pages Quelle = GitHub Actions (von Tayyip manuell umgestellt,
  verifiziert). Einzige Pipeline: `.github/workflows/static.yml` (main).
- **Escrow-Live-Zahlungen bleiben hinter `zagGate`** (ZAG_LEGAL_SIGNOFF-Secret) bis
  anwaltliche Freigabe.

**Hypothesen (nicht festgezurrt):** Fee-Modell 8% Anbieter + 2,5% Kunde; Köln-Start
mit bundesweiter Warteliste; escrow-loser Validierungsstart (empfohlen, nicht formal
entschieden); Hausverwaltungen als Discovery-Experiment.

**Noch zu validieren:** alles unter „NICHT validiert" in §1. Produktentscheidungen
dazu erst nach echten Signalen (siehe §8).

## 3. Current User Journey
Landing (`app/landing.tsx`, dunkle Hero) → Onboarding/Rollenwahl (`app/onboarding.tsx`)
→ Home (`app/(tabs)/index.tsx`, auftragszentrierter Marken-Kopf „Was brauchen Sie?")
→ Auftrag-Wizard S1–S4 (`app/auftrag-aufgeben.tsx`: Kategorie → Beschreibung/PLZ →
Zeitrahmen → Budget/Consent/Zusammenfassung) → Erfolgs-Screen (Job-Referenz bzw.
Warteliste bei Nicht-Köln-PLZ). Parallel: Suche (`app/suche.tsx`) → Anbieter-Profil
(`app/anbieter.tsx`, Rating-Lockup + Leistungen + ein CTA „Unverbindliche Anfrage
stellen" → Wizard).

- **Funktioniert:** kompletter Durchklick inkl. Validierung, Köln-Gating→Warteliste,
  Content-Filter, Meisterpflicht-Hinweise, leere Zustände mit Beispiel-Inhalten
  (Aufträge/Nachrichten-Tabs), 8s-Timeouts gegen Endlos-Spinner (Home + Suche).
- **Demo-Daten:** Suche + Home zeigen gekennzeichnete Demo-Anbieter, solange
  Supabase 0 verifizierte Anbieter liefert; Tap → ehrlicher Vorschau-Alert.
- **Fehlt real:** Prod-Supabase/Stripe, echte Anbieter, E-Mail-Versand
  (waitlist-doi gebaut, `RESEND_API_KEY` fehlt — Tayyip).
- **Login-Mechanik:** Wizard ist ohne Login ausfüllbar; Submit erfordert Login
  (Alert). Login-Hinweis auf Schritt 1 warnt vorher (Eingaben überleben den
  Login-Redirect NICHT — bekanntes P2). `/login` hat Registrierungs-Link;
  „Einloggen" auf Landing + Onboarding führt direkt zu `/login`.

## 4. Work Completed in This Session
- `979ad0a` WERK-Betriebssystem (11 Docs) in `.claude/werk-os/` verankert.
- `9d3015b` Doppel-Pipeline `deploy-web.yml` + tote Root-index.html entfernt.
- `4c43a56` Dunkle Landing-Hero (Prototyp-Vorbild) + UWG-Fix („400+" raus).
- `a6e5a5d` Pages-Race-Diagnose + build_type-PUT im Workflow (reichte nicht — s. u.).
- `892e68a` **Fokus-Schnitt:** Feature-Flags, ein Track, Ehrlichkeits-Fixes,
  instant-preise → `archive/`.
- `47cc609` **Home-Redesign:** auftragszentrierter Marken-Kopf, Kategorie-Raster,
  Trust-Strip, Spinner-Timeout.
- `d39e44f`/`474fdc5`/`b3de599` Design-Skill-Stack: Leitplanken-Doku, ui-ux-pro-max
  v2.6.2, Open-Design-Skills + Referenzen installiert.
- `674f7bb` **Festpreis-Wording komplett entfernt** (13 Stellen inkl. kosten.html).
- `5da3719` **Journey-Designpass:** Anbieter-Rating-Lockup + Leistungen-Sektion,
  Wizard-Kacheln/Farben vereinheitlicht, Wizard-Nachbarschafts-Leck geschlossen,
  „30 Min."-Versprechen raus.
- `4fb88ae` **Positionierung:** „Kleinaufträge" raus → „Privat & Gewerbe" (Tayyips
  ausdrückliche Korrektur).
- `880d9d3` headroom-learn-Patterns versioniert in CLAUDE.md.
- `905657a` **Product Acceptance Check:** E2E-Test + 6 P1-Fixes (Login-Falle-Hinweis,
  Einloggen→/login, Ein-CTA im Profil, Superlativ raus, Onboarding-Text, Wizard-
  Bottom-Safe-Area). Live verifiziert.
- Außerdem: GitHub Pages Quelle von Tayyip manuell auf „GitHub Actions" gestellt
  (dauerhafter Fix des Website-Flackerns; Workflow-Token durfte das nicht).

## 5. Verified Current State (Stand Session-Ende)
- TypeScript: `npx tsc --noEmit` = 0 Fehler.
- Jest: 323/323 grün (6 Suiten, reine lib-Logik — UI-Redesigns brechen keine Tests).
- Playwright-E2E (lokaler Export, 390×844): 7/7 Checkpoints grün
  (Landing→Onboarding→Home→Wizard S1–S4→Suche-Demo). Script:
  Scratchpad `e2e.cjs` (Container-flüchtig; Muster: SPA-Server + getByPlaceholder).
- Routen-Audit: 0 tote `router.push`-Ziele über 47 Routen.
- Live: Root 200; Quelle=Actions bewiesen (Rohdatei `app/landing.tsx` → 404);
  Bundle-Marker verifiziert: „Privat & Gewerbe" ✓, „Zuerst kostenlos anmelden" ✓,
  „Unverbindliche Anfrage stellen" ✓, „Festpreis" = 0, „vertrauensw" = 0.
- Deploy-Mechanik: push auf main → static.yml → Artefakt → deterministisch live
  (~5–7 Min). Verifikation per Bundle-Hash/Marker, NICHT per Actions-API.

## 6. Known Deferred P2 Items (am Code verifiziert, alle noch offen)
1. **„EMPFOHLEN"-Badge** auf Kundenkarte im Onboarding — deplatziert (Rollen empfiehlt
   man nicht). P2: rein kosmetisch. Trigger: nächster Onboarding-Touch.
2. **providerId wird im Wizard ignoriert** (`auftrag-aufgeben` liest keine Params) —
   „Anfrage" vom Profil erzeugt allgemeinen Job statt gezielter Anbieter-Anfrage.
   P2: bräuchte Backend-Feld (Regel: keine Backend-Änderung ohne P0/P1). Trigger:
   erster echter Anbieter online + Nutzer erwarten gezielte Anfrage.
3. **Wizard-State überlebt Login nicht** (login.tsx ersetzt Stack). P2: Architektur-
   Thema; Hinweis auf S1 entschärft. Trigger: echte Abbruch-Daten im Funnel.
4. **„Alle X Bewertungen anzeigen"** = Platzhalter-Alert. P2: erst relevant, wenn ein
   Anbieter >5 echte Reviews hat.
5. **Verwaiste `ctaMsg`/`ctaMsgText`-Styles** in anbieter.tsx. P2: toter Code,
   harmlos. Trigger: nächster Edit an der Datei.

## 7. Real Go-to-Market Blocker
- **Technischer MVP-Status: bereit** für erste begleitete Tests (Journey vollständig,
  ehrlich, mobil sauber).
- **Operativer Marketplace-Status: leer.** 0 verifizierte Anbieter → eine echte
  Anfrage bekommt keine echte Antwort. Demo-Modus kommuniziert das ehrlich.
- **Marktvalidierung: 0.** Keine echte Transaktion, kein Anbieter-Commitment,
  keine Zahlungsbereitschafts-Daten.
- Operative Blocker (nur Tayyip): RESEND_API_KEY; Anbieter-Akquise; formale
  Sequenzierungs-/Concierge-Entscheidung (Strategie-Empfehlung liegt vor, s. Chat-
  unabhängig: escrow-loser Concierge-Start als Empfehlung, nicht entschieden);
  ZAG-Anwalt vor Escrow-Live; UG-Gründung.

## 8. Next Recommended Direction
- **Der eine nächste Schritt (außerhalb des Codes):** Tayyip kontaktiert 10–15
  Kölner Handwerksbetriebe und gewinnt 5–6 als verifizierte Anbieter
  (Gesprächsleitfaden kann aus `docs/vertrieb/Hausverwaltungen-Pitch.md` +
  Fee-Modell abgeleitet werden).
- **Danach messen:** Anbieter-Zusagen & Provisions-Akzeptanz; Zahl echter Anfragen
  über Gratis-Kanäle; abgeschlossene Aufträge; ob Provisionsrechnungen bezahlt werden.
- **Erst nach echten Signalen entscheiden:** Fee-Höhe, Escrow-Live (ZAG), gezielte
  Anbieter-Anfrage (P2 Nr. 2), Nachbarschaft-Reaktivierung, jede neue Feature-Idee,
  native Store-Releases, zweite Stadt.

## 9. Do Not Repeat
- KEINE erneute Repository-Gesamtanalyse ohne konkreten Anlass.
- KEIN erneuter Rewrite-vs-Refactor-Vergleich (entschieden: KEEP & NARROW).
- KEINE erneute Markt-/Wettbewerbs-/Strategieanalyse (liegt vor; NARROW + „Privat &
  Gewerbe" gelten).
- KEIN Redesign akzeptierter Screens (Landing, Home, Suche, Anbieter, Wizard,
  Onboarding) ohne Nutzersignal oder echten Defekt.
- KEIN Wiederöffnen des Festpreis-/Sofortpreis-Modells.
- KEIN Reaktivieren eingefrorener Features ohne die Trigger aus `constants/features.ts`.
- KEINE neue Feature-Bloat-Runde; MVP-Umfang ist eingefroren bis echte Signale da sind.
- KEINE `mcp__github__actions_list`-Großabfragen (350k+-Zeichen-Falle) — Deploy-Status
  über Bundle-Hash/Marker prüfen (Regel in CLAUDE.md).
- KEINE Mehrfach-Reads großer Dateien — einmal lesen, Edits planen, ein Durchgang.
- KEINE „production ready"-Behauptung, solange reale Anbieter-/Kundeninteraktion
  nicht validiert ist.
- Strategie NIE aus Code-Menge ableiten — verworfene Konzepte liegen in `archive/`
  und im Prototyp; maßgeblich ist `notes/04-Entscheidungen/`.

## 10. New Session Startup Protocol
1. `CLAUDE.md` lesen (enthält versionierte Headroom-Effizienzregeln — anwenden).
2. `docs/SESSION_HANDOFF.md` (diese Datei) lesen.
3. `git status` + `git log --oneline -5` prüfen (erwartet: HEAD ≥ `905657a`, clean).
4. Nur bei Widerspruch zwischen Handoff und Code: gezielt betroffene Dateien lesen.
5. Keine erneute Gesamtanalyse.
6. Den konkreten Auftrag des Founders ausführen; Entscheidungen in
   `notes/04-Entscheidungen/` dokumentieren; nach jedem logischen Block committen
   und auf `claude/werkr-platform-context-b088z6` UND `main` pushen (freigegeben);
   Live-Verifikation per Bundle-Marker.
