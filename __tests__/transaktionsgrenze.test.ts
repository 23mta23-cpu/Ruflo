/**
 * Die Obergrenze je Auftrag.
 *
 * ANLASS (20.09.2026): `app/garantie.tsx` nannte 5.000 € als Beta-Limit.
 * Gemessen gab es die Grenze nirgends -- nicht im Client, nicht in einer Edge
 * Function, nicht in der Datenbank. Ein Angebot über 40.000 € wäre
 * durchgegangen.
 */
import { TRANSAKTIONSGRENZE_EUR, ueberGrenze, ueberGrenzeText } from '../lib/transaktionsgrenze';

describe('Transaktionsgrenze', () => {
  it('lässt einen gewöhnlichen Auftrag durch', () => {
    // Gegenprobe zuerst: eine Grenze, die alles sperrt, wäre ein bestandener
    // Test und ein totes Produkt.
    expect(ueberGrenze(320)).toBe(false);
    expect(ueberGrenze(1)).toBe(false);
  });

  it('lässt genau die Grenze durch und einen Cent darüber nicht', () => {
    // Der Rand ist die eigentliche Frage. „Bis 5.000 €" heißt einschließlich.
    expect(ueberGrenze(TRANSAKTIONSGRENZE_EUR)).toBe(false);
    expect(ueberGrenze(TRANSAKTIONSGRENZE_EUR + 0.01)).toBe(true);
  });

  it('nennt im Text dieselbe Zahl, die er prüft', () => {
    expect(ueberGrenzeText()).toContain(TRANSAKTIONSGRENZE_EUR.toLocaleString('de-DE'));
  });

  it('sagt dem Betrieb, was er tun kann', () => {
    // Ein „geht nicht" ohne Ausweg ist ein gesperrter Knopf ohne Erklärung.
    expect(ueberGrenzeText()).toMatch(/aufteilen|schreiben Sie uns/i);
  });

  it('hält Unsinn für unbedenklich statt für zu hoch', () => {
    // NaN entsteht aus einem leeren Feld. Es als „über der Grenze" zu werten
    // hieße, den Knopf mit der falschen Begründung zu sperren -- die
    // Untergrenze fängt den leeren Fall bereits ab.
    expect(ueberGrenze(Number.NaN)).toBe(false);
  });
});
