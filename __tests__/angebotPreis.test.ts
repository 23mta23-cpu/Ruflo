import { werkantGebuehr, preisAufstellung, materialFehler, materialZeile, angebotLohntSich, MINDESTPREIS } from '../lib/angebotPreis';
import { MIN_PROVIDER_FEE } from '../lib/feeEngine';

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

describe('angebotLohntSich — die Untergrenze aus 0910 auch in der Oberflaeche', () => {
  // ANLASS (16.09.2026): Bei einem Preis von 0 zeigte das Angebotsformular
  // "Ihr Nettobetrag: €-3,00" und liess sich absenden. Die Datenbank weist das
  // seit 0910 ab (`price > 3.00`) — der Anbieter haette also eine negative
  // Auszahlung gesehen, gesendet, und einen Datenbankfehler bekommen.
  it('weist genau die Faelle ab, die 0910 abweist', () => {
    expect(angebotLohntSich(0, false)).toBe(false);
    expect(angebotLohntSich(1, false)).toBe(false);
    expect(angebotLohntSich(3.0, false)).toBe(false);   // Auszahlung waere 0,00
    expect(angebotLohntSich(3.01, false)).toBe(true);   // Auszahlung 0,01
    expect(angebotLohntSich(320, false)).toBe(true);
  });

  it('bei keinem zulaessigen Preis ist die Auszahlung negativ', () => {
    for (const p of [3.01, 3.5, 10, 37.49, 320, 25000]) {
      expect(angebotLohntSich(p, false)).toBe(true);
      expect(preisAufstellung(p, false, 0, false).auszahlung).toBeGreaterThan(0);
    }
  });

  it('bei jedem abgewiesenen Preis waere sie es', () => {
    for (const p of [0, 0.5, 1, 2.99, 3.0]) {
      expect(angebotLohntSich(p, false)).toBe(false);
      expect(preisAufstellung(p, false, 0, false).auszahlung).toBeLessThanOrEqual(0);
    }
  });

  it('Nachbarschaft hat ihre eigene Grenze (1,99 pauschal)', () => {
    expect(angebotLohntSich(1.99, true)).toBe(false);
    expect(angebotLohntSich(2.0, true)).toBe(true);
  });

  it('MINDESTPREIS ist dieselbe Zahl wie die Mindestgebuehr', () => {
    // Waeren die beiden verschieden, gaebe es zwei Wahrheiten ueber dieselbe
    // Grenze und eine davon veraltet.
    expect(MINDESTPREIS).toBe(MIN_PROVIDER_FEE);
  });
});
