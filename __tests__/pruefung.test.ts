/**
 * Die Vorprüfungen für die Anbieter-Verifizierung.
 *
 * Sie entscheiden nichts. Sie sortieren, was ein Mensch ohnehin ansehen muss.
 * Geprüft wird deshalb vor allem, dass sie nicht das Falsche durchwinken.
 */

import {
  vorpruefen, freigabeGesperrt, namenPassen, wartetSeitStunden,
  type Einreichung,
} from '../lib/pruefung';

const JETZT = new Date(2026, 8, 14, 12, 0);   // 14.09.2026, 12:00
const vorStunden = (h: number) => new Date(JETZT.getTime() - h * 3_600_000).toISOString();

function einreichung(ueber: Partial<Einreichung> = {}): Einreichung {
  return {
    id: 'p-1',
    business_name: 'Elektrotechnik Wassermann GmbH',
    trade_id: 'elektro',
    gewerbeschein_path: 'u1/gewerbeschein-1.pdf',
    meisterbrief_path: 'u1/meisterbrief-1.pdf',
    kyc_submitted_at: vorStunden(2),
    has_steuer_id: true,
    full_name: 'Tayyip Wassermann',
    ...ueber,
  };
}

describe('Was eine Freigabe sperrt', () => {
  it('ohne Gewerbeschein geht nichts', () => {
    const b = vorpruefen(einreichung({ gewerbeschein_path: null }), JETZT);
    expect(freigabeGesperrt(b)).toBe(true);
    expect(b.some((x) => /Gewerbeschein/.test(x.text))).toBe(true);
  });

  it('meisterpflichtiges Gewerk ohne Meisterbrief geht nicht', () => {
    // Der Kern: genau dieses Gate war der Grund, warum „Renovierung" am
    // 14.09. auffiel. Hier darf es nicht am Menschen vorbeirutschen.
    const b = vorpruefen(einreichung({ meisterbrief_path: null }), JETZT);
    expect(freigabeGesperrt(b)).toBe(true);
    expect(b.some((x) => /§ 1 HwO Anlage A/.test(x.text))).toBe(true);
  });

  it('zulassungsfreies Gewerk ohne Meisterbrief ist KEIN Hindernis', () => {
    const b = vorpruefen(
      einreichung({ trade_id: 'gebaeudereinigung', meisterbrief_path: null }), JETZT);
    expect(freigabeGesperrt(b)).toBe(false);
  });

  it('ein unbekanntes Gewerk sperrt', () => {
    for (const t of [null, '', 'gibt-es-nicht']) {
      expect(freigabeGesperrt(vorpruefen(einreichung({ trade_id: t }), JETZT))).toBe(true);
    }
  });

  it('eine vollständige Einreichung sperrt nicht', () => {
    expect(freigabeGesperrt(vorpruefen(einreichung(), JETZT))).toBe(false);
  });
});

describe('Worauf zuerst geschaut werden soll', () => {
  it('nennt die Grenze eines zulassungsfreien Gewerks', () => {
    const b = vorpruefen(einreichung({ trade_id: 'bodenleger', meisterbrief_path: null }), JETZT);
    expect(b.some((x) => /Parkett/.test(x.text))).toBe(true);
  });

  it('meldet, wenn Betriebsname und Kontoname nichts gemeinsam haben', () => {
    const b = vorpruefen(einreichung({ full_name: 'Maria Schmitz' }), JETZT);
    expect(b.some((x) => /Kontoinhaber/.test(x.text))).toBe(true);
  });

  it('meldet lange Wartezeit, weil der Betrieb dann meist weg ist', () => {
    const b = vorpruefen(einreichung({ kyc_submitted_at: vorStunden(80) }), JETZT);
    expect(b.some((x) => /Tagen/.test(x.text))).toBe(true);
  });

  it('meldet sie NICHT bei zwei Stunden', () => {
    const b = vorpruefen(einreichung(), JETZT);
    expect(b.some((x) => /Tagen/.test(x.text))).toBe(false);
  });

  it('eine fehlende Steuer-ID ist ein Hinweis, kein Hindernis', () => {
    const b = vorpruefen(einreichung({ has_steuer_id: false }), JETZT);
    expect(freigabeGesperrt(b)).toBe(false);
    expect(b.some((x) => x.schwere === 'hinweis' && /Steuer-ID/.test(x.text))).toBe(true);
  });
});

describe('namenPassen', () => {
  it('erkennt den gemeinsamen Nachnamen trotz Rechtsform und Gewerk', () => {
    expect(namenPassen('Elektrotechnik Wassermann & Söhne GmbH', 'Tayyip Wassermann')).toBe(true);
  });

  it('erkennt, wenn nichts gemeinsam ist', () => {
    expect(namenPassen('Elektro Wassermann GmbH', 'Maria Schmitz')).toBe(false);
  });

  it('ein gemeinsames Füllwort erzeugt KEINE Übereinstimmung', () => {
    // Sonst passte jedes „GmbH" auf jedes andere. Hier teilen beide „Elektro",
    // aber das ist ein Gewerkwort und zählt nicht.
    expect(namenPassen('Elektro Wassermann GmbH', 'Maria Elektro')).toBe(false);
    expect(namenPassen('Bau Schneider GmbH', 'Peter Bau')).toBe(false);
  });

  it('besteht ein Name nur aus Füllwörtern, wird nicht gemeldet', () => {
    // Lieber keine Meldung als eine, die niemand erklären kann.
    expect(namenPassen('GmbH', 'Maria Schmitz')).toBe(true);
  });
});

describe('wartetSeitStunden', () => {
  it('rechnet Stunden', () => {
    expect(wartetSeitStunden(einreichung({ kyc_submitted_at: vorStunden(5) }), JETZT)).toBe(5);
  });

  it('ohne Zeitstempel oder mit Unsinn: null statt NaN', () => {
    for (const t of [null, '', 'quatsch']) {
      expect(wartetSeitStunden(einreichung({ kyc_submitted_at: t }), JETZT)).toBeNull();
    }
  });
});
