import { trennbar, GROSSE_SCHRIFT_AB } from '../lib/grosseSchrift';

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
