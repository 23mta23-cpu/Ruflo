---
typ: status
aktualisiert: 2026-07-01
---

# 📊 Projekt-Status

> Eine Seite, die immer den aktuellen Stand zeigt. Bei jeder Session aktualisieren.

## Aktueller Stand (Code)
- React-Native-App (Expo SDK 56) + Web-Prototyp (`werkr-prototype.html`).
- TypeScript: 0 Fehler. Edge Functions auditiert und sauber.
- Prototyp & App fachlich abgeglichen (Fees, Stornofristen, Tracks).

## 🚧 Go-Live-Blocker
Vollständige, priorisierte Liste → **[[Go-Live-Blocker]]** (P0 Recht → P4 Store).

Verdikt 2026-06-27: **nicht launchbereit.** Kritischster Punkt: UG-Gründung +
ZAG/Escrow-Absicherung (BaFin) — beides blockiert alles andere.

## 🟡 Offen / als Nächstes
- [ ] (hier eintragen)

## 🧪 Test-/Verifikationsstand (2026-06-27)
- ✅ TypeScript: 0 Fehler. **Unit-Tests: 308/308 grün (5 Suites).**
- ⚠️ Beim Prüfen gefunden + behoben: **eingecheckter Merge-Konflikt** in `__tests__/account.test.ts`
  (`<<<<<<< HEAD`) + fehlende API (`isPStTGThresholdApproaching`, PStTG-Schwellen-Konstanten) in
  `lib/account.ts` nachimplementiert. Jest scannte zudem alte `.claude/worktrees/`-Kopien → in
  `jest.config.js` ausgeschlossen.
- ❗ **Wichtig:** Unit-Tests decken nur *reine Logik* (Fees, Compliance, Account, Rechnung). Die
  **End-to-End-Workflows** (Auth → Auftrag → Angebot → Escrow-Zahlung → Freigabe → Auszahlung)
  liefen **noch nie gegen ein Live-Backend** (kein Prod-Supabase/Stripe). → siehe [[Go-Live-Blocker]] P3/P4.

## 🔍 Prototyp-Audit (2026-06-28, Screen-für-Screen)
Strukturell sauber: Navigation (App+Prototyp), Icons, Handler, Design-Tokens, Tests.
Gefunden & behoben:
- **Fee-Bug:** €247,99 (8 Stellen) → €246,00; €1,99 Nachbarschafts-Schutz war fälschlich
  auf Handwerker-Aufträge addiert. AuftragDetail-Breakdown €124,99 → €123,00.
- **Rechtsform:** 3 Footer „WERKR GmbH" → UG; abgekürztes „(haftungsbeschr.)" → voll.
- **Emoji:** Support-Chat 📋🔒 + Map-Keys 📧💳✅ entfernt.
- **2. Pass (komplett, alle ~50 Screens):** ProviderAuftraege „€98,40" → **€110,40** (Thermostat
  €120 − 8 %; per OnboardingStripe-Breakdown eindeutig bestätigt).
- **3. Pass (2026-06-28): 4 offene Punkte autonom entschieden & umgesetzt** → [[../04-Entscheidungen/Audit-Folgeentscheidungen]]
  - ✅ Reklamations-SLA vereinheitlicht → „2 Werktagen" (Prototyp + App)
  - ✅ AuftragAufgeben: redundantes `urgency`-Feld entfernt
  - ✅ Support-Mail vereinheitlicht → support@werkr.de (hilfe@ ersetzt)
  - ✅ Escrow-Banner €240 → €246 (Auftraege, Reklamation, Benachrichtigungen)
  - Verifiziert: tsc 0, Jest 308/308, keine Dangling-Refs.
- Offen/minor (verbleibend, nicht kritisch): Storno-Gebührenstaffel auf €240-Basis (nur inaktive Tiers);
  diverse zweckgebundene @werkr.de-Adressen (datenschutz@/widerruf@/anbieter@/kontakt@/steuer@/streit@).

## ✅ Kürzlich erledigt
- [x] Merge-Konflikt + Test-Drift in `account.test.ts`/`lib/account.ts` behoben (Tests grün)
- [x] Rechtsform auf UG (haftungsbeschränkt) umgestellt, Firmendaten zentralisiert
- [x] Prototyp: Emoji-artige Icons ersetzt (Augen → "Zeigen/Verbergen", Herz → Repeat)
- [x] Fee-Minimums im Prototyp korrigiert (8 % mind. €3,00)
- [x] Stornofrist 24h → 48h vereinheitlicht

## 🔧 Code-Finalisierungs-Sprint (2026-07-01, laufend) → [[../04-Entscheidungen/Code-Finalisierung-Sprint]]
Autonom gestartet: "Code final" (alles, was ich ohne Live-Accounts/Anwalt/Gründung
selbst verifizieren kann) getrennt von "Ops offen" (Go-Live-Blocker, bleibt bei Tayyip).

**Session-Herkunft:** Ein paralleler Cowork-Audit (Google Drive, Stand 28.06.) fand 6
Befunde, davon 2 production-kritisch. Alle gegen echten Code geprüft und übernommen:
- ✅ `stripe-webhook`: `constructEvent` → `constructEventAsync` (Deno-Runtime-Fix, sonst
  wäre JEDER Webhook in Production gescheitert)
- ✅ `release-escrow` + `create-payment-intent`: Idempotency-Keys (Doppel-Auszahlung/
  Doppel-Charge-Schutz)
- ✅ `app.config.js`: war stille Teilkopie von `app.json`, verschluckte Stripe-Plugin +
  Android-Permissions + iOS-PrivacyManifests im Build → erweitert jetzt nur noch `app.json`
- ✅ `feeEngine.ts`: Eingabevalidierung (negative/NaN/Infinity-Preise abgelehnt)

**Danach eigenständig (Sicherheits-Härtung, nicht von Cowork):**
- ✅ Rate Limiting (Postgres-backed, alle 7 nutzerseitigen Edge Functions) + Access-Control-Matrix
  (`docs/security/access-control-matrix.md`) + strikte Input-Validierung + Standing Security
  Rules in `AGENTS.md`

**Runde 1 (Branding/Konsistenz):**
- ✅ `garantie.tsx`: „Ruflo UG" → `COMPANY_LEGAL_INLINE` (dynamisch aus `constants/legal.ts`)
- ✅ `package.json` name: `ruflo` → `werkr`
- ✅ 3 Stellen mit literalem „★"-Zeichen → echtes `Ionicons name="star"` (App-weiter Standard)
- **Bewusst NICHT geändert:** `app.json` `privacyPolicyUrl` (zeigt auf `/Ruflo/`) + GitHub-Repo-Name
  „Ruflo" — der reale Deploy (`deploy-web.yml`) läuft unter `/Ruflo/`; Repo umbenennen ist eine
  Infra-Entscheidung mit Nebenwirkungen, keine "kleine" Fix, bleibt bei Tayyip.

**Runde 2 (Testlücken, von Cowork als bewusste Lücke markiert):**
- ✅ DAC7/PStTG-Schwelle (30 Tx / €2.000) war nur als isolierte, ungetestete Kopie in
  `compliance.test.ts` vorhanden, getrennt von der echten Logik in `release-escrow`/
  `pstg-annual-report`. Extrahiert nach `lib/pstTgThresholds.ts`, Test zeigt jetzt auf echten Code.
- ✅ Storno-Refund-Staffel (>48h/24-48h/<24h) war doppelt von Hand gepflegt
  (`app/stornierung.tsx` Client-Preview + `cancel-contract` Server) und komplett ungetestet.
  Extrahiert nach `lib/cancellationRefund.ts`, 4 neue Tests.
- Beide Edge-Function-Duplikate bleiben (Deno kann nicht aus `lib/` importieren), jetzt mit
  "keep in sync"-Kommentar markiert.

**Runde 3 (Design-Audit + Prototyp-Sync):**
- ✅ `C.muted` (Placeholder-Grau) hatte nur 2,3:1 WCAG-Kontrast statt Pflicht-4,5:1 — und wurde
  170× für echten Lesetext (nicht nur Platzhalter) verwendet, u. a. Rechtstexte. Zentral gefixt
  (`constants/colors.ts`) → wirkt automatisch überall.
- ✅ Prototyp war bei `C.muted` vom App-Fix abgedriftet (eigenes lokales Farbobjekt) — synchronisiert.
- ✅ Pro-Abo-Trial-Widerspruch (14 vs. 30 Tage) gefunden und entschieden: 30 Tage (Begründung in
  der Entscheidungs-Notiz).
- ✅ ADR-0005 aktualisiert (dokumentierte noch den alten, kaputten `constructEvent`-Aufruf).

**Runde 4 (Dead-Code-Audit → echter Production-Bug gefunden):**
- 🔴 **Echter Bug behoben:** Migration 024 (Provider "Ablehnen"-Button) erlaubte per RLS nur
  `status='rejected'`, aber die DB-Check-Constraint erlaubt nur `pending/accepted/declined/expired`
  — `'rejected'` ist gar kein gültiger Wert! Der Button wäre an der Datenbank gescheitert (derselbe
  Bug-Typ, den Migration 024 eigentlich fixen sollte). Migration 026 + App-Code korrigiert auf
  `'declined'`.
- ✅ 20 echte tote Code-Pfade entfernt (`lib/auth.ts`, `contracts.ts`, `jobs.ts`, `offers.ts`,
  `notifications.ts`) — alle repo-weit verifiziert (inkl. `contexts/`, das eine erste Suche
  übersehen hatte). Darunter 6 `notify*`-Helfer, die auf lokalen Gerätebenachrichtigungen statt
  echtem Push basierten (durch das korrekte `sendPushToUser`-Muster längst ersetzt).
- Backlog notiert (nicht umgesetzt): 3 Screens duplizieren Status-Label-Logik inline statt
  gemeinsamer Helper — Konsolidierungschance, aber eigenes Refactoring-Risiko.

**Runde 5 — wichtigste Runde bisher: Edge Functions + Migrationen erstmals wirklich ausgeführt,
nicht nur gelesen.** Deno lokal installiert (`deno check` gegen alle 8 Edge Functions — die
waren nie Teil des `tsc`-Checks, `tsconfig.json` schließt `supabase/functions/**` explizit aus).
Docker war in dieser Sandbox nicht startbar (Rechte-Restriktion) → stattdessen lokales
PostgreSQL 16 aufgesetzt, mit einem minimalen `auth`-Schema-Stub alle 30 Migrationen von einer
frischen Datenbank an in Reihenfolge laufen lassen. **3 echte, bisher unentdeckte Bugs gefunden:**
- 🔴 `list-payment-methods`: 2 echte TS-Fehler (implicit any) — nie geprüft, weil `tsconfig.json`
  Edge Functions ausschließt.
- 🔴 **Migration 004 konnte auf keiner frischen Datenbank je vollständig durchlaufen** — Index-Kollision
  mit Migration 002b, danach bricht das Skript ab (kein Transaktions-Wrapper). Damit fehlten
  potenziell auch `contracts.updated_at`, beide Trigger und beide CHECK-Constraints überall dort,
  wo die Migrationskette je in Reihenfolge lief. Zusätzlich referenzierten beide Trigger eine
  nirgends definierte Funktion `set_updated_at()`.
- 🔴 **Migration 011 konnte ebenfalls nie durchlaufen** — versuchte den Rückgabetyp von
  `accept_offer()` per `CREATE OR REPLACE FUNCTION` zu ändern, was Postgres verbietet.
- Fix: Migration 004 + 011 direkt idempotent gemacht (da nachweislich noch nie erfolgreich
  durchgelaufen — kein "bereits live"-Risiko beim Editieren) + Migrationen 027/028 als
  Nachhol-Fix für den Fall, dass die echte Live-DB die alte, kaputte Version schon teilweise
  über den Dashboard-SQL-Editor bekommen hat (unbekannter Zustand, von hier nicht prüfbar).
- **Endergebnis verifiziert:** Alle 30 Migrationen laufen jetzt fehlerfrei auf einer frischen
  Postgres-16-Instanz durch (11 Tabellen, beide Constraints vorhanden, `accept_offer` mit
  korrektem Rückgabetyp). Alle 8 Edge Functions `deno check`-sauber.

**Warum das die bisher wichtigste Runde ist:** Das widerlegt direkt die Selbsteinschätzung von
vorher ("nie gegen echte Infrastruktur getestet") an der Stelle, wo es am meisten zählt — der
Datenbank-Schicht. Zwei der drei Bugs hätten jeden Versuch, die App gegen ein neues/frisches
Supabase-Projekt aufzusetzen, sofort zum Scheitern gebracht.

**Verifiziert nach jeder Runde:** `npx tsc --noEmit` 0 Fehler · `npx jest` 323/323 grün (von 308).

**Bewusste Grenze:** Ich arbeite das in begrenzten, selbst geprüften Runden ab (Fund → Fix →
tsc/jest → Commit), nicht als unbeaufsichtigte Dauerschleife mit automatischen Pushes ohne
Zwischenstand — bei einer Zahlungs-App ist das der verantwortliche Kompromiss zwischen
"eigenständig vorankommen" und "nichts Unkontrolliertes passiert".

## Verweise
- Launch-Details: `docs/go-live-checklist.md`
- Fee-Logik: [[02-Specs/Fee-Modell]]
- Harte Regeln: [[02-Specs/Sicherheitsregeln]]
- Security/Access-Control: `docs/security/access-control-matrix.md`
