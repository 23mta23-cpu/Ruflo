/**
 * Der Widerrufs-Haken beim Bezahlen (`app/zahlung.tsx`, Migration 0710).
 *
 * ANLASS (14.09.2026): Beide Tracks sahen denselben Satz. Im
 * Nachbarschafts-Track stand damit zweierlei Falsches: „der Handwerker",
 * den es dort nicht gibt, und ein 14-Tage-Widerrufsrecht, das gegenueber
 * einer Privatperson nicht besteht (§§ 312 ff. BGB setzen einen Unternehmer
 * nach § 14 BGB voraus). Der Kunde erklaerte einen Verzicht auf ein Recht,
 * das er nicht hatte, gegenueber jemandem, den es nicht gab — und das wurde
 * als Nachweis in `widerruf_consents` festgehalten.
 */

const eingefuegt: Record<string, unknown>[] = [];

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: (zeile: Record<string, unknown>) => {
        eingefuegt.push(zeile);
        return Promise.resolve({ error: null });
      },
    }),
  },
}));

import {
  widerrufstext,
  haltWiderrufsEinwilligungFest,
  lageAusVertrag,
  WIDERRUF_TEXT_VERSION,
} from '../lib/widerruf';
import { Werkant_SCHUTZ_FEE } from '../lib/feeEngine';

beforeEach(() => { eingefuegt.length = 0; });

// ---------------------------------------------------------------------------
// Nachbarschaft: kein Handwerker, kein Widerrufsrecht gegen den Helfer
// ---------------------------------------------------------------------------

describe('Nachbarschafts-Track', () => {
  const t = widerrufstext('nachbarschaft');

  it('nennt keinen Handwerker — dort arbeitet eine Privatperson', () => {
    expect(t.zustimmung).not.toMatch(/Handwerker/i);
    expect(t.erklaerung).not.toMatch(/Handwerker/i);
  });

  it('sagt ausdrücklich, dass es gegenüber dem Helfer kein Widerrufsrecht gibt', () => {
    expect(t.erklaerung).toMatch(/Privatperson/);
    expect(t.erklaerung).toMatch(/kein gesetzliches Widerrufsrecht/);
  });

  it('richtet den Widerruf gegen Werkant, nicht gegen den Helfer', () => {
    expect(t.zustimmung).toMatch(/gegenüber Werkant/);
  });

  it('nennt den Betrag, um den es tatsächlich geht', () => {
    expect(t.erklaerung).toContain(`€${Werkant_SCHUTZ_FEE.toFixed(2)}`);
  });
});

// ---------------------------------------------------------------------------
// Handwerker: das Widerrufsrecht besteht, der Text muss § 356 Abs. 4 abbilden
// ---------------------------------------------------------------------------

describe('Handwerker-Track', () => {
  const t = widerrufstext('handwerker');

  it('nennt den Handwerker', () => {
    expect(t.zustimmung).toMatch(/Handwerker/);
  });

  it('erklärt die Folge eines Widerrufs nach begonnener Arbeit', () => {
    expect(t.erklaerung).toMatch(/zahlen Sie die bis dahin geleistete Arbeit/);
  });
});

// ---------------------------------------------------------------------------
// Was § 356 Abs. 4 BGB verlangt — in beiden Fassungen
// ---------------------------------------------------------------------------

describe('Beide Fassungen folgen dem Gesetzeswortlaut', () => {
  const beide = (['handwerker', 'nachbarschaft'] as const).map(widerrufstext);

  it('enthalten das ausdrückliche Verlangen nach frühem Beginn', () => {
    for (const t of beide) expect(t.zustimmung).toMatch(/verlange ausdrücklich/);
  });

  it('enthalten die Bestätigung, das Recht bei voller Erfüllung zu verlieren', () => {
    for (const t of beide) {
      expect(t.zustimmung).toMatch(/Mir ist bekannt/);
      expect(t.zustimmung).toMatch(/erlischt/);
    }
  });

  it('sprechen nicht mehr von einem Verzicht (§ 361 Abs. 2 Satz 1 BGB)', () => {
    // Ein Verzicht im Voraus weicht zum Nachteil des Verbrauchers ab und
    // waere unwirksam. Bis 14.09.2026 stand genau das im Haken.
    for (const t of beide) expect(t.zustimmung).not.toMatch(/verzicht/i);
  });

  it('sagen beide, was ohne Häkchen passiert', () => {
    for (const t of beide) expect(t.erklaerung).toMatch(/Ohne Ihr Häkchen wird nichts abgebucht/);
  });

  it('sind lang genug für die Spalte angezeigter_text (0710: 20 bis 4000)', () => {
    for (const t of beide) {
      expect(t.zustimmung.length).toBeGreaterThanOrEqual(20);
      expect(t.zustimmung.length).toBeLessThanOrEqual(4000);
    }
  });

  it('unterscheiden sich voneinander', () => {
    expect(beide[0].zustimmung).not.toBe(beide[1].zustimmung);
  });
});

// ---------------------------------------------------------------------------
// Der Nachweis muss der Text sein, den dieser Kunde gesehen hat
// ---------------------------------------------------------------------------

describe('Nachweis in widerruf_consents', () => {
  it('hält je Track genau den gezeigten Satz fest', async () => {
    for (const lage of ['handwerker', 'nachbarschaft'] as const) {
      eingefuegt.length = 0;
      const r = await haltWiderrufsEinwilligungFest('c-1', 'k-1', lage);
      expect(r).toBe('ok');
      expect(eingefuegt).toHaveLength(1);
      expect(eingefuegt[0].angezeigter_text).toBe(widerrufstext(lage).zustimmung);
    }
  });

  it('die Fassungskennung wurde mit dem Wortlaut hochgezählt', () => {
    // Sonst ordnet die Datenbank neue Erklärungen dem alten Text zu.
    expect(WIDERRUF_TEXT_VERSION).not.toBe('widerruf-2026-08-16');
    expect(eingefuegt).toHaveLength(0);
  });

  it('schreibt die Fassungskennung mit', async () => {
    await haltWiderrufsEinwilligungFest('c-2', 'k-1', 'handwerker');
    expect(eingefuegt[0].text_version).toBe(WIDERRUF_TEXT_VERSION);
  });
});

// ---------------------------------------------------------------------------
// Die Weiche aus der Vertragszeile
// ---------------------------------------------------------------------------

describe('lageAusVertrag', () => {
  it('erkennt den Nachbarschafts-Track', () => {
    expect(lageAusVertrag('nachbarschaft')).toBe('nachbarschaft');
  });

  it('alles andere ist Handwerker, auch fehlende Werte', () => {
    for (const t of ['handwerker', '', null, undefined, 'Nachbarschaft', 'quatsch']) {
      expect(lageAusVertrag(t)).toBe('handwerker');
    }
  });
});
