/**
 * Wer steht hinter einem Angebot?
 *
 * Der Fall, auf den es ankommt, ist der FEHLENDE Name. „Anbieter" hinzustellen
 * sah bis 0800 aus wie ein Name und war keiner; ein leeres Feld liest sich wie
 * ein Ladefehler. Beides ist schlechter als die Wahrheit: dieser Betrieb ist
 * fuer den Kunden nicht aufrufbar.
 */
import {
  anbieterZeile,
  bewertungsZeile,
  annahmeFrage,
} from '../lib/angebotsAnbieter';

describe('anbieterZeile', () => {
  it('nennt den Betrieb beim Namen', () => {
    const z = anbieterZeile({ business_name: 'Elektro Yilmaz GmbH', rating_avg: 4.8, rating_count: 12 });
    expect(z.name).toBe('Elektro Yilmaz GmbH');
    expect(z.hinweis).toBeNull();
    expect(z.bewertung).toBe('4,8 · 12 Bewertungen');
  });

  it('sagt beim fehlenden Namen, was Sache ist, statt ihn zu erfinden', () => {
    for (const p of [null, undefined, {}, { business_name: null }, { business_name: '   ' }]) {
      const z = anbieterZeile(p as Parameters<typeof anbieterZeile>[0]);
      expect(z.name).toBe('Name nicht öffentlich');
      expect(z.name).not.toBe('Anbieter');
      expect(z.hinweis).toMatch(/nicht im Verzeichnis/);
    }
  });

  it('behauptet ohne Namen auch keine Bewertung', () => {
    // Eine Bewertung zu einem Betrieb, den man nicht aufrufen kann, ist eine
    // Zahl ohne Gegenstand.
    const z = anbieterZeile({ business_name: null, rating_avg: 5, rating_count: 99 });
    expect(z.bewertung).toBe('Keine Bewertungen einsehbar');
  });
});

describe('bewertungsZeile', () => {
  it('schreibt die deutsche Mehrzahl aus', () => {
    expect(bewertungsZeile({ business_name: 'X', rating_avg: 4.0, rating_count: 1 }))
      .toBe('4,0 · 1 Bewertung');
    expect(bewertungsZeile({ business_name: 'X', rating_avg: 4.0, rating_count: 2 }))
      .toBe('4,0 · 2 Bewertungen');
  });

  it('nutzt das deutsche Dezimalkomma', () => {
    expect(bewertungsZeile({ business_name: 'X', rating_avg: 4.75, rating_count: 3 }))
      .toMatch(/^4,8 /);
  });

  it('erfindet bei null Bewertungen keinen Schnitt', () => {
    for (const p of [
      { rating_avg: null, rating_count: 0 },
      { rating_avg: 0, rating_count: 0 },
      { rating_avg: 4.5, rating_count: 0 },
      {},
    ]) {
      expect(bewertungsZeile(p)).toBe('Noch keine Bewertungen');
    }
  });
});

describe('annahmeFrage', () => {
  it('nennt Betrieb UND Betrag', () => {
    // „das Angebot fuer 320,00 EUR annehmen" laesst offen, mit WEM der Vertrag
    // zustande kommt. Das ist die Frage, die im Zweifel zaehlt.
    const f = annahmeFrage('Elektro Yilmaz GmbH', '320,00 €');
    expect(f).toContain('Elektro Yilmaz GmbH');
    expect(f).toContain('320,00 €');
    expect(f).toMatch(/verbindlicher Vertrag/);
  });
});
