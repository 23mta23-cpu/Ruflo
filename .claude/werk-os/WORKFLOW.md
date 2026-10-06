# WORKFLOW.md

# WERK Development Workflow

## Purpose
Default workflow for all meaningful work (Founder, 05./06.10.2026).
ECC building block per step: skill `ecc` (`.claude/skills/ecc/SKILL.md`).
Consistency check: `python3 scripts/zyklus-check.py`.

## Cycle
plan → test → implement → review → verify → remember → improve

### 1. plan
Objective, user problem, relevant files only, assumptions, risks, one
success criterion. Reuse before building.

### 2. test
Write the expectation first and see it fail (red). A check that never
failed proves nothing (CLAUDE.md Prüfregel 1).

### 3. implement
Smallest high-quality change; follow existing architecture; focused diff.

### 4. review
Self-review the diff before verifying: correctness, silent failures,
security, simpler solution, technical debt.

### 5. verify
Tests green, exit codes read, rendered text read. Edge cases and
regression risk checked.

### 6. remember
Lesson to `docs/lehren/CHRONIK.md`; state to `docs/SESSION_HANDOFF.md`
(overwrite, keep short). Commit and push.

### 7. improve
Name the next gap (one) and the simplest next step. Report: summary,
files, why, risks, next step.

## Cost Awareness
Do not perform expensive analysis unless it increases confidence or quality.
One run per suite per block.

## Escalation
Automatically recommend running RED_TEAM.md when:
- Architecture changes
- Pricing changes
- Business model changes
- Security-critical features
- Major AI workflow changes

## Final Rule
Always optimize for long-term product quality, user value and efficient execution.
