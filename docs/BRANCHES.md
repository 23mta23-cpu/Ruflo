# Branch-Inventar (Stand 2026-07-19)

## Aktive Branches
| Branch | Zweck |
|---|---|
| `main` | Produktionsstand. Supabase-GitHub-Integration deployt Migrationen + Edge Functions bei Push. |
| `gh-pages` | GitHub-Pages-Deploy (Web-Export, Datenschutz-URL für Stores). |
| `claude/ruflo-deep-scan-1vr9zk` | Aktueller Arbeits-Branch (Deep-Scan-Session 19.07.). |

## Archiviert (verschoben nach `archive/legacy-2026-07-19/…`)
Alle Inhalte dieser Branches sind per Squash-Merge längst in `main`; die
Original-Commits bleiben unter dem Archiv-Ref erhalten (Regel: archivieren,
nie löschen).

| Archiv-Ref | Ursprünglicher Branch |
|---|---|
| `archive/legacy-2026-07-19/github-setup-analysis-zamu41` | `claude/github-setup-analysis-zamu41` |
| `archive/legacy-2026-07-19/grouped-settings-style-xpvyu6` | `claude/grouped-settings-style-xpvyu6` (Inhalt via PR #67 in main) |
| `archive/legacy-2026-07-19/project-context-review-e7mq0u` | `claude/project-context-review-e7mq0u` |
| `archive/legacy-2026-07-19/provider-pro-screen-zrckfc` | `claude/provider-pro-screen-zrckfc` |
| `archive/legacy-2026-07-19/werkr-handoff-bootstrap-hqr0yb` | `claude/werkr-handoff-bootstrap-hqr0yb` |
| `archive/legacy-2026-07-19/werkr-platform-build-64qstz` | `claude/werkr-platform-build-64qstz` |
| `archive/legacy-2026-07-19/werkr-platform-context-b088z6` | `claude/werkr-platform-context-b088z6` (enthält Ur-Version SESSION_HANDOFF) |

Ältere Archiv-Refs (`archive/provider-pro-screen-zrckfc`, `archive/werkr-platform-build-64qstz`,
`archive/werkr-platform-context-b088z6`) bleiben unverändert bestehen.

**Hinweis:** Die `claude/*`-Originale konnten aus der Sandbox nicht entfernt
werden (Git-Proxy blockt Branch-Deletes, „remote end hung up"). Da die
Archiv-Kopien stehen, ist das nur Kosmetik — bei Bedarf löscht der Founder die
`claude/*`-Duplikate in der GitHub-UI (Branches-Seite), Datenverlust ist
ausgeschlossen.
