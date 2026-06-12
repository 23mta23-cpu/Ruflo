/**
 * Property-based tests for calcPlatformFee.
 *
 * Invariant under test:
 *   For any gross amount A: round2(fee) + round2(net) === round2(A)
 *
 * This file intentionally imports the function from the compliance test so
 * the two files share a single implementation.  If the function is later
 * extracted to its own module, update the import path here.
 */

import { calcPlatformFee } from './compliance.test';

/** Round a number to 2 decimal places (half-up, matching calcPlatformFee). */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// ---------------------------------------------------------------------------
// Property: fee + net === grossAmount  (all values rounded to 2 dp)
// ---------------------------------------------------------------------------

describe('calcPlatformFee — property: fee + net === grossAmount', () => {
  /**
   * Sample amounts covering the full 0 – 10 000 € range.
   * We use a deterministic set rather than truly random numbers so that test
   * runs are reproducible and failures are easy to bisect.
   *
   * The set includes:
   *   - The boundaries (0 and 10 000)
   *   - Amounts where 8 % produces a terminating decimal (e.g. multiples of 25)
   *   - Amounts where 8 % produces a non-terminating decimal that must be
   *     rounded (e.g. 1 cent, amounts ending in .01 / .03 / .09 etc.)
   *   - A dense sweep of every whole-euro value 1–100
   *   - A stride of 137 € across the remaining range (prime stride avoids
   *     aliasing with the 8 % fraction period)
   */
  const testAmounts: number[] = [
    // Boundaries
    0,
    10000,

    // Sub-euro cent values
    0.01,
    0.1,
    0.99,

    // Dense sweep 1–100
    ...Array.from({ length: 100 }, (_, i) => i + 1),

    // Amounts known to produce non-terminating 8 % fractions
    12.34,
    33.33,
    66.67,
    99.99,
    1234.56,
    9999.99,

    // Prime-stride sweep across 101–9999
    ...Array.from(
      { length: Math.floor((9999 - 101) / 137) + 1 },
      (_, i) => 101 + i * 137
    ),
  ];

  test.each(testAmounts)(
    'fee + net === %s (gross amount)',
    (amount: number) => {
      const { fee, net } = calcPlatformFee(amount);

      // Both outputs must already be rounded to 2 dp by the function.
      expect(fee).toBe(round2(fee));
      expect(net).toBe(round2(net));

      // Core invariant: the money is fully accounted for.
      // We compare as integers (cents) to avoid floating-point equality issues.
      const grossCents = Math.round(amount * 100);
      const feeCents = Math.round(fee * 100);
      const netCents = Math.round(net * 100);

      expect(feeCents + netCents).toBe(grossCents);
    }
  );

  it('never produces a negative fee or net for non-negative inputs', () => {
    testAmounts.forEach((amount) => {
      const { fee, net } = calcPlatformFee(amount);
      expect(fee).toBeGreaterThanOrEqual(0);
      expect(net).toBeGreaterThanOrEqual(0);
    });
  });

  it('fee is always less than or equal to the gross amount', () => {
    testAmounts.forEach((amount) => {
      const { fee } = calcPlatformFee(amount);
      expect(fee).toBeLessThanOrEqual(amount + Number.EPSILON);
    });
  });

  it('net is always less than or equal to the gross amount', () => {
    testAmounts.forEach((amount) => {
      const { net } = calcPlatformFee(amount);
      expect(net).toBeLessThanOrEqual(amount + Number.EPSILON);
    });
  });
});
