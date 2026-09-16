import { schnitteAusZeilen as rechne } from '../lib/bewertungsschnitt';

// Geprueft wird die ECHTE Funktion aus lib/reviews.ts. Die erste Fassung
// dieses Tests hatte die Schleife abgeschrieben und sich damit selbst
// bestaetigt -- ein Test, der den Fehler nicht sehen kann, den er verhindern
// soll.

describe('Bewertungsschnitt (Rechenregel)', () => {
  it('mittelt ueber alle Bewertungen einer Person', () => {
    expect(rechne([
      { reviewed_id: 'a', rating: 5 },
      { reviewed_id: 'a', rating: 4 },
      { reviewed_id: 'a', rating: 3 },
    ])).toEqual({ a: { schnitt: 4, anzahl: 3 } });
  });

  it('haelt zwei Personen auseinander', () => {
    expect(rechne([
      { reviewed_id: 'a', rating: 5 },
      { reviewed_id: 'b', rating: 1 },
    ])).toEqual({ a: { schnitt: 5, anzahl: 1 }, b: { schnitt: 1, anzahl: 1 } });
  });

  it('wer nicht bewertet wurde, taucht gar nicht auf', () => {
    // Nicht mit 0 -- das waere eine Aussage, die niemand getroffen hat.
    expect(rechne([])).toEqual({});
    expect(rechne([{ reviewed_id: 'a', rating: 3 }])['b']).toBeUndefined();
  });

  it('rundet nicht vorzeitig', () => {
    // 4 + 5 = 9 / 2 = 4,5. Ein frueh gerundeter Zwischenwert ergaebe 4 oder 5.
    expect(rechne([
      { reviewed_id: 'a', rating: 4 },
      { reviewed_id: 'a', rating: 5 },
    ]).a.schnitt).toBeCloseTo(4.5, 10);
  });
});
