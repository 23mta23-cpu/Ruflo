import { ungeleseneMitteilungen } from '../lib/benachrichtigungen';

const zeilen = (...werte: (string | null)[]) =>
  async () => ({ data: werte.map((gelesen_am) => ({ gelesen_am })), error: null });

describe('ungeleseneMitteilungen', () => {
  it('zaehlt nur die ohne Lesedatum', async () => {
    expect(await ungeleseneMitteilungen(zeilen(null, '2026-09-16T10:00:00Z', null))).toBe(2);
  });

  it('alles gelesen ergibt 0', async () => {
    expect(await ungeleseneMitteilungen(zeilen('2026-09-16T10:00:00Z'))).toBe(0);
  });

  it('nichts da ergibt 0', async () => {
    expect(await ungeleseneMitteilungen(zeilen())).toBe(0);
  });

  it('ein Fehler erfindet keine Zahl', async () => {
    // Ein Punkt an der Glocke, hinter dem nichts steht, schickt den Betrieb
    // auf einen leeren Bildschirm und kostet Vertrauen.
    expect(await ungeleseneMitteilungen(async () => ({ data: null, error: new Error('Netz') }))).toBe(0);
    expect(await ungeleseneMitteilungen(async () => ({ data: [{ gelesen_am: null }], error: new Error('Netz') }))).toBe(0);
  });

  it('null-Daten ohne Fehler ergeben auch 0', async () => {
    expect(await ungeleseneMitteilungen(async () => ({ data: null, error: null }))).toBe(0);
  });
});
