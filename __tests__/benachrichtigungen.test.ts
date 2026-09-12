import {
  zusammenfuehren, ungeleseneAnzahl, type Mitteilung,
} from '../lib/benachrichtigungen';

const m = (p: Partial<Mitteilung> & { id: string; iso: string }): Mitteilung => ({
  art: 'system', titel: 't', text: 'x', gelesen: false,
  gespeichert: false, pflicht: false, ...p,
});

describe('zusammenfuehren', () => {
  it('Pflichtmitteilungen stehen oben, auch wenn sie aelter sind', () => {
    const strike = m({ id: 'n1', iso: '2026-09-01T10:00:00Z', pflicht: true, gespeichert: true, art: 'strike' });
    const chat   = m({ id: 'msg-9', iso: '2026-09-12T10:00:00Z', art: 'message' });
    const liste = zusammenfuehren([strike], [chat]);
    // Ein Strike traegt Frist und Beschwerdeweg. Er darf nicht unter
    // Chat-Nachrichten verschwinden.
    expect(liste.map((x) => x.id)).toEqual(['n1', 'msg-9']);
  });

  it('innerhalb derselben Dringlichkeit die neueste zuerst', () => {
    const alt = m({ id: 'a', iso: '2026-09-01T10:00:00Z' });
    const neu = m({ id: 'b', iso: '2026-09-12T10:00:00Z' });
    expect(zusammenfuehren([], [alt, neu]).map((x) => x.id)).toEqual(['b', 'a']);
  });

  it('zwei Pflichtmitteilungen: ebenfalls neueste zuerst', () => {
    const a = m({ id: 'p1', iso: '2026-09-01T10:00:00Z', pflicht: true });
    const b = m({ id: 'p2', iso: '2026-09-10T10:00:00Z', pflicht: true });
    expect(zusammenfuehren([a, b], []).map((x) => x.id)).toEqual(['p2', 'p1']);
  });

  it('bei gleicher Kennung gewinnt die gespeicherte Fassung', () => {
    // Nur die gespeicherte traegt einen Gelesen-Status, der das Schliessen
    // des Bildschirms ueberlebt.
    const ausDerTabelle = m({ id: 'x', iso: '2026-09-12T10:00:00Z', gelesen: true, gespeichert: true });
    const abgeleitet    = m({ id: 'x', iso: '2026-09-12T10:00:00Z', gelesen: false });
    const [eintrag] = zusammenfuehren([ausDerTabelle], [abgeleitet]);
    expect(eintrag.gelesen).toBe(true);
    expect(eintrag.gespeichert).toBe(true);
    expect(zusammenfuehren([ausDerTabelle], [abgeleitet])).toHaveLength(1);
  });

  it('leere Eingaben ergeben eine leere Liste', () => {
    expect(zusammenfuehren([], [])).toEqual([]);
  });
});

describe('ungeleseneAnzahl', () => {
  it('zaehlt nur die ungelesenen', () => {
    const liste = [
      m({ id: '1', iso: '2026-09-12T10:00:00Z', gelesen: true }),
      m({ id: '2', iso: '2026-09-12T11:00:00Z' }),
      m({ id: '3', iso: '2026-09-12T12:00:00Z' }),
    ];
    expect(ungeleseneAnzahl(liste)).toBe(2);
  });

  it('alles gelesen ergibt null', () => {
    expect(ungeleseneAnzahl([m({ id: '1', iso: 'x', gelesen: true })])).toBe(0);
  });
});
