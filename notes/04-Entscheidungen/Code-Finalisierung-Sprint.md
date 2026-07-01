---
typ: entscheidung
datum: 2026-07-01
status: angenommen
---

# Entscheidung: Code-Finalisierungs-Sprint (autonom gestartet, ohne Rückfrage)

Tayyip hat mich als CTO/Geschäftspartner beauftragt: "sorge dafür das es final wird
mit loops... wähl selbst eine sinnvolle option". Das ist die Entscheidung + der Plan.

## Was "final" hier bedeutet (bewusst abgegrenzt)

**Final = code-seitig launch-bereit**, NICHT operativ live. Die operativen Blocker aus
`notes/01-Status/Go-Live-Blocker.md` (UG gründen, ZAG/Anwalt, Stripe/Supabase Live,
Apple/Google Accounts) kann ich als KI nicht lösen — die bleiben explizit bei Tayyip.

Mein Scope ist alles, was ich ohne Zugriff auf Live-Konten/Verträge selbst verifizieren
und fertigstellen kann:
1. TypeScript 0 Fehler + Jest grün (laufende Grundvoraussetzung, jede Iteration geprüft)
2. Design-Token-Konsistenz (kein `C.green`, `fontWeight` max 700, `shadowColor` nie `'#000'`)
3. Branding-Konsistenz Ruflo → WERKR im Code (npm-name, URLs, Bundle-IDs) — AUSSER
   `constants/legal.ts`-Firmendaten (die brauchen echte Gründungsdaten von Tayyip)
4. Kein toter/redundanter Code (Cowork fand z. B. dead client-side cancelContract())
5. Testabdeckung der kritischen Geldflüsse (feeEngine, Escrow, Stornierung/Refund-Staffel,
   PStTG-Schwellenwert-Logik) — laut Cowork-Audit bewusste Lücke
6. Edge-Function-Konsistenz (Security-Härtung von letzter Session auf alle Functions
   angewendet, keine vergessen)
7. ADRs/Docs aktuell halten, wenn sich Architektur ändert

**Explizit NICHT in diesem Sprint:** neue Features, Screen-Politur, natives Build/Store-
Submission (braucht echte EAS-ID), Rechtstexte final (braucht Anwalt).

## Wie ich arbeite (Loop-Prinzip)

Statt alles in einer Antwort abzuarbeiten: iterativ, ein abgeschlossener Verifikationsschritt
pro Runde (Audit-Fund → Fix → tsc/jest → Commit → nächster Fund), damit jederzeit ein
sauberer, getesteter Zwischenstand existiert. Jede Session/jeder Fix wird hier oder in
`notes/01-Status/Projekt-Status.md` kurz vermerkt, damit der Fortschritt nachvollziehbar bleibt,
auch über mehrere Chat-Sessions hinweg.

## Nächste konkrete Schritte (Reihenfolge, von mir priorisiert)

1. Branding-Grep (Ruflo→WERKR-Reste) + Dead-Code-Grep — schnelle, risikoarme Fixes zuerst
2. Design-Token-Audit erneut laufen lassen (letzter Stand war 2026-06-24 clean, Re-Check nach
   den Security-Änderungen)
3. Testlücken aus Cowork-Audit schließen (Dispute/Refund-Staffel, PStTG-Schwelle)
4. Projekt-Status.md aktualisieren mit ehrlichem "Code final" vs. "Ops offen"-Stand
