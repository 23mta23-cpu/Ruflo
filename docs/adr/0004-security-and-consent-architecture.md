# ADR-0004: Security & Consent Architecture

**Status**: Accepted  
**Date**: 2026-06-12  
**Deciders**: WERKR Engineering  

## Context

A security audit of the prototype (session `0bc1ce02`) identified 15 findings (3 Critical, 5 High, 4 Medium, 3 Low). This ADR records which decisions were made, why, and what remains deferred to backend implementation.

## Decisions Made

### 1. DSGVO Consent — Null-state splash screen (Critical fix)

**Decision**: `_layout.tsx` renders a loading spinner while `AsyncStorage.getItem` resolves. Navigation stack only mounts after consent state is known.

**Rationale**: DSGVO Art. 7(1) — processing must not start before consent is recorded. The previous `consentGiven === null` window allowed deep links to fire before consent.

---

### 2. Structured Consent Record (High fix)

**Decision**: Consent is stored as a JSON record:
```json
{ "accepted": true, "analytics": false, "pstg": true, "version": "1.0", "timestamp": "ISO8601" }
```

**Rationale**: DSGVO Art. 7(1) requires the controller to demonstrate consent was given. A bare `"true"` string provides no audit trail. Version field forces re-consent when the privacy policy changes (increment `werkr_consent_vN` key).

---

### 3. Planet49 Decline Button (High fix)

**Decision**: Consent modal has two equally-prominent buttons — "Nur notwendige" (decline optional) and "Einverstanden" (accept all).

**Rationale**: ECJ Planet49 ruling (C-673/17) and DSGVO Art. 7 — consent must be freely given. A modal with only an accept button does not satisfy this. "Nur notwendige" calls `onAccept(false)`, which stores `analytics: false` in the consent record.

---

### 4. Year-ceiling bug in age gate (Critical fix)

**Decision**: Replaced hardcoded `y > 2025` with `y > new Date().getFullYear()`.

**Rationale**: The hardcoded ceiling would silently reject all users who entered a birth year of 2026+ as of 2026-01-01. JArbSchG §1 requires accurate age verification.

**Deferred**: Server-side age verification at registration API level. The client check remains a UX guard only.

---

### 5. Remove false "encrypted" claim (Critical fix)

**Decision**: Changed UI copy from "Bankdaten werden verschlüsselt gespeichert" to "Bankdaten werden serverseitig tokenisiert (Stripe Connect)".

**Rationale**: DSGVO Art. 5(1)(f) integrity principle and UWG §5 deceptive practices. No encryption was implemented — the label was false. Accurate copy informs users of the intended (future) Stripe tokenisation approach.

---

### 6. Fee rate unification (High fix)

**Decision**: `COMMISSION_RATE` unified to 0.08 (8%) across all screens.

**Rationale**: `steuer.tsx` previously used 12.5%. This created a UWG §5 misrepresentation risk and would have caused incorrect DAC7 gross income calculations. Single source of truth is the `landing.tsx` advertised rate of 8%.

---

### 7. MiLoG enforcement in Profil editor (High fix)

**Decision**: `handleSave()` in `(provider)/profil.tsx` validates `minPrice >= 13` and shows an Alert if violated.

**Rationale**: Free `TextInput` previously allowed any value. MiLoG §1(1) creates an obligation to prevent sub-minimum-wage transactions. UI copy said "wird blockiert" but nothing blocked it.

---

### 8. Logout token handling (Low fix)

**Decision**: Logout removes `werkr_auth_token` from AsyncStorage before navigating.

**Rationale**: Future auth token storage would remain active across logout without this. Defensive measure for when real auth is wired.

---

## Deferred to Backend Implementation

The following findings require server-side work and are tracked as must-fix before production:

| Finding | Issue | Backend work required |
|---------|-------|----------------------|
| F8 | Escrow is mock UI — no real payment hold | Stripe Connect integration, BaFin ZAG compliance |
| F6 | Art. 17 erasure only clears AsyncStorage | `DELETE /api/users/{id}` with cascade delete |
| F5 | DAC7 thresholds are hardcoded mock data | Real transaction aggregation API |
| F1 | 18+ check is client-side only | DOB verified server-side at registration |
| F2 | Steuer-ID/IBAN not tokenised yet | Stripe Connect KYC tokenisation |
| F11 | Android `allowBackup` not disabled | Android manifest update in `app.json` |

## Compliance Test Coverage

`__tests__/compliance.test.ts` covers the five core legal rules as pure functions:
- `isOver18` (JArbSchG)
- `isAboveMindestlohn` (§1 MiLoG, €13/h)
- `calcPlatformFee` (8% rate)
- `isDac7ThresholdReached` (≥30 tx OR ≥€2,000)
- `isConsentRequired` (DSGVO/TTDSG)

`__tests__/fee.test.ts` verifies `fee + net === gross` for 208 amounts including non-terminating 8% fractions.

Run with: `npm test`
