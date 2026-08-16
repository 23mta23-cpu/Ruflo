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
