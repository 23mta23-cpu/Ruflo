/**
 * Wie lange wartet ein Vorgang, und ist die Zusage überschritten?
 *
 * ANLASS (21.09.2026): `disputes` und `inhalts_meldungen` liest niemand. Bei
 * den Reklamationen hängt Geld daran (0770 friert den Treuhandbetrag ein),
 * und der Bildschirm sagt dem Kunden 2 Werktage zu.
 */
import {
  werktageDazwischen, reklamationsLage, meldungsLage, wartetSeitText,
  MELDUNG_FRIST_STUNDEN,
} from '../lib/wartendes';
import { REKLAMATION_FRIST_WERKTAGE } from '../constants/legal';

// 2026-09-21 ist ein Montag. Feste Daten, kein `new Date()` im Test.
const MO = (t = '09:00') => new Date(`2026-09-21T${t}:00`);
const DI = (t = '09:00') => new Date(`2026-09-22T${t}:00`);
const MI = (t = '09:00') => new Date(`2026-09-23T${t}:00`);
const FR = (t = '09:00') => new Date(`2026-09-18T${t}:00`);
const SA = (t = '09:00') => new Date(`2026-09-19T${t}:00`);

describe('werktageDazwischen', () => {
  it('zählt Montag bis Mittwoch als zwei Werktage', () => {
    expect(werktageDazwischen(MO(), MI())).toBe(2);
  });

  it('überspringt das Wochenende', () => {
    // Freitag bis Montag ist EIN Werktag, nicht drei. Ohne das wäre jede
    // Freitagsmeldung am Montagmorgen „überfällig", und der Betreiber
    // gewöhnt sich an rote Zeilen, die keine sind.
    expect(werktageDazwischen(FR(), MO())).toBe(1);
  });

  it('zählt innerhalb desselben Tages nichts', () => {
    expect(werktageDazwischen(MO('08:00'), MO('23:00'))).toBe(0);
  });

  it('zählt von Montag 23:00 auf Dienstag 01:00 einen Werktag, nicht zwei Stunden', () => {
    // Bewusst so: die Zahl sortiert ein Postfach, sie berechnet keine Frist
    // vor Gericht. Der Kommentar in lib/wartendes.ts sagt das auch.
    expect(werktageDazwischen(MO('23:00'), DI('01:00'))).toBe(1);
  });

  it('gibt bei Unsinn 0 statt NaN', () => {
    expect(werktageDazwischen(new Date('kaputt'), MO())).toBe(0);
    expect(werktageDazwischen(MI(), MO())).toBe(0);
  });
});

describe('reklamationsLage', () => {
  it('ist frisch am selben Tag', () => {
    expect(reklamationsLage(MO('08:00').toISOString(), MO('17:00'))).toBe('frisch');
  });

  it('wird fällig genau bei der zugesagten Frist', () => {
    // Die Trennung „fällig" / „überfällig" ist der Sinn: wer nur überfällig
    // kennt, erfährt es erst, wenn die Zusage schon gebrochen ist.
    const start = new Date(MO());
    const ziel = new Date(start);
    let werktage = 0;
    while (werktage < REKLAMATION_FRIST_WERKTAGE) {
      ziel.setDate(ziel.getDate() + 1);
      if (ziel.getDay() !== 0 && ziel.getDay() !== 6) werktage += 1;
    }
    expect(reklamationsLage(start.toISOString(), ziel)).toBe('faellig');
  });

  it('ist überfällig einen Werktag später', () => {
    expect(reklamationsLage(FR().toISOString(), new Date('2026-09-24T09:00:00'))).toBe('ueberfaellig');
  });

  it('meldet ohne Zeitpunkt nicht fälschlich überfällig', () => {
    // Gegenprobe: eine fehlende Angabe darf keine rote Zeile erzeugen,
    // sonst ist das Postfach nach einer Woche durchgehend rot.
    expect(reklamationsLage(null, MO())).toBe('frisch');
    expect(reklamationsLage('kaputt', MO())).toBe('frisch');
  });
});

describe('meldungsLage', () => {
  it('ist frisch innerhalb der Betriebsfrist', () => {
    expect(meldungsLage(MO('09:00').toISOString(), MO('20:00'))).toBe('frisch');
  });

  it('wird genau bei der Frist fällig und danach überfällig', () => {
    const start = MO('09:00');
    const genau = new Date(start.getTime() + MELDUNG_FRIST_STUNDEN * 3_600_000);
    expect(meldungsLage(start.toISOString(), genau)).toBe('faellig');
    expect(meldungsLage(start.toISOString(), new Date(genau.getTime() + 60_000))).toBe('ueberfaellig');
  });

  it('kennt kein Wochenende', () => {
    // Art. 16 DSA sagt „zeitnah", nicht „an Werktagen". Eine Meldung über
    // rechtswidrige Inhalte wartet nicht bis Montag.
    expect(meldungsLage(SA('09:00').toISOString(), new Date('2026-09-20T10:00:00'))).toBe('ueberfaellig');
  });
});

describe('wartetSeitText', () => {
  it('nennt Stunden, dann Tage, jeweils in der richtigen Zahlform', () => {
    expect(wartetSeitText(MO('09:00').toISOString(), MO('09:30'))).toBe('seit weniger als einer Stunde');
    expect(wartetSeitText(MO('09:00').toISOString(), MO('10:30'))).toBe('seit 1 Stunde');
    expect(wartetSeitText(MO('09:00').toISOString(), MO('14:00'))).toBe('seit 5 Stunden');
    expect(wartetSeitText(MO('09:00').toISOString(), DI('10:00'))).toBe('seit 1 Tag');
    expect(wartetSeitText(MO('09:00').toISOString(), MI('10:00'))).toBe('seit 2 Tagen');
  });

  it('erfindet ohne Zeitpunkt keine Zahl', () => {
    expect(wartetSeitText(null, MO())).toBe('Zeitpunkt unbekannt');
    expect(wartetSeitText('kaputt', MO())).toBe('Zeitpunkt unbekannt');
  });
});
