/**
 * Wie lange Geld unterwegs ist.
 *
 * ANLASS (20.09.2026): vier verschiedene Angaben zur selben Frage, zwei davon
 * auf demselben Bildschirm. Und die AGB sagen dem Anbieter 2 Werktage zu,
 * während mein erster Entwurf „1 bis 3" schrieb -- also eine längere Frist,
 * als der Vertrag zusichert.
 */
import {
  AUSZAHLUNG_WERKTAGE, ERSTATTUNG_WERKTAGE,
  auszahlungsdauer, erstattungsdauer,
} from '../lib/geldFristen';

describe('Geldfristen', () => {
  it('nennt die Auszahlung als Zusage, nicht als Spanne', () => {
    // Eine Spanne wäre hier falsch: die AGB sagen EINE Zahl zu. Wer „1 bis 3"
    // schreibt, nennt dem Anbieter eine längere Frist als den vereinbarten.
    expect(typeof AUSZAHLUNG_WERKTAGE).toBe('number');
    expect(auszahlungsdauer()).toBe('innerhalb von 2 Werktagen');
  });

  it('nennt die Erstattung als Spanne und ausdrücklich als Regelfall', () => {
    // Umgekehrt: hier gibt es KEINE Zusage in den AGB, und der Weg zurück
    // läuft über Kartennetz oder SEPA. Eine harte Zahl wäre eine Zusage,
    // die niemand gegeben hat.
    expect(ERSTATTUNG_WERKTAGE).toHaveLength(2);
    expect(erstattungsdauer()).toMatch(/^in der Regel nach /);
    expect(erstattungsdauer()).toContain('3 bis 5 Werktagen');
  });

  it('die Erstattung dauert nicht kürzer als die Auszahlung', () => {
    // Gegenprobe gegen einen Zahlendreher: der Weg zurück über das Kartennetz
    // ist nie schneller als eine SEPA-Auszahlung.
    expect(ERSTATTUNG_WERKTAGE[0]).toBeGreaterThanOrEqual(AUSZAHLUNG_WERKTAGE);
    expect(ERSTATTUNG_WERKTAGE[1]).toBeGreaterThan(ERSTATTUNG_WERKTAGE[0]);
  });

  it('beide Sätze lassen sich in einen Satz einsetzen', () => {
    // Sie werden mitten im Fließtext verwendet („ist das Geld {…}."), also
    // dürfen sie weder mit einem Großbuchstaben noch mit einem Punkt enden.
    for (const s of [auszahlungsdauer(), erstattungsdauer()]) {
      expect(s[0]).toBe(s[0].toLowerCase());
      expect(s.endsWith('.')).toBe(false);
    }
  });
});
