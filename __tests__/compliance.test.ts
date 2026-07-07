/**
 * Werkant Compliance Rule Tests
 *
 * Covers:
 *   - Age gate (JArbSchG §1 — Jugendarbeitsschutzgesetz)
 *   - Mindestlohn (§1 MiLoG — Minimum Wage Act)
 *   - Platform fee (8 %)
 *   - DAC7 reporting threshold (EU Directive 2021/514)
 *   - GDPR/TTDSG consent check
 *
 * The functions are co-located here so that they stay in sync with the tests
 * and can be re-exported for use in the app.
 */

// ---------------------------------------------------------------------------
// 1. Age gate (JArbSchG)
// ---------------------------------------------------------------------------

/**
 * Returns true when the person identified by `birthDate` is at least 18 years
 * old on the current calendar day (inclusive boundary — the day they turn 18
 * counts as "over 18").
 */
export function isOver18(birthDate: Date): boolean {
  // Future dates are always under 18.
  const today = new Date();
  if (birthDate > today) {
    return false;
  }

  // Calculate age by comparing calendar dates (avoids DST / leap-second edge
  // cases that a raw millisecond subtraction would introduce).
  const eighteenthBirthday = new Date(birthDate);
  eighteenthBirthday.setFullYear(eighteenthBirthday.getFullYear() + 18);

  return today >= eighteenthBirthday;
}

describe('isOver18 — JArbSchG age gate', () => {
  /**
   * Returns a Date that is `yearsAgo` years before today, with an optional
   * day offset so we can sit exactly on boundaries or just inside/outside them.
   */
  function dateYearsAgo(yearsAgo: number, dayOffset = 0): Date {
    const d = new Date();
    d.setFullYear(d.getFullYear() - yearsAgo);
    d.setDate(d.getDate() + dayOffset);
    return d;
  }

  it('returns false when born today (age 0)', () => {
    expect(isOver18(new Date())).toBe(false);
  });

  it('returns false when born exactly 17 years ago (age 17)', () => {
    expect(isOver18(dateYearsAgo(17))).toBe(false);
  });

  it('returns false when born 17 years and 364 days ago (one day before 18th birthday)', () => {
    // Exactly 18 years ago + 1 day forward in time = 1 day before turning 18
    expect(isOver18(dateYearsAgo(18, 1))).toBe(false);
  });

  it('returns true when born exactly 18 years ago (18th birthday)', () => {
    expect(isOver18(dateYearsAgo(18))).toBe(true);
  });

  it('returns true when born 30 years ago', () => {
    expect(isOver18(dateYearsAgo(30))).toBe(true);
  });

  it('returns false for a future date', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(isOver18(tomorrow)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Mindestlohn (§1 MiLoG)
// ---------------------------------------------------------------------------

/** Current statutory minimum wage in €/h (effective 2025-01-01). */
const MINDESTLOHN_EUR_PER_HOUR = 13.0;

/**
 * Returns true when `euroPerHour` meets or exceeds the current Mindestlohn.
 * Negative values are treated as below minimum wage.
 */
export function isAboveMindestlohn(euroPerHour: number): boolean {
  return euroPerHour >= MINDESTLOHN_EUR_PER_HOUR;
}

describe('isAboveMindestlohn — §1 MiLoG minimum wage', () => {
  it('returns false for 12.99 €/h (one cent below minimum)', () => {
    expect(isAboveMindestlohn(12.99)).toBe(false);
  });

  it('returns true for exactly 13.00 €/h (the minimum)', () => {
    expect(isAboveMindestlohn(13.0)).toBe(true);
  });

  it('returns false for 0 €/h', () => {
    expect(isAboveMindestlohn(0)).toBe(false);
  });

  it('returns true for 100 €/h (well above minimum)', () => {
    expect(isAboveMindestlohn(100)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Platform fee (8 %)
// ---------------------------------------------------------------------------

/** Platform fee rate applied to every transaction gross amount. */
const PLATFORM_FEE_RATE = 0.08;

/**
 * Calculates the Werkant platform fee and the resulting net amount.
 * Both values are rounded to 2 decimal places (half-up rounding via
 * `Math.round`, which is standard for monetary amounts in EUR).
 */
export function calcPlatformFee(grossAmount: number): { fee: number; net: number } {
  const rawFee = grossAmount * PLATFORM_FEE_RATE;
  const fee = Math.round(rawFee * 100) / 100;
  const net = Math.round((grossAmount - fee) * 100) / 100;
  return { fee, net };
}

describe('calcPlatformFee — 8 % platform fee', () => {
  it('calculates fee and net for €100.00', () => {
    expect(calcPlatformFee(100)).toEqual({ fee: 8, net: 92 });
  });

  it('calculates fee and net for €0.00', () => {
    expect(calcPlatformFee(0)).toEqual({ fee: 0, net: 0 });
  });

  it('calculates fee and net for €125.00', () => {
    expect(calcPlatformFee(125)).toEqual({ fee: 10, net: 115 });
  });

  it('rounds the fee to 2 decimal places (e.g. €12.34 → fee €0.99, net €11.35)', () => {
    // 12.34 * 0.08 = 0.9872 → rounds to 0.99; net = 12.34 - 0.99 = 11.35
    const result = calcPlatformFee(12.34);
    expect(result.fee).toBe(0.99);
    expect(result.net).toBe(11.35);
    // Confirm values have at most 2 decimal places
    expect(result.fee.toString()).toMatch(/^\d+(\.\d{1,2})?$/);
    expect(result.net.toString()).toMatch(/^\d+(\.\d{1,2})?$/);
  });
});

// ---------------------------------------------------------------------------
// 4. DAC7 threshold (EU Directive 2021/514)
// ---------------------------------------------------------------------------

// isDac7ThresholdReached lives in lib/pstTgThresholds.ts (real production
// code, re-exported from lib/pstTg.ts for the tax overview screen) rather
// than being redefined here, so this test exercises the actual function
// instead of an isolated copy of it.
import { isDac7ThresholdReached } from '../lib/pstTgThresholds';

describe('isDac7ThresholdReached — EU DAC7 reporting', () => {
  it('returns false when below both thresholds (29 tx, €1,999)', () => {
    expect(isDac7ThresholdReached(29, 1999)).toBe(false);
  });

  it('returns true when tx count threshold is met (30 tx, €0)', () => {
    expect(isDac7ThresholdReached(30, 0)).toBe(true);
  });

  it('returns true when amount threshold is met (1 tx, €2,000)', () => {
    expect(isDac7ThresholdReached(1, 2000)).toBe(true);
  });

  it('returns true when both thresholds are met (30 tx, €2,000)', () => {
    expect(isDac7ThresholdReached(30, 2000)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Consent check (GDPR / TTDSG)
// ---------------------------------------------------------------------------

/**
 * Returns true when the user's consent still needs to be collected.
 *
 * The value stored in AsyncStorage (or SecureStore) represents the user's
 * previous consent choice:
 *   - `null`    → no record exists; consent banner must be shown
 *   - `'true'`  → consent was explicitly given; no action required
 *   - `'false'` → consent was explicitly denied; must still honour the
 *                  no-tracking preference, but the banner itself is not shown
 *                  again — the value here is that we know the preference.
 *                  However per TTDSG the app must NOT set non-essential cookies
 *                  in this state, which the caller must enforce.  We still
 *                  return `true` to force a re-check of the stored preference.
 *   - `''`      → corrupted/empty storage entry; treat as missing
 */
export function isConsentRequired(storageValue: string | null): boolean {
  return storageValue !== 'true';
}

describe('isConsentRequired — GDPR/TTDSG consent gate', () => {
  it('returns true when storage is null (no prior record)', () => {
    expect(isConsentRequired(null)).toBe(true);
  });

  it('returns false when storage is "true" (consent already given)', () => {
    expect(isConsentRequired('true')).toBe(false);
  });

  it('returns true when storage is "false" (consent explicitly denied)', () => {
    expect(isConsentRequired('false')).toBe(true);
  });

  it('returns true when storage is an empty string (missing/corrupt entry)', () => {
    expect(isConsentRequired('')).toBe(true);
  });
});
