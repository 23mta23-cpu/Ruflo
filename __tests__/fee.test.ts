/**
 * Property-based tests for calcPlatformFee, and unit tests for the feeEngine
 * (calcNachbarschaftFees, calcHandwerkerFees, calcFees).
 *
 * Invariant under test for calcPlatformFee:
 *   For any gross amount A: round2(fee) + round2(net) === round2(A)
 *
 * This file intentionally imports calcPlatformFee from the compliance test so
 * the two files share a single implementation.  If the function is later
 * extracted to its own module, update the import path here.
 */

import { calcPlatformFee } from './compliance.test';
import {
  calcNachbarschaftFees,
  calcHandwerkerFees,
  calcFees,
  Werkant_SCHUTZ_FEE,
  PROVIDER_COMMISSION_RATE,
  CUSTOMER_FEE_RATE,
  MIN_PROVIDER_FEE,
  MIN_CUSTOMER_FEE,
  VAT_RATE,
} from '../lib/feeEngine';

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

// ---------------------------------------------------------------------------
// calcNachbarschaftFees
// ---------------------------------------------------------------------------

describe('calcNachbarschaftFees — Nachbarschaft (C2C) track', () => {
  const samplePrices = [0, 0.01, 1, 10, 37.50, 100, 250, 999.99];

  it('werkrSchutz is always exactly €1.99 regardless of job price', () => {
    samplePrices.forEach((price) => {
      const fees = calcNachbarschaftFees(price);
      expect(fees.werkrSchutz).toBe(Werkant_SCHUTZ_FEE);
      expect(fees.werkrSchutz).toBe(1.99);
    });
  });

  it('providerPayout equals jobPrice (helper receives 100%)', () => {
    samplePrices.forEach((price) => {
      const fees = calcNachbarschaftFees(price);
      expect(fees.providerPayout).toBe(price);
    });
  });

  it('customerTotal equals jobPrice + €1.99', () => {
    samplePrices.forEach((price) => {
      const fees = calcNachbarschaftFees(price);
      const expected = Math.round((price + 1.99) * 100) / 100;
      expect(fees.customerTotal).toBe(expected);
    });
  });

  it('track discriminant is "nachbarschaft"', () => {
    const fees = calcNachbarschaftFees(50);
    expect(fees.track).toBe('nachbarschaft');
  });

  it('werkrGross and werkrNet both equal werkrSchutz', () => {
    samplePrices.forEach((price) => {
      const fees = calcNachbarschaftFees(price);
      expect(fees.werkrGross).toBe(fees.werkrSchutz);
      expect(fees.werkrNet).toBe(fees.werkrSchutz);
    });
  });

  it('handles €0 job price — customer still pays €1.99 Werkant-Schutz', () => {
    const fees = calcNachbarschaftFees(0);
    expect(fees.jobPrice).toBe(0);
    expect(fees.werkrSchutz).toBe(1.99);
    expect(fees.customerTotal).toBe(1.99);
    expect(fees.providerPayout).toBe(0);
  });

  it('works correctly for a typical €50 job', () => {
    const fees = calcNachbarschaftFees(50);
    expect(fees.jobPrice).toBe(50);
    expect(fees.werkrSchutz).toBe(1.99);
    expect(fees.customerTotal).toBe(51.99);
    expect(fees.providerPayout).toBe(50);
    expect(fees.werkrGross).toBe(1.99);
    expect(fees.werkrNet).toBe(1.99);
  });
});

// ---------------------------------------------------------------------------
// calcHandwerkerFees — via feeEngine (mirrors rechnung-calc but uses the
// exported calcHandwerkerFees function instead of inline helpers)
// ---------------------------------------------------------------------------

describe('calcHandwerkerFees — Handwerker track', () => {
  it('constants are exported with correct values', () => {
    expect(PROVIDER_COMMISSION_RATE).toBe(0.08);
    expect(CUSTOMER_FEE_RATE).toBe(0.025);
    expect(MIN_PROVIDER_FEE).toBe(3.00);
    expect(MIN_CUSTOMER_FEE).toBe(1.50);
    expect(VAT_RATE).toBe(0.19);
  });

  it('track discriminant is "handwerker"', () => {
    const fees = calcHandwerkerFees(100, false);
    expect(fees.track).toBe('handwerker');
  });

  it('providerCommission is 8% of job price for €100', () => {
    const fees = calcHandwerkerFees(100, false);
    expect(fees.providerCommission).toBe(8.00);
  });

  it('customerServiceFee is 2.5% of job price for €100', () => {
    const fees = calcHandwerkerFees(100, false);
    expect(fees.customerServiceFee).toBe(2.50);
  });

  it('providerCommission respects minimum of €3.00 for small jobs', () => {
    // €10 * 0.08 = €0.80 < €3.00 minimum
    const fees = calcHandwerkerFees(10, false);
    expect(fees.providerCommission).toBe(3.00);
  });

  it('customerServiceFee respects minimum of €1.50 for small jobs', () => {
    // €10 * 0.025 = €0.25 < €1.50 minimum
    const fees = calcHandwerkerFees(10, false);
    expect(fees.customerServiceFee).toBe(1.50);
  });

  it('vatOnWerkr is 0 for B2B (Reverse Charge §13b UStG)', () => {
    const fees = calcHandwerkerFees(100, true);
    expect(fees.vatOnWerkr).toBe(0);
  });

  it('vatOnWerkr is 19% of werkrGross for C2C/B2C', () => {
    const fees = calcHandwerkerFees(100, false);
    const expectedVat = Math.round(fees.werkrGross * 0.19 * 100) / 100;
    expect(fees.vatOnWerkr).toBe(expectedVat);
  });

  it('customerTotal equals jobPrice + customerServiceFee', () => {
    const fees = calcHandwerkerFees(120, false);
    const expected = Math.round((fees.jobPrice + fees.customerServiceFee) * 100) / 100;
    expect(fees.customerTotal).toBe(expected);
  });

  it('providerPayout equals jobPrice minus providerCommission', () => {
    const fees = calcHandwerkerFees(120, false);
    const expected = Math.round((fees.jobPrice - fees.providerCommission) * 100) / 100;
    expect(fees.providerPayout).toBe(expected);
  });

  it('werkrNet equals werkrGross minus vatOnWerkr', () => {
    const fees = calcHandwerkerFees(120, false);
    const expected = Math.round((fees.werkrGross - fees.vatOnWerkr) * 100) / 100;
    expect(fees.werkrNet).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// calcFees — dispatch function
// ---------------------------------------------------------------------------

describe('calcFees — track dispatch', () => {
  it('dispatches to nachbarschaft track', () => {
    const result = calcFees(50, 'nachbarschaft', false);
    expect(result.track).toBe('nachbarschaft');
    expect(result.providerPayout).toBe(50);
  });

  it('dispatches to handwerker track', () => {
    const result = calcFees(100, 'handwerker', false);
    expect(result.track).toBe('handwerker');
  });

  it('ignores isB2B for nachbarschaft track', () => {
    const c2cResult = calcFees(50, 'nachbarschaft', false);
    const b2bResult = calcFees(50, 'nachbarschaft', true);
    expect(c2cResult).toEqual(b2bResult);
  });

  it('passes isB2B correctly to handwerker track', () => {
    const b2b = calcFees(100, 'handwerker', true);
    const c2c = calcFees(100, 'handwerker', false);
    if (b2b.track === 'handwerker' && c2c.track === 'handwerker') {
      expect(b2b.vatOnWerkr).toBe(0);
      expect(c2c.vatOnWerkr).toBeGreaterThan(0);
    }
  });
});

describe('feeEngine input validation', () => {
  it.each([-1, -0.01, NaN, Infinity, -Infinity])(
    'calcNachbarschaftFees rejects invalid jobPrice %p',
    (invalid) => {
      expect(() => calcNachbarschaftFees(invalid)).toThrow(RangeError);
    },
  );

  it.each([-1, -0.01, NaN, Infinity, -Infinity])(
    'calcHandwerkerFees rejects invalid jobPrice %p',
    (invalid) => {
      expect(() => calcHandwerkerFees(invalid, false)).toThrow(RangeError);
    },
  );

  it('allows a jobPrice of exactly 0', () => {
    expect(() => calcNachbarschaftFees(0)).not.toThrow();
    expect(() => calcHandwerkerFees(0, false)).not.toThrow();
  });
});
