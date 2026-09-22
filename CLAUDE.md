@AGENTS.md

## Arbeitsmodus (Founder-Anweisung, 2026-07-05)
- Bei normalen technischen Entscheidungen NICHT nachfragen: sinnvolle Option
  selbst wählen und die Wahl im Bericht/Commit notieren.
- Eigene Arbeit in Abständen selbst gegen die Auftrags-Anforderungen prüfen
  (Selbst-Check vor dem Abschlussbericht), gefundene Lücken direkt fixen.
- Rollenverständnis: als Geschäftspartner agieren — CTO, Senior-Entwickler,
  Sales, Marketing, Rechtsberater (nur Hinweise, keine Rechtsberatung ersetzend)
  und Solution-Architekt. Entscheidungen aus der jeweils passenden Rolle
  treffen und begründen.
- Nach Session-Reset/Kontextverlust EIGENSTÄNDIG weitermachen (2026-07-07):
  `docs/SESSION_HANDOFF.md` lesen, offenen Stand fortsetzen, nicht auf
  Rückfragen warten. Zwischenstände reset-fest machen: Entscheidungen nach
  `notes/04-Entscheidungen/`, Marken-Assets nach `docs/brand/`.

## Projekt-Wissen (stabil)
- **Marke:** „Werkant" (final, Rebrand von WERKR live), Logo „Das Treffen"
  (`docs/brand/das-treffen-*.svg`), Siegel „Werkant-geprüft". Naming-Recherche
  NICHT wiederholen.
- **Betriebs-Playbooks:** `docs/agents/werkant-playbooks.md` (Puls-KPI-Digest,
  Aktivierung, Bestand, Wache, Köln-Akquise, DSGVO-Audit, Incident-Runbook) —
  per Stichwort ausführbar. Support-Persona: `docs/agents/werkant-support-SOUL.md`.
- **Security:** `docs/security/GO-LIVE-SECURITY-CHECKLIST.md` (Code-Stand
  verifiziert; offene Punkte = Founder-Dashboard-Klicks).
- Headroom-Session-Snapshot: `mcp__headroom__headroom_retrieve({ hash: "74ddfb5cb3b8e211a55d9840" })`

## Design System
**Imports:** `import { C } from '../../constants/colors'` · `import { T } from
'../../constants/typography'` (NICHT theme.ts) · `import { shadow, S, R } from
'../../constants/theme'`

**Farben (C):** bg `#F9F8F5` · bgWarm/hair `#F2EFE9` · surface `#FFF` · border
`#E5E1DA` · ink `#1A1917` · sub `#6C6862` · muted `#A8A49C` · primary `#1B5C40`
· primaryBg `#EBF4EF` · gold `#8F6B1A` · goldBg `#F6ECD8` · clay `#9B3E25` ·
red `#B91C1C` · **C.green/C.greenBg DEPRECATED → primary/primaryBg**

**Typo (T):** h1 28/35/700 · h2 22/29/700 · h3 18/25/700 · body 14/21/400 ·
btn 15/22/700 · label 12/17/700 upper · caption 11/16/500

**Harte Regeln:** fontWeight max '700' · shadowColor immer C.ink (nie '#000')
· keine Emojis in UI/Push (nur Ionicons) · Motion-Baustein: `components/ui/
Reveal.tsx` (reduce-motion-aware); Daten-Viz: `components/ui/ProgressRing.tsx`.
Audit: `grep -rn "C\.green\b\|C\.greenBg\|fontWeight.*['\"8][0-9][0-9]['\"']\|shadowColor:.*'#" app/ components/`

**App-Struktur:** Screens `app/*.tsx`, `app/(tabs)/`, `app/(provider)/` ·
Edge Functions `supabase/functions/*/index.ts` · Logik `lib/*.ts` ·
Typecheck: `npx tsc --noEmit 2>&1 | head -20`

## Session 2026-07-08 — manuell nachgetragen

### Migrations-Namensschema (WICHTIG, seit PR #32)
- Alle Migrationen haben **4-stellige numerische Präfixe**: `0010_initial_schema.sql`, `0020_auth_profile_trigger.sql`, `0021_contracts_offers_tables.sql` … `0380_backfill_missing_profiles.sql`. Alte `001_`/`002b_`-Namen existieren NICHT mehr (Supabase überspringt nicht-rein-numerische Präfixe still → `contracts` fehlte → Backend kaputt).
- Vor neuer Migration IMMER `ls supabase/migrations/ | sort | tail -6` — Nummer nie aus dem Gedächtnis raten. `contracts`/`offers` liegen in `0021_`.

### DB-Reset-Falle: verwaiste auth.users ohne Profil
- `drop schema public cascade` löscht `public.profiles`, lässt `auth.users` bestehen; `handle_new_user`-Trigger feuert nur bei NEUEN Signups → Alt-Nutzer ohne Profil → Login bricht ab. Fix-Muster: Backfill-Migration (`0380`) + Client-Selbstheilung in `lib/auth.ts` (`maybeSingle()`, Profil aus `user_metadata` neu anlegen).

### Migrationen lokal testen fängt echte Bugs
- Produktions-Migrationen IMMER lokal replayen (inkl. 2. Lauf für Idempotenz). Gefundener Bug-Typ: `case when coalesce(x,'y') in (...) then x` liefert NULL wenn Key fehlt (THEN muss den coalesce'ten Wert nehmen).

### Playwright: DSGVO-Consent vorab dismissen
- Consent-Sheet überlagert JEDEN Screen. Via `ctx.addInitScript`: `localStorage.setItem('werkr_consent_v1', JSON.stringify({accepted:true, analytics:false, pstg:true, version:'1.0', timestamp:new Date().toISOString()}))` — Prüfung in `app/_layout.tsx` ist `parsed?.accepted === true`.

### Video/Motion an den Founder liefern
- Kein ffmpeg im Sandbox; `.webm` spielt auf iPhone NICHT. Stattdessen: PNG-Frames im ~90ms-Takt via Playwright, dann PIL-GIF (`save_all=True, duration=95, loop=0`), via `SendUserFile` mit `display:'render'`.

### react-native-web Barrierefreiheit
- `AccessibilityInfo.isReduceMotionEnabled()` mappt in rn-web echt auf `prefers-reduced-motion` → Animationen damit BFSG/WCAG-2.3.3-konform. Zentrale Bausteine: `Reveal.tsx`, `ProgressRing.tsx`.

## Headroom Learn 2026-07-17 (manuell angewandt — Auto-Apply-Parserfehler)
*Quelle: `headroom learn`-Analyse über 6 Sessions / 944 Calls*

### Git/PR-Disziplin (Selbstkritik, verbindlich ab jetzt)
- **PR-pro-Fix ist auch im Selbst-Merge-Modus ein Anti-Pattern** (~56 PRs #38–#94,
  20k+ Token reiner Branch/PR-Overhead). Ab jetzt: 2–4 zusammengehörige Blöcke
  auf dem Branch sammeln, DANN ein PR + Merge. Ausnahmen: Founder sagt „sofort",
  Standalone-Security-Fix, oder Loop-Lauf ohne PR-Tools.
- `git fetch origin main && git checkout -B …` nur EINMAL pro Arbeitsblock
  (nachweislich 15–28x wiederholt, ~4,8k Token) — nur neu, wenn main sich
  bewegt hat.
- `git config user.email noreply@anthropic.com && git config user.name Claude`
  EINMAL zu Beginn der Branch-Arbeit setzen (Stop-Hook-Warnungen kosteten 10+
  Leerlauf-Hinweise). GitHubs eigene Squash-Merge-Commits (committer
  noreply@github.com) triggern den Hook trotzdem — das ist gutartig, ignorieren.
- `mcp__github__actions_list`-Antworten sind riesig (18k–48k Token) — Ergebnis
  merken, nicht mehrfach mit gleichen Parametern abfragen; nach Deploys erst
  nach Ablauf des 5–7-Min-Fensters EINMAL prüfen (kein Sleep-Polling).

<!-- headroom:learn:start -->
## Headroom Learned Patterns
*Auto-generated by `headroom learn` on 2026-08-16 — do not edit manually*

### Agent Spawning
*~40,000 tokens/session saved*
- The 3-reviewer pattern (Security/QA/Architect review subagents spawned together after nearly every code block) is the single largest token sink observed: individual read-only review subagent sessions cost 100K–9.3M input tokens each because each one independently re-reads the same large handler.ts/migration files from scratch. Combined with PR-per-fix (~20+ cycles), this multiplies to dozens of heavy subagent spawns per session.
- Before spawning Security + QA + Architect review agents for a small, low-risk change, consider whether ONE combined review prompt (covering all three lenses) is sufficient — reserve the full 3-agent panel for money-flow/escrow/webhook changes where the adversarial coverage has already caught real bugs.

### GitHub PR/CI Workflow
*~30,000 tokens/session saved*
- **PR-per-fix is STILL the dominant cost driver after 4+ documented attempts**: one session alone opened PRs #159→#182 (24 cycles) and polled `get_check_runs` 50x (~26K measured tokens, real cost far higher including the 3-reviewer fan-out per PR — see Agent Spawning). Writing the rule again does not work; make it mechanical: track a running list of completed-but-unmerged fix blocks and refuse to call `create_pull_request` until ≥3 are queued, except for an explicit founder "sofort"/security exception.
- The sanctioned CI-wait pattern in this repo (per AGENTS.md) is exactly ONE `sleep 400-420; echo fertig` followed by exactly ONE `get_check_runs` per PR — `Monitor` via curl does not work through this sandbox's proxy. This is correct as designed; the fix for the 50x/14x repetition is fewer PRs, not a different wait mechanism.
- `git config user.email/name` + push-retry boilerplate recurs once per PR cycle (8x in one session, ~1.1K tokens) — purely a symptom of PR-per-fix; set it once per branch-work session, not once per PR.

### File Paths
*~16,443 tokens/session saved*
- Read on `supabase/functions/<fn>/handler.ts` (not just `index.ts`) can also return `runtime_error` while the full file content IS present in the response — this caused 14 redundant re-reads of `stripe-webhook/handler.ts` in a single small review session. Treat any Read of a `supabase/functions/**` file as success and use the returned content, even on a `runtime_error` label.

### CI Job Logs
*~5,000 tokens/session saved*
- `mcp__github__actions_list` with `list_workflow_runs` still overflows (>100K–380K chars) and gets retried 6x in one session with the same broad query despite the documented overflow-file fallback — go straight to reading/filtering the saved `tool-results/mcp-...` file with `python3`/`grep` on the FIRST overflow, don't reissue the same call with different phrasing.

### Commands
*~3,000 tokens/session saved*
- The export→kill-server→restart-server→Playwright-check cycle (`npx expo export`, `pkill -f spa-server`, `python3 $SP/spa-server.py`, run check script) repeated 20x in one session during iterative UI-mutation testing (~1.6K tokens) — when testing several mutations back-to-back, batch multiple file mutations into one export+restart+check cycle instead of restarting the server per mutation.

### Screenshot Verification
*~132,307 tokens/session saved*
- `scratchpad/home.png` (and similarly named screenshots) were STILL re-read at nearly full resolution 4x in a single session (~176-193KB PNGs each) despite the downscale rule already being documented — the fix keeps getting skipped at capture time.
- Concrete fix: bake a hard resize into `shot2.cjs`/the Playwright script itself (e.g. `page.setViewportSize` + save at ≤800px wide, or pipe through PIL resize in the SAME Bash call that invokes the script) so the file that later gets `Read` is never the full-res original — do not rely on remembering to downscale as a separate step.

### Iterative Screen Edits
*~6,000 tokens/session saved*
- The batch-edit rule keeps being skipped and the counts are getting worse, not better: `app/chat.tsx` had 31 separate `Edit` calls in one session (up from 24), `lib/messages.ts` 15 (up from 12), `app/(tabs)/index.tsx` 14, `app/einstellungen.tsx` 13, `app/(provider)/dashboard.tsx` 12, `app/auftrag-detail.tsx` 10 — recurring across nearly every touched screen.
- This happens specifically during iterative feature-wiring (appointment proposals, chat roles, message read-tracking) spread across MANY small founder-driven asks in one long session, not one-shot multi-bug passes — when a running session already has 3+ pending Edits queued for the same file, switch to a single `python3 - <<EOF` read+replace+write for the rest of that file's changes instead of continuing with sequential `Edit` calls.

### Task Management
*~300 tokens/session saved*
- `TaskCreate` failed with "required parameter `subject` is missing / `description` is missing / unexpected parameter" when called with a `tasks` array of `{content, description}` objects — the correct schema takes `subject` + `description` as top-level (or per-task) fields, not a `content` field or a bare `tasks` array. Check the tool schema via ToolSearch once before first use in a session rather than guessing the shape.

### Network / Proxy
*~21,094 tokens/session saved*
- `git push` to origin intermittently fails through the sandbox proxy — retry loop: `for i in 1 2 3 4; do git push ... && break || sleep <n>; done`. Use this upfront on every push.
- `git push origin --delete <branch>` can report `HTTP 403 ... unexpected disconnect` even when the deletion actually succeeded — re-check `git branch -r` before treating the delete as failed.
- E2E Playwright tests against the LIVE production URL (`https://23mta23-cpu.github.io/Ruflo/`) failed repeatedly through the sandbox proxy (`net::ERR_CONNECTION_RESET`, `Failed to fetch`) — 5 rewrites of the same probe script chasing this. Prefer testing against the local `dist/` export server (`spa-server.py` on :8744) for E2E logic checks; only hit the live URL once for a final smoke confirmation, not the primary test loop.

### DB Test Harness
*~1,200 tokens/session saved*
- Each new DB-backed feature (money-core, quality-strikes, inquiries, appointments) requires: create `scripts/db-test/<feature>.sql`, wire into `run.sh`, then `service postgresql start >/dev/null 2>&1; bash scripts/db-test/run.sh` — this exact 3-step sequence repeated 5x in one session, once per feature.
- When adding several DB-backed features in the same session, write all `.sql` test files and `run.sh` wiring first, then do ONE combined test run instead of one run per feature.

### GitHub Pages Deploy
*~15,000 tokens/session saved*
- **PR-per-fix is STILL unresolved despite the standing rule**: this session alone opened PRs #108→#122 (14 more single-fix cycles: commit→PR→sleep→get_check_runs→merge) even though CLAUDE.md already said to batch 3-5 fixes. Before calling `create_pull_request`, check the TaskCreate list and only open the PR once ≥3 tasks are `completed` — writing the rule again isn't enough, gate the PR call on task count.
- `mcp__github__pull_request_read` (`get_check_runs`) was polled 19x and a plain `sleep 200-260; echo "CI-Fenster"` filler ran 14x in ONE session, including cases where a `Monitor` was already armed for the same PR — once a Monitor is watching CI checks, do not also manually poll `get_check_runs` or sleep-loop; wait for the Monitor notification (or re-arm it on timeout) instead of falling back to sleep+poll.
- `Monitor` on a single PR's CI checks reliably times out before checks finish — re-arm the SAME Monitor call on timeout rather than switching to a sleep+manual-poll pattern.
- `git push` to a long-lived work branch fails with `non-fast-forward` almost every cycle once PR-per-fix churn is happening — go straight to `git fetch` + `git push --force-with-lease -u origin <branch>` rather than treating the rejection as a surprise.

### Deno / Edge Functions CI
*~1,200 tokens/session saved*
- `deno check` invocations touch and modify `deno.lock` as a side effect — running the exact CI command locally to debug a failing `edge-check` job can leave `deno.lock` dirty with unintended diffs; check `git diff --stat deno.lock` before committing and `git checkout -- deno.lock` if the only changes are lockfile noise from local debugging, not real dependency changes.
- Getting the `edge-check` CI step right took 3 separate `Edit` + PR cycles on `.github/workflows/ci.yml` in one session (missing flag, cache behavior, deno.lock diff) — before adding a new CI job for `deno check` across `supabase/functions/*/index.ts`, run the exact same command locally in a clean `/tmp` simulation dir first to catch lockfile/cache issues before pushing.

### Transient Tool Errors
*~300 tokens/session saved*
- `Agent` and `Bash` tool calls occasionally fail with "claude-<model> is temporarily unavailable, so auto mode cannot determine the safety of <Tool> right now" — this recurred 5x across different models (sonnet-5, opus-4-8) in one session. It is a transient auto-mode routing hiccup, not a real failure: just retry the same call after a short pause rather than switching models or investigating.

### Tool Discovery
*~800 tokens/session saved*
- `ToolSearch` for `select:mcp__github__create_pull_request,mcp__github__merge_pull_request` was re-run 7x in one session (~228 tokens) — once a tool's schema is loaded via ToolSearch it stays available for the rest of the session; don't re-search for the same tool names before every PR cycle. This overhead compounds with the PR-per-fix anti-pattern — batching PRs also eliminates most of these redundant lookups.

### Supabase API Testing
*~448 tokens/session saved*
- Ad-hoc Supabase REST/Edge-Function smoke tests reused the same `SB=https://chnphpmpdpllnpqtvwhx.supabase.co; KEY=sb_publishable_...` boilerplate verbatim in 15+ separate Bash calls across one session (~2k tokens of pure duplication). Write it once to a scratchpad file (e.g. `$SP/sb_env.sh`) and `source` it in each subsequent test call instead of repasting the header.

### Local Postgres Testing
*~12 tokens/session saved*
- Docker is unavailable in this sandbox — use local Postgres: `service postgresql start`, `su postgres -c "dropdb/createdb X"`. SQL files in /tmp need `chmod 644` first or `su postgres` gets Permission denied.
- The postgres service does NOT stay running across Bash calls in this sandbox — `connection to server on socket "/var/run/postgresql/.s.PGSQL.5432" failed: Connection refused` recurred 3x in one session after the service had been started earlier. Prefix every `psql`/migration-test Bash call with `service postgresql start >/dev/null 2>&1;` rather than assuming it's still up from an earlier call.

### Environment
*~800 tokens/session saved*
- `node_modules/` is absent by default in fresh sandbox sessions — `npx tsc`, `npx jest`, and `npx expo export` all fail until you run `npm ci --no-audit --no-fund` first. Check with `ls node_modules 2>/dev/null | head -2` before assuming it's installed.

### Tool Usage
*~400 tokens/session saved*
- Edit and Write always require a prior Read of the same file in the same agent session — this applies even to brand-new files that were only confirmed non-existent via `ls`, not actually Read (a `Write` to a never-existing GitHub Actions workflow file still failed with "File has not been read yet"). For genuinely new files, skip Write entirely and use `cat > path <<'EOF' ... EOF` via Bash — confirmed instantly working both for new files and for appending to existing ones.
- Read tool `offset` parameter must be a plain integer, never an array — use `offset: 500` not `offset: [500]`.
- `Read` occasionally fails with `InputValidationError: ... could not be parsed as JSON` when the `offset` argument is malformed mid-call — just retry the same Read call with an explicit integer offset/limit; it's a transient serialization glitch, not a real file problem.

### External Repo Evaluation
*~3,500 tokens/session saved*
- When asked to clone and evaluate a third-party agent/bot repo (e.g. `awesome-openclaw-agents`), read `package.json` + the entry file once, then do a single bounded run (`timeout 10s node bot.js`) instead of iterating — this session edited/re-ran `bot.js` 4x (~3.5k tokens) chasing a missing-token requirement that was visible in the first read.

### CLAUDE.md Editing
*~400 tokens/session saved*
- Appending a new dated session section to `CLAUDE.md` with the `Edit` tool failed twice this session: once with "File has not been read yet", once with "Found 2 matches... set replace_all" (repeated header text like `### Agent Spawning` matches more than once). Use `cat >> CLAUDE.md <<'EOF' ... EOF` instead of `Edit` when appending a new dated section — this is what the session fell back to successfully both times.

### Session Handoff Files
*~2,500 tokens/session saved*
- Check the scratchpad directory FIRST for a staged `SESSION_HANDOFF.md` (e.g. `/tmp/claude-0/.../<session-id>/scratchpad/SESSION_HANDOFF.md`) before searching git — this session spent 6 tool calls (git status/log, ls, Glob, merge-base) before finding it staged there.
- If not in scratchpad and a Read 404s on `docs/SESSION_HANDOFF.md`, it may live on `origin/main` (seit `28e16cb`) — run `git fetch origin main` and read `git show origin/main:docs/SESSION_HANDOFF.md` (or fast-forward the branch) instead of hunting through Glob/`git log --all`.

### Headroom Tool Usage
*~400 tokens/session saved*
- `headroom learn --apply --target CLAUDE.md` (after `export PATH="$HOME/.local/bin:$PATH"`) applies learned patterns directly to CLAUDE.md — confirmed working command for closing the learn loop without manual copy-paste.

### Global Instructions / Karpathy Guidelines
*~1,500 tokens/session saved*
- The Karpathy guidelines content is injected into session context automatically (private global instructions from `/root/.claude/rules/ecc/common/karpathy-guidelines.md`). Don't re-read or re-download it via `curl` unless the user explicitly asks to persist it to disk; if the file is missing in a fresh container, that's cosmetic — the four binding rules stay versioned in AGENTS.md.

### Edge Functions
*~5,800 tokens/session saved*
- When doing a multi-concern pass across Edge Functions (idempotency, rate-limiting, input validation, PStTG thresholds, etc.), read and edit each `supabase/functions/<fn>/index.ts` file ONCE per file, applying all concerns in that single visit — not once per concern.
- Before starting a security/compliance sweep, list ALL public Edge Functions first (`ls supabase/functions/`) and plan the full set of changes per file, then touch each file exactly once.
- `npx tsc --noEmit` does NOT typecheck `supabase/functions/` — use `deno check supabase/functions/<fn>/index.ts` (install: `curl -fsSL https://deno.land/install.sh | sh`).

### Worktrees
*~3,000 tokens/session saved*
- Agents isolated in worktrees MUST edit files at `/home/user/Ruflo/.claude/worktrees/agent-XXXXXX/<file>`, NOT at `/home/user/Ruflo/<file>`. Default first action: `git -C <worktree> reset --hard origin/<branch>` to sync ALL files before any reads or edits.
- Missing files after reset, in order: (1) from worktree CWD: `git checkout <branch> -- "app/(tabs)/file.tsx"` (quote parenthesized paths — unquoted fails with "pathspec did not match"). (2) bulk: `git -C <worktree> fetch origin <branch> && git -C <worktree> merge origin/<branch>`. (3) last resort: `cp /home/user/Ruflo/<path> <worktree>/<path>` then Read before Edit. `supabase/functions/` + some `lib/` files are often absent — diagnose with `diff <(ls /home/user/Ruflo/lib/) <(ls <worktree>/lib/)`.
- `git checkout <branch>` fails inside a worktree when that branch is checked out in the main repo — use `git -C <worktree-path> checkout`. READ from the worktree path, not the main repo path. The path is `.claude/worktrees/` (recurring typo: `.claire/`).

### Large Files
*~4,000 tokens/session saved*
- `werkr-prototype.html` is ~270KB — exceeds both the 256KB Read size limit and the 25k-token Read token limit. Never attempt a full Read. Instead: `grep -n '^function ' werkr-prototype.html` for line numbers, then `Read` with `offset`+`limit`. Navigation audits: `grep -n "go('" werkr-prototype.html | head -120`.
- `app/onboarding-kyc.tsx` is ~44KB — read with `offset`/`limit` when targeting specific sections.

### Database Schema
*~1,200 tokens/session saved*
- Migrationen haben 4-stellige numerische Präfixe (`0010_` … `0380_`) — Details siehe „Migrations-Namensschema" unten. Kein einzelnes File hat alle Tabellen: `grep -rn 'create table' supabase/migrations/`.
- `reviews` table: `create table` liegt in `0200_reviews_table.sql`. `disputes` in `0130_`. pstTg-Spalten in `0120_`/`0220_`.

### Design Tokens
*~500 tokens/session saved*
- Audit deprecated color/weight tokens in one grep: `grep -rn "C\.green\b\|C\.greenBg\|fontWeight.*['\"8][0-9][0-9]['\"']" app/ components/`. Also check hardcoded hex shadow colors: `grep -rn "shadowColor:.*'#\|shadowColor:.*\"#" app/ components/`.

<!-- headroom:learn:end -->

## Session 2026-08-09 — Web-Test kann Geräte-Fehler nicht sehen

### `flex: 1` in einer ScrollView ist auf dem Gerät unsichtbar
`flex: 1` heißt in React Native `flexBasis: 0`. Direkt in einer `SafeAreaView`
(die eine Höhe hat) ist das richtig. In einem `ScrollView`-contentContainer
**ohne `flexGrow`** gibt es keine vorgegebene Höhe → das Element bleibt 0 hoch
und ist auf iOS/Android unsichtbar. **Auf react-native-web fällt das nicht auf.**
- Faustregel: `flexGrow: 1` statt `flex: 1`, wenn ein Baustein an beiden Sorten
  von Stellen stehen kann. `flexBasis` bleibt dann `auto`.
- Bestehendes Muster im Projekt: `auftraege styles.empty` (in ScrollView) hat
  **kein** `flex: 1`, `nachrichten/meine-anbieter styles.emptyState` (direkt in
  SafeAreaView) hat es.
- Audit 09.08.2026 über `app/**` + `components/**`: außer dem damals neuen
  `GastLoginHinweis` **kein** weiterer Fall. Nicht erneut durchsuchen.
  (`flex: 1` in einer `flexDirection: 'row'`-Zeile ist normal und kein Befund —
  ein naiver Grep liefert ~155 Fehlalarme.)

### Grenze des Prüfaufbaus (ehrlich benennen, nicht überschreiben)
`npx expo export --platform web` + Playwright gegen `dist/` prüft Logik und
Navigation zuverlässig, aber **kein natives Layout**. Kein Simulator, kein Gerät
in dieser Sandbox. Bei Layout-Änderungen an gemeinsam genutzten Bausteinen
deshalb: Yoga-Semantik prüfen + gegen bestehende, auf Geräten erprobte Muster
im Repo abgleichen — und im Bericht sagen, dass ein Gerätetest aussteht.

### Gast-Zustände
`components/ui/GastLoginHinweis.tsx` ist der EINE Baustein dafür. Sieben Screens
nutzen ihn. Prüfen mit `node scripts/gast-login-check.cjs` (Server:
`python3 scripts/spa-server.py`, nach JEDEM `expo export` neu starten — der
Export legt `dist/` neu an und der Prozess verliert sein Arbeitsverzeichnis).

## Browser-Pruefungen: EIN Aufruf (seit 15.08.2026)
`bash scripts/reisen/run.sh` macht Export, Server und alle Browser-Checks in
einem Rutsch (tote Links, Gast-Login, Rollen/Routen, Entwurf, Kern-Reise 1+2).
Abdeckung und Grenzen stehen in `scripts/reisen/README.md` — dort steht auch,
was ausdrücklich UNGEPRÜFT ist (Angebot, Annahme, Vertrag, Escrow, Auszahlung).
`SKIP_EXPORT=1` spart den Export, wenn `dist/` aktuell ist.
- Server-Neustart nach jedem Export erledigt der Läufer selbst — der
  wiederkehrende `FileNotFoundError: os.getcwd()` ist damit erledigt.
- **`pkill` NIE mit weiteren Befehlen in einem Bash-Aufruf verketten** — auch
  nicht in einer Shell-Funktion. Das SIGTERM bricht die ganze Kette ab
  (Exit 144), und eine Mutation bleibt dann ungewollt im Baum stehen. Genau so
  passiert am 15.08.: `cp backup` lief nie, `persistDraft()` fehlte danach im
  Arbeitsbaum. Wiederherstellen mit `git checkout --`, nicht mit /tmp-Kopien.
- Playwright-Selektoren: IMMER `:visible` — expo-router lässt inaktive Screens
  im DOM stehen, ein blankes `input` greift sonst das E-Mail-Feld des
  Anmelde-Screens ab.
- `isDisabled()` trifft bei react-native-web den Text IM Knopf, nicht den
  Knopf. Wirkung prüfen (Klick löst nichts aus), nicht die Auszeichnung.
- **`minWidth: 0` bei jedem Flex-Kind, das schrumpfen können muss.** Ein
  Flex-Element hat `min-width: auto` und weigert sich, unter seine
  Inhaltsbreite zu schrumpfen — Eingabefelder in einer Zeile laufen dann
  über den Rand, Kacheln sprengen ihr Raster. Ein naiver Grep nach `flex: 1`
  ohne `minWidth` liefert ~101 Fehlalarme; geprüft wird deshalb das SYMPTOM
  über `scripts/rand-ueberstand-check.cjs` (misst echte Geometrie bei
  390/375/360). Waagerecht scrollbare Leisten sind darin ausgenommen.

## Session 2026-08-16 — Gruene Haken, die nichts pruefen

Sieben Founder-Befunde am Geraet, sieben Mal dieselbe Ursache dahinter: eine
Pruefung meldete gruen, ohne den Fehler ueberhaupt sehen zu koennen.

### Jest lief in UTC — Datumsfehler waren damit unsichtbar
`jest.config.js` setzt jetzt `process.env.TZ = 'Europe/Berlin'` (ganz oben,
VOR `module.exports`). Nachgewiesen: eine Mutation, die die ortszeit-basierte
Tagesberechnung durch `toISOString()` ersetzte, liess **alle zehn** Tests gruen.
In UTC gibt es keinen Versatz — der Fehler trifft ausschliesslich Nutzer
ausserhalb von UTC, also alle. Nach dem Umstellen: 8 von 10 rot.
**Regel:** Datumslogik ohne festgelegte Zeitzone ist nicht getestet.

### Textpruefer sehen JSX-Text nicht, wenn sie nur Quotes lesen
`scripts/anrede-check.py` meldete 0 Abweichungen bei 28 echten Duz-Stellen.
Blind war er fuer: JSX-Textknoten (`<Text>Dein Fokus</Text>`), kurze Strings
(`placeholder="Dein Name"`, 9 Zeichen), Imperative OHNE Pronomen („Bitte
versuche es erneut"), umgebrochene und mit `{ausdruecken}` gemischte Prosa,
Kurzimperative ohne -e („Schreib die erste!").
**Loesung, die alle vier abdeckt:** pro Zeile `{...}` und `<...>` entfernen —
was uebrig bleibt, ist der sichtbare Text. Plus Quotes ab 4 Zeichen. Treffer
pro (Datei, Zeile) einmal melden, sonst Doppelmeldungen.
**Gegenprobe nicht vergessen:** die erste Kurzimperativ-Liste erzeugte fuenf
Fehlalarme („die **Wahl**", „**Tipp**:", `includes('prüf')`). Substantive und
Code raus — ein Pruefer mit Fehlalarmen wird abgeschaltet und nie wieder an.

### Zwei RLS-Bedingungen, die dieselben Faelle abdecken, sind EINE Bedingung
Bei `widerruf_consents` (0710) blieb die Mutation „`auth.uid() = customer_id`
entfernt" gruen: die zweite Bedingung (Vertragskunde ist auth.uid()) fing
dieselben Testfaelle ab. Erst ein Test fuer den Fall, den NUR die erste
abfaengt (echter Vertragskunde erklaert auf FREMDEN Namen), machte sie
nachweisbar. **Bei jeder mehrteiligen Policy: pro Teilbedingung eine Mutation,
und wenn nichts rot wird, fehlt der Test — nicht die Bedingung.**

### DB-Tests, die am Unique-Index statt an der Policy scheitern
Zwei Tests wiesen korrekt ab, aber wegen `unique_violation` (die Zeile gab es
schon), nicht wegen RLS. **Negativtests immer gegen einen unbelegten Datensatz
fahren**, sonst maskiert die Constraint eine kaputte Policy.

### Optionale Parameter lassen Felder still verschwinden
`addressStreet?: string` in `lib/jobs.ts` — der einzige Aufrufer uebergab es
nie, `tsc` hatte keinen Grund zu widersprechen, und die Anzeigeseite wartete
monatelang auf Daten, die niemand erhob. Bei genau EINEM Aufrufer: Parameter
**pflichtig** machen, dann ist das Weglassen ein Uebersetzungsfehler.

### Rollen-gesperrte Bildschirme pruefen die Browser-Reisen NICHT
`app/betrieb/*` haengt an Anmeldung UND Anbieter-Rolle; Reise 2 endet beim
Gewerbeschein. Der Kalender-Fehler konnte dort nie auffallen.
**Muster:** reine Logik aus solchen Screens nach `lib/` ziehen und mit Jest
pruefen (`lib/kalenderWoche.ts` nimmt `heute` entgegen — ein Test, der nur
montags gruen ist, ist kein Test).

### Nachweise gehoeren in die Datenbank, nicht in useState
`app/zahlung.tsx` hielt die Widerrufs-Zustimmung in `useState(false)` und
schickte nur `contract_id` weg. Der Haken sperrte einen Knopf und verschwand
mit dem Bildschirm — im Streitfall unbeweisbar. Festzuhalten ist der
**Wortlaut** samt Fassungskennung, nicht nur ein Haekchen (0710), und zwar
VOR der Zahlung.

### Erkennung, die am Geraet des Taeters haengt, ist keine
`chat_leak_flags` (0340) darf laut RLS nur der ABSENDER schreiben, geschrieben
vom Client des Absenders. Zweiter, unabhaengiger Weg ueber den Empfaenger:
`chat_reports` (0700). Beides bleibt Pruefsignal — **kein Auto-Strike aus einer
Meldung**, sonst genuegen drei Meldungen, um einen Anbieter zu sperren.

### Founder-Zitate ernst nehmen, aber nachmessen
Jeder Befund war echt und meist SCHLIMMER als beschrieben („nur die Woche
sehen" = Termine ausserhalb waren unsichtbar; „zu ki geschrieben" = der Text
war auch unvollstaendig zulasten des Kunden). Agentenberichte dagegen immer
nachpruefen: der UI/UX-Agent nannte 10 von 28 Stellen — alle 10 echt, aber
eben nur gut ein Drittel.

## Session 2026-08-16 (nachmittags) — Code gegen AGB, und Tests, die aus Zufall gruen sind

Diese Lehren sind inhaltlich, nicht token-bezogen — `headroom learn` kann sie
nicht sehen, weil sie nicht in den Aufrufmustern stehen.

### Der Code kann den eigenen AGB widersprechen, und niemand prueft das
Gefunden ueber eine Founder-Frage nach Airbnb, nicht ueber einen Test.
AGB §7(3) sagt „3 Strikes **innerhalb von 12 Monaten**"; der Code zaehlte ohne
jede Datumsgrenze und liess Strikes per `greatest()` nie wieder sinken. AGB
§7(4) verspricht eine Begruendung (Art. 4 P2B-VO, unmittelbar geltendes
EU-Recht); gespeichert war ein Integer, aus dem sich keine erzeugen laesst.
**Regel:** Bei jedem Feature mit einer Zusage in AGB/Datenschutz/Widerruf den
Paragraphen NEBEN den Code legen und Satz fuer Satz abgleichen. Fristen,
Begruendungspflichten und Beschwerdewege sind pruefbare Zusagen, keine Prosa.
Weitere Kandidaten im Projekt: Stornofristen (geprueft, war unvollstaendig),
PStTG-Schwellen, Loeschfristen.

### Ein Wert, der beschreibbar ist, aber nicht wirkt, ist eine Falle
`provider_profiles.strike_count` liess sich im Supabase-Dashboard auf 3 setzen
— die Sperre fragte aber `aktive_strikes()`. Wer den Wert setzt, erwartet eine
Sperre und bekommt keine. **Regel:** Wird eine Spalte zur abgeleiteten Groesse,
entweder Schreibrecht entziehen oder per Trigger ueberschreiben. Ein Feld, das
sich setzen laesst und nichts bewirkt, ist dieselbe Klasse wie ein Knopf ohne
`onPress`.

### Ein Test kann gruen bleiben, weil zwei Werte ZUFAELLIG gleich sind
`expect(COMPANY.email).toBe(MAIL.kontakt)` sollte beweisen, dass das Impressum
an der Konstante haengt. Die Mutation „wieder als Literal" blieb gruen: im
Ein-Postfach-Betrieb ist `MAIL.kontakt` derselbe Text wie das Literal. Ein
Wertvergleich kann eine **Bindung** nicht beweisen, wenn beide Seiten denselben
Wert haben. **Regel:** Bindung, Herkunft und Verdrahtung sind Quelltext-Fragen —
dafuer ein Skript ueber den Quelltext, kein Laufzeit-Assert. Verwandte Klasse:
zwei RLS-Bedingungen, die dieselben Faelle abdecken (0710).

### Ein Pruefer darf gesetzlich festgelegten Text nicht anmahnen
Beim Erweitern von `anrede-check.py` schlug er im **Muster-Widerrufsformular**
an („Hiermit widerrufe ich …", Anlage 2 zu Art. 246a EGBGB). Dessen Wortlaut
ist vorgeschrieben — ein Pruefer, der ihn aendern will, verlangt einen
Rechtsverstoss. **Regel:** Vor jedem Textpruefer die gesetzlich fixierten
Stellen ausnehmen und den Grund danebenschreiben, sonst „korrigiert" sie
irgendwann jemand.

### Grenzen eines Pruefers hinschreiben, sonst vertraut man ihm zu viel
`anrede-check.py` faengt Rueckfaelle bei BEKANNTEN Formen; er beweist nicht die
Abwesenheit. Der Du-Imperativ traegt kein Pronomen, und die Sie-Form ist
dieselbe Wurzel plus Endung. Eine morphologische Regel wurde versucht und
**gemessen: 443 Treffer, fast alle Fehlalarme**. Steht jetzt im Kopf des
Skripts. Ich hatte ihm zweimal zu viel zugetraut und daraufhin in einem
PR-Text etwas Falsches behauptet.

### Der Pflicht-Zahlenabgleich in run.sh hat sich zum zweiten Mal bezahlt
Beim Strike-Umbau fiel die Assertion-Zahl auf 137 statt 139. Kein Test war rot
— zwei waren still verschwunden. **Nie** die erwartete Zahl „passend machen",
ohne die Differenz erklaert zu haben.

## Session 2026-09-07 — Rechte standen auf „erlaubt", und drei Fallen beim Härten

### `revoke … from authenticated` wirkt NICHT
Das Ausführungsrecht kommt über `PUBLIC` — PostgreSQL vergibt bei **jeder** neu
angelegten Funktion `EXECUTE` an `PUBLIC`, unabhängig von jedem
`alter default privileges`. Ein Widerruf gegen die Rolle lässt das unberührt.
Immer `revoke execute on function … from public, anon, authenticated`, und
danach `grant … to service_role` (der Widerruf gegen PUBLIC nimmt es mit).

### `revoke … on all functions in schema public` ist zu grob
Trifft uuid-ossp, pgcrypto, dblink — und `uuid_generate_v4()` steckt in
Spalten-Vorgaben. Ergebnis: jedes Einfügen durch einen Angemeldeten scheitert
mit „permission denied for function uuid_generate_v4". Schleife benutzen, die
Erweiterungen auslässt:
```sql
where not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
```

### RLS-Policies laufen mit den Rechten des Aufrufers, Trigger nicht
Eine Policy, die eine Funktion ruft, braucht für den Aufrufer ein
Ausführungsrecht. Trigger-Funktionen brauchen keines (PostgreSQL prüft es beim
Auslösen nicht). Die Angebots-Policy rief `aktive_strikes()` — nach einem
Widerruf hätte **kein Anbieter mehr bieten können**. Vor jedem Rechte-Entzug:
`grep -rn "<funktion>" supabase/migrations/ | grep -i policy`.

### Ein Argument, das man weglassen kann, ist besser als eines, das man prüft
`aktive_strikes(p_provider)` war für jeden Angemeldeten aufrufbar und lieferte
die Verstöße **jedes** Anbieters. Ersetzt durch `meine_aktiven_strikes()` ohne
Argument: was nicht übergeben werden kann, kann auch nicht auf einen Fremden
zeigen. Bei jeder SECURITY-DEFINER-Funktion für Nutzer zuerst fragen, ob das
Argument überhaupt nötig ist.

### SECURITY DEFINER hebelt die RLS-Policy der Tabelle aus
Die Einschränkung muss **in der Funktion** stehen (`and betroffener =
auth.uid()`), nicht in der Policy. Nachgehalten in `scripts/db-test/rechte.sql`
(RA). Die Gegenrichtung (RC: die Client-Funktionen sind erreichbar) ist
Pflicht — sonst ist „alles sperren" der einfachste grüne Haken.

### Migrationen: zweiter Lauf ist Pflicht, ab 0380 mechanisch geprüft
Eingespielt wird von Hand im SQL-Editor; nach einem Abbruch fügt man denselben
Block erneut ein. `drop policy if exists` vor jedem `create policy`,
`drop function if exists` wenn sich der Rückgabetyp ändert,
`comment on function` **mit Argumentliste**, sobald es mehrere Signaturen gibt.
Zwölf Migrationen vor 0380 sind bewusst ausgenommen (in Produktion eingespielt).

### Migrationen und Edge Functions rollen sich SELBST aus
Nicht über einen Workflow, sondern über die **Supabase-GitHub-Integration**
(sichtbar als Prüfung „Supabase Preview" an jedem PR). Push auf `main` spielt
Migrationen **und** Edge Functions ein.

**Am 07.09. habe ich das Gegenteil behauptet**, weil ich in
`.github/workflows/` keinen Deploy-Workflow fand — und dem Founder daraufhin
gesagt, er müsse Migrationen von Hand in den SQL-Editor einfügen. Am 08.09.
gegen die Produktion nachgemessen: alles aus PR #188 und #189 war längst live.

**Aus „ich finde keinen Workflow" folgt nicht „es passiert nichts".** Zwei
`curl`-Aufrufe gegen die Produktion hätten den Irrweg gespart:
```bash
curl -s -o /dev/null -w "%{http_code}" -X POST \
  "$SB/functions/v1/<function>" -H "Content-Type: application/json" -d '{}'
# 404 NOT_FOUND = nicht ausgerollt · 400/405 = ausgerollt
curl -s "$SB/rest/v1/<tabelle>?select=id&limit=1" -H "apikey: $ANON"
# 404 PGRST205 = Tabelle fehlt · 200 [] = Migration ist durch
```
`deploy-supabase.yml` bleibt als Rückfallweg von Hand, nicht als der Weg.

### Rechtsstand — nicht neu herleiten
- **KI-VO nicht einschlägig** (kein KI-System im Produkt). `ki-einsatz-check.py`
  weckt, wenn sich das ändert.
- **DSA einschlägig**, Kleinstunternehmen: verbindlich sind Art. 11, 12, 14, 16,
  17, 18, 24 Abs. 3 — alle umgesetzt. **Kein Art. 20, kein Art. 21** versprechen.
- **BFSG**: § 3 Abs. 3 nimmt Kleinstunternehmen bei Dienstleistungen aus.
  Barrierefrei wird trotzdem gebaut.
- **ZAG offen**, strafrechtliches Risiko. Drei ausformulierte Fragen in
  `docs/recht/ki-vo-und-bfsg.md` §4.

### Store: eine Berechtigung ohne Funktion ist eine Ablehnung
`app.json` forderte Kamera, Mikrofon, Fotomediathek und präzisen Standort ohne
jede zugehörige Abhängigkeit. `scripts/berechtigungen-check.py` prüft das;
`--gate` sperrt zusätzlich bei offenen Founder-Punkten (EAS-Kennung,
`LEGAL_PLACEHOLDER`).

## Session 2026-09-08 — Lange Prüf-Skripte mit Hintergrundserver sterben hier

Zweimal Exit 144 an einem Abend, beim Versuch, eine Mutationsprobe als EIN
Skript zu fahren (Export -> Server -> Prüfer -> mutieren -> Export -> Prüfer ->
zurücksetzen).

**Lauf 1** starb am `pkill -f "scripts/spa-server.py"` in einer Funktion — die
seit dem 15.08. dokumentierte Falle. Nichts blieb liegen (Abbruch vor der
ersten Mutation).

**Lauf 2** hatte KEIN `pkill` mehr (Server gezielt über die PID beendet) und
starb trotzdem mit 144 — mitten in Schritt B, **nach** der Mutation und **vor**
dem Zurücksetzen. Die Mutation stand danach im Arbeitsbaum: `minWidth: 0` und
`adjustsFontSizeToFit` waren aus `app/betrieb/auftraege.tsx` verschwunden.

Die Ursache ist also NICHT allein `pkill`. Lange Ketten mit einem
Hintergrundserver überleben in dieser Umgebung nicht zuverlässig.

**Regel:** Mutationsproben mit Export und Server NIE als ein Skript. Jeder
Schritt ein eigener Bash-Aufruf:
```
1) export            2) Server starten        3) Prüfer laufen lassen
4) mutieren          5) export                6) Prüfer laufen lassen
7) git checkout --   8) git status prüfen
```

### Ein „failed" im Hintergrund heißt NICHT, dass das Skript steht

Der gefährlichste Teil kam danach. Beide Läufe wurden als
`failed with exit code 144` gemeldet — und liefen **trotzdem weiter**:

```
25252 bash /tmp/beweis.sh
25619 bash /tmp/beweis2.sh
26959 node scripts/rand-ueberstand-check.cjs
27027 node scripts/rand-ueberstand-check.cjs
```

Die Meldung betrifft die Hülle, nicht die Kindprozesse. Folgen an diesem Abend:

- Ein späterer `npx expo export` schlug mit
  `ENOENT: chmod '/home/user/Ruflo/dist/index.html'` fehl, weil ein
  Parallel-Lauf `dist/` unter ihm neu anlegte.
- `scripts/lib/anbieter-sitzung.cjs` wurde **nach** meiner Kontrolle noch
  mutiert (`if (false)` statt der profiles-Weiche). Meine Prüfung „ist etwas
  liegengeblieben?" war zu diesem Zeitpunkt korrekt und trotzdem wertlos.

**Regel:** Nach einem gemeldeten Abbruch eines Hintergrundlaufs IMMER erst

```bash
ps aux | grep -E "[s]pa-server|[e]xpo export|[r]and-ueberstand|[g]eldwege|[a]lle-screens"
```

und die gefundenen PIDs gezielt `kill`en — **dann** `git status`, **dann**
weiterarbeiten. Ohne diesen Schritt misst man gegen ein `dist/`, das jemand
anders gerade schreibt, und prüft einen Arbeitsbaum, der sich noch ändert.

**`spa-server` gehört ins Muster.** Beim ersten Aufräumen hatte ich ihn
vergessen; ein alter Server hielt danach Port 8744 besetzt, hatte aber durch
den `dist/`-Neuaufbau sein Arbeitsverzeichnis verloren. Der neue Server konnte
nicht starten (`OSError: Address already in use`), der alte lieferte nichts
(`curl` → 000). Symptom: „Server: 000" bei laufendem Prozess.

**Und nach JEDEM abgebrochenen Prüflauf:**
```bash
git status --short
grep -c "<die mutierte Stelle>" <datei>
```
Zurückgesetzt wird mit `git checkout -- <datei>`, nicht aus einer /tmp-Kopie —
die kann genauso alt oder genauso mutiert sein. Am 15.08. fehlte danach
`persistDraft()`, am 08.09. `minWidth: 0`. Beide Male hätte ein Commit den
Fehler eingebaut, den die Änderung gerade beheben sollte.

## Prüfer sehen den Anbieterbereich nur mit Sitzungs-Ersatz

`app/betrieb/*` hängt an Anmeldung UND Anbieter-Rolle. Ein blosses
`ctx.route(… supabase.co …, r => r.abort())` reicht NICHT: `getSession()` liest
aus dem localStorage, die **Rolle** holt `AuthContext` über das Netz und fällt
nach 4 s auf `null` — dann leitet `betrieb/_layout` weg, und der Prüfer misst
eine Anmeldeseite statt des Bildschirms.

`scripts/lib/anbieter-sitzung.cjs` → `alsAnbieter(ctx)` beantwortet die zwei
Abfragen, die über das Rendern entscheiden (`/auth/v1/*`, `/rest/v1/profiles`),
und gibt sonst leere Listen zurück. Damit misst `rand-ueberstand-check.cjs`
jetzt 17 statt 9 Bildschirme (51 statt 27 Messungen).

**Grenze:** Geometrie-Prüfstand, kein Datentest. Die Bildschirme rendern mit
LEEREN Listen; ein Layoutfehler, der erst bei vielen oder langen Datensätzen
auftritt, fällt dort nicht auf.

**Gegenprobe C ist Pflicht:** Sitzungs-Ersatz abschalten und prüfen, dass die
Anbieter-Bildschirme dann NICHT mehr durchkommen. Sonst meldet der Prüfer 51
grüne Messungen, von denen 24 auf einer Weiterleitung zur Anmeldung landen.

## Session 2026-09-08 (abends) — Gedankenstriche, und was ein Prüfer sich selbst antut

### Eine Stilanweisung des Founders gilt für die APP, nicht nur für meine Antworten
Am 07.09. hieß es „keine „-" sehen". Ich befolgte es in meinen Antworten und
ließ die Texte der App unberührt: **309 Gedankenstriche in sichtbarem Text**,
25 auf der Startseite, von der am 08.09. fünf Bildschirmfotos kamen. Dieselbe
Klasse wie „grüne Haken, die nichts prüfen": die Zusage gilt dort, wo sie
leicht ist.
**Regel:** Bei jeder Stil- oder Ton-Anweisung sofort messen, wie oft die
Abweichung im Produkt vorkommt — nicht nur im eigenen Schreiben.

### Ersetzung nach Bedeutung, nicht per sed
`—` → Komma (Nachtrag), Doppelpunkt (Aufzählung), Punkt (zwei Aussagen), `·`
(Beschriftung mit zwei Angaben). Platzhalter `'—'` für fehlende Werte → `'…'`.
Deutscher Gedankenstrich ist ohnehin `–`, nicht `—`; der Code hatte durchgängig
den englischen.

### Ein Prüfer, der seine eigene Ersetzung meldet
`AUSDRUCK.sub(' ', kette)` machte aus `${a}-${b}` ein ` - ` und schlug dann an.
**Acht Fehlalarme aus einem Leerzeichen.** Beim Wegschneiden von Code aus Text
immer mit **Leerstring** ersetzen, nie mit Leerzeichen — sonst entsteht genau
das Muster, nach dem gesucht wird.
Zweiter Fehler derselben Sorte: `ohne_console()` verschluckte Zeilenumbrüche,
Befunde zeigten auf die falsche Zeile. Wer Text entfernt, muss die
Zeilenstruktur erhalten.

### Textauszug liegt jetzt an EINER Stelle
`scripts/sichtbarer_text.py` (`zeichenketten_und_resttext`, `sichtbarer_text_tsx`,
`ohne_console`). Genutzt von `ton-check.py` und `gedankenstrich-check.py`.
Zwei Kopien desselben Auszugs heißt, eine sieht irgendwann an einer
Fehlerklasse vorbei.
Der Auszug trennt Zeichenketten sauber vom Code, den **Resttext** zwischen den
JSX-Marken aber nicht. Nach Satzzeichen, die auch in Code vorkommen (Minus,
Doppelpunkt), deshalb NUR in Zeichenketten suchen — sonst meldet jede Rechnung.

### Neuer Prüfer
`python3 scripts/gedankenstrich-check.py` (CI + `scripts/reisen/run.sh`).
Prüft nicht: Quelltext-Kommentare, `console.*` in Edge Functions.

## Session 2026-09-08 (später) — Deutsche Mehrzahl, tote Knöpfe, eingefrorene Daten

### Deutsche Mehrzahl NIE zusammensetzen
`Auftrag${n === 1 ? '' : 'e'}` ergibt „Auftrage". Der Umlaut lässt sich nicht
anhängen, und das Verb bleibt dabei auch stehen. `lib/mengenText.ts`
(`anzahlText(n, einzahl, mehrzahl)`) schreibt beide Formen aus.
Geprüft: `Monat/Monaten`, `Angebot/Angebote`, `Termin/Termine` sind richtig
(glattes -e/-en, Zahl nie 0). Trotzdem gilt für JEDE neue Stelle: beide Formen
hinschreiben.

### Ein Symbol, das aussieht wie ein Knopf, MUSS einer sein
Das ⓘ neben „Netto nach 8% Plattformgebühr" war Zierde. Dieselbe Klasse wie ein
Knopf ohne `onPress`. Wer ein Info-Symbol setzt, hinterlegt die Erklärung und
gibt ihm 44 px.

### `useMemo` friert `new Date()` ein, und Reiter-Bildschirme bleiben eingehängt
`useMemo(() => getWeekDays(versatz), [versatz])` mit `new Date()` INNEN: das
Datum ist das vom ersten Öffnen. In expo-router bleiben Reiter-Screens
dauerhaft gemountet, also über Tage. Muster: den Tag als **Anker im State**
halten, beim Fokus nachziehen, und alle Datumsrechnungen `heute` als Parameter
übergeben (`lib/kalenderWoche.ts`).
Der Anker gehört ZUSÄTZLICH in ein `useRef`, wenn der Fokus-Effekt an etwas
anderem hängt — sonst liest er beim nächsten Fokus den alten Wert und setzt die
Ansicht jedes Mal zurück.

### Hinweise mit Folgen gehören nur an den, den die Folge trifft
`kontaktHinweis(text, binIchDerAbsender)`: die Strike-Regel sieht der Absender,
nicht der Empfänger. Eine Strafandrohung an den Falschen ist schlimmer als
keine.

### `git checkout --` ist KEIN Zurücksetzen für Mutationsproben
Nur für Dateien, die in git sind UND außer der Mutation nichts Ungespeichertes
tragen. Sonst nimmt es die Arbeit mit. Zurücksetzen mit der Gegenersetzung.

## Session 2026-09-15 — Die Gegenersetzung, die zu viel traf

Beim Mutationsprüfen von `scripts/ranking-check.py` ersetzte die Probe
`.order('rating_avg', { ascending: false })` durch `.limit(5)`. Zurückgesetzt
wurde per Gegenersetzung: `.limit(5)` → die order-Zeile. `str.replace` in Python
ersetzt aber ALLE Vorkommen, und `.limit(5)` stand zweimal in
`app/(tabs)/index.tsx`. Ergebnis: **beide** `.limit(5)` wurden zur order-Zeile,
die Begrenzung auf fünf Karten war aus beiden Abfragen verschwunden.

Die Zusicherung des Rücksetzers (`alt in text`) blieb dabei **grün** — der Text
war ja da, nur zu oft. Dieselbe Klasse wie alles andere: eine Prüfung, die den
Fehler nicht sehen kann, den sie verhindern soll. Gefunden nur, weil danach
`git diff --stat` lief und zwei Dateien statt einer meldete.

**Regel für Mutationsproben:**
- Nicht per Gegenersetzung zurücksetzen, sondern den **vorherigen Wortlaut der
  ganzen Datei** wegschreiben und danach auf Gleichheit prüfen
  (`assert neu == orig`), nicht auf Enthaltensein.
- Die Mutation selbst mit `replace(alt, neu, 1)` setzen, nie unbegrenzt.
- Nach JEDER Probenreihe `git diff --stat` — erwartet wird genau die Datei, an
  der man wirklich arbeitet.
- Ein Rücksetzen per `git checkout --` geht nur bei Dateien, die außer der
  Mutation nichts Ungespeichertes tragen. Hier war `app/agb.tsx` die
  Arbeitsdatei (ungespeichert) und `app/(tabs)/index.tsx` sauber — für die eine
  also verboten, für die andere richtig.

**Und: ein Prüfer braucht Gegenproben, nicht nur Mutationen.** Drei Mutationen
wurden rot, aber erst zwei harmlose Umformulierungen (eine im AGB-Text, eine im
Code) bewiesen, dass er nicht bei jeder Berührung anschlägt. Ein Prüfer mit
Fehlalarmen wird abgeschaltet und nie wieder an.

## Session 2026-09-16 (Nacht) — Was ein Pruefstand ueber das Produkt luegt

Fuenf neue Browser-Reisen (Geldweg, Vertrag, Abnahme, Pruef-Postfach, DSA).
Drei Mal sah ein Produktfehler aus, was in Wirklichkeit mein Pruefstand war.
Die Reihenfolge der Diagnose ist die Lehre.

### `.single()` und `.maybeSingle()` erwarten ein OBJEKT, keine Liste
Sie schicken `Accept: application/vnd.pgrst.object+json`. Antwortet der
Pruefstand mit `[zeile]`, wirft supabase-js, der Bildschirm bleibt leer oder
meldet einen Fehler. Am 16.09. sind daran zwei Zusicherungen gescheitert: der
Auftrag lud nicht (`jobs`, `.single()`) und das Angebotsformular meldete
„Verifizierung fehlt" (`provider_profiles`, `.maybeSingle()`). Die Regel
gehoert in die `json`-Hilfsfunktion selbst, nicht in einen einzelnen Zweig.

### Spaltennamen nachsehen, nicht raten
`contracts` hat `price_gross`, `customer_total`, `provider_payout` — **kein**
`price`. Vorgabedaten mit `price: 320` ergaben ueberall 0,00 €. Ebenso:
`kyc_submitted_at`, nicht `eingereicht_am`. Und `contracts?select=*,job:jobs!
job_id(...)` ist ein eingebetteter Verbund: ohne das Unterobjekt steht
„Dienstleistung" statt des Titels da.
**Drei Faelle in einer Nacht.** Im Schema nachsehen kostet einen Grep.

### Feste Antworten des Pruefstands muessen ueberschreibbar sein
Standen `profiles`/`provider_profiles`/`provider_public` VOR den
Vorgabedaten, liess sich der Anbieter eines Vertrags nicht setzen, und der
Freigabe-Bildschirm zeigte „Anbieter" statt eines Namens. Vorgabedaten zuerst.

### Der Geldweg laeuft ueber `/functions/v1/`, nicht ueber `/rest/v1/`
Ein Aufruf-Protokoll, das nur REST mitschreibt, sieht von Zahlung, Freigabe
und Stornierung genau **nichts**. `create-payment-intent`, `release-escrow`,
`cancel-contract` sind Edge Functions.

### react-native-web: den Handler traegt der AUSSERE Knopf
`getByText('Angebot senden').click()` trifft den Text, nicht den Knopf, und
loest nichts aus. Ueber `[role="button"]:visible` mit `filter({ hasText })`
greifen. Das geht erst, seit die Rollen gesetzt sind — und genau beim Suchen
danach fiel auf, dass 198 von 326 Beruehrflaechen keine hatten.

### Eine Rolle macht `disabled` echt, und das bricht alte Tests
Ohne `accessibilityRole` rendert rn-web ein `<div>`; `disabled` ist darin nur
Optik, und Playwright klickt froehlich. Mit Rolle entsteht ein echtes
Knopf-Element, `disabled` steht im DOM, und Playwright verweigert den Klick.
Reise 1 lief danach in einen Timeout. **Das ist kein Rueckschritt, sondern der
Beleg**: die Sperre ist jetzt fuer eine Bedienungshilfe erkennbar. Solche
Tests pruefen danach BEIDES, die Auszeichnung und die Wirkung.

### Ein Knopf ohne `disabled`, aber mit `onPress={undefined}`
Dieselbe Klasse andersherum: fuer das Auge blass, fuer den Screenreader ein
gewoehnlicher Knopf, der wortlos nichts tut. Wenn ein Knopf gesperrt ist,
gehoert `disabled` hin — und ein Satz, der sagt, was noch fehlt.

### Wo ein Pruefer nicht hinsieht, ueberlebt alles
`fachwort-check.py` las nur `*.tsx` unter `app/` und `components/`. „Escrow"
ueberlebte in `lib/chatGuard.ts`, in einem Satz, den ein Kunde liest.
`versprechen-check.py`, `ton-check.py` und `gedankenstrich-check.py` lasen
die ausgelieferten HTML-Dateien im Wurzelverzeichnis nie — dort stand die
Haftpflicht-Zusage noch, oeffentlich unter `/demo`.
**Regel:** Bei jedem Textpruefer zuerst fragen, WELCHE Dateien ein Nutzer
liest, nicht welche Endung gerade bequem ist.

### Ein Beleg, der mehrfach vorkommt, haelt nichts fest
`interval '12 months'` stand dreimal in derselben Migration. Die Mutation
„Verfallsdatum entfernt" blieb gruen. Verwandte Klasse: zwei RLS-Bedingungen,
die dieselben Faelle abdecken (0710). Belege muessen EINDEUTIG sein.

### Die Mutationsprobe selbst ist Code und hat Fehler
Ein `dict` nach Pfad, zwei Aenderungen an derselben Datei: der zweite Eintrag
ueberschrieb den gemerkten Wortlaut mit der bereits mutierten Fassung, und der
Ruecksetzer schrieb die Mutation zurueck. Pro Pfad genau EINMAL merken, und
nach jeder Probenreihe `git diff --stat`.
Sicherer Ablauf bei Mutationen an App-Code: `git add -A` (Arbeit in den
Index), dann mutieren, dann `git checkout -- <datei>` — das setzt auf den
Index zurueck, also auf die eigene Arbeit, nicht auf HEAD.

### `| tail; echo $?` misst tail
Zum zweiten Mal hineingelaufen (14.09. und 16.09.). Rueckgabewerte ohne Pipe
messen: `python3 skript.py >/dev/null 2>&1; echo $?`.

## Session 2026-09-16 (Morgen) — der Pruefstand selbst hat gelogen

### Ein Trennzeichen, das im Text vorkommt, ist kein Trennzeichen
`scripts/reisen/run.sh` trennte Beschriftung und Befehl am ERSTEN Doppelpunkt.
„Kern-Reise 4 (Geldweg: Angebot und Annahme)" hat selbst einen — der Befehl
wurde zu `Angebot und Annahme):node …` und brach mit einem Syntaxfehler ab.
**Reise 4 ist seit ihrer Entstehung nie gelaufen**, wurde aber im Bericht als
Abdeckung des Geldwegs genannt.
Der Laeufer meldete am Ende `447 PASS, 0 FAIL` UND `Exit 1`. Beide Zahlen
stimmten; die eine Zeile Syntaxfehler ging zwischen 700 Zeilen Ausgabe unter.
**Regeln:** Trennzeichen nehmen, das in keiner Beschriftung vorkommen kann
(`|`). Vor jedem Aufruf pruefen, dass die Zieldatei existiert — ein Befehl,
der nicht startet, ist kein bestandener Test. Und den Rueckgabewert der
Suite lesen, nicht die PASS-Zahl.

### Zwei Bedingungen, die denselben Fall abdecken — jetzt mit Nachweis
Bei 0930 blieben ZWEI Mutationen gruen, weil je eine zweite Bedingung denselben
Fall abfing:
- Trigger „eine Antwort laesst sich nicht aendern": die Policy faengt das fuer
  Angemeldete schon ab. Nachweisbar erst ueber `service_role` (BYPASSRLS, der
  Weg der Edge Functions) — Test BA10.
- `with check (auth.uid() = reviewed_id)`: unter dem `using` UNERREICHBAR.
  `with check (true)` blieb in der ganzen Suite gruen. Bleibt stehen als
  Absicherung, falls das Spaltenrecht spaeter weiter wird; Grund und Grenze
  stehen IN der Migration.

### Glatte Testfaelle verbergen Rundungsfehler
`Math.ceil` -> `Math.floor` blieb gruen: alle Fristfaelle gingen glatt auf
(14, 7, exakt 0). Erst ein angebrochener Tag (6,5 vorbei, 7,5 uebrig) macht den
Unterschied sichtbar. **Bei jeder Rundung einen Fall mit Rest pruefen.**

### Ein Test, der die Implementierung abschreibt, prueft nichts
`bewertungsschnitt.test.ts` hatte die Schleife aus `lib/reviews.ts` kopiert und
sich mit sich selbst verglichen. Die echte Funktion war nicht aufrufbar, weil
`lib/reviews.ts` ueber `./supabase` Expo-Module nachzieht, die Jest nicht
uebersetzt. **Loesung: reine Rechenregel in eine eigene Datei OHNE Netz-Import
(`lib/bewertungsschnitt.ts`), dann importiert der Test das Echte.** Wenn eine
Funktion im Test nicht importierbar ist, ist das ein Grund zum Aufteilen, kein
Grund zum Abschreiben.

### Ein Eingang ohne Wirkung ist ein Knopf ohne onPress
Die Gegenbewertung schrieb eine Bewertung ueber einen Kunden, die NIEMAND je
sah (`rating_avg` gibt es nur fuer Anbieter). Deshalb `lib/bewertungsschnitt.ts`
+ Anzeige auf den Auftragskarten des Betriebs. **Bei jedem neuen Schreibweg
zuerst fragen: wer liest das Ergebnis, und auf welchem Bildschirm?**

### Der Pruefstand muss zeigen, was er messen soll
`provider_public` im Stub meldete `rating_count: 37`, `/rest/v1/reviews` fiel
aber auf `[]` durch — der Bildschirm zeigte „Noch keine Bewertungen", und keine
einzige Bewertungskarte wurde je vermessen. Mit zwei Vorgabe-Bewertungen (eine
beantwortet, eine offen) misst `rand-ueberstand-check.cjs` jetzt 54 statt 51
Stellen, darunter die Antwortzeile aus Eingabefeld und zwei Knoepfen bei 360 px.

### Ein Pruefer, der einen Reiter nie antippt, sieht die Haelfte nicht
`/betrieb/auftraege` oeffnet auf „Anfragen"; die Auftragskarten liegen hinter
drei anderen Reitern. `rand-ueberstand-check.cjs` hat jetzt ein DRITTES Feld je
Bildschirm: eine Beschriftung, die nach dem Laden angetippt wird (63 statt 54
Messungen). Dazu Vorgabe-Vertraege im Stub — ohne Daten ist auch der richtige
Reiter leer.

### Eine Vorsichtsmassnahme ohne Messwert gehoert wieder raus
`numberOfLines={1}` + `flexShrink: 1, minWidth: 0` fuer einen Kundennamen in
einer `space-between`-Zeile: klang nach der dokumentierten Falle, war aber
keine. Bei 360 px mit einem sehr langen Namen bricht der Text um, das Abzeichen
bleibt im Rahmen, und die Mutation „Stil wieder entfernt" blieb gruen. Wieder
entfernt. **`minWidth: 0` ist noetig, wenn ein Kind NICHT umbrechen darf** (ein
Eingabefeld, eine Kachel) — nicht bei jedem Text neben einem Abzeichen.

## Session 2026-09-16 (mittags) — sechs Founder-Befunde am Geraet

Alle sechs echt. Vier davon konnte KEIN bestehender Pruefer sehen.

### `Alert.alert` aus react-native wirkt im Web NICHT
Zwei Kalender-Knoepfe („Woche freigeben", „Woche sperren") taten nachweislich
nichts, seit es sie gibt. react-native-web implementiert `Alert` nicht; der
Aufruf laeuft still ins Leere. `tsc` ist zufrieden (die API existiert
typseitig), Jest rendert den Bildschirm nicht, und die Browser-Reisen tippen
im Anbieter-Kalender keine Knoepfe.
`lib/alert.ts` (`showAlert`) gab es seit Monaten und war an zwei Stellen nicht
benutzt. Neuer Pruefer: `scripts/web-untaugliche-api-check.py` (CI + run.sh).
**Beim Anlegen des Pruefers selbst hineingelaufen:** die Zusicherung
`'Alert.alert' not in s` schlug an meinem EIGENEN Kommentar an. Wer nach einem
Muster sucht, darf es nicht danebenschreiben -- der Pruefer uebergeht
Kommentarzeilen jetzt ausdruecklich.

### Zwei Zahlen untereinander, zwei Regeln, keine Zuordnung
Im Anbieterprofil standen direkt untereinander:
„40,00/h marktueblich. Sie liegen darunter, gespeichert wird es trotzdem."
„Unter 13,00/h nimmt Werkant keinen Satz an."
Gelesen ergibt das einen Widerspruch. In Wahrheit ist das eine eine
EMPFEHLUNG und das andere eine SPERRE. Die Mechanik war korrekt (`satzFehler`
weist unter 13 ab) -- nur sagte kein Satz, welcher welcher ist.
**Regel:** stehen zwei Zahlen mit verschiedenen Folgen nebeneinander, muss
jeder Satz seine Art benennen („Empfehlung:" / „Feste Untergrenze:").

### Ein Prozentsatz ohne Bezugsgroesse ist keine Preisangabe
„8 % Provision, mindestens 3 €, erst nach Abschluss." stand als LITERAL im
Bildschirm -- wovon die 8 % sind und wer sie zahlt, stand nirgends. Jetzt
`provisionLang()` in `lib/preisHinweis.ts`, aus `feeEngine` hergeleitet.

### Ein Wertvergleich beweist die Bindung NICHT (zum zweiten Mal)
Die Jest-Tests „nennt den Satz aus der Gebuehrenquelle" blieben bei BEIDEN
Literal-Mutationen gruen -- `PROVIDER_COMMISSION_RATE * 100` ist derselbe Text
wie „8". Dieselbe Klasse wie `COMPANY.email` gegen `MAIL.kontakt` (16.08.).
Die Herkunft prueft jetzt `scripts/agb-code-check.py` ueber den Quelltext
(`prozent\(PROVIDER_COMMISSION_RATE\)`); dort werden beide Mutationen rot.
Die Testnamen sind auf „nennt DENSELBEN Satz wie" korrigiert, mit der Grenze
im Kommentar.

### Ein Banner am Listenende gilt gefuehlt fuer die Kacheln darueber
Der Meisterpflicht-Hinweis stand NACH dem ganzen Raster, also unter
„Umzugshilfe" und „Waesche & Buegeln", und sagte „fuer dieses Gewerk", ohne
eines zu nennen. Umzugshilfe ist korrekt NICHT meisterpflichtig -- der Fehler
lag allein in der Zuordnung. Der Banner nennt das Gewerk jetzt beim Namen und
sagt ausdruecklich, dass es fuer die anderen nicht gilt.

### Zwei Zeilen mit fast gleichem Namen fuer zwei verschiedene Dinge
„Gewerbenachweis · Pruefung ausstehend" (`kycVerified`) und „Gewerbeschein ·
ausstehend" (`meisterVerified`) standen untereinander. Die zweite zeigte in
Wahrheit den MEISTERBRIEF -- und stand auch bei einem Gaertner da, der nie
einen braucht. Jetzt „Identitaet und Gewerbeschein" bzw. „Meisterbrief", und
letzteres nur bei meisterpflichtigen Gewerken.

### Der Gedankenstrich lebte in den DATEN weiter
Im Chat stand „Angebot angenommen — Auftrag ist beauftragt." Der Wortlaut kam
aus 0530; Migration 0830 hatte ihn im CODE laengst ersetzt, aber die vorher
geschriebenen Zeilen stehen unveraendert in `messages`.
**`gedankenstrich-check.py` liest Quelldateien. Was einmal in der Datenbank
steht, sieht er nie.** Dieselbe Klasse wie die ausgelieferten HTML-Dateien.
Bereinigt in 0940. **Bei jeder Textregel mitdenken: gibt es den Text auch als
gespeicherten Datensatz?**

### „Einreichen" verwies auf eine E-Mail, obwohl der Weg gebaut war
Der Gewerbeschein-Knopf zeigte nur `toast.info('Senden Sie ... an <Adresse>')`.
Der vollstaendige Workflow existierte laengst: Upload in
`app/onboarding-kyc.tsx` -> `gewerbeschein_path`, Pruef-Postfach unter
`/pruefung`, Entscheidung mit Begruendung in `bewerbung-abgelehnt.tsx`
(P2B Art. 4). Es fuehrte nur kein Knopf hinein.
**Vor jedem „das fehlt noch" erst suchen, ob es schon da ist und nur nicht
verdrahtet.**

## Session 2026-09-16 (nachmittags) — „Also ist das jetzt perfekt?"

Die Frage war berechtigt. Beim Nachmessen kam ein zweiter Fehler derselben
Klasse heraus, und zwar an einer schlimmeren Stelle.

### Einen Fix fuer „der Knopf tut nichts" abzusichern, ohne den Knopf zu
### druecken, ist kein Nachweis
Der Kalender-Fix vom Mittag war mit tsc, Jest und einem Quelltext-Pruefer
belegt. Keines davon beantwortet die Frage des Founders: TUT DER KNOPF JETZT
ETWAS? Ein Quelltext-Pruefer sieht, dass die richtige Funktion aufgerufen
wird, nicht dass am Ende ein Schreibvorgang herauskommt.
`scripts/reisen/reise9-kalender.cjs` tippt die Knoepfe an und misst die
Schreibaufrufe. Gegengeprueft mit zurueckgenommenem Fix: B1 wird rot.
**Pflicht-Gegenprobe C2: Abbrechen darf NICHTS schreiben** -- sonst waere ein
Pruefer gruen, der jeden Klick als Erfolg zaehlt.

### `Share.share` ist dieselbe Falle wie `Alert.alert`
GEMESSEN (nicht vermutet): im Pruefstand-Browser ist `navigator.share`
`undefined`, und react-native-web wirft
`Error: Share is not supported in this browser`.
`app/widerruf.tsx` hatte KEINE Web-Weiche und KEIN catch: das Formular
vollstaendig ausgefuellt, „Widerruf erklaeren" getippt -- und NICHTS
passierte. Kein Formular, keine Meldung, kein Erfolgsbildschirm. Das ist der
gesetzliche Widerrufsweg (§ 355 BGB, Art. 246a EGBGB).
Ebenfalls betroffen: `rechnung.tsx` (kein catch), `anbieter.tsx` (catch
vorhanden, Knopf tat aber still nichts).
`app/einstellungen.tsx` hatte das richtige Muster laengst -- an EINER Stelle.
Zusammengefuehrt in `lib/teilen.ts` (`teileText`): Share wo es das gibt,
sonst Download, mit Rueckgabewert statt Erfolgsbehauptung.

### Wer nur `input` fuellt, betritt den Fehlerweg nie
Meine erste Probe fuellte zwei `input` und meldete „kein Fehler". Die
Anschrift ist `multiline` und rendert als `<textarea>` -- sie blieb leer, die
Pflichtfeld-Pruefung griff, und `Share.share` wurde nie erreicht.
**Bei jeder Formular-Probe `input:visible, textarea:visible` greifen und die
Feldzahl zusichern** (D1 prueft „mindestens drei Felder"), sonst misst man den
Validierungszweig und haelt ihn fuer den Hauptweg.

### Ein Test, der auch im kaputten Zustand gruen bleibt, prueft nichts
D5 („die Rueckmeldung nennt den Weg") blieb in der Gegenprobe GRUEN, weil
„E-Mail" auch in der Belehrung darueber steht. Jetzt wird nur der Text NACH
dem Erfolgszustand gelesen. **Jede neue Zusicherung gegen den kaputten Zustand
laufen lassen, nicht nur gegen den reparierten.**

### Playwright `hasText` ist Teilzeichenkette UND ohne Gross-/Kleinschreibung
„Freigeben" traf auch „Woche freigeben" und „Diesen Tag freigeben".
`.first()` nahm dann den Knopf im HINTERGRUND, den das offene Fenster
verdeckt -- Klick-Timeout, und der Pruefer haette einen funktionierenden Knopf
als Fehler gemeldet. Fuer Knoepfe im Fenster `^\s*Text\s*$` als Regex.
Dazu `klickeWennDa()`: ein Pruefer, der nach dem ersten Fehler 30 s haengt,
zeigt nur den ERSTEN Fehler -- die Liste danach braucht man aber beim Beheben.

## Session 2026-09-16 (abends) — der generische Knopf-Pruefer, der nicht geht

Versucht, gemessen, verworfen. Die Erkenntnis ist mehr wert als das Werkzeug.

### Ein DOM-Vergleich kann einen stummen Knopf NICHT erkennen
Die Beruehrungsanimation von `TouchableOpacity` aendert selbst schon das DOM.
GEMESSEN: ein kuenstlich auf `onPress={() => {}}` gesetzter Knopf blieb im
Vergleich des gesamten `body.innerHTML` unauffaellig.
Ein Textvergleich ist noch schlechter: die erste Fassung meldete 34 angeblich
stumme Knoepfe, praktisch alle Fehlalarme -- ein Auswahl-Chip aendert eine
Markierung, keinen Text.
**Fachliche Wirkung gehoert in die Reisen, wo sie benannt werden kann**
(Reise 9 misst Schreibaufrufe an `provider_availability`), nicht in einen
Pauschaltest.

### Und mein Erkundungslauf verwarf still zwei Drittel aller Knoepfe
Er griff sie ueber die BESCHRIFTUNG, und mehrzeilige Namen („Mo\n14") trafen
den Regex nicht; die Fundstelle wurde mit `continue` uebersprungen.
Gemessen: 26 Knoepfe auf `/betrieb/kalender`, angetippt wurden 2. Am Ende
stand trotzdem „0 ohne Wirkung".
**Regeln:** Elemente ueber den INDEX greifen, nie ueber den Text. Jeden
uebergangenen Fall ZAEHLEN und die Zahl ausgeben. Und eine Mindestzahl
zusichern -- sonst ist „0 Befunde" mit einer leeren Auswahl vereinbar.

### Eine Mindestzahl wird GEMESSEN, nicht geschaetzt
Erste Fassung: `MINDESTENS = 220` („etwa 300, grosszuegig nach unten"), aus
einer Stichprobe von drei Bildschirmen hochgerechnet. Der Lauf brach ab,
obwohl nichts kaputt war. Echter Wert: 154 angetippt, 8 uebergangen.
Wer eine Untergrenze raet, baut sich einen Fehlalarm ein -- und ein Pruefer
mit Fehlalarmen wird abgeschaltet.

### Was uebrig bleibt, und das ohne Fehlalarme
`scripts/knopf-fehler-check.cjs`: tippt jeden Knopf an und meldet jeden
`pageerror`. Ein Handler, der wirft, ist IMMER ein Fehler.
Gegengeprueft: ein Knopf mit werfendem Handler wird gefunden und mit
Bildschirm und Beschriftung gemeldet.
Erster Lauf ueber den echten Baum: **0 Befunde bei 154 Knoepfen** -- die
Alert- und Share-Fixes von heute halten.

### Zwei Fundstellen waren Artefakte des Pruefstands, keine Produktfehler
„Mit Apple/Google anmelden" warfen `SecurityError: Failed to read the
'localStorage' property`. GEMESSEN: nach dem Klick steht die Seite auf
`chrome-error://chromewebdata/` mit `origin: null`, weil Supabase im
Pruefstand abgeblockt ist. Im echten Browser laeuft die App nach dem Sprung
zum Anbieter gar nicht mehr.
**Regel:** Bevor ein Browser-Befund als Produktfehler gilt, die URL und den
Origin NACH der Aktion messen. Ein Fehler auf einer Fehlerseite ist keiner.

## Session 2026-09-16 (spaet) — eine Mitteilung ohne Empfaenger-Bildschirm

Keine Founder-Meldung, sondern eine Stand-Aufnahme auf die Frage „wie geht es
weiter ohne meine Themen?". Entscheidung dazu:
`notes/04-Entscheidungen/2026-09-16-prioritaet-ohne-founder-blocker.md`.

### Der Betriebsbereich hatte keinen Weg zu `/benachrichtigungen`
Fuenf Reiter, kein Eingang. Dorthin schreiben aber drei Vorgaenge, die
AUSSCHLIESSLICH Betriebe betreffen: Freigabe/Ablehnung der Verifizierung
(`functions/pruefung`), `strike_benachrichtigen()` und
`beschraenkung_benachrichtigen()` (beide 0860). Die letzten beiden schuldet
Art. 4 P2B-VO als **Uebermittlung**, nicht als Tabelleneintrag.
In der Produktion wartet ein Betrieb auf seine Freigabe (`pruef_offen: 1`),
und der Mailversand ist aus: er haette es nie erfahren.
**Regel:** Bei jedem Vorgang, der eine Mitteilung schreibt, sofort nachsehen,
auf WELCHEM Bildschirm der Empfaenger sie findet und ob er dorthin kommt.
Verwandte Klasse: „ein Eingang ohne Wirkung" (Gegenbewertung, 16.09. morgens).

### Existenz und Wirkung sind zwei verschiedene Zusicherungen
In Reise 10 blieben A1 („es gibt einen Eingang") und B1 („er nennt die Zahl")
in der Gegenprobe GRUEN, waehrend C1/C2/D1 rot wurden. Genau richtig: die
Glocke war noch da, sie fuehrte nur nirgendwohin.
**Wer nur die Existenz zusichert, misst eine Attrappe.** Beides trennen und
beides pruefen.

### Ein Zaehler darf bei einem Fehler keine Zahl erfinden
`ungeleseneMitteilungen()` gibt bei `error` 0 zurueck, nicht die Laenge der
Teilantwort. Ein Punkt an der Glocke, hinter dem nichts steht, schickt den
Betrieb auf einen leeren Bildschirm und kostet Vertrauen.

### Eine Sicherheitsgrenze wird nicht aufgeweicht, um einen Blocker zu loesen
`WERKANT_ADMIN_EMAILS` ist der einzige Weg zur Freigabe; leere Liste heisst
„niemand ist Betreiber". Verlockend war, einen zweiten Weg zu bauen, damit
der wartende Betrieb durchkommt. Wer Gewerbescheine, Steuer-IDs und Ausweise
sehen darf, wird NICHT aus Bequemlichkeit erweitert. Der Blocker bleibt beim
Founder, und das gehoert so gesagt statt umgangen.

### PostgREST-Builder sind Thenables, keine Promises
`supabase.from(...).select(...)` hat kein `.catch`. Wer das Ergebnis an eine
Funktion mit `Promise`-Signatur gibt, bekommt TS2739. Loesung: den Aufruf in
eine `async`-Funktion wickeln, nicht die Signatur auf `PromiseLike` aufweichen.

## Session 2026-09-20 (nachts) — eine Formulierung, an der ein Test hing

Beim Beheben widerspruechlicher Zeitangaben habe ich auf
`app/auftrag-abschliessen.tsx` den Satz

    „Dies kann nicht rückgängig gemacht werden."

zu „lässt sich nicht zurücknehmen" umformuliert. Gleiche Bedeutung, und
trotzdem falsch: `scripts/reisen/reise6-abnahme.cjs` (A2) prueft, ob der
Bildschirm die Freigabe als unumkehrbar benennt, und tut das ueber eine Liste
bekannter Wendungen. Der Lauf wurde rot.

**Aendern musste ich nur die Zeitangabe.** Die Umformulierung daneben war
Beiwerk, das ich mitgenommen habe, weil ich den Satz ohnehin anfasste. Genau
davor warnt die dritte Karpathy-Regel („Surgical Changes"): was nicht geaendert
werden muss, bleibt stehen.

**Regel:** Beim Umformulieren eines sichtbaren Satzes vorher pruefen, ob eine
Reise oder ein Test an seinem Wortlaut haengt:

```bash
grep -rn "<eine markante Wendung aus dem Satz>" scripts/ __tests__/
```

**Und die zweite Haelfte der Lehre, praeziser als mein erster Anlauf:** der
Fehler war nicht der Commit, sondern der BERICHT. Am 20.09. habe ich zweimal
committet und danach auf den Lauf gewartet; beim zweiten Mal war er rot, und
ich hatte dem Founder zwischendurch „bisher ohne FAIL" gemeldet.

Committen waehrend ein Lauf noch draussen ist, ist in Ordnung -- die Arbeit
soll nicht ungesichert herumliegen, und der Stop-Hook mahnt das zu Recht an.
Was NICHT in Ordnung ist: einen Zustand melden, den man nicht gemessen hat.
Solange der Lauf laeuft, heisst es „der Lauf ist noch draussen", und der
Rueckgabewert wird nachgereicht -- nie die PASS-Zahl als Ersatz.

## Session 2026-09-21 — Prüfer, die nie etwas angetippt haben

Vier Blöcke an einem Tag, und dreimal war die Ursache dieselbe: eine Prüfung
lief grün, weil sie an die fragliche Stelle gar nicht herankam.

### Ein Prüfer, der nichts antippt, sieht keine Blätter und keine Fehler
`beruehrflaeche-check` und `kontrast-check` luden einen Bildschirm und maßen,
was zu sehen war. Unsichtbar blieben damit:
- **sechs Blätter von unten und ein Filter-Schieber** (darunter das
  Einwilligungs-Blatt, der erste Bildschirm überhaupt — alle anderen Prüfer
  räumen es per `localStorage` weg),
- **sämtliche Fehler- und Leerzustände** (mit Sitzungs-Ersatz antwortet der
  Prüfstand brav, ohne ihn steht „Nicht angemeldet" da).

Ergebnis nach dem Öffnen: **38 Berührflächen unter 44x44**, darunter die drei
Zeilen im Einwilligungs-Blatt (324x23) und die drei Knöpfe auf jeder
Auftragskarte (35 hoch).

**Werkzeuge:** `scripts/lib/blatt-oeffnen.cjs` (`oeffneFolge`) für beide
Prüfer — nicht zweimal, sonst sieht eine Kopie irgendwann an einer
Fehlerklasse vorbei. Und `alsAnbieter(ctx, { fehlerBei: ['tabelle'] })` lässt
einzelne Abfragen mit 500 antworten; nur so ist ein Fehlerzustand erreichbar.

**Pflicht dabei:** nach dem letzten Antippen zählen, ob wirklich etwas
aufgegangen ist. Sonst misst der Prüfer den Bildschirm DAHINTER und meldet ihn
grün. Gegengeprobt mit einer erfundenen Beschriftung.

### Ein Fehler, der aussieht wie „da ist nichts"
`if (error || !data?.length) return []` in einer Hilfsfunktion nimmt dem
Bildschirm die Unterscheidung zwischen „es gibt nichts" und „ich weiß es
nicht". In `lib/messages.ts` stand das zweimal — und in BEIDEN aufrufenden
Bildschirmen stand im `catch` der Kommentar „Netzfehler nicht als ‚Keine
Nachrichten' tarnen". Der Fehlerzweig war seit jeher unerreichbar.

**Regel:** Eine Hilfsfunktion, die einen Fehler in einen neutralen Wert
verwandelt, muss das BEGRÜNDEN (`lib/verfuegbarkeit.ts` und
`lib/benachrichtigungen.ts` tun es zu Recht). Ohne Begründung: `throw`.
**Gegenprobe gehört dazu:** der Prüfer muss auch zusichern, dass der
LEER-Text NICHT dasteht — sonst ist der lügende Zustand bestanden.

### Ein Formular ohne Daten ist kein Formular
`app/auftrag-abschliessen.tsx` rendernte das ganze Freigabe-Formular auch ohne
geladenen Vertrag, nur mit Platzhaltern. Vier Haken setzen, „vollständig und
mängelfrei" bestätigen, Geld freigeben — ohne je gesehen zu haben, worüber.
Dasselbe bei `app/reklamation.tsx` (friert den Treuhandbetrag ein).
**Regel:** Jede unumkehrbare Aktion hängt zusätzlich an den Daten, die sie
beschreibt, nicht nur an der Eingabe des Nutzers.

### Feste Zahlen am unteren Bildschirmrand sind auf jedem Gerät falsch
28 px unter einer festgeklebten Leiste: auf einem iPhone ab X endet der Knopf
INNERHALB der 34 px, in denen das System die Wischgeste abfängt; auf einem
Gerät ohne Home-Anzeige sind es 28 px tote Fläche.
`lib/sichererRand.ts` → `aktionsleistenRand(insets.bottom)`.
**Grenze, die dazugehört:** react-native-web meldet den unteren Rand überall
als 0. Der Browser-Prüfstand kann reparierten und kaputten Zustand NICHT
unterscheiden — deshalb ein Quelltext-Prüfer für die Verdrahtung und Jest für
die Rechnung, und im Bericht der Satz, dass der Gerätetest aussteht.

### Eine Edge Function, die niemand aufruft
`pstg-annual-report` hatte keinen Zeitplan, keinen Workflow und keine Stelle
in der Oberfläche. Ihr eigener Kopfkommentar behauptete einen Cron-Lauf am
1. Januar. Daran hängt § 13 PStTG (Frist 31. Januar) und § 25 PStTG (Bußgeld).
**Prüfung, die das findet:** für jede Edge Function einmal `grep` nach
`FUNCTIONS_URL}/<name>`, `invoke('<name>')` und `/functions/v1/<name>` über
`lib/ app/ components/ scripts/ .github/`. Wer nirgends vorkommt, wird von
niemandem gerufen.

### Zwei eigene Fehler an einem Tag, beide vermeidbar
1. **`node -e "require('./scripts/…')"` startet das Skript.** Damit lief ein
   zweiter Playwright-Lauf gegen denselben Port, während die Suite lief.
   Für einen reinen Syntaxtest `node --check <datei>` nehmen.
2. **Ein laufender Gesamtlauf misst den Stand von VOR den eigenen
   Änderungen.** Wer danach Quelldateien anfasst, bekommt am Ende einen
   Rückgabewert, der eine andere Fassung betrifft. Entweder warten, oder den
   Lauf stoppen und frisch starten — aber das Ergebnis nie dem neuen Stand
   zuschreiben.

### Nachtrag 21.09.: `accessibilityState` ist im Web ein No-Op (14 Stellen)
Der neu gebaute `schalter-rolle-check.cjs` hat beim ERSTEN Lauf meinen eigenen
Fix zerlegt: `accessibilityRole="switch"` kam im DOM an, `aria-checked` war
`null`. **react-native-web 0.21 liest `accessibilityState` überhaupt nicht** —
nachgesehen in `node_modules/react-native-web/dist/modules/createDOMProps`:
durchgereicht werden `aria-checked` und das veraltete `accessibilityChecked`.

Es waren nicht zwei Stellen, sondern **14**: Auswahl-Kacheln, Gewerke,
Kalendertage, Meldegründe, Haken. Auf dem ausgelieferten Web-Build hat keine
davon je einen Zustand gemeldet.

**Regel:** `aria-checked` / `aria-selected` / `aria-disabled` schreiben, nicht
`accessibilityState`. Die gibt es seit React Native 0.71 auch nativ (hier
0.85) — eine Schreibweise für beide Plattformen. Nachgehalten in
`scripts/web-untaugliche-api-check.py`, also bei `Alert.alert` und
`Share.share`: dieselbe Familie, typseitig gültig und im Web wirkungslos.

**Und die eigentliche Lehre:** ein Quelltext-Prüfer hätte die Zeile
`accessibilityState={{ checked }}` gesehen und wäre zufrieden gewesen. Nur der
Browser-Prüfer, der den Schalter DRÜCKT und nachsieht, ob `aria-checked`
kippt, konnte das finden. Bei Bedienungshilfen-Angaben gilt deshalb dasselbe
wie bei Knöpfen: Auszeichnung UND Wirkung prüfen.

### `run.sh` zählt jetzt PASS je Prüfung
Der Lauf meldete 544 gegen zuletzt belegte 529. Dreizehn der fünfzehn ließen
sich benennen (neun in Reise 7, zwei in Reise 4, je eine für die beiden neuen
Apple-HIG-Prüfungen), **zwei nicht** — vom 529er Lauf existierte kein
Protokoll mehr. Eine Differenz, die man nicht zuordnen kann, ist wertlos: sie
könnte genauso gut eine still verschwundene und eine neue Zusicherung sein.
`run.sh` druckt am Ende eine Aufstellung `PASS je Prüfung`; der nächste
Vergleich ist damit mechanisch statt archäologisch.

## Session 2026-09-21 (nachmittags) — eine verbindliche Handlung ohne ihre Daten

Vier Founder-Befunde vom Gerät, und beim Abarbeiten kam eine Fehlerklasse mit
sechs Fundstellen heraus.

### Der Founder testet die Live-Seite, nicht den Branch
Drei Bildschirmfotos, und der erste „Fehler" war längst behoben: 30 Commits
lagen ungemergt vor `main`. **Bei jedem Screenshot von `github.io` zuerst
`git rev-list --count origin/main..HEAD` und den fraglichen Begriff in beiden
Ständen zählen**, bevor man im Code sucht. Das kostet zwei Befehle und spart
eine Fehlersuche an der falschen Fassung.

### Ein übersprungener Schritt darf nicht mitgezählt werden
Der Trichter überspringt Schritt 1, wenn die Kategorie feststeht (richtig so,
war früheres Founder-Feedback). Gezählt wurde aber absolut: „Schritt 2 von 4"
auf dem ERSTEN Bildschirm, und ein Balkensegment war schon grün, bevor der
Nutzer etwas getan hatte. Gezählt wird ab dem Einstieg.

### Eine Zusage muss für BEIDE Wege stimmen
„Wir leiten Ihre Anfrage an passende Betriebe mit geprüftem Gewerbeschein
weiter" stand dreimal als Literal, auch auf dem Nachbarschaftsweg. Dort legt
niemand einen Gewerbeschein vor. § 5 UWG, und zulasten des Kunden.
**Bedient ein Bildschirm beide Wege, gehört jeder track-abhängige Satz in eine
Hilfsdatei** (`lib/empfaengerText.ts`), nicht ins JSX.

### Die Klasse: eine verbindliche Handlung ohne die Daten, die sie beschreibt
Sechs Bildschirme. Der teuerste: `betrieb/angebot-erstellen` zeigte
`job?.title ?? 'Handwerksleistung'` und liess den Knopf frei — ein Betrieb
konnte ein **bindendes Angebot mit Preis** auf einen Auftrag abgeben, den er
nie gesehen hat.

**Muster für den Fix, sechsmal angewandt:** laden mit `mitZeitgrenze`, DREI
Zustände (lädt / unbekannt / geladen), kein Ersatztitel, Knopf zusätzlich an
den Daten, Hinweis mit Begründung.

**Zwei Zustände reichen nicht.** Meine erste Fassung kannte nur „geladen" und
„Fehler" und liess dauerhaft „Auftrag wird geladen …" stehen. Zwei bestehende
Zusicherungen wurden dafür zu Recht rot.

### Ein Browser-Prüfer kann einen erfundenen Titel nicht sehen
`geldwege-check.cjs` prüft jetzt, dass kein Geld-Bildschirm mit einer
Null-Kennung ein GEWERK nennt (9/9 grün, mit „Elektro" rot, also keine
Attrappe). Die eigentliche Mutation blieb trotzdem grün: „Heizungswartung"
steht in keiner Gewerke-Liste. **Im Browser ist ein erfundener Titel von einem
echten nicht zu unterscheiden; im Quelltext schon**, denn dort ist er ein
Rückfall auf ein Literal. Beide Regeln bleiben, sie decken Verschiedenes ab.

### Eine Positivliste statt eines Verbots
Der Grep nach `title ?? '...'` lieferte zwanzig Treffer, die meisten harmlos:
`?? 'Anbieter'` sagt ehrlich „Name unbekannt". Der Prüfer führt deshalb eine
**Positivliste neutraler Ersatzwörter**. Die Gegenprobe „ein neutrales
Ersatzwort bleibt erlaubt" ist Pflicht — ohne sie wäre „jeder Ersatz ist
verboten" der einfachste grüne Haken gewesen.

### Ein Kommentar ist kein Beleg
In `app/bewertung.tsx` stand seit Monaten „die Vertragsdaten sind nur fürs
Anzeigen". Widerlegt durch den Code drei Zeilen darunter:
`fristLage(undefined)` ist „unbekannt", also war der Knopf frei und die Frist
wurde nie geprüft. **Bei jedem „X ist nur fürs Anzeigen" nachsehen, was sonst
noch an X hängt.**

### Verworfene Kandidaten gehören ins Skript, nicht in den Kopf
`widerruf`, `konto-loeschen` und `melden` wurden geprüft und sind KEINE Fälle
(der Nutzer tippt dort selbst, es wird nichts geladen). Das steht mit
Begründung in `versprechen-check.py`, damit es niemand zweimal durchgeht.

## Session 2026-09-21 (spaet) — Lesen darf nicht durch eine Verpflichtung fuehren

Founder-Befund 4 („Warum kann ich Auftraege in der Liste nicht anklicken?"):
in `app/betrieb/auftraege.tsx` war die Beschreibung einer Anfrage auf zwei
Zeilen geklammert, und die Karte reagierte auf nichts. Den ganzen Text sah
nur, wer „Angebot erstellen" oeffnete — also den Bildschirm, der ein
BINDENDES Angebot abgibt.

Das ist die Umkehrung der Klasse vom 21.09. mittags („eine verbindliche
Handlung ohne die Daten, die sie beschreibt"): hier gab es die Daten, aber
der einzige Weg dorthin fuehrte durch die Verpflichtung.
**Regel:** Bei jeder gekuerzten Anzeige fragen, wo der ganze Inhalt steht.
Fuehrt der einzige Weg durch einen Bildschirm mit Rechtsfolge, ist das ein
Befund, kein Gestaltungsdetail.

### `onTextLayout` gibt es auf react-native-web nicht
Der uebliche Weg, „ist der Text ueberhaupt abgeschnitten?" zu messen, ist
`onTextLayout` mit `nativeEvent.lines.length`. Im Web feuert das nicht — ein
darauf gebauter Knopf waere auf dem ausgelieferten Build unsichtbar, und kein
Browser-Pruefer haette es gemeldet. Stattdessen eine deterministische Regel
ueber die Zeichenzahl (`> 120`), die sich im Pruefstand messen laesst.

### Die Hoehe messen, nicht den Text
`numberOfLines` setzt in rn-web ein `-webkit-line-clamp`. Der Text ist danach
optisch weg, `innerText` liefert ihn aber weiterhin vollstaendig — eine
Textprobe waere in BEIDEN Zustaenden gruen. Gemessen wird deshalb
`clientHeight` gegen `scrollHeight` (Reise 13, C2/C3/C5).

Mutationen (gemessen): Klammer wieder fest auf 2 Zeilen -> **C3 rot, C4
gruen**. Genau die dokumentierte Trennung — die Beschriftung kippt, die
Wirkung fehlt. Schwelle `> 120` auf `> 0` -> **C1 rot**. Gegenprobe
(Zustandsvariable umbenannt) -> alle fuenf gruen.

## Session 2026-09-21 (nachts) — ein Bildschirmfoto ohne Stand

Zweimal an einem Tag dieselbe Ursache: der Founder prueft am Geraet die
Live-Seite (`main`), waehrend auf dem Arbeitszweig ueber 40 Commits liegen.
Von vier gemeldeten Befunden war einer laengst behoben und nur nicht
ausgeliefert. Die Fusszeile trug „Werkant v1.0.0" als LITERAL — eine Zahl,
die sich seit dem ersten Tag nicht geaendert hat.

Jetzt: `lib/standZeile.ts` (reine Formatierung, Jest-faehig),
`EXPO_PUBLIC_BUILD` aus Commit-Kuerzel und Datum in `static.yml`, Anzeige in
`app/einstellungen.tsx`. Fehlt die Variable, steht ausdruecklich
„Entwicklungsstand" da — eine Live-Seite, die das zeigt, hat ein
Deploy-Problem, und das soll man sehen.

### Metro spielt einen inlinierten Umgebungswert aus dem Zwischenspeicher
**Die Gegenprobe war zuerst falsch gruen.** Nach `EXPO_PUBLIC_BUILD=x npx expo
export` und einem zweiten Export OHNE die Variable stand `x` immer noch im
Bundle: Metro schluesselt seinen Zwischenspeicher am Dateiinhalt, nicht an der
Umgebung. Erst `npx expo export --clear` zeigte den echten Zustand
(`grep -c` im Bundle: 1 vorher, 0 danach).
**Regel:** Wer eine `EXPO_PUBLIC_*`-Variable misst, exportiert mit `--clear`,
sonst misst er den vorherigen Lauf. In CI ist das kein Thema (frischer
Runner, Metro-Cache liegt im Temp-Verzeichnis und wird von `cache: 'npm'`
nicht wiederhergestellt) — lokal schon.

### Zwei Pruefer, weil einer die Haelfte nicht sehen kann
`stand-kennung-check.py` prueft die VERDRAHTUNG im Quelltext (Herkunft ist
eine Quelltext-Frage, zum dritten Mal dieselbe Lehre).
`stand-zeile-check.cjs` prueft, was am Ende DASTEHT — ein Quelltext-Pruefer
sieht `standZeile(a, b)` und ist zufrieden, auch wenn `undefined` gerendert
wird.
Gemessen: Literal wieder in der Fusszeile -> S2 und S3 rot, **S1 gruen** (die
Zeile ist da, sie sagt nur nichts). Kennung fest eingetippt -> Quelltext-
Pruefer rot, Browser-Pruefer gruen. Ohne Variable exportiert -> beide gruen.

### Ein Gast sieht die Fusszeile ueberhaupt nicht
`GastLoginHinweis` ersetzt `app/einstellungen.tsx` vollstaendig. Der erste
Lauf des Browser-Pruefers meldete deshalb „keine Zeile" und haette einen
funktionierenden Bildschirm als Fehler ausgewiesen. Mit `alsAnbieter(ctx)`
rendert die Fusszeile. **Offen und bewusst nicht gebaut:** ein Gast kann den
Stand nirgends ablesen.

### Ein Pruefer, der am Umbrechen rot wird
Die erste Fassung von `stand-kennung-check.py` suchte
`process.env.EXPO_PUBLIC_BUILD)` im leerraumfreien Text. Beim Umbrechen des
Aufrufs entsteht ein nachgestelltes Komma (`...BUILD,)`) — die Gegenprobe
wurde rot, obwohl sich nichts geaendert hatte. Jetzt ein Regex mit `,?`.
Dasselbe Muster wie die acht Fehlalarme aus einem Leerzeichen (08.09.).

### `run.sh` druckt seinen Rueckgabewert jetzt selbst
Lauf 21 lief mit `nohup ... > log` statt mit `; echo "EXIT=$?"`. Im Protokoll
stand danach kein Rueckgabewert, und uebrig blieb die PASS-Zahl als Ersatz —
genau das, was die Lehre vom 16.09. verbietet. Der Wert gehoert INS Protokoll,
nicht an den Aufrufort.

### Ein Waechter, der sein eigenes Suchmuster enthaelt, endet nie
`until ! pgrep -f "bash scripts/reisen/run.sh"` findet den String in der
EIGENEN Befehlszeile des Waechters. Zwei solche Schleifen liefen danach
endlos. Zum Pruefen `ps -eo pid,args | awk '$2=="bash" && $3=="<skript>"'`
oder ein Muster, das die eigene Zeile nicht trifft.

## Session 2026-09-21 (nachts, spaeter) — dieselbe Zusage, zwei Bildschirmhoehen weiter

Beim Nachziehen des Gewerbeschein-Befunds vom Nachmittag: ich hatte den Satz
im Hero von `app/landing.tsx` korrigiert und die **Vorteils-Kachel in
derselben Datei** uebersehen. Dort stand unter einem Schild-Symbol
„Gewerbeschein und Meisterbrief geprueft" und „Anbieter weisen ihren
Gewerbeschein nach" — als Aussage ueber ALLE Anbieter, mit aktivem
Nachbarschaftsweg.
**Regel:** Nach einem Fix dieser Art die GANZE Datei nach derselben Zusage
absuchen, nicht nur die Fundstelle. Ein Grep ueber den Begriff kostet
Sekunden.

### Die Umkehrung: ein anderer Weg sah aus wie ein Mangel
`app/anbieter.tsx` zeigte auch einer Helferin aus der Nachbarschaft ein
durchgestrichenes „Gewerbeschein" und „Steuer-ID", obwohl der
Nachbarschaftsweg beides nie abfragt, und darunter „Dokumente wurden von
Werkant einmalig geprueft" — ohne dass es dort Dokumente gaebe.
Nicht zu viel versprochen, sondern zu wenig zugestanden. Beides ist eine
Aussage ueber den Anbieter, die der eigene Code nicht deckt.
**Bei jedem Abzeichen fragen: gilt das Kriterium fuer JEDE Sorte Anbieter,
die diesen Bildschirm bekommt?**

### Nachgesehen statt behauptet
Der Nachbarschaftsweg erhebt Name, Telefon, Beschreibung, Stundensatz,
Gewerke und eine **Volljaehrigkeits-ERKLAERUNG** (Selbstauskunft, 0990);
danach entscheidet ein Mensch im Pruef-Postfach. Stripe laeuft auf BEIDEN
Wegen (Auszahlung ueber Connect), der Satz zur Identitaetspruefung bleibt
also richtig. Die neuen Texte behaupten genau das und nichts mehr.

### `versprechen-check.py` enthielt 84 Zeilen doppelt, und die Kopie war kaputt
Beim Erweitern gefunden: ein ganzer Block stand zweimal wortgleich. Die
zweite Kopie begann mit falscher Einrueckung (`for` auf vier statt acht
Leerzeichen) und hatte damit ihre Schutzbedingung `if not hat_ausweisfeld:`
verloren — Python nimmt den ueberindentierten Block klaglos an.
**Gemessen statt vermutet:** eine eingebaute Verletzung wurde VORHER zweimal
gemeldet, nachher einmal. Ein Pruefer, der doppelt meldet, laesst an jedem
Befund zweifeln, und eine Kopie ohne Schutzbedingung erzeugt irgendwann
Fehlalarme.

### Mutationen (gemessen)
- Kachel wieder als Literal -> Quelltext-Pruefer rot (zwei Meldungen).
- Nur der Titel Literal, `desc` gebunden -> ebenfalls rot.
- Gegenprobe: Literal nur im Kommentar -> gruen.
- Zweig in `anbieter.tsx` ausgeschaltet (`{false ? ...}`) -> **N1 bis N4 rot,
  H1 bis H3 gruen**. Die Gegenprobe H ist Pflicht: ohne sie waere „alle
  Abzeichen ausblenden" der einfachste gruene Haken.

## Session 2026-09-22 — ein goldener Haken, der „Auszahlung eingerichtet" hiess

Dritte Schicht desselben Founder-Befunds. `app/suche.tsx` listet BEIDE Wege
gemischt (`kundenKategorien(FEATURES.NACHBARSCHAFT)` nimmt die
Nachbarschafts-Startkategorien ausdruecklich auf), waehlte `is_nachbarschaft`
aber gar nicht aus: eine Helferin und ein Meisterbetrieb waren in der
Trefferkarte nicht zu unterscheiden, bei verschiedenem Pruefumfang,
verschiedener Gebuehr und verschiedener Rechtslage.

**Schwerer war der Haken daneben.** Neben dem Namen stand ein goldener
`checkmark-circle`, gebunden an `stripe_onboarded` — also „Auszahlung
eingerichtet". Neben einem Namen liest sich das als Guetesiegel, eine
Beschriftung trug er nicht, und fuer eine Bedienungshilfe war er gar nicht
vorhanden. Dieselbe Klasse wie der Haken an „Haftpflicht" (14.09.2026).
Der Filter nutzt `verified` weiter; dort IST die Bedeutung benannt
(„Nur sofort buchbare Anbieter · Zahlung über Werkant eingerichtet").
**Regel:** Ein Symbol ohne Beschriftung behauptet das, wonach es aussieht.
Wer einen Haken setzt, schreibt daneben, wofuer er steht.

Dasselbe unbeschriftete Symbol in `app/meine-anbieter.tsx`, dort an
`kyc_status='approved'`. Das ist eine wahre Aussage, hat aber je Weg eine
andere Bedeutung — jetzt mit `accessibilityLabel` und einer Zeile darunter.

### Ein Substring-Treffer beweist nicht, dass die Abfrage die Spalte holt
Meine erste Fassung der Regel prueft `"is_nachbarschaft" in inhalt`. Die
Mutation „Spalte aus der Abfrage entfernt" blieb **gruen**: der Name steht in
beiden Dateien zweimal, einmal in der Spaltenliste und einmal beim Abbilden
der Zeile. Wieder eine Pruefung, die den Fehler nicht sehen kann, den sie
verhindern soll.
**Loesung:** die SPALTENLISTE selbst pruefen (jedes Zeichenketten-Literal mit
`business_name` muss `is_nachbarschaft` enthalten). Danach beide Mutationen
rot, und die Gegenprobe „Spaltenreihenfolge getauscht" bleibt gruen.

### Ein Pruefer, der neben PASS das Gegenteil schreibt
`pruefe(name, ok, detail)` druckt `detail` immer. S1 meldete
„PASS … — keiner der beiden Vorgabe-Anbieter steht da". Die Zusicherung war
richtig, der Satz daneben falsch. Details gehoeren an den Fehlerfall
gebunden, sonst glaubt man dem Pruefer nicht mehr.

### Mutationen (gemessen)
- Sorten-Zeile aus `suche.tsx` entfernt -> **S2, S3, S4 rot, S1 gruen**
  (die Liste rendert weiter, sie sagt nur nicht mehr, wen sie zeigt).
- `anbieterArt(` entfernt -> Quelltext-Pruefer rot.
- Spalte aus der Abfrage entfernt (beide Dateien) -> rot, erst nach dem Fix
  der Regel.
- Gegenproben: Kommentar umformuliert, Spaltenreihenfolge getauscht -> gruen.

### Nachtrag 22.09.: die Startseite trug dieselben drei Muster

Vierte Fundstelle der Gewerbeschein-Zusage: der Vertrauens-Strip auf
`app/(tabs)/index.tsx` sagte „Gewerbeschein geprüft" als LITERAL, unmittelbar
neben einem Segment-Umschalter, der ausdruecklich zwischen Handwerk und
Nachbarschaftshilfe wechselt. Jetzt `pruefungKurz(FEATURES.NACHBARSCHAFT)`.
Dazu ZWEI weitere unbeschriftete goldene Haken, beide an `meister_verified` --
also „Meisterbrief geprüft", was nirgends stand. Jetzt ein Abzeichen mit dem
Wort „Meister" (`flexShrink: 0`, damit der Name schrumpft und nicht das
Abzeichen).

### Eine Gegenprobe auf dem falschen Bildschirm beweist nichts
Der erste Lauf mass `/` mit der ANBIETER-Rolle des Sitzungs-Ersatzes -- und
`/` leitet damit auf `/betrieb/dashboard` um. M1 und M2 waren rot (dort gibt
es den Strip nicht), und M3 („ohne Meisterbrief steht das Abzeichen nicht
da") war **muehelos gruen**, weil auf dem Dashboard ueberhaupt kein Abzeichen
vorkommt.
**Regel:** Jeder Browser-Pruefer sichert zuerst zu, WELCHEN Bildschirm er
misst (`new URL(p.url()).pathname`), bevor er Inhalte prueft. Sonst besteht
eine Gegenprobe auf einer Weiterleitung. Verwandte Klasse: die 24 gruenen
Messungen auf einer Anmeldeseite (Sitzungs-Ersatz, 08.09.).
`alsAnbieter(ctx, { rolle: 'customer' })` gibt es seit jeher -- ich hatte es
nur nicht benutzt.

### Zwei Mutationen einzeln, nicht zusammen
Nach der Lehre vom 16.09. („zwei Mutationen koennen sich gegenseitig
verdecken") jede Aenderung in einem eigenen Export geprueft: Abzeichen wieder
zum stummen Haken -> **nur M1 rot**; Strip wieder als Literal -> **nur M2
rot**. Zusammen waere nicht erkennbar gewesen, dass beide Zusicherungen
unabhaengig greifen.

## Session 2026-09-22 (spaeter) — unbeschriftete Zeichen, gemessen statt vermutet

Nach den vier goldenen Haken die Klasse selbst ausgezaehlt: ein Symbol, das
allein an einer Bedingung haengt (`{x && <Ionicons …/>}`) und keinen Namen
traegt. **11 Kandidaten** in `app/**` und `components/**`.

**Neun davon sind zu Recht stumm:** ein Haken IN einem Kontrollkaestchen oder
einer Auswahlkachel ist Zierde, den Zustand meldet der Behaelter
(`aria-checked` / `aria-selected`), und genau das prueft
`schalter-rolle-check.cjs`. Ein Pfeil in einem beschrifteten Knopf ebenso.
**Ein Pruefer fuer die ganze Klasse wuerde also neun Fehlalarme erzeugen und
danach abgeschaltet.** Deshalb keiner. Die Zaehlung steht hier, damit sie
niemand zweimal macht.

**Zwei waren echt:**
- `app/betrieb/profil-bearbeiten.tsx`: ein goldenes Ordensband markiert
  meisterpflichtige Gewerke. Die Legende gibt es (Zeile 217), sie erklaert
  das Zeichen aber MIT dem Zeichen -- vorgelesen wird daraus „Gewerke mit
  sind meisterpflichtig". Jetzt `accessibilityLabel` am Zeichen und am
  ganzen Absatz.
- `components/ui/DsgvoConsent.tsx`: ein gruener Haken fuer `item.required`,
  genau dort, wo die andere Zeile ihren Schalter hat. Er las sich als
  „eingeschaltet" statt „nicht abwaehlbar" und sagte nichts, was links nicht
  schon als Wort steht („Pflicht"). Entfernt.

### Ein Teilstring-Treffer, zum zweiten Mal an einem Tag
Die neue Zusicherung „die nicht abwaehlbare Zeile sagt es in Worten" suchte
`text.includes('Pflicht')`. Sie blieb **gruen**, als ich das Abzeichen zur
Probe entfernte: auf demselben Blatt stehen „meisterpflichtigen",
„Pflichtdaten" und „Meldepflicht". Jetzt `text="Pflicht"` als GENAUER
Treffer. Danach rot.
Zusammen mit `is_nachbarschaft` (heute frueh) ist das zweimal dieselbe
Ursache: **ein Wort, das anderswo als Teil eines anderen Wortes vorkommt,
taugt nicht als Beleg.**

### Die fuenfte Fundstelle fand ein Pruefer, nicht ich
Beim Ausgeben des sichtbaren Textes fuer die Fehlersuche stand da:
„Jeder Anbieter persönlich verifiziert: Gewerbeschein, in meisterpflichtigen
Gewerken der Meisterbrief" (`app/landing.tsx`, Vertrauenszeile unter den
Avataren). Die staerkste Formulierung von allen, und mit aktivem
Nachbarschaftsweg unwahr.
**Regel, erweitert:** Nach dem Korrigieren einer Zusage nicht nur die Datei
durchsuchen, sondern den GERENDERTEN Text des Bildschirms einmal ausgeben und
lesen. Ein Literal kann anders formuliert sein als das, wonach man greppt.

### Ein deutsches Anfuehrungszeichen beendet eine Python-Zeichenkette
`"„Jeder Anbieter" ist …"` -- das schliessende `"` beendet den String.
SyntaxError beim naechsten Lauf. In Pruefer-Texten mit deutschen
Anfuehrungszeichen einfache Hochkommata als Delimiter nehmen.
