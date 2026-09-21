import { calcCancellationRefundPct, stundenBisTermin, OHNE_TERMIN_STUNDEN, erstattungsBetrag } from '../lib/cancellationRefund';

// ACHTUNG bei Aenderungen an diesen Schwellen: der Kunde liest sie im Klartext
// auf dem Angebots-Bildschirm (`app/angebot.tsx`, Banner "Stornierung"). Wer
// hier eine Zahl aendert und den Text stehen laesst, laesst die App etwas
// Falsches versprechen — und zwar an der Stelle, an der der Kunde ueber Geld
// entscheidet. Text mit anpassen.

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

describe('stundenBisTermin — dieselbe Rechnung wie im Server', () => {
  const JETZT = new Date('2026-09-16T12:00:00Z');
  const inStunden = (h: number) => new Date(JETZT.getTime() + h * 3_600_000).toISOString();

  it('rechnet ohne Rundung', () => {
    expect(stundenBisTermin(inStunden(48.4), JETZT)).toBeCloseTo(48.4, 5);
    expect(stundenBisTermin(inStunden(24.4), JETZT)).toBeCloseTo(24.4, 5);
  });

  it('ohne Termin gilt dieselbe Vorgabe wie im Server', () => {
    expect(stundenBisTermin(null, JETZT)).toBe(OHNE_TERMIN_STUNDEN);
    expect(stundenBisTermin(undefined, JETZT)).toBe(OHNE_TERMIN_STUNDEN);
    expect(stundenBisTermin('kein Datum', JETZT)).toBe(OHNE_TERMIN_STUNDEN);
  });

  it('an der Kante zeigt die ungerundete Zahl dasselbe wie der Server', () => {
    // Genau der Fall, der die Anzeige und die Erstattung auseinanderlaufen
    // liess: gerundet 48 -> 50 %, ungerundet 48,4 -> 100 %.
    const h = stundenBisTermin(inStunden(48.4), JETZT);
    expect(calcCancellationRefundPct(false, h)).toBe(1.0);
    expect(calcCancellationRefundPct(false, Math.round(h))).toBe(0.5);
  });

  it('ein vergangener Termin ergibt keine Erstattung', () => {
    expect(calcCancellationRefundPct(false, stundenBisTermin(inStunden(-3), JETZT))).toBe(0);
  });
});

describe('erstattungsBetrag', () => {
  it('rechnet die Stufe auf den gezahlten Betrag um', () => {
    expect(erstattungsBetrag(320, 100)).toBe(320);
    expect(erstattungsBetrag(320, 50)).toBe(160);
    expect(erstattungsBetrag(320, 0)).toBe(0);
  });

  it('rundet auf Cent, und zwar auf einen angebrochenen Fall', () => {
    // Glatte Testfaelle verbergen Rundungsfehler (16.09.2026). 102,55 zu
    // 50 % sind 51,275 -- es muss ein Betrag herauskommen, den man bezahlen
    // kann.
    expect(erstattungsBetrag(102.55, 50)).toBe(51.28);
    expect(erstattungsBetrag(99.99, 50)).toBe(50);
  });

  it('erfindet bei unsinnigen Werten keinen Betrag', () => {
    expect(erstattungsBetrag(Number.NaN, 50)).toBe(0);
    expect(erstattungsBetrag(320, Number.NaN)).toBe(0);
    expect(erstattungsBetrag(-10, 100)).toBe(0);
  });
});
