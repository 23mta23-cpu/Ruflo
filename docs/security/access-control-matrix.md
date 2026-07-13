# WERKR — Access Control Matrix

_Stand: 01.07.2026. Ground truth: `supabase/migrations/*.sql` (RLS policies) +
`supabase/functions/*/index.ts` (Edge Function auth/authorization checks).
This file is descriptive of the current schema — when a migration or Edge
Function changes access rules, update this file in the same PR._

## Roles

| Role | Definition |
|---|---|
| **Anonymous** | No Supabase session (`auth.uid()` is null). |
| **Customer** | Authenticated user, `profiles.role = 'customer'`. |
| **Provider** | Authenticated user, `profiles.role = 'provider'`. |
| **Contract/Job party** | The specific customer or provider referenced by a row's `customer_id`/`provider_id`. |
| **service_role** | Supabase service-role key. Bypasses RLS entirely. **Only ever used inside Edge Functions** (ADR-0004), never shipped to a client. |
| **Admin (out-of-band)** | Holder of `WERKR_ADMIN_SECRET`, checked via header, not a Supabase auth role. |

## Table-level matrix (RLS)

| Table | Anonymous | Customer/Provider (own rows) | Any authenticated user | service_role |
|---|---|---|---|---|
| `profiles` | none | select/update own row (own row only; `role` immutable after creation, guarded by trigger); contract parties may select each other's row | none | full (Edge Functions only) |
| `provider_profiles` | select rows where `available=true and kyc_status='approved'` (public search) | select/update own row (update blocked from touching `stripe_onboarded`) | none beyond public search | full — only writer of `stripe_onboarded` (via `stripe-webhook`) |
| `jobs` | none | select own (as customer or provider); customer can insert | none | full |
| `offers` | none | provider: insert on open/matched jobs; select own offers; customer: select offers on own jobs | none | full |
| `contracts` | none | select/insert/update where `customer_id`/`provider_id` = self | none | full — only writer of `status='completed'` (via `release-escrow`) and `escrow_*` timestamps |
| `messages` | none | select/insert where sender is a party of the referenced job | none | full |
| `disputes` | none | insert/select own (`reporter_id = self`) | none | full |
| `reviews` | select all (public reputation signal) | insert own (`reviewer_id = self`) | select all | full |
| `pro_subscriptions` | none | provider: select own | none | full — only writer (via `stripe-webhook`) |
| `pstg_reports` | none | provider: select own | none | full — only writer (via `pstg-annual-report`) |
| `rate_limits` (migration 025) | none | none | none | full (only ever touched via `check_rate_limit` RPC inside Edge Functions) |
| `chat_leak_flags` (migration 034) | none | insert own (`sender_id = self`, must be a party of the referenced job); **no select** for any client role | none | full (admin/audit review only) |
| `waitlist` (migration 035) | insert (open signup, no auth required) | insert | insert | full (admin export only) |

**Hard rule (ADR-0004, unchanged by this doc):** `stripe_onboarded`, `contracts.status='completed'`, `escrow_captured_at`/`escrow_released_at`, and all `pstg_*` fields are writable **only** by `service_role` inside the specific Edge Function named above — never by a client-side RLS policy.

## RPC matrix (SECURITY DEFINER)

| RPC | Caller auth | Authorization inside | Notes |
|---|---|---|---|
| `accept_offer(offer, job)` (migration 039) | `authenticated` only | Customer derived from `auth.uid()`; must be job owner; offer must be `pending` and belong to the job; row-lock against double-accept | Creates contract with server-side fee calc + signature timestamps; declines competing offers |
| `decline_offer(offer)` (migration 039) | `authenticated` only | Caller (`auth.uid()`) must be owner of the offer's job; offer must be `pending` | Customer-side decline; provider-side decline uses own-row RLS policy (migration 026) |

## Edge Function matrix

| Function | Caller auth | Additional authorization | Rate limit | Notes |
|---|---|---|---|---|
| `create-payment-intent` | User JWT required | Caller must be `contracts.customer_id` | 10/min per user, 30/min per IP | Idempotency key per contract |
| `release-escrow` | User JWT required | Caller must be `contracts.customer_id` | 10/min per user, 30/min per IP | Idempotency key per contract |
| `cancel-contract` | User JWT required | Caller must be `customer_id` or `provider_id` on the contract | 10/min per user, 30/min per IP | — |
| `delete-account` | User JWT required | Caller can only delete self; blocked if active contracts exist | 3/hour per user, 10/hour per IP | Destructive — deliberately tight limit |
| `list-payment-methods` | User JWT required | Stripe customer scoped to caller's `profiles.stripe_customer_id` | 30/min per user, 60/min per IP | Read-only |
| `send-push` | User JWT required | Caller and target must share a job or contract | 20/min per user, 60/min per IP | Prevents using push as a spam vector against strangers |
| `pstg-annual-report` | `x-admin-secret` header (not user JWT) | Secret must match `WERKR_ADMIN_SECRET` | 5/min per IP (checked **before** the secret comparison, to slow brute-forcing) | Cron/admin only |
| `stripe-webhook` | Stripe signature (`stripe-signature` header, verified via `constructEventAsync`) | Signature verification IS the authorization — no user JWT involved | **Intentionally none** | Rate limiting Stripe's own delivery traffic would risk dropping legitimate events; the cryptographic signature check is the correct control here |
| `waitlist-doi` | **None (anonymous)** — landing-page signup and email confirm links carry no JWT | POST: identical 200 response whether or not the email exists (no enumeration); GET: confirm requires knowledge of the random UUID token, single-use | 10/hour per IP + 3/hour per email | Sends DOI mail via Resend (`RESEND_API_KEY` secret); unconfirmed entries get no marketing mail (UWG §7) |
| Storage: `verification-docs` (kein Edge Function) | User JWT (Supabase Storage RLS) | Insert/Select nur im eigenen Ordner `{auth.uid()}/…`; kein Update/Delete (Audit-Trail); Review-Zugriff nur service_role via Dashboard | Bucket-Limit 10 MB, MIME-Whitelist JPG/PNG/PDF | Migration 037; Statusübergang pending/rejected→in_review zusätzlich per DB-Guard an gesetzten `gewerbeschein_path` gebunden |

## Standing rule for future endpoints

Every **new** public Edge Function must, before touching the database or an external API:
1. Verify the caller (user JWT, or an explicit out-of-band secret for admin/cron endpoints).
2. Call `enforceRateLimit` from `supabase/functions/_shared/rateLimit.ts` (per-user and per-IP).
3. Parse the body with `supabase/functions/_shared/validate.ts` — reject unexpected fields, assert types/formats/length on every field.
4. Add a row to this matrix in the same PR.
