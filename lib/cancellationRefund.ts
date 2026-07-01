// Pure cancellation-refund-tier logic, split out so it has zero side-effecting
// imports and can be unit-tested directly instead of being duplicated by hand
// in the client preview screen and the cancel-contract Edge Function.
//
// Rule: a provider cancelling always refunds 100% (they broke the deal). A
// customer cancelling gets a tiered refund based on how far out the job was
// scheduled: >48h = 100%, 24–48h = 50%, <24h = 0%.
//
// The cancel-contract Edge Function duplicates this as plain numbers (Deno
// functions can't import from lib/), so any change here must be mirrored there.

export function calcCancellationRefundPct(
  isProvider: boolean,
  hoursUntilScheduled: number,
): number {
  if (isProvider) return 1.0;
  if (hoursUntilScheduled > 48) return 1.0;
  if (hoursUntilScheduled > 24) return 0.5;
  return 0;
}
