/**
 * Der Anbieter-Beleg (`app/rechnung.tsx`).
 *
 * WARUM DIESE DATEI NEU IST (14.09.2026): Die vorige Fassung hat die Formel
 * des Bildschirms ABGESCHRIEBEN statt sie zu importieren. Im Kopf stand das
 * sogar als Vorzug: "All helpers are inlined here — no import of the React
 * screen needed." Damit konnte kein einziger Test den Bildschirm je widerlegen.
 * Sie hat den Fehler zusaetzlich als richtig festgeschrieben:
 *
 *     it('totalFee equals commission plus VAT for €100', () => {
 *       expect(totalFee).toBe(9.52);   // 8 % * 1,19
 *     });
 *
 * 9,52 % wurden nie einbehalten. Zugesagt und abgezogen werden 8 %.
 * Denselben Widerspruch trug die alte Datei schon in sich: ein Test hiess
 * "money is fully accounted for" und pruefte `commission + net === gross` —
 * fuer die 1,52 EUR aus `totalFee` ist darin kein Platz.
 *
 * Getestet wird jetzt die echte Funktion aus `lib/feeEngine.ts`.
 */

import {
  anbieterGebuehr,
  calcHandwerkerFees,
  PROVIDER_COMMISSION_RATE,
} from '../lib/feeEngine';

/** Rundung auf zwei Stellen, nur fuer Erwartungswerte in diesen Tests. */
function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

// ---------------------------------------------------------------------------
// Die Gebuehr ist der Betrag, der einbehalten wird — nicht mehr
// ---------------------------------------------------------------------------

describe('Anbieter-Gebuehr: ausgewiesen ist, was einbehalten wird', () => {
  it('weist genau die Provision aus, ohne Aufschlag', () => {
    expect(anbieterGebuehr(8.0, false).gebuehr).toBe(8.0);
  });

  it('Auszahlung plus ausgewiesene Gebuehr ergibt den Auftragswert', () => {
    // Die entscheidende Probe. Sobald jemand die USt wieder aufschlaegt,
    // ist die Summe groesser als der Auftragswert — es gibt kein Geld dafuer.
    for (const preis of [50, 100, 120, 375.5, 1000]) {
      const f = calcHandwerkerFees(preis, false);
      const g = anbieterGebuehr(f.providerCommission, false);
      expect(r2(f.providerPayout + g.gebuehr)).toBe(preis);
    }
  });

  it('die Gebuehr bleibt bei 8 Prozent des Auftragswerts', () => {
    const f = calcHandwerkerFees(1000, false);
    const g = anbieterGebuehr(f.providerCommission, false);
    expect(r2(g.gebuehr / 1000)).toBe(PROVIDER_COMMISSION_RATE);
  });
});

// ---------------------------------------------------------------------------
// Die Umsatzsteuer ist ENTHALTEN, nicht aufgeschlagen
// ---------------------------------------------------------------------------

describe('Umsatzsteuer im Anbieter-Beleg (§ 3a UStG)', () => {
  it('rechnet 19/119 heraus, nicht 19/100 obendrauf', () => {
    // 8,00 brutto: 8,00 * 19/119 = 1,2773… -> 1,28.
    // Aufgeschlagen waeren es 1,52 gewesen. Nach § 14c Abs. 1 UStG schuldet
    // den Mehrbetrag, wer eine hoehere Steuer ausweist, als er schuldet.
    expect(anbieterGebuehr(8.0, false).enthalteneUst).toBe(1.28);
    expect(anbieterGebuehr(8.0, false).enthalteneUst).not.toBe(1.52);
  });

  it('die Steuer ist stets kleiner als die Gebuehr, in der sie steckt', () => {
    for (const provision of [3, 8, 9.6, 80, 240.75]) {
      const g = anbieterGebuehr(provision, false);
      expect(g.enthalteneUst).toBeLessThan(g.gebuehr);
    }
  });

  it('Netto mal 1,19 ergibt die Gebuehr wieder', () => {
    for (const provision of [8, 9.6, 80]) {
      const g = anbieterGebuehr(provision, false);
      const netto = r2(g.gebuehr - g.enthalteneUst);
      expect(Math.abs(netto * 1.19 - g.gebuehr)).toBeLessThan(0.01);
    }
  });

  it('keine Steuer bei Reverse Charge, und die Gebuehr bleibt dieselbe', () => {
    for (const provision of [0, 3, 8, 80, 9999.99]) {
      const b2b = anbieterGebuehr(provision, true);
      const b2c = anbieterGebuehr(provision, false);
      expect(b2b.enthalteneUst).toBe(0);
      expect(b2b.gebuehr).toBe(b2c.gebuehr);
    }
  });

  it('kein Betrag bei einer Gebuehr von null', () => {
    const g = anbieterGebuehr(0, false);
    expect(g.gebuehr).toBe(0);
    expect(g.enthalteneUst).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Dieselbe Richtung in der Gesamtrechnung der Plattform
// ---------------------------------------------------------------------------

describe('Werkant-Erloes: die Steuer steckt im Bruttoerloes', () => {
  it('vatOnWerkr ist 19/119 von werkrGross, nicht 19/100', () => {
    const f = calcHandwerkerFees(100, false);
    // werkrGross = 8,00 + 2,50 = 10,50 -> 10,50 * 19/119 = 1,6764… -> 1,68
    expect(f.werkrGross).toBe(10.5);
    expect(f.vatOnWerkr).toBe(1.68);
    expect(f.vatOnWerkr).not.toBe(2.0);
  });

  it('werkrNet mal 1,19 ergibt werkrGross wieder', () => {
    for (const preis of [50, 100, 120, 1000]) {
      const f = calcHandwerkerFees(preis, false);
      expect(Math.abs(f.werkrNet * 1.19 - f.werkrGross)).toBeLessThan(0.01);
    }
  });

  it('der Bruttoerloes ist genau das, was beide Seiten zahlen', () => {
    // Kein Cent USt kommt von aussen dazu: Kunde zahlt Preis + Service-Fee,
    // Anbieter bekommt Preis - Provision. Die Differenz ist werkrGross.
    for (const preis of [50, 100, 375.5]) {
      const f = calcHandwerkerFees(preis, false);
      expect(r2(f.customerTotal - f.providerPayout)).toBe(f.werkrGross);
    }
  });
});
