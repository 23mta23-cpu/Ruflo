---
name: ecc
description: Arbeitszyklus plan → test → implement → review → verify → remember → improve mit dem passenden ECC-Baustein je Schritt (Expo/RN, TypeScript, Postgres/RLS, Security, e2e). Bei jeder Code- oder Migrationsaufgabe laden.
---

# Arbeitszyklus mit ECC

Zyklus: plan → test → implement → review → verify → remember → improve.

ECC liegt vollständig unter `~/.claude/ecc` (Stand `ef648e0`); fehlt es:
`bash scripts/setup-ecc.sh`. Nicht nativ installiert (455 Einträge, ~16.000
Token pro Anfrage). Je Schritt nur die genannte Datei lesen, und nur den
Abschnitt, der passt. Projektregeln (CLAUDE.md-Prüfregeln, AGENTS.md) gehen
vor; ECC liefert die Checkliste, nicht die Entscheidung.

### 1. plan
Ziel, betroffene Dateien, Risiko, Erfolgskriterium in einem Satz.
`agents/planner.md` (Schritte), bei Architektur `agents/architect.md`.
Geldfluss/Escrow/Security: RED_TEAM.md aus werk-os.

### 2. test
Erwartung zuerst schreiben und ROT sehen (der rote Lauf ist die Mutation).
`agents/tdd-guide.md`; Browser: `skills/e2e-testing/SKILL.md`;
DB/RLS: `scripts/db-test/` mit Gegenprobe.

### 3. implement
Kleinster Diff, bestehende Muster. RN/Expo: `skills/react-native-patterns/SKILL.md`;
Migrationen/RLS: `skills/postgres-patterns/SKILL.md`.

### 4. review
Ein kombinierter Durchgang über den Diff: `agents/typescript-reviewer.md`,
`agents/silent-failure-hunter.md`; je nach Inhalt `agents/react-reviewer.md`,
`agents/database-reviewer.md`, `agents/security-reviewer.md`.

### 5. verify
Tests grün, Rückgabewert lesen, GERENDERTEN Text lesen.
`skills/verification-loop/SKILL.md`; Testlücken: `agents/pr-test-analyzer.md`.

### 6. remember
Lehre nach `docs/lehren/CHRONIK.md`, Stand in `docs/SESSION_HANDOFF.md`
überschreiben. `agents/doc-updater.md`; wiederkehrende Lehre zur Regel:
`skills/rules-distill/SKILL.md`.

### 7. improve
Nächste Lücke benennen (eine), Vereinfachung prüfen:
`agents/code-simplifier.md`, `agents/refactor-cleaner.md`.

Weitere Teile: `ls ~/.claude/ecc/skills ~/.claude/ecc/agents`.
Prüfskript für diese Datei: `python3 scripts/zyklus-check.py`.
