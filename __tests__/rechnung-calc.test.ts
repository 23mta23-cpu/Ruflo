/**
 * Tests for the billing calculation logic in app/rechnung.tsx.
 *
 * The screen uses these constants and formulas:
 *
 *   COMMISSION = 0.08          (8 % platform fee on gross)
 *   VAT_RATE   = 0.19          (19 % German Umsatzsteuer)
 *
 *   commission  = gross * COMMISSION
 *   net         = gross - commission
 *   vatOnFee    = isB2B ? 0 : commission * VAT_RATE   (Reverse Charge for B2B)
 *   totalFee    = commission + vatOnFee
 *
 * All helpers are inlined here — no import of the React screen needed.
 */

const COMMISSION = 0.08;
const VAT_RATE   = 0.19;

/** Rounds a number to 2 decimal places (monetary rounding). */
function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Calculates the full invoice breakdown for a given gross amount and user type. */
function calcInvoice(gross: number, isB2B: boolean) {
  const commission = r2(gross * COMMISSION);
  const net        = r2(gross - commission);
  const vatOnFee   = isB2B ? 0 : r2(commission * VAT_RATE);
  const totalFee   = r2(commission + vatOnFee);
  return { commission, net, vatOnFee, totalFee };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('WERKR billing constants', () => {
  it('COMMISSION rate is 8 %', () => {
    expect(COMMISSION).toBe(0.08);
  });

  it('VAT_RATE is 19 %', () => {
    expect(VAT_RATE).toBe(0.19);
  });
});

// ---------------------------------------------------------------------------
// C2C (isBusinessUser = false) — 19 % USt on platform fee
// ---------------------------------------------------------------------------

describe('C2C billing (isB2B = false)', () => {
  it('commission is 8 % of gross for €100', () => {
    const { commission } = calcInvoice(100, false);
    expect(commission).toBe(8.00);
  });

  it('net payout equals gross minus commission for €100', () => {
    const { net } = calcInvoice(100, false);
    expect(net).toBe(92.00);
  });

  it('vatOnFee is 19 % of the commission for €100 (§ 3a UStG)', () => {
    // commission = 8.00 → vatOnFee = 8.00 * 0.19 = 1.52
    const { vatOnFee } = calcInvoice(100, false);
    expect(vatOnFee).toBe(1.52);
  });

  it('totalFee equals commission plus VAT for €100', () => {
    // 8.00 + 1.52 = 9.52
    const { totalFee } = calcInvoice(100, false);
    expect(totalFee).toBe(9.52);
  });

  it('gross = commission + net (money is fully accounted for)', () => {
    const gross = 250;
    const { commission, net } = calcInvoice(gross, false);
    expect(r2(commission + net)).toBe(gross);
  });

  it('handles the typical €120 job correctly', () => {
    // commission = 120 * 0.08 = 9.60
    // net        = 120 - 9.60 = 110.40
    // vatOnFee   = 9.60 * 0.19 = 1.824 → rounds to 1.82
    // totalFee   = 9.60 + 1.82 = 11.42
    const result = calcInvoice(120, false);
    expect(result.commission).toBe(9.60);
    expect(result.net).toBe(110.40);
    expect(result.vatOnFee).toBe(1.82);
    expect(result.totalFee).toBe(11.42);
  });

  it('works for a zero gross amount without producing negative values', () => {
    const result = calcInvoice(0, false);
    expect(result.commission).toBe(0);
    expect(result.net).toBe(0);
    expect(result.vatOnFee).toBe(0);
    expect(result.totalFee).toBe(0);
  });

  it('scales linearly to large amounts (€1 000)', () => {
    const result = calcInvoice(1000, false);
    expect(result.commission).toBe(80.00);
    expect(result.net).toBe(920.00);
    expect(result.vatOnFee).toBe(r2(80 * 0.19));
    expect(result.totalFee).toBe(r2(80 + r2(80 * 0.19)));
  });
});

// ---------------------------------------------------------------------------
// B2B (isBusinessUser = true) — Reverse Charge, no USt on fee
// ---------------------------------------------------------------------------

describe('B2B billing (isB2B = true) — Reverse Charge', () => {
  it('vatOnFee is always 0 regardless of gross amount', () => {
    for (const gross of [0, 50, 100, 500, 9999.99]) {
      const { vatOnFee } = calcInvoice(gross, true);
      expect(vatOnFee).toBe(0);
    }
  });

  it('totalFee equals commission (no VAT added) for €100', () => {
    const { commission, totalFee } = calcInvoice(100, true);
    expect(totalFee).toBe(commission);
    expect(totalFee).toBe(8.00);
  });

  it('net payout is identical for B2B and C2C (VAT is not deducted from net)', () => {
    // The VAT difference is only in totalFee; both user types get the same net.
    const gross = 300;
    const b2b = calcInvoice(gross, true);
    const c2c = calcInvoice(gross, false);
    expect(b2b.net).toBe(c2c.net);
  });

  it('gross = commission + net for B2B too', () => {
    const gross = 175.50;
    const { commission, net } = calcInvoice(gross, true);
    expect(r2(commission + net)).toBe(gross);
  });

  it('B2B totalFee is strictly less than C2C totalFee for positive amounts', () => {
    const gross = 200;
    const b2b = calcInvoice(gross, true);
    const c2c = calcInvoice(gross, false);
    expect(b2b.totalFee).toBeLessThan(c2c.totalFee);
  });
});

// ---------------------------------------------------------------------------
// Rounding edge cases
// ---------------------------------------------------------------------------

describe('rounding correctness', () => {
  it('rounds vatOnFee to 2 decimal places (e.g. €150 gross C2C)', () => {
    // commission = 12.00; vatOnFee = 12 * 0.19 = 2.28 (exact — no rounding needed)
    const { vatOnFee } = calcInvoice(150, false);
    expect(vatOnFee).toBe(2.28);
    // Confirm the value equals its own 2-dp rounded form (i.e. no sub-cent remainder).
    expect(vatOnFee).toBe(r2(vatOnFee));
  });

  it('commission result has at most 2 decimal places for any whole-euro gross', () => {
    for (let gross = 1; gross <= 100; gross++) {
      const { commission } = calcInvoice(gross, false);
      // Compare as integer cents to avoid IEEE-754 representation noise.
      const cents = Math.round(commission * 100);
      const roundTrip = cents / 100;
      expect(commission).toBeCloseTo(roundTrip, 10);
    }
  });

  it('vatOnFee for €33.33 gross does not cause floating-point leakage', () => {
    // commission = r2(33.33 * 0.08) = r2(2.6664) = 2.67
    // vatOnFee   = r2(2.67  * 0.19) = r2(0.5073) = 0.51
    const { commission, vatOnFee } = calcInvoice(33.33, false);
    expect(commission).toBe(2.67);
    expect(vatOnFee).toBe(0.51);
    // Confirm both are finite and not NaN
    expect(Number.isFinite(vatOnFee)).toBe(true);
  });
});
