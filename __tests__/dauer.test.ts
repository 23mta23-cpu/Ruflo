/**
 * Tests fuer lib/dauer.ts.
 *
 * ANLASS: Founder-Screenshot vom 07.09.2026 — drei Auftraege „Wartet auf
 * Angebote", ausgestellt im Juli, und nirgends stand, wie lange sie schon
 * warten.
 */
import { seitWann } from '../lib/dauer';

const jetzt = new Date(2026, 8, 7, 10, 0);   // 07.09.2026, 10:00

describe('seitWann', () => {
  it('nennt die Wochen aus dem Screenshot', () => {
    // 26.07. -> 43 Tage -> 6 Wochen
    expect(seitWann(new Date(2026, 6, 26), jetzt)).toBe('seit 6 Wochen');
    expect(seitWann(new Date(2026, 6, 22), jetzt)).toBe('seit 6 Wochen');
  });

  it('bleibt in der ersten Stunde unbestimmt', () => {
    expect(seitWann(new Date(2026, 8, 7, 9, 30), jetzt)).toBe('gerade eben');
  });

  it('zaehlt Stunden, Tage, Wochen und Monate der Reihe nach', () => {
    expect(seitWann(new Date(2026, 8, 7, 5, 0), jetzt)).toBe('seit 5 Stunden');
    expect(seitWann(new Date(2026, 8, 6, 9, 0), jetzt)).toBe('seit gestern');
    expect(seitWann(new Date(2026, 8, 2, 9, 0), jetzt)).toBe('seit 5 Tagen');
    expect(seitWann(new Date(2026, 7, 20), jetzt)).toBe('seit 2 Wochen');
    expect(seitWann(new Date(2026, 5, 1), jetzt)).toBe('seit 3 Monaten');
  });

  it('sagt Einzahl richtig', () => {
    expect(seitWann(new Date(2026, 8, 7, 9, 0), jetzt)).toBe('seit 1 Stunde');
    expect(seitWann(new Date(2026, 6, 13), jetzt)).toBe('seit 1 Monat');
  });

  it('behauptet nichts bei fehlendem oder unlesbarem Datum', () => {
    expect(seitWann(null, jetzt)).toBeNull();
    expect(seitWann('kein datum', jetzt)).toBeNull();
    expect(seitWann(undefined, jetzt)).toBeNull();
  });

  it('behauptet nichts bei einem Datum in der Zukunft', () => {
    expect(seitWann(new Date(2026, 8, 9), jetzt)).toBeNull();
  });

  it('kippt an der Zeitumstellung nicht', () => {
    // Ueber die Umstellung Ende Oktober sind sieben Kalendertage 169 Stunden.
    //
    // ACHTUNG, in der Gegenprobe gelernt: der naheliegende Fall (beide um
    // 09:00) beweist NICHTS. 169/24 = 7,04 — auch ohne Normierung auf Mittag
    // rundet das auf 7. Der Test war gruen, obwohl die Normierung entfernt war.
    //
    // Es braucht einen Abstand nahe der halben Tagesgrenze, an der die
    // Zusatzstunde die Rundung kippt: 23:00 -> 09:00 sind 6 Tage und 10
    // Stunden, mit der Umstellung 155 -> 155/24 = 6,46 -> gerundet 6.
    // Ueber Mittag gerechnet sind es die richtigen 7 Kalendertage.
    expect(seitWann(new Date(2026, 9, 19, 23, 0), new Date(2026, 9, 26, 9, 0))).toBe('seit 7 Tagen');
  });
});
