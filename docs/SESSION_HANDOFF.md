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
