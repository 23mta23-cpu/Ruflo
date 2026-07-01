// Pure DAC7/PStTG threshold logic (§4 PStTG), split out from lib/pstTg.ts so
// it has zero side-effecting imports (no AsyncStorage/Supabase) and can be
// unit-tested directly instead of duplicated as an isolated copy in tests.
//
// A provider becomes reportable once they cross EITHER threshold in a
// calendar year. The release-escrow and pstg-annual-report Edge Functions
// duplicate these as plain numbers (Deno functions can't import from lib/),
// so any change here must be mirrored there.

export const PSTG_TX_THRESHOLD = 30;
export const PSTG_REV_THRESHOLD_EUR = 2000;

/** Pure predicate for whether a provider has crossed the DAC7 reporting threshold. */
export function isDac7ThresholdReached(txCount: number, totalEur: number): boolean {
  return txCount >= PSTG_TX_THRESHOLD || totalEur >= PSTG_REV_THRESHOLD_EUR;
}
