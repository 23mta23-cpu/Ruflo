# Entscheidung: Zugeschnittenes Werkant-Agenten-Team

**Datum:** 2026-07-16
**Rolle:** CTO / Solution-Architekt
**Auslöser:** Founder-Anweisung — zugeschnittene Spezial-Agenten erstellen
(director solution/software architekt, sales, marketing, CCO, CTO, senior
test expert, UI/UX, CFO) + principal senior projektmanager.

## Entscheidung
10 statische Agenten-Definitionen unter `.claude/agents/werkant--*.md` angelegt
(Präfix `werkant--`, klar getrennt von den importierten `agency--` und den
Swarm-`ruflo-*` Agenten). Bewusst **statische Markdown-Definitionen** statt
laufender Agent-Spawns:

- **Token-Disziplin (Founder-Vorgabe):** Statische Files kosten ~nichts, sind
  reset-fest und wiederverwendbar. Live-Spawns kosten pro Aufruf und liefern
  laut CLAUDE.md-Learning bei Audit-Tasks oft No-Ops.
- **Zuschnitt statt Generik:** Jeder Agent kennt den echten Werkant-Kontext
  (Expo/Supabase/Stripe, Design-System C/T, Migrations-Schema, Go-Live-Gate,
  DSGVO/PStTG/BFSG), nicht nur eine generische Rollenbeschreibung.

## Team
CTO · Director Software Architect · Director Solution Architect ·
Senior Test Expert · Director UI/UX · Director Sales · Director Marketing ·
CCO (Commercial + Compliance) · CFO · Principal Senior Project Manager.

Der Principal PM orchestriert das Team und nutzt die Skill
`ruflo-intelligence--intelligence-transfer` für reset-feste, projektübergreifende
Muster (IPFS/Pinata, benötigt `PINATA_API_JWT`).

## Bestehende Agenten (nicht dupliziert, referenziert)
`agency--marketing-*`, `agency--sales-*`, `agency--security-*`,
`agency--support-finance-tracker`, `agency--support-legal-compliance-checker`
— die neuen Director/C-Level-Agenten verweisen für Tiefe darauf.
