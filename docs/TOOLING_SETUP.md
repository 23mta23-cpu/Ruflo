# Tooling-Setup: Open Design · Headroom · Karpathy-Guidelines

> Stand: 2026-07-06. Installation und Nutzung der drei externen Toolkits im
> WERKR-Projekt. In Cloud-Sessions sind pip-Installationen flüchtig —
> Reproduktion mit den Befehlen unten.

## 1. Karpathy-Guidelines (multica-ai/andrej-karpathy-skills)

**Was:** Verhaltensregeln gegen typische LLM-Coding-Fehler (Think Before
Coding, Simplicity First, Surgical Changes, Goal-Driven Execution).

**Installiert:** `.claude/skills/karpathy-guidelines/SKILL.md` — wird von
Claude Code automatisch als Skill erkannt. Keine weitere Einrichtung nötig.

## 2. Headroom (headroomlabs-ai/headroom) — Kontext-Kompression

**Was:** Komprimiert Tool-Outputs/Logs/RAG-Chunks vor dem LLM (60–95 %
weniger Tokens bei Log-/JSON-Daten, reversibel, Signal bleibt erhalten).
CLAUDE.md enthält bereits versionierte headroom-learn-Patterns.

**Installation (pro Session/Maschine):**
```bash
pip3 install --user headroom-ai
export PATH="$HOME/.local/bin:$PATH"
headroom --version   # geprüft: 0.30.0
```

**Nutzung:**
- Python-Library: `from headroom import compress` →
  `compress(messages)` liefert `tokens_before/after`, `transforms_applied`.
  Verifiziert: 4.555 → 121 Tokens auf Log-Tool-Output, FATAL-Zeile erhalten.
- Proxy: `headroom proxy --port 8787` (zero-code, jede Sprache).
- Claude-Code-Wrap: `headroom wrap claude` / rückgängig `headroom unwrap claude`.
- MCP-Server: `headroom mcp` (`headroom_compress`, `headroom_retrieve`,
  `headroom_stats`).
- Lernen aus Fehl-Sessions: `headroom learn` (schreibt nach CLAUDE.local.md).

## 3. Open Design (nexu-io/open-design)

**Was:** Open-Source-Design-Studio (Desktop-App macOS/Windows bzw.
Docker-Web-Deploy) plus ein Dateisystem aus 163 Design-Skills,
Design-Systems (`DESIGN.md`-Markenverträge) und Templates, die Coding-Agents
direkt nutzen können.

**In dieser Umgebung nutzbar:** die Skills (Desktop-App braucht GUI + Node 24;
Docker-Daemon ist im Cloud-Container nicht verfügbar). Kuratierte Auswahl
installiert unter `.claude/skills/` (ergänzend zum bereits vorhandenen
Open-Design-Stack aus Commit b3de599):

- `artifacts-builder` — mehrteilige HTML-Artifacts (React/Tailwind/shadcn)
- `design-md` — DESIGN.md-Markenverträge erstellen/pflegen
- `brand-guidelines` — Farb-/Typo-Systematik als Referenz
- `canvas-design` — Poster/Illustration/PDF-Gestaltung
- `color-expert` — OKLCH/Kontrast/Paletten-Expertise
- `d3-visualization` — interaktive Datenvisualisierung
- `copywriting` — Landing-/Marketing-Copy
- `creative-director` — Kreativ-Methodik + Bewertungsraster

**Volle App lokal (macOS/Windows, außerhalb der Cloud-Session):**
```bash
git clone https://github.com/nexu-io/open-design.git
cd open-design/deploy && cp .env.example .env
# OD_API_TOKEN mit `openssl rand -hex 32` setzen
docker compose up -d   # Web-UI auf http://127.0.0.1:7456
```
Alternativ Desktop-Release: https://github.com/nexu-io/open-design/releases

## Hinweis WERKR-Design-Regeln

Für UI-Arbeit an WERKR gelten weiterhin verbindlich: minimalist-ui +
ui-ux-pro-max + `.claude/design-references/` (siehe
`notes/04-Entscheidungen/Design-Sprache-Skills.md` und
`docs/SESSION_HANDOFF.md` §2). Die Open-Design-Skills sind ergänzendes
Werkzeug, keine Ablösung der Design-Sprache.
