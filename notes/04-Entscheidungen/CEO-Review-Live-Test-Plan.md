---
typ: entscheidung
datum: 2026-07-05
status: verbindlich
quelle: /plan-ceo-review (gstack) — Auto-Entscheidungs-Modus per Founder-Anweisung
---

# CEO-Review: Kontrollierter Live-Test Köln — Ergebnis

Modus: SELECTIVE EXPANSION (Scope gehalten, genau EINE Erweiterung akzeptiert).
Geprüfter Plan: 10–15 Betriebe kontaktieren → 5–6 verifizierte Anbieter;
escrow-loser Concierge-Start (Zahlung direkt Kunde→Betrieb, 8 %-Provisionsrechnung
nachträglich); Messgrößen Provisions-Akzeptanz / echte Anfragen / abgeschlossene
Aufträge / bezahlte Provisionsrechnungen; Nachbarschaft bleibt aus.

## Kernbefund (Premise Challenge)

Der Plan testet nur die HÄLFTE des Marktplatzes. 5–6 Anbieter ohne einen einzigen
Demand-Hebel produzieren keine Transaktion — und ohne Transaktion ist die wichtigste
Messgröße (bezahlte Provisionsrechnung) unerreichbar. Anbieter, die nach 4 Wochen
null Anfragen sehen, churnen und sind als Referenz verbrannt.

**Akzeptierte Erweiterung (einzige):** Paralleler Minimal-Demand-Plan —
(a) 2 kostenlose Kanäle (eBay Kleinanzeigen / Kölner Nachbarschafts- und
Veedel-Gruppen), (b) 3 Seed-Aufträge aus Tayyips persönlichem Umfeld als
garantierte Erstaufträge. Nebeneffekt: stärkt die Akquise („wir bringen Ihnen
die ersten Anfragen mit").

**Abgelehnte Erweiterungen:** Hausverwaltungen-Pilot parallel (erst nach
Referenzen, wie im Pitch-Doc selbst vermerkt), Escrow-Vorziehen (ZAG),
Nachbarschaft-Aktivierung (Modell-D-Kriterien), bezahlte Werbung (Budget).

## Verbindliche Alternativen-Entscheidung (0C-bis)

- A) Concierge supply-only (wie eingereicht) — Vollständigkeit 7/10
- **B) A + Minimal-Demand-Plan — Vollständigkeit 9/10 ← GEWÄHLT**
- C) Demand-first ohne Anbieter — 5/10 (verbrennt Kundenvertrauen, verworfen)

Begründung: Completeness ist billig (2 h Mehraufwand), testet aber erst dadurch
die einzige Kennzahl, die zählt.

## Findings aus den 11 Review-Sektionen (nur echte)

| # | Finding | Schwere | Entscheidung |
|---|---|---|---|
| S1 | **Prod-Cutover ist unsequenziert.** Ohne Prod-Supabase gibt es keine echten Jobs; der Wechsel (Keys, Smoke-Test, Beta-Copy) muss VOR dem ersten Anbieter-Onboarding als Runbook stehen. | P1 | Runbook `docs/release/LIVE_CUTOVER_RUNBOOK.md` als nächster Build-Batch |
| S2 | **Provisionsregel unscharf.** „Wenn ein Auftrag zustande kommt" muss heißen: Provision nur auf **bezahlte** Aufträge — sonst Streit beim ersten Zahlungsausfall (Betrieb trägt Ausfallrisiko wie im Direktgeschäft). | P1 | Akquise-Paket + Gesprächsleitfaden präzisieren |
| S3 | **PII-Kanal-Risiko.** Gewerbeschein/Meisterbrief dürfen nicht in WhatsApp-Verläufen gesammelt werden — Dokumente nur über den App-KYC-Upload oder definierten sicheren Kanal (DSGVO). | P1 | In Verifizierungs-Checkliste festschreiben |
| S4 | **Kein Live-Smoke-Test definiert.** 1 kompletter Testauftrag (Anfrage→Angebot→Vertrag) gegen Prod-Supabase vor dem ersten echten Anbieter. | P1 | Teil des Runbooks (S1) |
| S5 | **Analytics ist lokal-only.** Funnel-Events liegen auf Nutzergeräten. ABER: Alle Plan-Messgrößen sind serverseitig messbar (jobs/offers/contracts-Tabellen + manuelle O-Töne). Kein Blocker. | P2 | Server-Event-Sink als Folge-Batch nach Live-Start |
| S6 | **Beta-Copy veraltet beim Cutover.** Landing sagt „Alle Zahlungen laufen im Stripe-Testmodus" — beim escrow-losen Live-Start stimmt das nicht mehr (Ehrlichkeitsregel!). | P1 | Copy-Anpassung ins Runbook (S1) |
| S7 | **SPOF Tayyip** (Verifizierung, Provisionsrechnung, Support, Concierge-Eskalation bei 48h ohne Angebot). Bei 5–6 Anbietern akzeptabel; Eskalations-Ablauf gehört ins Runbook. | OK/notiert | Bewusst akzeptiert bis >20 Aufträge/Monat |

Sektionen ohne Findings: Code-Qualität (keine Codeänderung im Plan), Performance
(Skala irrelevant), Security-Architektur (Standing Rules verifiziert, keine neuen
Endpoints), Design/UX (kein neues UI; nur S6-Copy).

## NOT in scope (mit Grund)

- Hausverwaltungen-Pilot — erst nach ersten Referenzen
- Escrow/ZAG-Vorziehen — anwaltliche Freigabe ist harte Bedingung
- Nachbarschaft-Aktivierung — Modell-D-Kriterien unverändert
- Pro-Abo, zweite Stadt, Store-Release, bezahlte Werbung — Fokus-Schnitt gilt

## Was bereits existiert und wiederverwendet wird

Akquise-Paket (`docs/vertrieb/Anbieter-Akquise-Koeln.md`), KYC-Flow inkl.
Meisterpflicht-Gate, Storno/Reklamations-Flows für No-Show-Fälle,
Rechnungslogik (`lib/`-Tests grün), RC-verifizierte Journeys, Warteliste
(RESEND-Key weiter offen — für Köln-Test nicht blockierend).

## Implementation Tasks (nächste Build-Batches, hier NICHT ausgeführt)

- [ ] **T1 (P1, CC ~20 min)** — `docs/release/LIVE_CUTOVER_RUNBOOK.md`: Prod-Supabase-Keys, Smoke-Test-Auftrag, Beta-Copy-Anpassung (S6), Rollback, Concierge-Eskalation (48h ohne Angebot).
- [ ] **T2 (P1, CC ~5 min)** — Akquise-Paket: „Provision nur bei bezahltem Auftrag" + sicherer Dokumenten-Kanal (S2, S3).
- [ ] **T3 (P1, CC ~10 min)** — Demand-Plan-Abschnitt ins Vertriebs-Doc: 2 Kanäle + 3 Seed-Aufträge (akzeptierte Erweiterung).
- [ ] **T4 (P2, extern)** — RESEND_API_KEY setzen (Tayyip).
- [ ] **T5 (P2, CC ~30 min)** — Server-Event-Sink `analytics_events` an `flushSink()` (nach Live-Start).

## Verdikt

Plan ist mit der einen Erweiterung (Demand-Hebel) und den vier P1-Fixes
**freigegeben zur Ausführung**. Outside-Voice-Zweitmeinung entfiel
(Codex nicht installiert; Claude-Subagents sind in dieser Umgebung dokumentiert
funktionslos — CLAUDE.md Learned Patterns). Kein Blindfleck-Ersatz vorhanden;
dafür Premortem-Abgleich durchgeführt (Todesursache 1 wird durch den Plan
nicht berührt, Nachbarschaft bleibt aus).
