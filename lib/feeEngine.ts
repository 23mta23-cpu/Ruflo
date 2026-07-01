/**
 * WERKR Fee Engine
 *
 * Centralised, pure fee calculation logic for both marketplace tracks.
 *
 * Nachbarschaft (C2C neighbourhood helpers):
 *   - Fixed "WERKR-Schutz" fee of €1.99 charged to the customer
 *   - Helper (private person) receives 100% of the agreed job price
 *
 * Handwerker (professional tradespeople):
 *   - Provider commission: 8% of job value, minimum €3.00
 *   - Customer service fee: 2.5% of job value, minimum €1.50
 *   - B2B: Reverse Charge (§13b UStG) — no VAT on WERKR fee
 *   - C2C/B2C: 19% VAT on WERKR fee (§3a UStG), borne by WERKR
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Fixed escrow & buyer-protection fee charged on every Nachbarschaft job. */
export const WERKR_SCHUTZ_FEE = 1.99;

/** Rate deducted from the provider payout on Handwerker jobs. */
export const PROVIDER_COMMISSION_RATE = 0.08;

/** Rate added on top of the job price for the customer on Handwerker jobs. */
export const CUSTOMER_FEE_RATE = 0.025;

/** Minimum provider commission — prevents sub-economic micro-transactions. */
export const MIN_PROVIDER_FEE = 3.00;

/** Minimum customer service fee — prevents sub-economic micro-transactions. */
export const MIN_CUSTOMER_FEE = 1.50;

/** German Umsatzsteuer rate applied to WERKR fees on C2C/B2C Handwerker jobs. */
export const VAT_RATE = 0.19;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FeeTrack = 'nachbarschaft' | 'handwerker';

export type NachbarschaftFees = {
  track: 'nachbarschaft';
  jobPrice: number;
  /** Always €1.99 — the fixed WERKR-Schutz (Escrow & Käuferschutz) fee. */
  werkrSchutz: number;
  /** jobPrice + werkrSchutz — what the customer is charged. */
  customerTotal: number;
  /** jobPrice — helper receives 100%; no commission is deducted. */
  providerPayout: number;
  /** Same as werkrSchutz — WERKR's gross revenue on this job. */
  werkrGross: number;
  /**
   * Same as werkrSchutz — WERKR UG treats the €1.99 as gross revenue.
   * No VAT split is applied at this level.
   */
  werkrNet: number;
};

export type HandwerkerFees = {
  track: 'handwerker';
  jobPrice: number;
  /** max(jobPrice * 0.08, 3.00) — deducted from provider payout. */
  providerCommission: number;
  /** max(jobPrice * 0.025, 1.50) — added on top of job price for customer. */
  customerServiceFee: number;
  /** jobPrice + customerServiceFee — what the customer is charged. */
  customerTotal: number;
  /** jobPrice - providerCommission — what the provider receives. */
  providerPayout: number;
  /** providerCommission + customerServiceFee — WERKR's total gross revenue. */
  werkrGross: number;
  /**
   * 0 when isB2B (Reverse Charge §13b UStG applies),
   * else werkrGross * 0.19 (§3a UStG, borne by WERKR).
   */
  vatOnWerkr: number;
  /** werkrGross - vatOnWerkr — WERKR's net revenue after VAT. */
  werkrNet: number;
};

export type FeeResult = NachbarschaftFees | HandwerkerFees;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Rounds a number to 2 decimal places (half-up, standard monetary rounding). */
function r2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Rejects negative, NaN, or Infinity job prices before they reach Stripe. */
function assertValidJobPrice(jobPrice: number): void {
  if (!Number.isFinite(jobPrice) || jobPrice < 0) {
    throw new RangeError(`Invalid jobPrice: ${jobPrice}`);
  }
}

// ---------------------------------------------------------------------------
// Calculation functions
// ---------------------------------------------------------------------------

/**
 * Calculates fees for a Nachbarschaft (C2C) job.
 *
 * The helper always receives 100% of the agreed job price. The customer pays
 * an additional fixed WERKR-Schutz fee of €1.99 on top.
 *
 * @param jobPrice - The agreed job price in EUR (must be >= 0)
 * @returns A NachbarschaftFees breakdown
 */
export function calcNachbarschaftFees(jobPrice: number): NachbarschaftFees {
  assertValidJobPrice(jobPrice);
  const werkrSchutz = WERKR_SCHUTZ_FEE;
  return {
    track: 'nachbarschaft',
    jobPrice,
    werkrSchutz,
    customerTotal: r2(jobPrice + werkrSchutz),
    providerPayout: jobPrice,
    werkrGross: werkrSchutz,
    werkrNet: werkrSchutz,
  };
}

/**
 * Calculates fees for a Handwerker (professional tradesperson) job.
 *
 * @param jobPrice - The agreed job price in EUR (must be >= 0)
 * @param isB2B    - When true, Reverse Charge applies (§13b UStG); no VAT on
 *                   WERKR fees. When false, 19% VAT (§3a UStG) is deducted
 *                   from WERKR's net revenue.
 * @returns A HandwerkerFees breakdown
 */
export function calcHandwerkerFees(jobPrice: number, isB2B: boolean): HandwerkerFees {
  assertValidJobPrice(jobPrice);
  const providerCommission = r2(Math.max(jobPrice * PROVIDER_COMMISSION_RATE, MIN_PROVIDER_FEE));
  const customerServiceFee = r2(Math.max(jobPrice * CUSTOMER_FEE_RATE, MIN_CUSTOMER_FEE));
  const customerTotal = r2(jobPrice + customerServiceFee);
  const providerPayout = r2(jobPrice - providerCommission);
  const werkrGross = r2(providerCommission + customerServiceFee);
  const vatOnWerkr = isB2B ? 0 : r2(werkrGross * VAT_RATE);
  const werkrNet = r2(werkrGross - vatOnWerkr);

  return {
    track: 'handwerker',
    jobPrice,
    providerCommission,
    customerServiceFee,
    customerTotal,
    providerPayout,
    werkrGross,
    vatOnWerkr,
    werkrNet,
  };
}

/**
 * Dispatches fee calculation to the correct track.
 *
 * @param jobPrice - The agreed job price in EUR
 * @param track    - 'nachbarschaft' or 'handwerker'
 * @param isB2B    - Only relevant for 'handwerker'; ignored for 'nachbarschaft'
 * @returns The appropriate FeeResult for the given track
 */
export function calcFees(jobPrice: number, track: FeeTrack, isB2B: boolean): FeeResult {
  if (track === 'nachbarschaft') {
    return calcNachbarschaftFees(jobPrice);
  }
  return calcHandwerkerFees(jobPrice, isB2B);
}
