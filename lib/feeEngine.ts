/**
 * Werkant Fee Engine
 *
 * Centralised, pure fee calculation logic for both marketplace tracks.
 *
 * Nachbarschaft (C2C neighbourhood helpers):
 *   - Fixed "Werkant-Schutz" fee of €1.99 charged to the customer
 *   - Helper (private person) receives 100% of the agreed job price
 *
 * Handwerker (professional tradespeople):
 *   - Provider commission: 8% of job value, minimum €3.00
 *   - Customer service fee: 2.5% of job value, minimum €1.50
 *   - B2B: Reverse Charge (§13b UStG) — no VAT on Werkant fee
 *   - C2C/B2C: 19% VAT on Werkant fee (§3a UStG), borne by Werkant
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Fixed escrow & buyer-protection fee charged on every Nachbarschaft job. */
export const Werkant_SCHUTZ_FEE = 1.99;

/** Rate deducted from the provider payout on Handwerker jobs. */
export const PROVIDER_COMMISSION_RATE = 0.08;

/** Rate added on top of the job price for the customer on Handwerker jobs. */
export const CUSTOMER_FEE_RATE = 0.025;

/** Minimum provider commission — prevents sub-economic micro-transactions. */
export const MIN_PROVIDER_FEE = 3.00;

/** Minimum customer service fee — prevents sub-economic micro-transactions. */
export const MIN_CUSTOMER_FEE = 1.50;

/** German Umsatzsteuer rate applied to Werkant fees on C2C/B2C Handwerker jobs. */
export const VAT_RATE = 0.19;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FeeTrack = 'nachbarschaft' | 'handwerker';

export type NachbarschaftFees = {
  track: 'nachbarschaft';
  jobPrice: number;
  /** Always €1.99 — the fixed Werkant-Schutz (Escrow & Käuferschutz) fee. */
  werkrSchutz: number;
  /** jobPrice + werkrSchutz — what the customer is charged. */
  customerTotal: number;
  /** jobPrice — helper receives 100%; no commission is deducted. */
  providerPayout: number;
  /** Same as werkrSchutz — Werkant's gross revenue on this job. */
  werkrGross: number;
  /**
   * Same as werkrSchutz — Werkant UG treats the €1.99 as gross revenue.
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
  /** providerCommission + customerServiceFee — Werkant's total gross revenue. */
  werkrGross: number;
  /**
   * 0 when isB2B (Reverse Charge §13b UStG applies),
   * else werkrGross * 0.19 (§3a UStG, borne by Werkant).
   */
  vatOnWerkr: number;
  /** werkrGross - vatOnWerkr — Werkant's net revenue after VAT. */
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

/**
 * Prozentanteil eines Betrags in ganzen Cent, kaufmännisch gerundet — exakt so,
 * wie Postgres `round(numeric, 2)` es tut.
 *
 * WARUM NICHT `r2(preis * satz)`: Das war ein echter Fehler in Produktion.
 * `84.6 * 0.025` ergibt in IEEE-754 nicht 2.115, sondern 2.1149999999999998 —
 * `Math.round` macht daraus 2.11. Postgres rechnet dieselbe Zeile in `numeric`
 * exakt und rundet 2.115 kaufmännisch auf 2.12. Die App zeigte dem Kunden also
 * 86,71 €, und `create-payment-intent` bucht `contracts.customer_total` ab,
 * das die Datenbank mit 86,72 € berechnet hat. Zwischen 1 und 500 € betrifft
 * das 23 Preise; die Datenbank ist die maßgebliche Stelle, weil aus ihrer
 * Zeile abgebucht wird.
 *
 * Gerechnet wird deshalb in ganzzahliger Cent-Arithmetik ohne Zwischenschritt
 * über Fließkomma: `floor((2*zaehler + nenner) / (2*nenner))` ist die
 * kaufmännische Aufrundung für positive Brüche.
 */
function pctCents(amountCents: number, numerator: number, denominator: number): number {
  const num = amountCents * numerator;
  return Math.floor((2 * num + denominator) / (2 * denominator));
}

/** Euro-Betrag in ganze Cent, ohne die Fließkomma-Ungenauigkeit der Eingabe. */
function toCents(euro: number): number {
  return Math.round(euro * 100);
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
 * an additional fixed Werkant-Schutz fee of €1.99 on top.
 *
 * @param jobPrice - The agreed job price in EUR (must be >= 0)
 * @returns A NachbarschaftFees breakdown
 */
export function calcNachbarschaftFees(jobPrice: number): NachbarschaftFees {
  assertValidJobPrice(jobPrice);
  const werkrSchutz = Werkant_SCHUTZ_FEE;
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
 *                   Werkant fees. When false, 19% VAT (§3a UStG) is deducted
 *                   from Werkant's net revenue.
 * @returns A HandwerkerFees breakdown
 */
export function calcHandwerkerFees(jobPrice: number, isB2B: boolean): HandwerkerFees {
  assertValidJobPrice(jobPrice);
  // Ganzzahlige Cent-Arithmetik, damit das Ergebnis Zeichen für Zeichen dem
  // entspricht, was accept_offer (0530:48-52) in `numeric` rechnet und was
  // create-payment-intent anschließend abbucht.
  const priceCents = toCents(jobPrice);
  const commissionCents = Math.max(pctCents(priceCents, 8, 100), toCents(MIN_PROVIDER_FEE));
  const serviceFeeCents = Math.max(pctCents(priceCents, 25, 1000), toCents(MIN_CUSTOMER_FEE));
  const grossCents = commissionCents + serviceFeeCents;
  const vatCents = isB2B ? 0 : pctCents(grossCents, 19, 100);

  const providerCommission = commissionCents / 100;
  const customerServiceFee = serviceFeeCents / 100;
  const customerTotal = (priceCents + serviceFeeCents) / 100;
  const providerPayout = (priceCents - commissionCents) / 100;
  const werkrGross = grossCents / 100;
  const vatOnWerkr = vatCents / 100;
  const werkrNet = (grossCents - vatCents) / 100;

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
