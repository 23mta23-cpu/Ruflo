# WERKR Vault — Obsidian + Claude + Codex

Dies ist ein **Obsidian-Vault**, der direkt im Repo liegt. Alle Notizen sind
einfache Markdown-Dateien (`.md`). Dadurch können **Claude Code** und **Codex**
sie genauso lesen und schreiben wie du in Obsidian — ein gemeinsames Gehirn für
Mensch und KI.

> Faustregel: Was *langfristig* gilt (Architektur, Recht, Revenue) → `docs/adr/`.
> Was *laufende Arbeit* ist (Status, Ideen, Session-Notizen, Specs in Arbeit) → hier in `notes/`.

---

## 1. Setup auf dem Mac (einmalig)

### Obsidian installieren
```bash
# Variante A: Homebrew (empfohlen)
brew install --cask obsidian

# Variante B: Download
# https://obsidian.md/download
```

### Repo auf den Mac holen (falls noch nicht da)
```bash
git clone <REPO-URL> ~/Code/Ruflo
cd ~/Code/Ruflo
git checkout claude/werkr-platform-build-64qstz
```

### Vault öffnen
1. Obsidian starten → **"Open folder as vault"**
2. Ordner `~/Code/Ruflo/notes` auswählen
3. Vertrauen bestätigen ("Trust author and enable plugins")

Beim ersten Öffnen legt Obsidian einen `.obsidian/`-Ordner an (lokale Config).
Der wird **nicht** committet (siehe `.gitignore`) — jede Maschine hat ihre eigene.

---

## 2. Empfohlene Einstellungen

**Settings → Core plugins** aktivieren:
- ✅ Templates  → Template folder location: `templates`
- ✅ Daily notes → New file location: `00-Inbox`
- ✅ Backlinks, Outline, Tag pane, Graph view

**Settings → Files & Links:**
- "Default location for new notes" → `00-Inbox`
- "New link format" → `Relative path to file` (wichtig, damit Links auch außerhalb Obsidian/in Git stimmen)
- ✅ "Use [[Wikilinks]]"

**Community Plugins (optional, schlank halten):**
- `Templater` — mächtigere Templates (Datum, Variablen) — nur wenn du es brauchst.
- Mehr braucht es zum Start **nicht**. Erst wachsen lassen, dann erweitern.

---

## 3. Zusammenarbeit mit Claude & Codex

Weil alles echte Dateien sind, gibst du den Agenten einfach Pfade:

- *"Lies `notes/MOC.md` und `notes/01-Status/Projekt-Status.md`, bevor du anfängst."*
- *"Trag das Ergebnis in `notes/03-Sessions/` als neue Session-Notiz ein."*
- *"Aktualisiere die Go-Live-Blocker in `notes/01-Status/Projekt-Status.md`."*

**Tipp:** `MOC.md` (Map of Content) ist die Startseite — von dort verzweigt alles.
Wenn ein Agent "den Überblick" braucht, ist das die eine Datei zum Einlesen.

---

## 4. Sync zwischen Geräten

| Methode | Gut für | Hinweis |
|---|---|---|
| **Git** (empfohlen für diesen Vault) | Versionierung, Mac + KI-Agenten | `notes/` ist Teil des Repos → einfach committen/pushen |
| iCloud Drive | Mac + iPhone, simpel | Nicht mit Git im selben Ordner mischen |
| Obsidian Sync (kostenpflichtig) | Komfort, Verschlüsselung | ~4 €/Monat |

Für **AI-Kontext** ist **Git** ideal: Du und die Agenten arbeiten auf demselben
Branch, jede Änderung ist nachvollziehbar.

---

## 5. Ordnerstruktur

```
notes/
├── MOC.md                 ← Startseite / Inhaltsverzeichnis ("Map of Content")
├── 00-Inbox/              ← Schnelle Notizen, Daily Notes, unsortiert
├── 01-Status/             ← Aktueller Projektstand, Go-Live-Blocker, Roadmap
├── 02-Specs/              ← Feature-Specs, Fee-Modell, Sicherheitsregeln (lebende Docs)
├── 03-Sessions/           ← Logs deiner Sessions mit Claude/Codex
├── 04-Entscheidungen/     ← Leichte Notizen; formale ADRs liegen in docs/adr/
└── templates/             ← Vorlagen für neue Notizen
```
