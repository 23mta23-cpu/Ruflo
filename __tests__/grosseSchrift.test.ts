import { trennbar, GROSSE_SCHRIFT_AB, stapeln, STAPELN_AB } from '../lib/grosseSchrift';

const WORT = 'Nachbar­schafts­hilfe';

describe('trennbar', () => {
  it('entfernt die Trennstellen bei normaler Schrift', () => {
    expect(trennbar(WORT, 1)).toBe('Nachbarschaftshilfe');
  });

  it('behaelt die Trennstellen bei grosser Systemschrift (iOS xxxLarge)', () => {
    expect(trennbar(WORT, 1.35)).toBe(WORT);
  });

  it('knapp unter der Schwelle gilt noch als normale Schrift', () => {
    // iOS „Large" (Standard) ist 1,0, „xLarge" etwa 1,06: dort passt das
    // Wort noch, und eine Trennung waere eine sichtbare Aenderung ohne Grund.
    expect(trennbar(WORT, 1.06)).toBe('Nachbarschaftshilfe');
    expect(trennbar(WORT, GROSSE_SCHRIFT_AB)).toBe(WORT);
  });

  it('laesst Text ohne Trennstellen unveraendert', () => {
    expect(trennbar('Handwerk', 1)).toBe('Handwerk');
    expect(trennbar('Handwerk', 2)).toBe('Handwerk');
  });
});

describe('stapeln', () => {
  it('stapelt bei Standard- und grosser Schrift NICHT (bis xxxLarge)', () => {
    // Bis 1,35 passen die Zeilen nachweislich nebeneinander
    // (rand-ueberstand-check --schrift=1.35 ist gruen). Stapeln waere dort
    // eine sichtbare Aenderung ohne Grund.
    expect(stapeln(1)).toBe(false);
    expect(stapeln(1.35)).toBe(false);
  });

  it('stapelt ab den Bedienungshilfen-Groessen (iOS AX1 = 1,65)', () => {
    expect(stapeln(1.65)).toBe(true);
    expect(stapeln(2)).toBe(true);
  });

  it('die Schwelle liegt zwischen xxxLarge und AX1', () => {
    expect(STAPELN_AB).toBeGreaterThan(1.35);
    expect(STAPELN_AB).toBeLessThanOrEqual(1.65);
  });
});
