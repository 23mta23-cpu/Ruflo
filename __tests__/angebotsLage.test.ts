/**
 * Der leere Angebotszustand.
 *
 * Der Kern ist die Unterscheidung NULL / 0: „noch nicht gelaufen" gegen
 * „gelaufen und niemand passte". Wer beides gleich behandelt, hat die Spalte
 * umsonst angelegt.
 *
 * Alle Faelle bekommen `jetzt` uebergeben. Ein Test, der die Systemuhr liest,
 * ist an einem anderen Tag ein anderer Test (CLAUDE.md, 16.08.).
 */
import { lageBestimmen, lageText, seitText, stundenSeit } from '../lib/angebotsLage';

const JETZT = new Date('2026-09-16T12:00:00+02:00');
const vorStunden = (n: number) =>
  new Date(JETZT.getTime() - n * 3_600_000).toISOString();

describe('stundenSeit', () => {
  it('rechnet volle Stunden', () => {
    expect(stundenSeit(vorStunden(3), JETZT)).toBe(3);
    expect(stundenSeit(vorStunden(0.9), JETZT)).toBe(0);
  });
  it('haelt eine schiefe Uhr aus', () => {
    expect(stundenSeit(new Date(JETZT.getTime() + 7_200_000).toISOString(), JETZT)).toBe(0);
  });
  it('erfindet nichts aus fehlenden oder kaputten Angaben', () => {
    expect(stundenSeit(null, JETZT)).toBe(0);
    expect(stundenSeit('kein Datum', JETZT)).toBe(0);
  });
});

describe('lageBestimmen', () => {
  it('NULL heisst unbekannt, nicht niemand', () => {
    expect(lageBestimmen({ created_at: vorStunden(5), benachrichtigte_betriebe: null }, JETZT))
      .toEqual({ art: 'unbekannt' });
    expect(lageBestimmen({ created_at: vorStunden(5), benachrichtigte_betriebe: undefined as never }, JETZT))
      .toEqual({ art: 'unbekannt' });
  });

  it('0 heisst niemand, und das ist der Fall, auf den es ankommt', () => {
    expect(lageBestimmen({ created_at: vorStunden(5), benachrichtigte_betriebe: 0 }, JETZT))
      .toEqual({ art: 'niemand', stunden: 5 });
  });

  it('eine Zahl groesser 0 heisst warten', () => {
    expect(lageBestimmen({ created_at: vorStunden(30), benachrichtigte_betriebe: 4 }, JETZT))
      .toEqual({ art: 'wartet', betriebe: 4, stunden: 30 });
  });
});

describe('seitText', () => {
  it('schreibt beide Mehrzahlformen aus', () => {
    // Deutsche Mehrzahl nie zusammensetzen (CLAUDE.md, 08.09.).
    expect(seitText(0)).toBe('gerade eben');
    expect(seitText(1)).toBe('seit einer Stunde');
    expect(seitText(5)).toBe('seit 5 Stunden');
    expect(seitText(24)).toBe('seit einem Tag');
    expect(seitText(49)).toBe('seit 2 Tagen');
  });
});

describe('lageText', () => {
  it('nennt bei einem Betrieb die Einzahl', () => {
    const t = lageText({ art: 'wartet', betriebe: 1, stunden: 2 });
    expect(t.text).toContain('Ein Betrieb');
    expect(t.text).toContain('wurde über Ihren Auftrag informiert');
    expect(t.text).not.toContain('Betriebe');
  });

  it('nennt bei mehreren die Mehrzahl', () => {
    const t = lageText({ art: 'wartet', betriebe: 3, stunden: 2 });
    expect(t.text).toContain('3 Betriebe');
    expect(t.text).toContain('wurden');
  });

  it('sagt bei niemand die Wahrheit statt zu schweigen', () => {
    const t = lageText({ art: 'niemand', stunden: 9 });
    expect(t.titel).toMatch(/noch kein passender Betrieb/i);
    expect(t.text).toContain('konnten wir in Ihrem Postleitzahlenbereich noch niemanden');
  });

  it('verspricht nirgends eine Frist', () => {
    // Genau die Klasse, die am 15.09. aus dem Produkt geflogen ist.
    for (const l of [
      { art: 'unbekannt' } as const,
      { art: 'wartet', betriebe: 2, stunden: 1 } as const,
      { art: 'niemand', stunden: 1 } as const,
    ]) {
      const t = lageText(l);
      expect(t.titel + ' ' + t.text).not.toMatch(
        /innerhalb von \d|in \d+ ?(h|Stunden)\b|binnen \d|spätestens/i);
    }
  });

  it('siezt und setzt keinen Gedankenstrich', () => {
    for (const l of [
      { art: 'unbekannt' } as const,
      { art: 'wartet', betriebe: 2, stunden: 1 } as const,
      { art: 'niemand', stunden: 1 } as const,
    ]) {
      const t = lageText(l);
      const ganz = t.titel + ' ' + t.text;
      expect(ganz).not.toMatch(/\b(du|dein|deine|dir|dich)\b/i);
      expect(ganz).not.toMatch(/—| – /);
    }
  });
});
