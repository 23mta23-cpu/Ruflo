---
name: ecc
description: Everything Claude Code (ECC) on demand - index of the ECC skills/agents that fit Werkant (Expo/RN, TypeScript, Postgres/RLS, security, e2e, a11y). Load when a review, security check, RN pattern or test question comes up.
---

# ECC auf Abruf

ECC liegt vollständig unter `~/.claude/ecc` (293 Skills, 68 Agenten, 94
Befehle, Stand `ef648e0`). Fehlt der Ordner (neuer Container):
`bash scripts/setup-ecc.sh`.

Bewusst NICHT nativ installiert: 455 Einträge würden in jede Anfrage
geladen (~16.000 Token), genau die Last, die am 01.10. entfernt wurde.
Stattdessen hier die passenden Teile; die Datei lesen und anwenden.

| Anlass | Datei unter `~/.claude/ecc/` |
|---|---|
| Fehler, die still verschluckt werden (`catch {}`, Ersatzwerte) | `agents/silent-failure-hunter.md` |
| Code-Review TypeScript / React | `agents/typescript-reviewer.md`, `agents/react-reviewer.md` |
| React Native / Expo | `skills/react-native-patterns/SKILL.md`, `skills/react-performance/SKILL.md` |
| Migrationen, RLS, Indizes | `skills/postgres-patterns/SKILL.md`, `agents/database-reviewer.md` |
| Security (OWASP, Secrets, Auth) | `skills/security-review/SKILL.md`, `agents/security-reviewer.md` |
| Browser-Tests | `skills/e2e-testing/SKILL.md`, `agents/e2e-runner.md` |
| Barrierefreiheit (BFSG) | `skills/accessibility/SKILL.md`, `agents/a11y-architect.md` |
| Token-Budget | `skills/token-budget-advisor/SKILL.md`, `skills/context-budget/SKILL.md` |

Alles andere: `ls ~/.claude/ecc/skills ~/.claude/ecc/agents`.
Projektregeln (CLAUDE.md, Prüfregeln, AGENTS.md) gehen vor.
