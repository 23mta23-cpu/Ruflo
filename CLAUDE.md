@AGENTS.md

## Pruef-Regeln in Kuerze (22.09.2026)

Diese Datei ist ueber die Monate lang geworden, und dieselben Regeln haben
mich an einem einzigen Tag VIERMAL eingeholt. Deshalb hier die Kurzfassung; die
Begruendungen und die Messwerte stehen in `docs/lehren/CHRONIK.md` (grep).

**1. Ein gruener Haken zaehlt erst, wenn eine Mutation ihn rot machen kann.**
Und eine Gegenprobe gehoert dazu: ein Pruefer mit Fehlalarmen wird
abgeschaltet und nie wieder an.

**2. Ein Beleg muss EINDEUTIG der sein, um den es geht.**
Vier Fundstellen an einem Tag: „Pflicht" steckt in „meisterpflichtigen";
`is_nachbarschaft` steht zweimal in derselben Datei; der erwartete Betrag
stand als Bezugsgroesse daneben; das Etikett kam zweimal auf dem Bildschirm
vor. Wenn ein Anker nicht eindeutig ist, entscheidet nicht das erste
Vorkommen, sondern eine Suche ueber alle.

**3. Auszeichnung und Wirkung sind ZWEI Zusicherungen.**
Der Knopf kann „Weniger anzeigen" sagen und nichts aufklappen; der Bildschirm
kann „Frist abgelaufen" sagen und trotzdem absenden lassen. Immer beides.

**4. Die Rechnung kann gedeckt sein und die Anzeige nicht.**
Jest prueft `feeEngine`, `angebotPreis`, `cancellationRefund`,
`bewertungsFrist` gruendlich. Kein Test hat je gefragt, ob der Bildschirm
diese Zahlen hinschreibt. Und: Bildschirm und erzeugte DATEI sind zwei
verschiedene Texte.

**5. Ein Schritt, der uebersprungen werden KANN, wird zugesichert.**
`if (await feld.count())` hat den Materialfall einer Reise seit ihrer
Entstehung still ausgelassen. Zaehlen und zusichern, nicht in ein `if` packen.

**6. Erst messen, welchen Bildschirm man misst.**
`/` leitet mit Anbieter-Rolle auf `/betrieb/dashboard` um; eine Gegenprobe
bestand dort muehelos, weil es das Gesuchte dort gar nicht gibt.

**7. Herkunft ist eine Quelltext-Frage, Wirkung eine Browser-Frage.**
Ein Wertvergleich beweist keine Bindung, wenn beide Seiten denselben Text
ergeben. Ein Quelltext-Pruefer sieht nicht, ob `undefined` gerendert wird.

**8. Nach einer Textkorrektur den GERENDERTEN Text lesen.**
Die fuenfte und sechste Fundstelle derselben Zusage fand kein Grep, sondern
das Ausgeben des sichtbaren Textes. Ein Literal kann anders formuliert sein
als das, wonach man sucht.

**9. Eine Ausnahmeliste braucht eine Verfallspruefung.**
Sonst ist sie irgendwann eine Liste ohne Eintraege im Produkt und der
Pruefer prueft weniger, als sein Name sagt.

**10. Den Rueckgabewert lesen, nie die PASS-Zahl als Ersatz.**
`run.sh` druckt `EXIT=` selbst. `| tail; echo $?` misst tail.


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

**App-Struktur:** Screens `app/*.tsx`, `app/(tabs)/`, `app/betrieb/` ·
Edge Functions `supabase/functions/*/index.ts` · Logik `lib/*.ts` ·
Typecheck: `npx tsc --noEmit 2>&1 | head -20`

## Lehren-Chronik: `docs/lehren/CHRONIK.md` (29.09.2026 ausgelagert)

Die datierten Abschnitte „Session JJJJ-MM-TT" standen bis zum 29.09. hier und
machten diese Datei 170 KB gross. Sie wird in JEDE Sitzung und jede Anfrage
geladen; 164 KB davon waren Geschichte. Die Kurzfassung oben
(„Pruef-Regeln in Kuerze") ist das, was bei jeder Aufgabe gilt.

- **Vor Arbeit an einem Thema** die Chronik gezielt durchsuchen, nicht ganz
  lesen: `grep -n -i "<stichwort>" docs/lehren/CHRONIK.md`.
- **Neue datierte Lehren** mit `cat >> docs/lehren/CHRONIK.md <<'EOF'` anhaengen,
  NICHT hier. Das gilt auch dann, wenn der automatische Block unten
  („CLAUDE.md Editing") etwas anderes sagt; der stammt aus der Zeit davor.
- Eine Lehre, die bei JEDER Aufgabe gilt, gehoert zusaetzlich als Satz in die
  Kurzfassung oben.
- Der Block unten wird von `headroom learn --apply --target CLAUDE.md`
  verwaltet und bleibt deshalb hier.

<!-- headroom:learn:start -->
## Headroom Learned Patterns
*Auto-generated by `headroom learn` on 2026-09-28 — do not edit manually*

### GitHub Notifications and CI Checks
*~50,000 tokens/session saved*
- `ReadNotifications` was called 50x with `{}` (~45k tokens wasted). Call it only when a system notice says notifications are pending. Never call it again as a poll, and never call it right after a merge unless a notice arrived.
- `mcp__github__pull_request_read` `get_check_runs` was repeated 20x, 10x, 7x and 6x for single PRs (~17k tokens wasted). Do exactly one `sleep 420; echo fertig`, then one `get_check_runs`, then merge or fix. If checks are still pending, do other work and check once more later. Never poll back-to-back.
- `ToolSearch select:mcp__github__create_pull_request,...` ran 4x. The schemas stay loaded for the whole session, so search once.

### Repeated Reads
*~8,000 tokens/session saved*
- `sed -n '125,200p' scripts/lib/anbieter-sitzung.cjs` ran 5x (~4k tokens). Read the stub once with a larger range, note which routes it answers, and do not re-read it per probe.
- `sed -n '1,80p' docs/SESSION_HANDOFF.md` ran 3x and `sed -n '760,830p' app/auftrag-aufgeben.tsx` ran 3x. `Read` of `supabase/functions/pstg-annual-report/index.ts` ran 5x. Read a file once in full, or with a wide range, and reuse the result.
- `supabase/functions/release-escrow/handler.ts` returns `runtime_error` on `Read` but the content is present. Use the content and do not retry (3 retries, ~3k tokens).
- Repeated `Edit` calls on one file: `app/anbieter.tsx` 8x, `scripts/alle-screens-check.cjs` 6x. With 3 or more edits pending on the same file, do one `python3` read-replace-write with `assert text.count(old) == 1`.

### Background Runs and Server Cleanup
*~4,000 tokens/session saved*
- `pkill -f "scripts/spa-server.py"` was run 118x (+9x wrapped in a subshell), and repeatedly ended with Exit 144, which aborts any chained command. Kill by PID: `ps -eo pid,args | grep "[s]pa-server" | awk '{print $1}' | xargs -r kill`. Never chain other commands after `pkill`.
- `scripts/reisen/run.sh` starts and restarts its own server after each export. Do not start `spa-server` by hand before it. Run it ONCE per block with `> /tmp/x.log 2>&1; echo EXIT=$?`, then read the log. Do not pipe it through `tail`, and do not re-run it just to see more output.
- Polling a background run with `tail -N log; ps aux | grep ...` repeated 5x per run (~700 tokens). Use one `until grep -q "^EXIT=" log; do sleep 25; done` and read the log once. Do not poll in short loops.
- After a background run is reported as `failed` (Exit 144), child processes may still be running. Check `ps aux | grep -E "[s]pa-server|[e]xpo export|[r]eisen"` and kill the PIDs before running `git status` or starting a new export.

### Test Suite Runs
*~3,000 tokens/session saved*
- `service postgresql start >/dev/null 2>&1; bash scripts/db-test/run.sh 2>&1 | tail -40` ran 10x and `npx jest 2>&1 | tail -15` ran 7x. Write all new tests first, then run each suite ONCE per block. A `tail` cut may hide the failing line, so use `grep -E "FAIL|ERROR|EXIT"` instead.
- `python3 scripts/edge-hausregeln-check.py; echo EXIT=$?` failed 5x in a row against unchanged input. After a failure, read the finding, fix it, then re-run once. Do not re-run the same command without a change.

### Git Push Boilerplate
*~2,000 tokens/session saved*
- The retry loop `for i in 1 2 3 4; do git push -u origin claude/session-handoff-docs-1qxv3d && break || sleep $((2**i)); done` ran 24x + 12x + 5x + 5x (~2k tokens) plus a stop-hook reminder each time. Commit locally during a block. Push once at the END of each block, not after every commit. Never defer the push to a PR: the container is ephemeral, and unpushed work is lost on reset (manual correction 28.09.2026).

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
