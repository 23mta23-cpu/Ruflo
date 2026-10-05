#!/usr/bin/env bash
# ECC (Everything Claude Code) vollständig nach ~/.claude/ecc holen.
# Gepinnt, damit ein neuer Container denselben Stand bekommt.
# Bewusst KEIN nativer Install: siehe .claude/skills/ecc/SKILL.md.
set -euo pipefail
ZIEL="$HOME/.claude/ecc"
STAND="ef648e01899ba3e8dc6371642deaaf64b4477775"
if [ ! -d "$ZIEL/.git" ]; then
  git clone -q https://github.com/affaan-m/ECC.git "$ZIEL"
fi
git -C "$ZIEL" fetch -q --depth 1 origin "$STAND" 2>/dev/null || true
git -C "$ZIEL" checkout -q "$STAND"
# --ignore-scripts: keine pre/postinstall-Skripte aus fremden Paketen.
(cd "$ZIEL" && npm install --ignore-scripts --no-audit --no-fund --loglevel=error)
echo "ECC bereit: $ZIEL ($(ls "$ZIEL/skills" | wc -l) Skills)"
