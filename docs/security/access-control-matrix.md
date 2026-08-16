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
| `provider_profiles` | select rows where `available=true and kyc_status='approved'` (public search) | select/update own row (update blocked from touching `stripe_onboarded` **and `stripe_account_id`**) | none beyond public search | full — only writer of `stripe_onboarded` (via `stripe-webhook`) and of `stripe_account_id` (Connect flow, **not yet built**) |
| `jobs` | none | select own (as customer or provider); verified providers read open/matched jobs (0410); customer insert requires verified email (0400) | none | full |
| `offers` | none | provider: insert on open/matched jobs requires verified email (0400); select own offers; customer: select offers on own jobs | none | full |
| `contracts` | none | select/update where `customer_id`/`provider_id` = self — **INSERT revoked (0680)** | none | full — only writer of `status='completed'` (via `release-escrow`) and `escrow_*` timestamps |
| `messages` | none | Thread = (job, provider). SELECT: job-Kunde sieht alle Threads seines Auftrags, Anbieter nur den eigenen. INSERT: Kunde in eigenem Auftrag ODER Anbieter im eigenen Thread (verifiziert, nicht gesperrt, Track passend) — erlaubt Vor-Vertrags-Rückfragen (0510) | none | full |
| `disputes` | none | insert/select own (`reporter_id = self`) | none | full |
| `reviews` | select all (public reputation signal) | insert own (`reviewer_id = self`) | select all | full |
| `pro_subscriptions` | none | provider: select own | none | full — only writer (via `stripe-webhook`) |
| `pstg_reports` | none | provider: select own | none | full — only writer (via `pstg-annual-report`) |
| `rate_limits` (migration 025) | none | none | none | full (only ever touched via `check_rate_limit` RPC inside Edge Functions) |
| `contract_payment_intents` (migration 0660) | none | none | none | full — RLS enabled, **no policy** (default deny). Holds every PaymentIntent per contract, not just the latest. Written only via `register_payment_intent`; read via `contract_for_payment_intent`. Contains payment identifiers and amounts. |
| `payout_operations` (migration 0650) | none | none | none | full — RLS enabled, **no policy** (default deny). Only touched by `release-escrow` via the `payout_claim` / `payout_finalize` RPCs. Contains payout amounts and Stripe account ids; no client has any business reading it. |
| `chat_leak_flags` (migration 034) | none | insert own (`sender_id = self`, must be a party of the referenced job); **no select** for any client role | none | full (admin/audit review only) |
| `chat_reports` (migration 0700) | none | insert only (`reporter_id = self`, Melder UND Gemeldeter müssen beide Partei **desselben** Auftrags sein; `reporter_id <> reported_id`; pro (Melder, Nachricht) nur einmal); **no select** for any client role | none | full (admin/audit review only) |
| `widerruf_consents` (migration 0710) | none | insert own (`customer_id = self` UND Kunde **dieses** Vertrags; genau eine Erklärung je Vertrag), select own (Art. 15 DSGVO); **kein update, kein delete** | none | full |
| `provider_strikes` (migration 0720) | none | select own only (`provider_id = self`); **kein insert/update/delete** | none | full — Strikes vergibt das System bzw. die Nachprüfung, nie der Betroffene |
| `dsgvo_consents` (migration 0730) | insert (die Einwilligung wird **vor** der Registrierung eingeholt; `user_id` muss dann null sein) | insert (nur `user_id = self` oder null), select own, update own **nur für den Widerruf** (Trigger sperrt jede andere Änderung) | none | full |
| `provider_availability` (migration 0740) | none | select **alle Angemeldeten** (ein Kunde muss sehen, wann der Anbieter kann); insert/delete nur `provider_id = self`; kein update | none | full |
| `waitlist` (migration 035) | insert (open signup, no auth required) | insert | insert | full (admin export only) |
| `email_verifications` (migration 040) | none | none | none | full (verify-email Edge Function only; RLS default-deny) |

**`provider_availability` (0740) — warum alle Angemeldeten lesen dürfen:** Der
Sinn der Tabelle ist, dass ein Kunde beim Terminvorschlag sieht, wann der
Anbieter kann. Ohne Leserecht wäre sie so nutzlos wie vorher, als die
Markierungen nur im Bildschirmzustand lagen und **von nichts gelesen wurden**.
Gespeichert sind ausschließlich Zusagen zur eigenen Erreichbarkeit — keine
Aufträge, keine Kundendaten, keine Buchungen. Fehlt eine Zeile, gilt die Stunde
als gesperrt: Verfügbarkeit wird zugesagt, nicht unterstellt.

**`dsgvo_consents` (0730) — warum `anon` schreiben darf:** Das Consent-Blatt
liegt über jedem Bildschirm und wird **vor** einer Registrierung bestätigt. Ohne
`anon`-Insert gäbe es für genau die Nutzer keinen Nachweis, die noch kein Konto
haben — und Art. 7 Abs. 1 DSGVO verlangt den Nachweis unabhängig davon. Der
Eintrag ist dann anonym (`user_id` null) und für niemanden lesbar; er ist reines
Nachweismaterial. Bis 16.08.2026 gab es gar keinen serverseitigen Nachweis: die
Einwilligung lag ausschließlich im `localStorage` des Nutzergeräts.

**`provider_strikes` (0720) und die Sperre:** Die Angebots-Policy prüft seit
0720 `aktive_strikes(auth.uid()) < 3` statt `provider_profiles.strike_count`.
Grund: ein Strike verfällt durch bloßen **Zeitablauf** (AGB §7(3): „innerhalb
von 12 Monaten"), und dabei findet kein Schreibvorgang statt, der eine Spalte
nachführen könnte — die Sperre wäre stehengeblieben. `strike_count` ist nur
noch abgeleitete Anzeige und wird per Trigger bei jedem Schreibvorgang
überschrieben, damit ein manuell gesetzter Wert nicht *aussieht* wie eine
Sperre, ohne eine zu sein. Der Anbieter **muss** seine eigenen Strikes lesen
können: ohne Kenntnis der Begründung ist weder Art. 4 P2B-VO (EU) 2019/1150
erfüllt noch eine Beschwerde nach AGB §7(5) möglich.

**Warum `chat_reports` (0700) neben `chat_leak_flags` (034) steht:** Die
Leak-Flags dürfen laut RLS ausschließlich vom **Absender** geschrieben werden
(`auth.uid() = sender_id`), und geschrieben werden sie von `logLeakEvent()` im
Client des Absenders. Die Erkennung hängt damit vollständig am Gerät
desjenigen, gegen den sie sich richtet — ein veränderter Client, eine ältere
App-Version oder eine Schreibweise, die die Regex nicht trifft, erzeugt gar
keinen Fund. `chat_reports` ist der zweite, davon unabhängige Weg über den
**Empfänger**. Beide sind reine Prüfsignale: **weder das eine noch das andere
vergibt automatisch einen Strike** (0500 zählt ausschließlich Leak-Flags, und
erst ab drei). Bei Meldungen wiegt das schwerer als bei der Regex, weil eine
Meldung frei auslösbar ist: mit Auto-Strike genügten drei Meldungen, um einen
Anbieter zu sperren. Kein Client-Rollenzugriff auf `select` — sähe der
Gemeldete die Meldung, wüsste er sofort, wer ihn gemeldet hat.

**INSERT auf `contracts` (0680, P0):** Der Guard-Trigger
`trg_guard_contracts_sensitive_cols` ist `before update` und feuert bei INSERT
nicht; die RLS-INSERT-Policy aus 0050 prüft keine einzelne Spalte. Ein Kunde
konnte damit eine Vertragszeile mit frei gewähltem `provider_payout`, gesetztem
`escrow_captured_at` und `status='active'` anlegen — und `release-escrow`, das
den PaymentIntent nicht gegen Stripe prüft, hätte darauf einen echten Transfer
ausgelöst. Verifiziert gegen einen frischen Migrations-Replay. `authenticated`
und `anon` ist INSERT deshalb entzogen; Verträge entstehen ausschließlich in
`accept_offer()` (`security definer`). Ein künftiger pauschaler
`grant insert on all tables` (wie 0420 einer war) würde die Lücke wieder öffnen —
`scripts/db-test/contracts-insert-lockdown.sql` schlägt dann fehl.

**Zweite Schranke gegen denselben P0 (0690):** Der Entzug aus 0680 ist eine
Rechtevergabe, und Rechtevergaben wurden in diesem Schema schon einmal pauschal
überschrieben (`0420: grant … on all tables … to anon, authenticated`). Deshalb
deckt `trg_guard_contracts_sensitive_cols` seit 0690 auch INSERT ab und lehnt
jeden Vorgang ab, dessen `current_user` `authenticated` oder `anon` ist.
`accept_offer()` ist davon nicht betroffen, weil es `security definer` ist und
damit unter seinem Eigentümer läuft — der Trigger musste dafür allerdings von
`security definer` auf **invoker** umgestellt werden, sonst wäre `current_user`
immer der Eigentümer und die Unterscheidung unmöglich. Beide Richtungen sind in
`scripts/db-test/contracts-insert-lockdown.sql` abgesichert (Z4: Client wird
geblockt, auch wenn das INSERT-Recht zurückkommt; Z5: `accept_offer` schreibt
Geldspalten weiterhin).

**Hard rule (ADR-0004, unchanged by this doc):** `stripe_onboarded`, `contracts.status='completed'`, `escrow_captured_at`/`escrow_released_at`, and all `pstg_*` fields are writable **only** by `service_role` inside the specific Edge Function named above — never by a client-side RLS policy.

## RPC matrix (SECURITY DEFINER)

| RPC | Caller auth | Authorization inside | Notes |
|---|---|---|---|
| `accept_offer(offer, job)` (migration 039) | `authenticated` only | Customer derived from `auth.uid()`; must be job owner; offer must be `pending` and belong to the job; row-lock against double-accept | Creates contract with server-side fee calc + signature timestamps; declines competing offers |
| `decline_offer(offer)` (migration 039) | `authenticated` only | Caller (`auth.uid()`) must be owner of the offer's job; offer must be `pending` | Customer-side decline; provider-side decline uses own-row RLS policy (migration 026) |
| `pstg_record_transaction(provider, payout)` (migration 0610) | **`service_role` only** — `execute` ist `public`/`anon`/`authenticated` explizit entzogen | Kein Aufrufer-Check nötig, weil Client-Rollen die Funktion nicht ausführen dürfen; sie wird ausschliesslich von `release-escrow` nach erfolgter Auszahlung aufgerufen | Schreibt den PStTG-Jahresstand atomar fort (Jahreswechsel, Hochzählen, Schwelle 30 Tx / 2000 EUR, Sperre). Ersetzt das frühere Lesen-Rechnen-Schreiben in `release-escrow`, bei dem gleichzeitige Freigaben eine Transaktion verlieren konnten. Die Zählerspalten selbst sind seit 0610 auch gegen direkte Client-Writes gesperrt |

## Edge Function matrix

| Function | Caller auth | Additional authorization | Rate limit | Notes |
|---|---|---|---|---|
| `verify-email` | POST: User JWT required; GET: token (Besitznachweis) | POST: nur eigener Account; GET: gültiger Einmal-Token | POST 3/h per user, 10/h per IP; GET 20/h per IP | Eigenes DOI: setzt `profiles.email_verified_at` (service_role); Token-Tabelle `email_verifications` ist default-deny |
| `create-payment-intent` | User JWT required | Caller must be `contracts.customer_id` | 10/min per user, 30/min per IP | Idempotency key per contract |
| `release-escrow` | User JWT required | Caller must be `contracts.customer_id`; **Zahlung wird vor jedem Transfer gegen Stripe geprüft** (PaymentIntent `succeeded`, `amount_received` ≥ `customer_total`, `metadata.contract_id` passend) | 10/min per user, 30/min per IP | Idempotency key per contract |
| `cancel-contract` | User JWT required | Caller must be `customer_id` or `provider_id` on the contract | 10/min per user, 30/min per IP | — |
| `delete-account` | User JWT required | Caller can only delete self; blocked if active contracts exist | 3/hour per user, 10/hour per IP | Destructive — deliberately tight limit |
| `list-payment-methods` | User JWT required | Stripe customer scoped to caller's `profiles.stripe_customer_id` | 30/min per user, 60/min per IP | Read-only |
| `send-push` | User JWT required | Caller and target must share a job or contract | 20/min per user, 60/min per IP | Prevents using push as a spam vector against strangers |
| `notify-matching-providers` | User JWT required | Caller must be the job's owner (`customer_id`); job must be `open` | 10/h per user, 20/h per IP | Notification fan-out only to providers matching Gewerk+PLZ-Region; payload = Titel + Stadt (keine Neuoffenlegung — offene Aufträge sind für Anbieter ohnehin sichtbar) |
| `pstg-annual-report` | `x-admin-secret` header (not user JWT) | Secret must match `WERKR_ADMIN_SECRET` | 5/min per IP (checked **before** the secret comparison, to slow brute-forcing) | Cron/admin only |
| `stripe-webhook` | Stripe signature (`stripe-signature` header, verified via `constructEventAsync`) | Signature verification IS the authorization — no user JWT involved | **Intentionally none** | Rate limiting Stripe's own delivery traffic would risk dropping legitimate events; the cryptographic signature check is the correct control here. **Neu (0630/0640):** verarbeitet zusätzlich `charge.refunded`, `charge.dispute.*` (Status, Gebühr und Cash-Bewegung getrennt), `charge.refund.updated` und `radar.early_fraud_warning.created`. Die proaktive Erstattung auf eine Frühwarnung hin ist die einzige Stelle, an der die Function Geld ohne vorherige Nutzeraktion bewegt — deshalb hinter dem Secret `STRIPE_AUTO_REFUND_ON_FRAUD_WARNING` (Standard: aus). |
| `export-my-data` | User JWT required | Alle Queries strikt auf `auth.uid()` gescoped: Profil, Anbieterprofil, Jobs, Angebote, Verträge, Bewertungen, Meldungen (nur selbst gemeldet), Pro, PStTG, Warteliste; Nachrichten + Terminvorschläge nur im eigenen (job, provider)-Thread (Befund L1); `job_addresses` nur zu eigenen **Kunden**-Aufträgen (Befund M1) | 3/hour per user, 6/hour per IP | Art. 15/20 DSGVO; JSON-Antwort direkt an den Client (kein Mailversand). Query-Fehler → 500 mit Kategorienliste statt stillem Teil-Export. Bewusst NICHT enthalten: `email_verifications` (gültiger Token = Zugangsmittel), `chat_leak_flags` (abgeleitete Missbrauchserkennung, nicht Art. 20) |
| `waitlist-doi` | **None (anonymous)** — landing-page signup and email confirm links carry no JWT | POST: identical 200 response whether or not the email exists (no enumeration); GET: confirm requires knowledge of the random UUID token, single-use | 10/hour per IP + 3/hour per email | Sends DOI mail via Resend (`RESEND_API_KEY` secret); unconfirmed entries get no marketing mail (UWG §7) |
| Storage: `verification-docs` (kein Edge Function) | User JWT (Supabase Storage RLS) | Insert/Select nur im eigenen Ordner `{auth.uid()}/…`; kein Update/Delete (Audit-Trail); Review-Zugriff nur service_role via Dashboard | Bucket-Limit 10 MB, MIME-Whitelist JPG/PNG/PDF | Migration 037; Statusübergang pending/rejected→in_review zusätzlich per DB-Guard an gesetzten `gewerbeschein_path` gebunden |

## Standing rule for future endpoints

Every **new** public Edge Function must, before touching the database or an external API:
1. Verify the caller (user JWT, or an explicit out-of-band secret for admin/cron endpoints).
2. Call `enforceRateLimit` from `supabase/functions/_shared/rateLimit.ts` (per-user and per-IP).
3. Parse the body with `supabase/functions/_shared/validate.ts` — reject unexpected fields, assert types/formats/length on every field.
4. Add a row to this matrix in the same PR.

## Dokumentierte Ausnahme (Re-Audit 2026-07-17)

- **`stripe-webhook` hat BEWUSST kein Rate-Limiting** (Abweichung von Standing
  Security Rule 1): Das Gate ist die Stripe-Signaturprüfung
  (`constructEventAsync` VOR jeder Verarbeitung; ungültige Signatur → 400).
  Ein Rate-Limit würde legitime Stripe-Retry-Bursts (z. B. nach Ausfall)
  verwerfen und echte Zahlungs-Events verlieren. NICHT „nachrüsten".

## Re-Audit-Vermerk

2026-07-17: Alle 10 öffentlichen Edge Functions gegen die Standing Security
Rules (AGENTS.md) re-verifiziert — Rate-Limit + Auth-Gate + Matrix-Zeile
vollständig; einzige (dokumentierte) Ausnahme oben.


## RPCs mit erweiterten Rechten (SECURITY DEFINER)

| Function | Callable by | Purpose |
|---|---|---|
| `payout_claim(uuid, uuid)` | `service_role` only (execute revoked from public/anon/authenticated) | Claims a contract's payout atomically. Re-checks every contract precondition inside the transaction. Creates or returns exactly one `payout_operations` row per `contract_id`. Does **not** release escrow and does **not** touch the PStTG counter. |
| `register_payment_intent(uuid, text, integer)` | `service_role` only | Registers a PaymentIntent as the contract's current one, demotes earlier ones and keeps `contracts.stripe_payment_intent` in sync — all in one transaction. Locks the contract row. Refuses to move an intent to a different contract. |
| `contract_for_payment_intent(text)` | `service_role` only | Resolves any PaymentIntent — including a superseded one — to its contract, and reports whether it is the current one. This is what lets a refund or chargeback on an older intent still find its contract. |
| `payout_finalize(uuid, text)` | `service_role` only | Finalises a payout in one transaction: operation, contract, job and PStTG counter. Repeat calls are inert — this is the crash-recovery path. A conflicting transfer id blocks the operation (`manual_review`) instead of overwriting it. |

Both set `search_path = public`. A conflicting or ambiguous Stripe reconciliation
never creates a transfer — it blocks the operation and surfaces an error.

## Rollback von Migration 0650

Der Ledger ist additiv: er nimmt nichts weg. Ein fehlerhafter Rollout lässt sich
in zwei Stufen zurücknehmen.

**Stufe 1 — Code zurück, Schema behalten** (der Normalfall). `release-escrow`
auf den Vorstand zurücksetzen. Tabelle und Funktionen bleiben liegen und stören
nicht; bereits angelegte Operationen bleiben als Beleg erhalten. Kein Datenverlust.

**Stufe 2 — Schema zurück** (nur wenn zwingend):

```sql
drop function if exists public.payout_finalize(uuid, text);
drop function if exists public.payout_claim(uuid, uuid);
drop table if exists public.payout_operations;
-- stripe_account_id NICHT droppen: die Spalte wird von release-escrow und
-- stripe-webhook gelesen, unabhängig vom Ledger.
```

Vor Stufe 2 prüfen, ob Operationen mit `status <> 'finalized'` existieren — das
sind angestoßene, aber nicht abgeschlossene Auszahlungen. Sie zu löschen
bedeutet, die einzige lokale Spur eines möglicherweise bereits erfolgten
Stripe-Transfers zu verlieren:

```sql
select id, contract_id, status, stripe_transfer_id, last_error
  from public.payout_operations where status <> 'finalized';
```


## Rollback von Migration 0660

Additiv — sie nimmt nichts weg. `contracts.stripe_payment_intent` bleibt als
Spiegel bestehen und wird von `register_payment_intent` weiter gepflegt.

**Stufe 1 — Code zurück, Schema behalten.** Die Lesewege im Webhook wieder auf
`contracts.stripe_payment_intent` stellen, `create-payment-intent` wieder direkt
schreiben lassen. Tabelle und Funktionen bleiben liegen; kein Datenverlust.

**Stufe 2 — Schema zurück** (nur wenn zwingend):

```sql
drop function if exists public.contract_for_payment_intent(text);
drop function if exists public.register_payment_intent(uuid, text, integer);
drop table if exists public.contract_payment_intents;
```

Vorher prüfen, ob es Intents gibt, die **nicht** aktuell sind — die stehen
nirgends sonst, ihr Verlust ist der eigentliche Schaden:

```sql
select contract_id, payment_intent_id, status
  from public.contract_payment_intents where not is_current;
```
