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

/**
 * Stunden bis zum Termin, aus dem Termin selbst.
 *
 * ANLASS (16.09.2026): `app/stornierung.tsx` las die Stunden aus einem
 * URL-Parameter, den `app/auftrag-detail.tsx` vorher mit `Math.round(...)`
 * hineingeschrieben hatte. Die Edge Function rechnet dagegen LIVE aus
 * `jobs.scheduled_at` und `Date.now()`. Zwei Folgen:
 *
 *  1. Die Rundung verschiebt die Kante. Bei 48,4 Stunden rundet der Client auf
 *     48 und zeigt 50 %; der Server sieht 48,4 und erstattet 100 %.
 *  2. Schlimmer, weil es den Kunden trifft: die Zahl ist ein Schnappschuss.
 *     Wer den Bildschirm bei 48,5 Stunden oeffnet und eine Stunde spaeter
 *     bestaetigt, hat 100 % gelesen und bekommt 50 %.
 *
 * Deshalb wird jetzt live gerechnet, mit demselben Ausdruck wie im Server, und
 * OHNE Rundung. `null` heisst "kein Termin vereinbart"; dafuer gilt dieselbe
 * Vorgabe wie im Server (72 Stunden, also volle Erstattung).
 */
export const OHNE_TERMIN_STUNDEN = 72;

export function stundenBisTermin(
  scheduledAt: string | null | undefined,
  jetzt: Date = new Date(),
): number {
  if (!scheduledAt) return OHNE_TERMIN_STUNDEN;
  const t = new Date(scheduledAt).getTime();
  if (Number.isNaN(t)) return OHNE_TERMIN_STUNDEN;
  return (t - jetzt.getTime()) / 3_600_000;
}
