---
typ: entscheidung
datum: 2026-07-02
status: angenommen
---

# Entscheidung: `agency-agents` — kuratierte Teilmenge statt Komplett-Installation

Tayyip wollte `github.com/msitarzewski/agency-agents` installiert haben ("für unser Projekt
nutzen"). Vor der Installation geprüft (gleiches Vorgehen wie bei „ponytail" und
„obsidian-skills" zuvor):

## Sicherheitsprüfung
- `scripts/install.sh` + `scripts/convert.sh` komplett gelesen (1.955 Zeilen zusammen) —
  keine `curl|eval`-Muster, kein `sudo`, kein Zugriff auf SSH-Keys/`/etc/passwd`, keine
  verdächtige Netzwerk-Exfiltration. Reines Datei-Kopieren.
- Gemeldete Star-Zahl (125.000+) wirkt unplausibel hoch für ein Nischen-Repo — wie bei
  „ponytail" zuvor. GitHub-API/`git clone` für fremde Repos ist in dieser Session bewusst
  gesperrt (nur `23mta23-cpu/ruflo` erlaubt) — konnte die Zahl daher nicht direkt verifizieren.
  Da der Skript-Inhalt aber sauber ist, keine Blockade, nur Vorsicht bei Stern-Zahlen als
  Vertrauensindikator.
- MIT-Lizenz.

## Entscheidung: nicht alle 232 Agenten, sondern 12 relevante
Das Repo bietet 232 Agenten in 16 Fachbereichen (Engineering, Design, Marketing, Sales,
Product, Finance, Game Development, GIS, Academic, Spatial Computing, ...). Die meisten sind
für ein deutsches, lokales Dienstleistungs-Marktplatz-Projekt (Köln, Pre-Launch) irrelevant
(z. B. China-Social-Media-Spezialisten für Xiaohongshu/Douyin/Weibo, Game-Dev-Agenten für
Unity/Unreal/Godot). Bulk-Install hätte nur Ballast erzeugt — widerspricht „Simplicity First".

**Ausgewählt (passend zu den mir zugewiesenen Rollen CTO/Dev/Recht/Marketing/Sales):**
- `security-architect`, `security-appsec-engineer`, `security-compliance-auditor`
- `sales-outbound-strategist`, `sales-offer-lead-gen-strategist`
- `marketing-growth-hacker`, `marketing-content-creator`, `marketing-seo-specialist`,
  `marketing-social-media-strategist`, `marketing-email-strategist`
- `support-legal-compliance-checker`, `support-finance-tracker`

**Installiert nach:** `.claude/agents/agency--<name>.md` (projektgebunden, git-versioniert —
nicht `~/.claude/agents/` wie das offizielle Install-Skript vorschlägt, da das nur lokal auf
einem Rechner wirken würde, nicht „für unser Projekt" im Sinne von: jede Session, die dieses
Repo öffnet, hat sie automatisch).

## Verifikation
`npx tsc --noEmit` 0 Fehler · `npx jest` 323/323 grün (reine Markdown-Ergänzung, keine
Code-Änderung, aber sicherheitshalber geprüft).
