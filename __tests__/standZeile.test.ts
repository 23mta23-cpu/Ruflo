import { standZeile } from '../lib/standZeile';

describe('standZeile', () => {
  it('nennt Fassung und Auslieferungsstand', () => {
    expect(standZeile('1.0.0', 'a1b2c3d · 21.09.2026'))
      .toBe('Werkant 1.0.0 · Stand a1b2c3d · 21.09.2026');
  });

  it('sagt ohne Build-Kennung ausdruecklich Entwicklungsstand', () => {
    expect(standZeile('1.0.0', undefined)).toBe('Werkant 1.0.0 · Entwicklungsstand');
  });

  // Der Deploy-Workflow setzt die Variable auch dann, wenn der Schritt
  // davor nichts gefunden hat -- dann kommt ein leerer String an. Der darf
  // nicht als gueltige Kennung durchgehen.
  it('behandelt eine leere Kennung wie eine fehlende', () => {
    expect(standZeile('1.0.0', '')).toBe('Werkant 1.0.0 · Entwicklungsstand');
    expect(standZeile('1.0.0', '   ')).toBe('Werkant 1.0.0 · Entwicklungsstand');
  });

  it('kommt ohne Fassung aus, statt „undefined" anzuzeigen', () => {
    expect(standZeile(undefined, 'a1b2c3d')).toBe('Werkant · Stand a1b2c3d');
    expect(standZeile(null, null)).toBe('Werkant · Entwicklungsstand');
  });

  // Kein Gedankenstrich in sichtbarem Text (Founder-Anweisung 07.09.2026).
  it('setzt keinen Gedankenstrich', () => {
    const alle = [standZeile('1.0.0', 'x'), standZeile(null, null)];
    for (const z of alle) expect(z).not.toMatch(/[—–]/);
  });
});
