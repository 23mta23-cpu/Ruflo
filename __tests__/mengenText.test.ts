import { anzahlText } from '../lib/mengenText';

describe('anzahlText', () => {
  // Der Fall vom Bildschirmfoto des Founders (08.09.2026).
  it('drei offene Auftraege: Umlaut in der Mehrzahl, Verb im Plural', () => {
    expect(anzahlText(3, 'neuer Auftrag wartet', 'neue Aufträge warten'))
      .toBe('3 neue Aufträge warten');
  });

  it('einer: Einzahl mit ausgeschriebener Eins', () => {
    expect(anzahlText(1, 'neuer Auftrag wartet', 'neue Aufträge warten'))
      .toBe('1 neuer Auftrag wartet');
  });

  it('null nimmt die Mehrzahl', () => {
    expect(anzahlText(0, 'Termin heute', 'Termine heute')).toBe('0 Termine heute');
  });

  it('Termine: keine Umlautfalle, aber dieselbe Regel', () => {
    expect(anzahlText(2, 'Termin heute', 'Termine heute')).toBe('2 Termine heute');
    expect(anzahlText(1, 'Termin heute', 'Termine heute')).toBe('1 Termin heute');
  });
});
