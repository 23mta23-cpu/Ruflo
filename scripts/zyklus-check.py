#!/usr/bin/env python3
"""Arbeitszyklus und ECC-Zuordnung bleiben stimmig.

ANLASS (06.10.2026, Founder): „Wende das ECC generell ein: plan -> test ->
implement -> review -> verify -> remember -> improve." Der Zyklus steht an
drei Stellen (CLAUDE.md, .claude/werk-os/WORKFLOW.md, Skill `ecc`). Driften
sie auseinander, gilt in einer Sitzung ein anderer Ablauf als in der
naechsten -- WORKFLOW.md hatte bis heute Review NACH Verify.

Geprueft:
  1. Alle drei Dateien nennen die sieben Schritte in dieser Reihenfolge.
  2. Jede ECC-Datei, auf die der Skill verweist, existiert unter
     ~/.claude/ecc. Sonst verweist der Index ins Leere (Pruefregel 9).
     Fehlt ~/.claude/ecc ganz (neuer Container), wird das gemeldet statt
     still uebersprungen: `bash scripts/setup-ecc.sh`.
"""
import re
import sys
from pathlib import Path

W = Path(__file__).resolve().parent.parent
ECC = Path.home() / ".claude" / "ecc"
SCHRITTE = ["plan", "test", "implement", "review", "verify", "remember", "improve"]
DATEIEN = ["CLAUDE.md", ".claude/werk-os/WORKFLOW.md", ".claude/skills/ecc/SKILL.md"]


def reihenfolge(text: str) -> list[str]:
    """Die Schritte in der Reihenfolge ihres ERSTEN Vorkommens als Zyklus-Kette
    `plan → test → …` oder als Ueberschrift `### 1. plan`."""
    kette = re.search(r"plan\s*(?:→|->)\s*test.*?improve", text, re.S | re.I)
    if kette:
        teile = re.split(r"\s*(?:→|->)\s*", kette.group(0).lower())
        return [w for w in (re.split(r"\W", t.strip())[0] for t in teile) if w in SCHRITTE]
    return [m.group(1).lower() for m in re.finditer(r"^#+\s*\d\.\s*(\w+)", text, re.M)
            if m.group(1).lower() in SCHRITTE]


def main() -> int:
    fehler = []
    for d in DATEIEN:
        pfad = W / d
        if not pfad.exists():
            fehler.append(f"{d}: Datei fehlt")
            continue
        gefunden = reihenfolge(pfad.read_text(encoding="utf-8"))
        if gefunden != SCHRITTE:
            fehler.append(f"{d}: Schritte {gefunden or 'keine'} statt {SCHRITTE}")

    index = W / ".claude/skills/ecc/SKILL.md"
    verweise = re.findall(r"`((?:agents|skills)/[\w./-]+\.md)`", index.read_text(encoding="utf-8")) if index.exists() else []
    if not verweise:
        fehler.append("Skill ecc: keine ECC-Verweise gefunden")
    elif not ECC.is_dir():
        fehler.append(f"{ECC} fehlt: bash scripts/setup-ecc.sh")
    else:
        for v in verweise:
            if not (ECC / v).is_file():
                fehler.append(f"Skill ecc: {v} existiert nicht in {ECC}")

    for f in fehler:
        print("FAIL", f)
    print(f"{len(DATEIEN)} Dateien, {len(verweise)} ECC-Verweise geprueft, {len(fehler)} Befunde.")
    return 1 if fehler else 0


if __name__ == "__main__":
    sys.exit(main())
