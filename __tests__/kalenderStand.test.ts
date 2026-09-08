import { kalenderStandNachFokus, wochenTage, isoTag } from '../lib/kalenderWoche';

describe('kalenderStandNachFokus', () => {
  const sonntag = new Date(2026, 8, 13, 22, 0);   // So, 13.09.2026
  const montag  = new Date(2026, 8, 14, 8, 0);    // Mo, 14.09.2026

  it('gleicher Tag: der Stand bleibt unveraendert', () => {
    const stand = { anker: isoTag(sonntag), versatz: 3, gewaehlterTag: 6 };
    const spaeter = new Date(2026, 8, 13, 23, 59);
    expect(kalenderStandNachFokus(stand, spaeter)).toBe(stand);
  });

  it('neuer Tag in derselben Woche: Anker und Wochentag wandern mit', () => {
    const stand = { anker: '2026-09-08', versatz: 0, gewaehlterTag: 1 };
    const mittwoch = new Date(2026, 8, 9, 9, 0);
    expect(kalenderStandNachFokus(stand, mittwoch))
      .toEqual({ anker: '2026-09-09', versatz: 0, gewaehlterTag: 2 });
  });

  // Der Fall aus der Founder-Frage: App bleibt ueber den Wochenwechsel offen.
  it('ueber den Wochenwechsel: "Diese Woche" ist danach wirklich diese Woche', () => {
    const stand = { anker: isoTag(sonntag), versatz: 0, gewaehlterTag: 6 };
    const neu = kalenderStandNachFokus(stand, montag);
    expect(neu.anker).toBe('2026-09-14');
    expect(neu.gewaehlterTag).toBe(0);

    const alteWoche = wochenTage(neu.versatz, sonntag).map(isoTag);
    const neueWoche = wochenTage(neu.versatz, montag).map(isoTag);
    expect(alteWoche[0]).toBe('2026-09-07');
    expect(neueWoche[0]).toBe('2026-09-14');
  });

  it('geblaetterte Woche wird beim Tagwechsel auf die laufende zurueckgesetzt', () => {
    const stand = { anker: isoTag(sonntag), versatz: 3, gewaehlterTag: 4 };
    expect(kalenderStandNachFokus(stand, montag).versatz).toBe(0);
  });
});
