// Pure DAC7/PStTG threshold logic (§4 PStTG), split out from lib/pstTg.ts so
// it has zero side-effecting imports (no AsyncStorage/Supabase) and can be
// unit-tested directly instead of duplicated as an isolated copy in tests.
//
// A provider becomes reportable once they cross EITHER threshold in a
// calendar year.
//
// DIES IST DIE QUELLE. lib/account.ts exportiert seine Namen seit 13.09.2026
// von hier weiter, statt eigene Zahlen zu fuehren.
//
// EINE Kopie bleibt unvermeidlich: supabase/functions/pstg-annual-report
// fuehrt die Zahlen als Literale, weil Deno Edge Functions nicht aus lib/
// importieren koennen. Bis 13.09.2026 stand hier nur „muss mitgezogen werden" —
// und der Satz nannte zusaetzlich release-escrow, das die Zahlen gar nicht
// (mehr) enthaelt. Der Hinweis war also selbst veraltet und suggerierte
// trotzdem Verlaesslichkeit.
//
// Abgeglichen wird jetzt mechanisch: scripts/schwellen-check.py (CI).

export const PSTG_TX_THRESHOLD = 30;
export const PSTG_REV_THRESHOLD_EUR = 2000;

/** Pure predicate for whether a provider has crossed the DAC7 reporting threshold. */
export function isDac7ThresholdReached(txCount: number, totalEur: number): boolean {
  return txCount >= PSTG_TX_THRESHOLD || totalEur >= PSTG_REV_THRESHOLD_EUR;
}
