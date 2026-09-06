/**
 * Tests fuer lib/kalenderWoche.ts — Blaettern im Anbieter-Kalender.
 *
 * Anlass (16.08.2026, Founder-Befund): „Im kalender kann ich nur die woche
 * sehen? Was ist wenn es am naechsten monat ist".
 *
 * Nachgeprueft war es schlimmer als beschrieben. app/betrieb/kalender.tsx
 * berechnete die Woche fest aus `new Date()` — es gab ueberhaupt keine
 * Moeglichkeit zu blaettern — und loadBooked() verwarf zusaetzlich JEDEN
 * Termin ausserhalb dieser Woche. Ein bestaetigter Auftrag am 28.08. war fuer
 * den Anbieter nicht schwer zu finden, sondern unsichtbar.
 *
 * Der Bildschirm selbst haengt an Anmeldung UND Anbieter-Rolle und ist im
 * Browser-Durchlauf nicht erreichbar (Reise 2 endet beim Gewerbeschein).
 * Deshalb ist die Datumsarithmetik hier ausgelagert und wird direkt geprueft.
 * Alle Tests setzen `heute` ein, damit sie nicht vom Ausfuehrungstag abhaengen
 * — ein Test, der nur montags gruen ist, ist kein Test.
 */

import { isoTag, montagDerWoche, wochenTage } from '../lib/kalenderWoche';

// Ein Donnerstag.
const DONNERSTAG = new Date(2026, 7, 20, 15, 30);

describe('montagDerWoche', () => {
  it('findet den Montag der laufenden Woche', () => {
    expect(isoTag(montagDerWoche(0, DONNERSTAG))).toBe('2026-08-17');
  });

  it('blaettert vorwaerts und rueckwaerts in Sieben-Tage-Schritten', () => {
    expect(isoTag(montagDerWoche(1, DONNERSTAG))).toBe('2026-08-24');
    expect(isoTag(montagDerWoche(-1, DONNERSTAG))).toBe('2026-08-10');
    expect(isoTag(montagDerWoche(3, DONNERSTAG))).toBe('2026-09-07');
  });

  it('zaehlt den Sonntag zur ablaufenden, nicht zur kommenden Woche', () => {
    // getDay() liefert fuer Sonntag 0. Ohne die (+6)%7-Verschiebung faengt die
    // Woche am Sonntag an und der Sonntag rutscht in die falsche Woche.
    const sonntag = new Date(2026, 7, 23, 12, 0);
    expect(isoTag(montagDerWoche(0, sonntag))).toBe('2026-08-17');
  });

  it('setzt den Montag auf Tagesbeginn', () => {
    const m = montagDerWoche(0, DONNERSTAG);
    expect([m.getHours(), m.getMinutes(), m.getSeconds()]).toEqual([0, 0, 0]);
  });
});

describe('wochenTage', () => {
  it('liefert Montag bis Sonntag', () => {
    expect(wochenTage(0, DONNERSTAG).map(isoTag)).toEqual([
      '2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20',
      '2026-08-21', '2026-08-22', '2026-08-23',
    ]);
  });

  it('laeuft ueber die Monatsgrenze, ohne bei 31 stehenzubleiben', () => {
    // Genau der Fall aus dem Founder-Befund: der Termin liegt "im naechsten
    // Monat". Eine Woche kann in zwei Monaten liegen.
    expect(wochenTage(1, new Date(2026, 7, 27)).map(isoTag)).toEqual([
      '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03',
      '2026-09-04', '2026-09-05', '2026-09-06',
    ]);
  });

  it('laeuft ueber den Jahreswechsel', () => {
    expect(wochenTage(0, new Date(2026, 11, 31)).map(isoTag)).toEqual([
      '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31',
      '2027-01-01', '2027-01-02', '2027-01-03',
    ]);
  });

  it('vergibt ueber Wochen hinweg lauter VERSCHIEDENE Tagesschluessel', () => {
    // Das ist der eigentliche Fehler hinter dem Symptom: Buchungen lagen unter
    // `${wochentag}-${stunde}`. Dieser Schluessel wiederholt sich jede Woche —
    // beim Blaettern waeren die Termine der einen Woche in jeder anderen
    // erschienen.
    const schluessel = [-2, -1, 0, 1, 2]
      .flatMap((v) => wochenTage(v, DONNERSTAG).map(isoTag));
    expect(new Set(schluessel).size).toBe(schluessel.length);
  });
});

describe('isoTag', () => {
  it('nimmt die Ortszeit, nicht UTC', () => {
    // toISOString() haette hier '2026-08-31' geliefert: 00:30 deutscher
    // Sommerzeit ist 22:30 UTC des Vortages. Ein Termin kurz nach Mitternacht
    // waere damit einen Tag zu frueh im Kalender gestanden.
    expect(isoTag(new Date(2026, 8, 1, 0, 30))).toBe('2026-09-01');
  });

  it('fuellt Monat und Tag zweistellig auf', () => {
    expect(isoTag(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

/* ═══ Sprung zu einem beliebigen Datum (Founder-Befund 07.09.2026) ═════════
   "Ich moechte auch Kalender fuer die naechsten Wochen etc. anklicken koennen
   oder 2027 — gerade ist es schlecht geregelt mit +1 etc."
   Der Kalender kannte nur Wochenschritte. Fuer Januar 2027 waeren das rund
   70 Tipper gewesen.                                                        */
import { wochenVersatzZu, monatsRaster, wochenZeitraum } from '../lib/kalenderWoche';

describe('wochenVersatzZu', () => {
  const heute = new Date(2026, 8, 11); // Freitag, 11.09.2026

  it('liefert 0 fuer jeden Tag der laufenden Woche', () => {
    // Der Kern: nicht die Tagesdifferenz durch 7, sondern die Woche. Ein
    // Zieltag am Montag derselben Woche liegt 4 Tage zurueck — das darf
    // NICHT -1 ergeben.
    expect(wochenVersatzZu(new Date(2026, 8, 7), heute)).toBe(0);   // Mo
    expect(wochenVersatzZu(new Date(2026, 8, 11), heute)).toBe(0);  // Fr
    expect(wochenVersatzZu(new Date(2026, 8, 13), heute)).toBe(0);  // So
  });

  it('zaehlt Wochen vorwaerts und rueckwaerts', () => {
    expect(wochenVersatzZu(new Date(2026, 8, 14), heute)).toBe(1);
    expect(wochenVersatzZu(new Date(2026, 8, 6), heute)).toBe(-1);
  });

  it('springt ueber den Jahreswechsel — der eigentliche Anlass', () => {
    // 4.1.2027 ist ein Montag. Von der Woche des 7.9.2026 sind das 17 Wochen.
    expect(wochenVersatzZu(new Date(2027, 0, 4), heute)).toBe(17);
    // Und der Weg zurueck stimmt auch.
    expect(wochenVersatzZu(heute, new Date(2027, 0, 4))).toBe(-17);
  });

  it('kippt an der Zeitumstellung nicht', () => {
    // In der Nacht zum 25.10.2026 wird die Uhr zurueckgestellt: diese Woche
    // hat 169 Stunden. Eine Division durch 168 ergaebe 1,006 — mit Math.floor
    // waere das noch 1, ueber mehrere Umstellungen hinweg aber nicht mehr.
    const vor  = new Date(2026, 9, 19);  // Mo vor der Umstellung
    const nach = new Date(2026, 9, 26);  // Mo danach
    expect(wochenVersatzZu(nach, vor)).toBe(1);
    // Ueber beide Umstellungen eines Jahres hinweg (Maerz und Oktober).
    expect(wochenVersatzZu(new Date(2027, 2, 29), new Date(2026, 9, 19))).toBe(23);
  });
});

describe('wochenZeitraum', () => {
  const heute = new Date(2026, 8, 11);

  it('nennt ein Datum statt eines Versatzes', () => {
    // Der Founder-Befund im Kern: "+3 Wochen" sagt niemandem, welche Woche
    // er gerade ansieht.
    expect(wochenZeitraum(0, heute)).toBe('7.–13. Sep. 2026');
  });

  it('nennt beide Monate, wenn die Woche einen Monatswechsel enthaelt', () => {
    expect(wochenZeitraum(3, heute)).toBe('28. Sep.–4. Okt. 2026');
  });

  it('nennt beide Jahre ueber den Jahreswechsel', () => {
    const s = wochenZeitraum(16, heute);           // 28.12.2026 – 3.1.2027
    expect(s).toContain('2026');
    expect(s).toContain('2027');
  });
});

describe('monatsRaster', () => {
  it('beginnt an einem Montag und deckt den ganzen Monat ab', () => {
    const tage = monatsRaster(2026, 8); // September 2026
    expect(tage[0].getDay()).toBe(1);
    expect(tage.some((d) => d.getDate() === 1 && d.getMonth() === 8)).toBe(true);
    expect(tage.some((d) => d.getDate() === 30 && d.getMonth() === 8)).toBe(true);
    expect(tage.length % 7).toBe(0);
  });

  it('haengt keine ueberfluessige Fremdwoche an', () => {
    // Februar 2027 beginnt an einem Montag und hat genau 28 Tage — vier
    // Wochen, keine mehr. Ein starres 42-Tage-Raster haengte zwei komplett
    // fremde Wochen unten dran.
    expect(monatsRaster(2027, 1).length).toBe(28);
  });
});
