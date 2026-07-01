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
