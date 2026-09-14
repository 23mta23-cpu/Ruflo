/**
 * Werkant Compliance Rule Tests
 *
 * Covers:
 *   - Altersgrenze (§§ 106, 107 BGB — Geschaeftsfaehigkeit), via lib/alter.ts
 *   - Plattform-Preisboden (data/categories.ts; NICHT das MiLoG)
 *   - Platform fee (8 %)
 *   - DAC7 reporting threshold (EU Directive 2021/514)
 *   - GDPR/TTDSG consent check
 *
 * ACHTUNG (14.09.2026): Im Kopf stand hier
 *
 *     "The functions are co-located here so that they stay in sync with the
 *      tests and can be re-exported for use in the app."
 *
 * Das war der Fehler, als Vorzug beschrieben. Eine Funktion, die in der
 * Testdatei steht, prueft nur sich selbst. `isOver18` hier und `calcAge` in
 * app/onboarding-kyc.tsx waren zwei voellig verschiedene Fassungen derselben
 * Regel — die eine nahm ein Date, die andere eine Zeichenkette, und keine von
 * beiden wies den 31. Februar ab.
 *
 * Die Altersgrenze ist am 14.09.2026 nach `lib/alter.ts` gezogen und wird von
 * `__tests__/alter.test.ts` gegen den ECHTEN Code geprueft, mit festem
 * Stichtag. Der Rest dieser Datei (Mindestlohn, Plattformgebuehr,
 * Consent-Weiche) traegt dieselbe Tautologie und ist noch nicht umgestellt —
 * siehe docs/recht/rechts-audit-2026-09-13.md.
 *
 * Neue Regeln NICHT mehr hier nachbilden.
 */

// ---------------------------------------------------------------------------
// 1. Age gate (JArbSchG)
// ---------------------------------------------------------------------------

import { istVolljaehrig } from '../lib/alter';

/**
 * Alt-Schnittstelle dieser Datei, jetzt nur noch eine Huelle um den ECHTEN
 * Code in lib/alter.ts. Damit pruefen die Tests darunter dieselbe Regel, die
 * der Bildschirm anwendet — vorher waren es zwei verschiedene.
 */
export function isOver18(birthDate: Date, heute: Date = new Date()): boolean {
  const eingabe = `${String(birthDate.getDate()).padStart(2, '0')}.`
    + `${String(birthDate.getMonth() + 1).padStart(2, '0')}.`
    + `${birthDate.getFullYear()}`;
  return istVolljaehrig(eingabe, heute);
}

describe('isOver18 — Altersgrenze (§§ 106, 107 BGB), Huelle um lib/alter.ts', () => {
  /**
   * Returns a Date that is `yearsAgo` years before today, with an optional
   * day offset so we can sit exactly on boundaries or just inside/outside them.
   */
  function dateYearsAgo(yearsAgo: number, dayOffset = 0): Date {
    const d = new Date();
    d.setFullYear(d.getFullYear() - yearsAgo);
    d.setDate(d.getDate() + dayOffset);
    return d;
  }

  it('returns false when born today (age 0)', () => {
    expect(isOver18(new Date())).toBe(false);
  });

  it('returns false when born exactly 17 years ago (age 17)', () => {
    expect(isOver18(dateYearsAgo(17))).toBe(false);
  });

  it('returns false when born 17 years and 364 days ago (one day before 18th birthday)', () => {
    // Exactly 18 years ago + 1 day forward in time = 1 day before turning 18
    expect(isOver18(dateYearsAgo(18, 1))).toBe(false);
  });

  it('returns true when born exactly 18 years ago (18th birthday)', () => {
    expect(isOver18(dateYearsAgo(18))).toBe(true);
  });

  it('returns true when born 30 years ago', () => {
    expect(isOver18(dateYearsAgo(30))).toBe(true);
  });

  it('returns false for a future date', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(isOver18(tomorrow)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Mindestlohn (§1 MiLoG)
// ---------------------------------------------------------------------------

import { MINDESTPREIS_BODEN, satzFehler } from '../data/categories';

/**
 * ZWEI FEHLER, behoben am 14.09.2026.
 *
 * (1) Hier stand eine eigene Konstante `MINDESTLOHN_EUR_PER_HOUR = 13.0`,
 *     kommentiert als „Current statutory minimum wage (effective 2025-01-01)".
 *     Der massgebliche Boden steht in data/categories.ts als
 *     MINDESTPREIS_BODEN, und dessen Kommentar ist sorgfaeltiger:
 *
 *       „Orientiert am gesetzlichen Mindestlohn, ohne ihn zu behaupten: das
 *        MiLoG gilt fuer Arbeitnehmer, nicht unmittelbar fuer selbstaendige
 *        Betriebe."
 *
 *     Genau diese Behauptung stand hier. 13,00 EUR war ausserdem nie der
 *     gesetzliche Mindestlohn eines Jahres. Ein Zahlenwert mit falschem
 *     Etikett laedt dazu ein, den Boden an ein Gesetz anzupassen, das gar
 *     nicht gilt — dieselbe Klasse wie „§ JArbSchG" bei der Altersgrenze.
 *
 * (2) Die Funktion war eine Nachbildung und prueft damit nur sich selbst.
 *     Jetzt eine Huelle um `satzFehler()`, den der Bildschirm wirklich ruft.
 */
export function isAboveMindestlohn(euroPerHour: number): boolean {
  return satzFehler(euroPerHour) === null;
}

describe('isAboveMindestlohn — Plattform-Boden aus data/categories.ts', () => {
  it('returns false for 12.99 €/h (one cent below minimum)', () => {
    expect(isAboveMindestlohn(12.99)).toBe(false);
  });

  it('returns true for exactly 13.00 €/h (the minimum)', () => {
    expect(isAboveMindestlohn(13.0)).toBe(true);
  });

  it('returns false for 0 €/h', () => {
    expect(isAboveMindestlohn(0)).toBe(false);
  });

  it('returns true for 100 €/h (well above minimum)', () => {
    expect(isAboveMindestlohn(100)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Platform fee (8 %)
// ---------------------------------------------------------------------------

import { calcHandwerkerFees } from '../lib/feeEngine';

/**
 * DREI FEHLER, behoben am 14.09.2026. Diese Nachbildung beschrieb ein
 * Gebuehrenmodell, das das Produkt NICHT verwendet:
 *
 * (1) Sie rechnete 8 % auf den BRUTTObetrag. Gerechnet wird auf die
 *     Arbeitsleistung, also den Auftragswert ohne den ausgewiesenen
 *     Materialanteil (lib/angebotPreis.ts, lib/feeEngine.ts).
 * (2) Sie kannte den Mindestbetrag von 3,00 EUR nicht. Bei 10 EUR
 *     Auftragswert behauptete sie 0,80 EUR Gebuehr; einbehalten werden 3,00.
 * (3) Sie rundete mit `Math.round(x * 100) / 100` auf einem Fliesskommawert —
 *     genau der Fehler, den feeEngine mit ganzzahliger Cent-Arithmetik
 *     vermeidet (dort dokumentiert an `84.6 * 0.025 === 2.1149999999999998`).
 *
 * Und weil sie eine Nachbildung war, konnte sie nichts davon melden. Am
 * selben Tag kam heraus, dass die Umsatzsteuer im Beleg um 19 % zu hoch
 * ausgewiesen wurde — auch daran waere diese Datei nie angeschlagen.
 *
 * Jetzt eine Huelle um `calcHandwerkerFees`, ohne Materialanteil.
 */
export function calcPlatformFee(arbeitsleistung: number): { fee: number; net: number } {
  const f = calcHandwerkerFees(arbeitsleistung, false);
  return { fee: f.providerCommission, net: f.providerPayout };
}

describe('calcPlatformFee — 8 % auf die Arbeitsleistung, mindestens 3 EUR', () => {
  it('calculates fee and net for €100.00', () => {
    expect(calcPlatformFee(100)).toEqual({ fee: 8, net: 92 });
  });

  it('unter 37,50 EUR greift der Mindestbetrag von 3,00 EUR', () => {
    // Die alte Nachbildung kannte ihn nicht und behauptete bei 12,34 EUR eine
    // Gebuehr von 0,99 EUR. Einbehalten werden 3,00.
    expect(calcPlatformFee(12.34)).toEqual({ fee: 3, net: 9.34 });
    expect(calcPlatformFee(10)).toEqual({ fee: 3, net: 7 });
  });

  it('ab 37,50 EUR sind es 8 Prozent', () => {
    expect(calcPlatformFee(100)).toEqual({ fee: 8, net: 92 });
    expect(calcPlatformFee(1000)).toEqual({ fee: 80, net: 920 });
  });

  it('bei 0 EUR ergibt der Mindestbetrag eine negative Auszahlung', () => {
    // Festgehalten, nicht behauptet: ein 0-EUR-Auftrag ist ueber die
    // Oberflaeche nicht anlegbar (satzFehler sperrt unter dem Preisboden).
    // Sollte er je entstehen, faellt es hier auf statt im Zahlungslauf.
    expect(calcPlatformFee(0)).toEqual({ fee: 3, net: -3 });
  });

  it('calculates fee and net for €125.00', () => {
    expect(calcPlatformFee(125)).toEqual({ fee: 10, net: 115 });
  });

});

// ---------------------------------------------------------------------------
// 4. DAC7 threshold (EU Directive 2021/514)
// ---------------------------------------------------------------------------

// isDac7ThresholdReached lives in lib/pstTgThresholds.ts (real production
// code, re-exported from lib/pstTg.ts for the tax overview screen) rather
// than being redefined here, so this test exercises the actual function
// instead of an isolated copy of it.
import { isDac7ThresholdReached } from '../lib/pstTgThresholds';

describe('isDac7ThresholdReached — EU DAC7 reporting', () => {
  it('returns false when below both thresholds (29 tx, €1,999)', () => {
    expect(isDac7ThresholdReached(29, 1999)).toBe(false);
  });

  it('returns true when tx count threshold is met (30 tx, €0)', () => {
    expect(isDac7ThresholdReached(30, 0)).toBe(true);
  });

  it('returns true when amount threshold is met (1 tx, €2,000)', () => {
    expect(isDac7ThresholdReached(1, 2000)).toBe(true);
  });

  it('returns true when both thresholds are met (30 tx, €2,000)', () => {
    expect(isDac7ThresholdReached(30, 2000)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Consent check (GDPR / TTDSG)
// ---------------------------------------------------------------------------

import { zustimmungErteilt } from '../lib/consent';

/**
 * ZWEI FEHLER, behoben am 14.09.2026.
 *
 * (1) Die Nachbildung verglich mit der Zeichenkette `'true'`. Gespeichert
 *     wird aber ein JSON-Objekt (`{ accepted, analytics, pstg, version,
 *     timestamp }`). Sie modellierte ein Format, das es nicht gibt, und haette
 *     JEDE echte Zustimmung als „fehlt" gelesen.
 * (2) Ihr eigener Kommentar widersprach sich: „der Banner wird nicht erneut
 *     gezeigt ... We still return `true`".
 *
 * Jetzt eine Huelle um `zustimmungErteilt()` aus lib/consent.ts, die
 * `app/_layout.tsx` wirklich verwendet.
 */
export function isConsentRequired(storageValue: string | null): boolean {
  return !zustimmungErteilt(storageValue);
}

describe('isConsentRequired — GDPR/TTDSG consent gate', () => {
  it('returns true when storage is null (no prior record)', () => {
    expect(isConsentRequired(null)).toBe(true);
  });

  it('die alte Fassung \'true\' gilt weiterhin als erteilt', () => {
    expect(isConsentRequired('true')).toBe(false);
  });

  it('returns true when storage is "false" (consent explicitly denied)', () => {
    expect(isConsentRequired('false')).toBe(true);
  });

  it('returns true when storage is an empty string (missing/corrupt entry)', () => {
    expect(isConsentRequired('')).toBe(true);
  });
});
