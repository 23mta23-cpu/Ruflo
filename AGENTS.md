# WERK Operating System (verbindlich für alle Sessions)

Die Betriebssystem-Dokumente des Projekts liegen unter `.claude/werk-os/`.
Prioritätsreihenfolge bei Konflikten (höher schlägt niedriger):

1. `WERK_OS.md` (Kern-Identität, Founder-Mindset, Kostendisziplin)
2. `ENGINEERING.md`
3. `ARCHITECTURE.md`
4. `SECURITY.md`
5. `REPOSITORY_INTELLIGENCE.md`
6. `DECISION_FRAMEWORK.md`
7. `PRODUCT.md`
8. `AGENT_ORCHESTRATION.md`
9. `WORKFLOW.md`
10. `TASK_TEMPLATE.md`

`RED_TEAM.md` wird NICHT bei jeder Aufgabe ausgeführt — nur automatisch vor
größeren Architektur-, Produkt-, Pricing-, Security- oder Strategieentscheidungen.
Aus Token-Disziplin (WERK_OS §Cost Awareness) werden diese Dateien bei Bedarf
gelesen, nicht pauschal in jede Session geladen.

# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Karpathy Coding Guidelines (Active for all WERKR sessions)

These four rules apply to every code change in this project:

1. **Think Before Coding** — State assumptions explicitly. Surface tradeoffs. Ask when uncertain.
2. **Simplicity First** — Minimum code that solves the problem. No speculative features.
3. **Surgical Changes** — Touch only what you must. Match existing style. Small diffs.
4. **Goal-Driven Execution** — Define verifiable success criteria before writing. Verify after.

Full guidelines: `~/.claude/rules/ecc/common/karpathy-guidelines.md`
Source: https://github.com/multica-ai/andrej-karpathy-skills

# Standing Security Rules (active for all WERKR sessions)

These apply to every new public Edge Function or endpoint, not just the ones already fixed:

1. **Rate limiting** — every public Edge Function must call `enforceRateLimit` from
   `supabase/functions/_shared/rateLimit.ts` (per-user and per-IP, sensible defaults,
   graceful 429 with `Retry-After`). See `docs/security/access-control-matrix.md` for
   current limits per endpoint.
2. **Strict input validation** — parse bodies with `supabase/functions/_shared/validate.ts`:
   reject unexpected top-level fields, assert type/format (UUID, string length) on every
   expected field, before touching the database or Stripe.
3. **API keys / secrets** — never hard-code secret keys (Stripe secret, service_role, admin
   secrets) client-side or in source; only in Supabase Edge Function secrets / EAS secrets.
   Publishable/anon keys are safe client-side (RLS-enforced) but must come from env config,
   not a hardcoded production fallback, once `.env.local` is standard practice.
4. **Access control** — new tables/columns need an explicit RLS policy (default deny); new
   Edge Functions need an explicit auth check (user JWT or admin secret) plus an ownership/
   authorization check (caller must be a party to the resource). Add a row to
   `docs/security/access-control-matrix.md` in the same PR.
5. **OWASP baseline** — treat every new endpoint against the OWASP Top 10 (injection, broken
   access control, security misconfiguration, etc.) before considering it done. Don't break
   existing functionality to satisfy these rules — surface the tradeoff and ask if unclear.

# Standing Test Rules (verbindlich für alle Sessions und Subagenten)

Anlass (26.07.2026): In der Produktionsdatenbank lagen ~20 Konten aus früheren
Agenten-Läufen — `werkant.pentest.attacker.*`, `werkant.pentest.victim.*`,
`werkant.e2e.*`, `werkant.stab.*`, `claude-diag-*`. Alle von Test-Agenten
gegen die LIVE-Instanz erzeugt. Das verfälscht Nutzerzahlen, hinterlässt
Datenmüll, und ein Pentest gegen Produktion ist zusätzlich riskant.

1. **Funktionale Tests, RLS-Tests und Pentests laufen lokal.**
   `service postgresql start >/dev/null 2>&1; bash scripts/db-test/run.sh`
   spielt alle Migrationen gegen ein frisches Postgres. UI-Tests gegen den
   lokalen `dist/`-Export (`npx expo export --platform web`, dann
   `spa-server`), nicht gegen die Live-URL.

2. **Keine Testkonten in der Produktion anlegen.** Kein `signup` gegen
   `chnphpmpdpllnpqtvwhx.supabase.co`, um „mal eben etwas auszuprobieren".

3. **Ausnahme: Diagnose eines Produktions-Fehlers, der lokal nicht
   reproduzierbar ist** (z. B. fehlendes Secret in Edge-Function-Umgebung).
   Dann gilt: genau EIN Konto, Adresse mit erkennbarem Präfix
   (`claude-diag-<timestamp>@example.com`), und **im selben Arbeitsschritt
   wieder entfernen**. Nicht „später aufräumen".

4. **Ein einzelner Abschluss-Rauchtest gegen die Live-URL ist erlaubt** —
   lesend, ohne Konto anzulegen.

5. Fest verdrahtete Testkonten gehören dokumentiert. Aktuell:
   `b1debug1907@example.com` in `scripts/e2e-live.cjs:28` — dieses Konto
   NICHT löschen.

# CI-Warten in DIESER Umgebung (gemessen, nicht vermutet)

`Monitor` mit `curl https://api.github.com/...` funktioniert hier NICHT: Der
Sandbox-Proxy liefert ohne Token keine verwertbare Antwort, der Monitor läuft
ergebnislos aus. Am 26./27.07. dreimal hintereinander passiert — und jedes Mal
folgte doch ein manueller Poll. Das ist teurer als kein Monitor.

Regel:
1. **Weniger CI-Läufe** ist der eigentliche Hebel: 2–4 zusammengehörige Blöcke
   sammeln, DANN ein PR. (Siehe auch die Headroom-Notiz zu PR-pro-Fix.)
2. Zum Prüfen genau EIN `mcp__github__pull_request_read` mit
   `method: get_check_runs`, nachdem echte Arbeit dazwischen lag — nicht
   mehrfach hintereinander.
3. Ist noch nichts fertig: weiterarbeiten und später erneut EINMAL prüfen.
   Kein `sleep`, kein erneutes Monitor-Arming für GitHub-CI.

# Edge Functions VOR dem Push prüfen (nicht der CI überlassen)

`npx tsc --noEmit` prüft `supabase/functions/` NICHT. Am 27.07. ist genau
deshalb ein Namenskonflikt (`authErr` doppelt deklariert) in `delete-account`
durchgerutscht: lokal „grün", CI rot, und der Founder bekam die Fehlermail.
Ich hatte beim Push notiert „deno nicht installiert — CI prüft es". Das ist
keine Verifikation, das ist Hoffnung.

Deno installieren (einmal pro Sandbox):
`curl -fsSL https://deno.land/install.sh | sh && export PATH="$HOME/.deno/bin:$PATH"`

Nach JEDER Änderung an `supabase/functions/**` vor dem Commit:
```
for fn in supabase/functions/*/index.ts; do
  deno check --node-modules-dir=auto "$fn" || echo "FAIL $fn"
done
```
`deno check` verändert `deno.lock` als Nebenwirkung — vor dem Commit
`git diff --stat deno.lock` prüfen und bei reinem Lockfile-Rauschen
`git checkout -- deno.lock`.
