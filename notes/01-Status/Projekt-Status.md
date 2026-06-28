---
typ: status
aktualisiert: 2026-06-27
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
- Offen/minor (Business-Entscheidung, nicht gefixt):
  - **Reklamations-SLA widersprüchlich:** 24 h (SupportChat) vs. 72 h (Reklamation) vs. 2 Werktage (Garantie) → verbindlichen Wert festlegen.
  - **AuftragAufgeben:** Step-2-Feld „Dringlichkeit" (`urgency`) wird nie verwendet — Step 3 fragt dasselbe (Doppelung).
  - Mehrere Support-Mails: hilfe@ / kontakt@ / support@ / anbieter@ — vereinheitlichen.
  - €240 (Job) vs. €246 (Escrow-Gesamt) in einzelnen Bannern; Storno-Gebührenstaffel auf €240-Basis (nur inaktive Tiers).

## ✅ Kürzlich erledigt
- [x] Merge-Konflikt + Test-Drift in `account.test.ts`/`lib/account.ts` behoben (Tests grün)
- [x] Rechtsform auf UG (haftungsbeschränkt) umgestellt, Firmendaten zentralisiert
- [x] Prototyp: Emoji-artige Icons ersetzt (Augen → "Zeigen/Verbergen", Herz → Repeat)
- [x] Fee-Minimums im Prototyp korrigiert (8 % mind. €3,00)
- [x] Stornofrist 24h → 48h vereinheitlicht

## Verweise
- Launch-Details: `docs/go-live-checklist.md`
- Fee-Logik: [[02-Specs/Fee-Modell]]
- Harte Regeln: [[02-Specs/Sicherheitsregeln]]
