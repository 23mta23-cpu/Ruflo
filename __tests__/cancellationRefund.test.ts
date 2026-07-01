import { calcCancellationRefundPct } from '../lib/cancellationRefund';

describe('calcCancellationRefundPct — Stornierungs-Rückerstattungsstaffel', () => {
  it('always refunds 100% when the provider cancels, regardless of timing', () => {
    expect(calcCancellationRefundPct(true, 1)).toBe(1.0);
    expect(calcCancellationRefundPct(true, 25)).toBe(1.0);
    expect(calcCancellationRefundPct(true, 100)).toBe(1.0);
  });

  it('refunds 100% when the customer cancels more than 48h before the scheduled time', () => {
    expect(calcCancellationRefundPct(false, 48.01)).toBe(1.0);
    expect(calcCancellationRefundPct(false, 72)).toBe(1.0);
  });

  it('refunds 50% when the customer cancels 24-48h before the scheduled time', () => {
    expect(calcCancellationRefundPct(false, 48)).toBe(0.5);
    expect(calcCancellationRefundPct(false, 24.01)).toBe(0.5);
  });

  it('refunds 0% when the customer cancels less than 24h before the scheduled time', () => {
    expect(calcCancellationRefundPct(false, 24)).toBe(0);
    expect(calcCancellationRefundPct(false, 0)).toBe(0);
    expect(calcCancellationRefundPct(false, -5)).toBe(0);
  });
});
