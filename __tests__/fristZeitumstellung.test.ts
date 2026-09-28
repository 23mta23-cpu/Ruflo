/**
 * Fristen ueber die Zeitumstellung.
 *
 * ANLASS (28.09.2026): `jest.config.js` setzt TZ='Europe/Berlin' -- seit dem
 * 16.08. bewusst, weil Datumslogik in UTC ungetestet ist. Damit laufen diese
 * Tests in einer Zone MIT Sommerzeit, und genau dort trennt sich eine feste
 * Dauer (14 x 24 h) von einem Kalendertag.
 *
 * `lib/bewertungsFrist.ts` rechnet als DAUER. Das ist die Absicht und deckt
 * sich mit der Policy in 0930, solange die Datenbank in UTC laeuft
 * (gemessen, siehe scripts/db-test/bewertung-frist-antwort.sql BA11/BA12).
 * Diese Tests halten die Dauer-Semantik fest: wer sie spaeter auf `setDate`
 * umbaut, bekommt eine Kalender-Semantik und damit eine Stunde Abweichung
 * gegenueber dem Server -- im Maerz in die schlimmere Richtung.
 */
import { fristLage, darfBewerten } from '../lib/bewertungsFrist';

// Umstellung 2026: 29.03. (vor -> zurueck 2 Uhr wird 3 Uhr, Tag hat 23 h)
// und 25.10. (Tag hat 25 h).
const VOR_MAERZ = '2026-03-22T12:00:00+01:00';
const VOR_OKTOBER = '2026-10-18T12:00:00+02:00';

describe('Bewertungsfrist ueber die Zeitumstellung', () => {
  it('laeuft im Maerz nach genau 14 x 24 Stunden ab, nicht nach 14 Kalendertagen', () => {
    const start = new Date(VOR_MAERZ).getTime();
    const knappDavor = new Date(start + 14 * 86_400_000 - 60_000);
    const knappDanach = new Date(start + 14 * 86_400_000 + 60_000);
    expect(darfBewerten(VOR_MAERZ, knappDavor)).toBe(true);
    expect(darfBewerten(VOR_MAERZ, knappDanach)).toBe(false);
  });

  it('laeuft im Oktober ebenso nach genau 14 x 24 Stunden ab', () => {
    const start = new Date(VOR_OKTOBER).getTime();
    const knappDavor = new Date(start + 14 * 86_400_000 - 60_000);
    const knappDanach = new Date(start + 14 * 86_400_000 + 60_000);
    expect(darfBewerten(VOR_OKTOBER, knappDavor)).toBe(true);
    expect(darfBewerten(VOR_OKTOBER, knappDanach)).toBe(false);
  });

  it('zaehlt die Resttage ueber die Maerz-Umstellung ohne Sprung', () => {
    // Sieben Tage nach dem Start, also mitten ueber die Umstellung hinweg.
    const start = new Date(VOR_MAERZ).getTime();
    const lage = fristLage(VOR_MAERZ, new Date(start + 7 * 86_400_000));
    expect(lage).toEqual({ art: 'offen', verbleibendeTage: 7 });
  });

  it('zaehlt die Resttage ueber die Oktober-Umstellung ohne Sprung', () => {
    const start = new Date(VOR_OKTOBER).getTime();
    const lage = fristLage(VOR_OKTOBER, new Date(start + 7 * 86_400_000));
    expect(lage).toEqual({ art: 'offen', verbleibendeTage: 7 });
  });

  it('meldet den letzten Tag auch, wenn die Umstellung dazwischen lag', () => {
    const start = new Date(VOR_MAERZ).getTime();
    const lage = fristLage(VOR_MAERZ, new Date(start + 13.5 * 86_400_000));
    expect(lage.art).toBe('letzterTag');
  });

  it('die Testumgebung laeuft wirklich in einer Zone mit Sommerzeit', () => {
    // Ohne diese Zusicherung waeren alle Tests oben in UTC trivial gruen --
    // dort gibt es keine Umstellung, und sie koennten nichts messen.
    const winter = new Date('2026-01-15T12:00:00Z').getTimezoneOffset();
    const sommer = new Date('2026-07-15T12:00:00Z').getTimezoneOffset();
    expect(winter).not.toBe(sommer);
  });
});
