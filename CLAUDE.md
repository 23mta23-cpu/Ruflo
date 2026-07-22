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
*Auto-generated by `headroom learn` on 2026-07-22 — do not edit manually*

### Screenshot Verification
*~132,307 tokens/session saved*
- `scratchpad/home.png` was re-read at full resolution 4x AGAIN in a fresh session (~132K tokens) even though the downscale rule is already written in CLAUDE.md — the rule is documented but not being executed at capture time.
- Fix by baking the downscale into the SAME Bash call that takes the screenshot (e.g., append `&& python3 -c "from PIL import Image; Image.open(p).resize((w//2,h//2)).save(p)"` to the Playwright shot script itself), so the file that gets `Read` is never the raw full-res PNG in the first place.

### GitHub PR/CI Workflow
*~25,000 tokens/session saved*
- PR-per-fix STILL recurred in the newest session despite the standing rule: ~15 individual PRs (#108→#134), 38 `get_check_runs` polls, and 14 `sleep N; echo CI-Fenster` filler calls in ONE session. Gate `create_pull_request` on ≥3 completed TaskCreate items, not on memory of the rule.
- Once a `Monitor` is armed on a PR's checks, do NOT also poll `get_check_runs` manually or fall back to `sleep N; echo` — on Monitor timeout, re-arm the SAME Monitor. This exact anti-pattern recurred even in a session that already had the rule written down.
- `mcp__github__enable_pr_auto_merge` fails with "Auto-merge is not enabled for this repository" — don't retry it, go straight to `merge_pull_request` once checks pass.
- `git fetch origin main --quiet && git checkout -B <branch> origin/main` repeated 10x and 7x respectively in one session (once per PR cycle) — this collapses automatically once PR batching (above) is followed; don't re-fetch/re-checkout if `git log --oneline -1` already matches the last known main SHA.

### Network / Proxy
*~21,094 tokens/session saved*
- `git push` to origin intermittently fails through the sandbox proxy — retry loop: `for i in 1 2 3 4; do git push ... && break || sleep <n>; done`. Use this upfront on every push.
- `git push origin --delete <branch>` can report `HTTP 403 ... unexpected disconnect` even when the deletion actually succeeded — re-check `git branch -r` before treating the delete as failed.
- E2E Playwright tests against the LIVE production URL (`https://23mta23-cpu.github.io/Ruflo/`) failed repeatedly through the sandbox proxy (`net::ERR_CONNECTION_RESET`, `Failed to fetch`) — 5 rewrites of the same probe script chasing this. Prefer testing against the local `dist/` export server (`spa-server.py` on :8744) for E2E logic checks; only hit the live URL once for a final smoke confirmation, not the primary test loop.

### Iterative Screen Edits
*~5,687 tokens/session saved*
- `app/chat.tsx` had 24 separate `Edit` calls, `lib/messages.ts` 12, `app/(tabs)/index.tsx` 11, `app/einstellungen.tsx` 10, `app/auftrag-detail.tsx` 9 in one multi-feature session — recurs across nearly every touched screen (`auftraege.tsx`, `login.tsx`, `nachrichten.tsx`, `dashboard.tsx`, `database.types.ts`, `angebot-erstellen.tsx` each 3-6x).
- The existing "batch via python3 heredoc" fallback is being skipped for iterative feature-wiring work (as opposed to one-shot multi-bug passes). When one feature touches a file in >3 places (e.g. wiring appointment proposals through chat.tsx), plan all edits from a single Read and apply via one `python3 - <<EOF` read+replace+write, not sequential Edit calls.

### Agent Spawning
*~5,000 tokens/session saved*
- CORRECTION to prior guidance: subagents spawned via the `Agent` tool are NOT silent no-ops. The inline "0 tool calls, 0 tokens, 0.0s" summary shown in the spawning session is just an async-dispatch stub — the agent's real work happens in its own session (confirmed: 9 separate subagent sessions this run each did 7-41 real tool calls: security pentest, functional QA, go-to-market review, vision/go-live review, DB feature implementation, appointment-workflow review, etc.).
- Read-only review/audit subagents (security, QA journey, GTM, vision) ARE a good pattern for protecting main-session context on large audits — keep delegating these; just read the agent's own completed output/notification rather than judging success from the inline stub.

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

### CI Job Logs
*~4,000 tokens/session saved*
- `mcp__github__get_job_logs` on the same `job_id` was retried 4x with slightly different params after hitting output-size limits (~52K-380K chars exceeding max tokens) — the first call already gets saved to a local file (`tool-results/mcp-...`) on overflow; read/filter THAT file with `python3`/`grep` instead of re-calling the tool with new parameter combinations.
- `mcp__github__actions_list` responses are also huge (~380K chars) for this repo — always pass the narrowest `resource`/status filter available and fall back to the saved overflow file immediately rather than retrying with broader params.

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

### Commands
*~700 tokens/session saved*
- Never combine `pkill -f spa-server` (or any pkill targeting a background process) with a subsequent `git commit`/`git add` in the same Bash call — pkill's SIGTERM propagates to the whole command chain and aborts it with exit code 144. Run `pkill -f spa-server 2>/dev/null; true` as its own call, then commit separately. Note: even run in isolation, this command can still legitimately exit 144 — treat that as benign, not a real failure, and don't retry or investigate.
- The Playwright screenshot script (`shot2.cjs`) must be run with cwd = the scratchpad dir (`cd $SP && node script.js`), not `node $SP/script.js` from the repo root — running from the repo root throws `Cannot find module 'playwright'` because module resolution depends on cwd.
- Playwright screenshot verification loop for this repo: `npx expo export --platform web`, then start `python3 <scratchpad>/spa-server.py` (serves `dist/` on :8744), confirm with `curl -s -o /dev/null -w "%{http_code}" http://localhost:8744/`, then `cd` into the scratchpad dir and run the parameterized `shot2.cjs <pfad> <name>` — kein neues .cjs pro Check schreiben.
- Chromium binary: `/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`. CDN-Skripte (jsdelivr etc.) blockt der Proxy.
- Quote all Bash paths containing parentheses: `ls "/path/app/(tabs)/"`. The Grep tool does NOT accept a file_path parameter — use `Bash: grep -n 'pattern' file`. `find | xargs grep` returns 123 on no-match — use `grep -rn` directly.
- Installing `headroom-ai`: `pip install --user "headroom-ai[all]"` then `export PATH="$HOME/.local/bin:$PATH"`.

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

### File Paths
*~2,425 tokens/session saved*
- Reading ANY `supabase/functions/*/index.ts` file can return `runtime_error` while the full file content IS present in the response — treat as success and use the returned content rather than re-reading.
- `contexts/AuthContext.tsx` lives at project root; `supabase/functions/` may be absent from sparse worktrees (see Worktrees section).

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
