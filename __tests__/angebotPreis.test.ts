import {
  werkantGebuehr, preisAufstellung, materialFehler, materialZeile,
} from '../lib/angebotPreis';

describe('preisAufstellung', () => {
  // Genau die Zahlen vom Bildschirmfoto des Founders (08.09.2026).
  it('Material wird NICHT auf die Auszahlung addiert', () => {
    const a = preisAufstellung(230, true, 100, false);
    expect(a.auszahlung).toBeCloseTo(219.6, 2);
    // Der alte Bildschirm versprach hier 311,60.
    expect(a.auszahlung).not.toBeCloseTo(311.6, 2);
  });

  /* Founder-Entscheidung 08.09.2026: „Lass uns es ausweisen aber nicht
     provisionieren." Die Zahlen muessen mit Migration 0830 uebereinstimmen,
     sonst sieht der Anbieter eine Zahl und bekommt eine andere. */
  it('Provision rechnet auf die Arbeitsleistung, nicht auf den vollen Preis', () => {
    const a = preisAufstellung(230, true, 100, false);
    expect(a.arbeitsanteil).toBe(130);
    expect(a.gebuehr).toBeCloseTo(10.4, 2);     // 8 % von 130
    expect(a.gebuehr).not.toBeCloseTo(18.4, 2); // 8 % von 230 waere falsch
  });

  it('Material gleich Preis: der Mindestbetrag greift, nicht null', () => {
    const a = preisAufstellung(500, true, 500, false);
    expect(a.arbeitsanteil).toBe(0);
    expect(a.gebuehr).toBeCloseTo(3, 2);
    expect(a.auszahlung).toBeCloseTo(497, 2);
  });

  it('Material bleibt als Anteil sichtbar, ohne den Preis zu erhoehen', () => {
    const a = preisAufstellung(230, true, 100, false);
    expect(a.materialAnteil).toBe(100);
    expect(a.leistungspreis).toBe(230);
  });

  it('ohne Materialangabe ist der Anteil null und die Gebuehr die alte', () => {
    const a = preisAufstellung(230, false, 100, false);
    expect(a.materialAnteil).toBe(0);
    expect(a.arbeitsanteil).toBe(230);
    expect(a.gebuehr).toBeCloseTo(18.4, 2);
  });

  it('Nachbarschaft: 1,99 pauschal statt 8 Prozent', () => {
    const a = preisAufstellung(230, false, 0, true);
    expect(a.gebuehr).toBeCloseTo(1.99, 2);
    expect(a.auszahlung).toBeCloseTo(228.01, 2);
  });
});

describe('werkantGebuehr', () => {
  it('greift der Mindestbetrag von 3 Euro bei kleinen Auftraegen', () => {
    expect(werkantGebuehr(20, false)).toBeCloseTo(3, 2);   // 8 % waeren 1,60
    expect(werkantGebuehr(50, false)).toBeCloseTo(4, 2);   // 8 % sind 4,00
  });
});

/* Die Anzeige muss dasselbe rechnen wie Migration 0830. Weicht sie ab, sieht
   der Anbieter eine Zahl und bekommt eine andere. Die Werte hier sind
   dieselben, die scripts/db-test/provision-ohne-material.sql gegen die
   echte Datenbank prueft (M1, M4, M5). */
describe('Gleichlauf mit Migration 0830', () => {
  it('M1: 230 Preis, 100 Material -> 10,40 Gebuehr, 219,60 Auszahlung', () => {
    const a = preisAufstellung(230, true, 100, false);
    expect(a.gebuehr).toBeCloseTo(10.4, 2);
    expect(a.auszahlung).toBeCloseTo(219.6, 2);
  });

  it('M4: 230 Preis, kein Material -> 18,40 Gebuehr', () => {
    expect(preisAufstellung(230, true, 0, false).gebuehr).toBeCloseTo(18.4, 2);
  });

  it('M5: 500 Preis, 500 Material -> 3,00 Gebuehr', () => {
    expect(preisAufstellung(500, true, 500, false).gebuehr).toBeCloseTo(3, 2);
  });
});

describe('materialFehler', () => {
  it('Material groesser als der Preis wird abgewiesen', () => {
    expect(materialFehler(100, true, 150)).toContain('höher als der Angebotspreis');
  });

  it('Material gleich dem Preis ist erlaubt (reine Materialbeschaffung)', () => {
    expect(materialFehler(100, true, 100)).toBeNull();
  });

  it('ohne Haken oder ohne Betrag gibt es nichts zu beanstanden', () => {
    expect(materialFehler(100, false, 150)).toBeNull();
    expect(materialFehler(100, true, 0)).toBeNull();
  });
});

describe('materialZeile', () => {
  it('nennt dem Kunden den enthaltenen Betrag mit Komma', () => {
    expect(materialZeile(true, 100)).toBe('Im Preis enthaltene Materialkosten: €100,00');
  });

  it('schweigt, wenn nichts angegeben wurde', () => {
    expect(materialZeile(false, 100)).toBeNull();
    expect(materialZeile(true, 0)).toBeNull();
  });
});
