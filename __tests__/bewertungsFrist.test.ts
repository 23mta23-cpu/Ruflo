import {
  BEWERTUNGSFRIST_TAGE, fristLage, darfBewerten, fristText, darfAntworten,
} from '../lib/bewertungsFrist';

const TAG = 86_400_000;
const ABSCHLUSS = '2026-09-01T10:00:00.000Z';
const t = (versatzMs: number) => new Date(Date.parse(ABSCHLUSS) + versatzMs);

describe('Bewertungsfrist', () => {
  it('nennt 14 Tage — dieselbe Zahl wie die Policy in 0930', () => {
    expect(BEWERTUNGSFRIST_TAGE).toBe(14);
  });

  it('direkt nach Abschluss sind es 14 Tage', () => {
    expect(fristLage(ABSCHLUSS, t(0))).toEqual({ art: 'offen', verbleibendeTage: 14 });
  });

  it('nach 7 Tagen sind 7 uebrig', () => {
    expect(fristLage(ABSCHLUSS, t(7 * TAG))).toEqual({ art: 'offen', verbleibendeTage: 7 });
  });

  it('am letzten Tag heisst es "letzter Tag", nicht "0 Tage"', () => {
    // 13 Tage und 12 Stunden vorbei: es geht noch, aber weniger als ein Tag.
    expect(fristLage(ABSCHLUSS, t(13.5 * TAG))).toEqual({ art: 'letzterTag' });
  });

  it('eine Sekunde vor Ablauf geht es noch', () => {
    expect(darfBewerten(ABSCHLUSS, t(14 * TAG - 1000))).toBe(true);
  });

  it('genau auf die Sekunde ist Schluss', () => {
    expect(fristLage(ABSCHLUSS, t(14 * TAG))).toEqual({ art: 'abgelaufen' });
    expect(darfBewerten(ABSCHLUSS, t(14 * TAG))).toBe(false);
  });

  it('ohne Zeitstempel wird niemand ausgesperrt — wie die Policy', () => {
    // Die Policy in 0930 laesst `c.completed_at is null` durch. Waere es hier
    // andersherum, verbaete die App etwas, das der Server erlaubt.
    expect(fristLage(null).art).toBe('unbekannt');
    expect(darfBewerten(null)).toBe(true);
    expect(darfBewerten(undefined)).toBe(true);
  });

  it('ein unlesbares Datum sperrt ebenfalls nicht', () => {
    expect(fristLage('morgen frueh').art).toBe('unbekannt');
    expect(darfBewerten('morgen frueh')).toBe(true);
  });

  it('der Text nennt die verbleibenden Tage, nicht nur "bald"', () => {
    const satz = fristText(fristLage(ABSCHLUSS, t(3 * TAG)));
    expect(satz).toContain('11');
    expect(satz).toContain('Tage');
  });

  it('der abgelaufene Text nennt die Frist aus der Konstante', () => {
    const satz = fristText({ art: 'abgelaufen' });
    expect(satz).toContain(String(BEWERTUNGSFRIST_TAGE));
  });

  it('kein Text enthaelt einen Gedankenstrich', () => {
    const alle = [
      fristText(fristLage(ABSCHLUSS, t(0))),
      fristText({ art: 'letzterTag' }),
      fristText({ art: 'abgelaufen' }),
      fristText({ art: 'unbekannt' }),
    ];
    for (const satz of alle) {
      expect(satz).not.toMatch(/[—–]/);
    }
  });
});

describe('Antwortrecht', () => {
  const mich = 'aaaaaaaa-0000-0000-0000-000000000001';
  const andere = 'bbbbbbbb-0000-0000-0000-000000000002';

  it('die bewertete Person darf antworten', () => {
    expect(darfAntworten({ reviewed_id: mich, antwort: null }, mich)).toBe(true);
  });

  it('wer nicht bewertet wurde, darf nicht antworten', () => {
    // Sonst haette jeder Besucher unter jeder Bewertung ein Antwortfeld.
    expect(darfAntworten({ reviewed_id: andere, antwort: null }, mich)).toBe(false);
  });

  it('eine bestehende Antwort laesst sich nicht ersetzen', () => {
    expect(darfAntworten({ reviewed_id: mich, antwort: 'Stimmt so nicht.' }, mich)).toBe(false);
  });

  it('eine leere Antwort gilt als Antwort, nicht als "noch nichts"', () => {
    // '' ist nicht null: der Trigger in 0930 haette sie gar nicht gespeichert.
    // Trotzdem darf die App daraus kein zweites Antwortrecht ableiten.
    expect(darfAntworten({ reviewed_id: mich, antwort: '' }, mich)).toBe(false);
  });

  it('ohne Anmeldung kein Antwortfeld', () => {
    expect(darfAntworten({ reviewed_id: mich, antwort: null }, null)).toBe(false);
    expect(darfAntworten({ reviewed_id: mich, antwort: null }, undefined)).toBe(false);
  });
});
