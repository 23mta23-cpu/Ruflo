import { aktionsleistenRand, LEISTEN_GRUNDABSTAND } from '../lib/sichererRand';

describe('aktionsleistenRand', () => {
  it('gibt ohne geschuetzten Bereich den Grundabstand', () => {
    // iPhone SE, Android mit drei Knoepfen, Web.
    expect(aktionsleistenRand(0)).toBe(16);
  });

  it('legt den geschuetzten Bereich OBEN DRAUF, statt ihn zu ersetzen', () => {
    // iPhone ab X: 34 px Home-Anzeige. Der Knopf muss darueber enden,
    // nicht darin. 34 allein waere zu knapp, 28 (der alte Festwert) liegt
    // sogar darunter.
    expect(aktionsleistenRand(34)).toBe(50);
    expect(aktionsleistenRand(34)).toBeGreaterThan(34);
    expect(aktionsleistenRand(34)).toBeGreaterThan(28);
  });

  it('waechst mit dem Rand', () => {
    expect(aktionsleistenRand(48)).toBeGreaterThan(aktionsleistenRand(34));
  });

  it('faellt bei unsinnigen Werten auf den Grundabstand zurueck', () => {
    // Ein negativer Wert wuerde den Knopf aus dem Bild schieben.
    expect(aktionsleistenRand(-10)).toBe(LEISTEN_GRUNDABSTAND);
    expect(aktionsleistenRand(Number.NaN)).toBe(LEISTEN_GRUNDABSTAND);
  });
});
