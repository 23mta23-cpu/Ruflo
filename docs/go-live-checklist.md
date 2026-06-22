# WERKR Go-Live Checklist

Pre-launch checklist covering EAS builds, backend secrets, and legal requirements.
Work through each section in order — items within a section can often be done in parallel.

---

## 1. EAS Project ID

**File:** `app.json` → `expo.extra.eas.projectId`
**Current value:** `"werkr-placeholder-replace-with-real-eas-id"` — must be replaced before any build.

**Steps:**
```bash
npx eas-cli login          # authenticate with your expo.dev account
npx eas-cli init           # creates project on expo.dev and writes the real UUID into app.json
```

Alternatively: create the project manually at https://expo.dev/accounts/[your-account]/projects,
then copy the UUID from Project Settings and paste it into `app.json`.

- [ ] Replace `werkr-placeholder-replace-with-real-eas-id` with the real EAS project UUID in `app.json`

---

## 2. EAS Build — iOS

### 2a. Apple Developer credentials

**File:** `eas.json` → `submit.production.ios`

| Field | Where to find it | Placeholder in eas.json |
|-------|-----------------|------------------------|
| `appleId` | Your Apple ID email (the one tied to Apple Developer Program) | `REPLACE_WITH_APPLE_ID` |
| `appleTeamId` | https://developer.apple.com/account → Membership → Team ID (10-char string) | `REPLACE_WITH_TEAM_ID` |
| `ascAppId` | App Store Connect → My Apps → [your app] → App Information → Apple ID (numeric) | `REPLACE_WITH_APP_STORE_CONNECT_APP_ID` |

**Steps:**
1. Enroll in Apple Developer Program at https://developer.apple.com if not already done ($99/year).
2. Create the app record in App Store Connect (https://appstoreconnect.apple.com) under My Apps → (+).
3. Fill in the three placeholder values in `eas.json`.

### 2b. iOS provisioning profile & certificate

```bash
eas credentials --platform ios
```

EAS will prompt you to generate or upload a distribution certificate and provisioning profile.
Accept the defaults — EAS manages them automatically (stored in your expo.dev project).

### 2c. Build & submit

```bash
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

- [ ] Apple Developer Program enrolled
- [ ] App record created in App Store Connect
- [ ] `appleId`, `appleTeamId`, `ascAppId` filled in `eas.json`
- [ ] `eas credentials` run (provisioning profile generated)
- [ ] iOS production build submitted to TestFlight

---

## 3. EAS Build — Android

### 3a. Google Play Console service account

**File:** `./google-service-account.json` (referenced in `eas.json` → `submit.production.android`)

**Steps:**
1. Create a Google Play Developer account at https://play.google.com/console ($25 one-time fee).
2. Create the app entry (app package: `de.werkr.app`).
3. Generate a service account key:
   - Google Play Console → Setup → API access → Link to Google Cloud project → Create service account
   - Grant role: **Release manager** (or Service Account User + Release Manager)
   - Download the JSON key → save as `./google-service-account.json` at the repo root.
   - **Do not commit this file** — it is listed in `.gitignore`.

### 3b. Build & submit

```bash
eas build --platform android --profile production
eas submit --platform android --profile production
```

The submit step reads `./google-service-account.json` and uploads the AAB to the internal track
(as configured in `eas.json` → `submit.production.android.track: "internal"`).
Promote to production in the Play Console dashboard when ready.

- [ ] Google Play Developer account created
- [ ] App entry created (package `de.werkr.app`)
- [ ] Service account JSON downloaded → `./google-service-account.json`
- [ ] Android production build submitted to Play Console

---

## 4. Supabase Production

### 4a. Create project

1. Go to https://supabase.com and create a new project (choose EU region for DSGVO compliance).
2. Note three values from Settings → API:
   - **Project URL** — `https://<ref>.supabase.co`
   - **anon (public) key** — safe to expose in the app
   - **service_role key** — keep secret, only used in Edge Functions

### 4b. Add EAS secrets (app build-time env vars)

```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL \
    --value "https://<ref>.supabase.co"

eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY \
    --value "eyJ..."
```

These two are picked up automatically during `eas build --profile production`.

### 4c. Edge Function secrets (server-side only)

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

The service_role key is needed by Edge Functions that bypass RLS. Never put it in an EAS secret
that gets embedded in the client bundle.

### 4d. Run database migrations

```bash
supabase login
supabase link --project-ref <ref>
supabase db push          # applies migrations 001–013 in order
```

Verify with `supabase db diff` — should show no pending changes after push.

Migration 013 adds the `disputes` table with RLS (customers/providers can insert and read
their own disputes; status updates are server-only).

- [ ] Supabase project created (EU region)
- [ ] EAS secret `EXPO_PUBLIC_SUPABASE_URL` set
- [ ] EAS secret `EXPO_PUBLIC_SUPABASE_ANON_KEY` set
- [ ] Supabase secret `EXPO_PUBLIC_SUPABASE_ANON_KEY` set in GitHub Actions (for keep-alive cron)
- [ ] Supabase Edge Function secret `SUPABASE_SERVICE_ROLE_KEY` set
- [ ] `supabase db push` run (migrations 001–013 applied)

---

## 5. Stripe Production

### 5a. Activate live mode

1. Log in to https://dashboard.stripe.com.
2. Complete the Stripe onboarding (bank account, business details, tax ID).
3. Activate live mode — the dashboard will prompt you through the steps.
4. From the Developers → API keys page, note:
   - **Publishable key** — `pk_live_...`
   - **Secret key** — `sk_live_...`

### 5b. App EAS secret (client-side)

```bash
eas secret:create --scope project --name EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY \
    --value "pk_live_..."
```

### 5c. Edge Function secrets (server-side)

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
```

### 5d. Webhook secret

1. Stripe Dashboard → Developers → Webhooks → Add endpoint.
2. Endpoint URL: `https://<ref>.supabase.co/functions/v1/stripe-webhook`
3. Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`,
   `account.updated` (for Connect), and any others the Edge Function handles.
4. Copy the **Signing secret** (`whsec_...`).

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

### 5e. Stripe Connect (if using platform payouts to providers)

If `stripe_account_id` (added in migrations 006+) is used for provider payouts, enable Stripe
Connect in the dashboard and complete platform onboarding separately.

- [ ] Stripe live mode activated
- [ ] EAS secret `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` set (`pk_live_...`)
- [ ] Supabase secret `STRIPE_SECRET_KEY` set (`sk_live_...`)
- [ ] Webhook endpoint registered in Stripe dashboard
- [ ] Supabase secret `STRIPE_WEBHOOK_SECRET` set (`whsec_...`)

---

## 6. GitHub Secrets (CI web build)

The workflow `.github/workflows/deploy-web.yml` needs two repository secrets.
Set them at: https://github.com/[org]/[repo]/settings/secrets/actions → New repository secret

| Secret name | Value |
|-------------|-------|
| `EXPO_PUBLIC_SUPABASE_URL` | Same as the Supabase project URL above |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Same as the anon key above |

`GITHUB_TOKEN` is provided automatically by GitHub Actions — no action needed.

The same two secrets also power `.github/workflows/supabase-keep-alive.yml`, which pings
the Supabase REST API every 3 days to prevent free-tier auto-pause.

- [ ] GitHub secret `EXPO_PUBLIC_SUPABASE_URL` set
- [ ] GitHub secret `EXPO_PUBLIC_SUPABASE_ANON_KEY` set

---

## 7. Legal — Required Before App Store Submission

German law (§5 TMG, DSGVO Art. 13/14) requires accurate legal texts. The following files
contain placeholder data that **must** be updated before publishing.

### 7a. Company address

Replace `Musterstraße 1, 50667 Köln` with the real registered business address in all four files:

| File | Lines containing placeholder |
|------|------------------------------|
| `app/impressum.tsx` | Lines 46, 114 |
| `app/agb.tsx` | Line 15 (§1 intro paragraph) |
| `app/datenschutz.tsx` | Line 15 (Verantwortlicher block) |
| `app/widerruf.tsx` | Lines 29, 58, 78 |

### 7b. Geschäftsführer name

Replace `[Ihr Name]` with the actual managing director name in:

| File | Lines containing placeholder |
|------|------------------------------|
| `app/impressum.tsx` | Lines 45, 113 |
| `app/datenschutz.tsx` | Line 15 (Datenschutzbeauftragter field) |

### 7c. Legal review (strongly recommended)

- [ ] Impressum reviewed by a German lawyer (§5 TMG / §55 RStV compliance)
- [ ] Datenschutzerklärung reviewed for DSGVO Art. 13/14 compliance
  - Confirm all processing purposes and legal bases are listed
  - Confirm data retention periods are stated
  - Confirm Auftragsverarbeitungsverträge (AVV) with Supabase, Stripe, Expo are signed
- [ ] AGB reviewed — especially §§ covering Fernabsatz / Verbraucherrecht (§312 BGB ff.)
- [ ] Widerrufsbelehrung matches the statutory 14-day model (matches Anlage 1 EGBGB)

### 7d. Checklist

- [ ] Real company address in impressum.tsx, agb.tsx, datenschutz.tsx, widerruf.tsx
- [ ] Real Geschäftsführer name in impressum.tsx and datenschutz.tsx
- [ ] Lawyer sign-off on Impressum (§5 TMG)
- [ ] Lawyer sign-off on Datenschutzerklärung (DSGVO)
- [ ] AVV with Supabase (https://supabase.com/dpa), Stripe (https://stripe.com/dpa), Expo signed

---

## 8. Final Pre-Launch Checks

- [ ] TypeScript clean: `npx tsc --noEmit` exits with 0 errors
- [ ] All EAS secrets visible: `eas secret:list`
- [ ] All Supabase secrets visible: `supabase secrets list`
- [ ] Production build tested on a real device (not simulator) via TestFlight / Play internal track
- [ ] Push notifications tested end-to-end in production environment
- [ ] Stripe payment flow tested with a real card in live mode (small amount, then refund)
- [ ] App Store screenshots and metadata prepared (6.5" iPhone, iPad if `supportsTablet: true`)
- [ ] Google Play store listing text, screenshots, and content rating questionnaire filled in
- [ ] Privacy policy URL (`https://23mta23-cpu.github.io/Ruflo/datenschutz`) resolves correctly
