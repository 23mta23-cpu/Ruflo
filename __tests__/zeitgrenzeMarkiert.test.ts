import { mitZeitgrenzeMarkiert } from '../lib/retry';

describe('mitZeitgrenzeMarkiert', () => {
  it('gibt einen echten Wert als { wert } zurueck', async () => {
    const r = await mitZeitgrenzeMarkiert(Promise.resolve('da'), 50);
    expect(r).toEqual({ wert: 'da' });
  });

  it('unterscheidet „Datensatz gibt es nicht" von „Zeitgrenze"', async () => {
    // Der Kern: ein regulaeres null kommt VERPACKT zurueck.
    const nichtGefunden = await mitZeitgrenzeMarkiert(Promise.resolve(null), 50);
    expect(nichtGefunden).toEqual({ wert: null });
    expect(nichtGefunden).not.toBeNull();
  });

  it('gibt bei Zeitablauf null zurueck', async () => {
    const r = await mitZeitgrenzeMarkiert(new Promise(() => {}), 20);
    expect(r).toBeNull();
  });

  it('reicht einen Wurf durch, statt ihn zu null zu machen', async () => {
    await expect(mitZeitgrenzeMarkiert(Promise.reject(new Error('kaputt')), 50))
      .rejects.toThrow('kaputt');
  });
});
