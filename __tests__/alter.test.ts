/**
 * Die Altersgrenze — gegen den echten Code, mit festem Stichtag.
 *
 * ANLASS (14.09.2026): `calcAge()` stand INNERHALB der Bildschirm-Komponente
 * `app/onboarding-kyc.tsx` und wurde von nichts geprueft.
 * `__tests__/compliance.test.ts` trug eine ZWEITE, voellig andere Fassung
 * (`isOver18(Date)`) und pruefte ausschliesslich sich selbst — im Kopf jener
 * Datei steht das sogar als Vorzug hin.
 *
 * `heute` wird hier immer uebergeben. Ein Test, der nur an bestimmten Tagen
 * gruen ist, ist kein Test.
 */

import { alterAm, istVolljaehrig, datumLesen, MINDESTALTER } from '../lib/alter';

const HEUTE = new Date(2026, 8, 14); // 14.09.2026

describe('datumLesen — ein Datum, das es nicht gibt, gibt es nicht', () => {
  it('weist den 31. Februar ab', () => {
    // JavaScript macht aus new Date(2000, 1, 31) den 2. Maerz statt eines
    // Fehlers. Bis 14.09.2026 kam "31.02.2000" deshalb als gueltiges
    // Geburtsdatum durch, und das Eingabefeld zeigte „bestaetigt".
    expect(datumLesen('31.02.2000')).toBeNull();
    expect(datumLesen('30.02.2000')).toBeNull();
    expect(datumLesen('31.04.2000')).toBeNull();
  });

  it('kennt den Schalttag', () => {
    expect(datumLesen('29.02.2000')).not.toBeNull();  // Schaltjahr
    expect(datumLesen('29.02.2001')).toBeNull();      // keins
  });

  it('weist Unsinn ab, ohne zu werfen', () => {
    for (const e of ['', '1.2', '32.13.2000', 'a.b.c', '01.01.1899', '--', '1.1.2000.1']) {
      expect(datumLesen(e)).toBeNull();
    }
  });

  it('nimmt ein gewöhnliches Datum an', () => {
    const d = datumLesen('07.03.1994');
    expect(d?.getFullYear()).toBe(1994);
    expect(d?.getMonth()).toBe(2);
    expect(d?.getDate()).toBe(7);
  });
});

describe('alterAm — volle Jahre am Stichtag', () => {
  it('rechnet ein gewöhnliches Alter', () => {
    expect(alterAm('14.09.2000', HEUTE)).toBe(26);
  });

  it('der Geburtstag zählt einschließlich: an ihm ist man schon so alt', () => {
    expect(alterAm('14.09.2008', HEUTE)).toBe(18);
  });

  it('einen Tag vor dem 18. Geburtstag ist man 17', () => {
    expect(alterAm('15.09.2008', HEUTE)).toBe(17);
  });

  it('Geburtstag später im Jahr zieht ein Jahr ab', () => {
    expect(alterAm('31.12.2000', HEUTE)).toBe(25);
  });

  it('Geburtstag früher im Jahr nicht', () => {
    expect(alterAm('01.01.2000', HEUTE)).toBe(26);
  });

  it('ein Datum in der Zukunft ergibt kein Alter', () => {
    expect(alterAm('15.09.2026', HEUTE)).toBeNull();
    expect(alterAm('01.01.2030', HEUTE)).toBeNull();
  });

  it('ungültige Eingaben ergeben null, keine Zahl', () => {
    for (const e of ['31.02.2000', 'quatsch', '']) expect(alterAm(e, HEUTE)).toBeNull();
  });
});

describe('istVolljaehrig', () => {
  it('am 18. Geburtstag ja', () => {
    expect(istVolljaehrig('14.09.2008', HEUTE)).toBe(true);
  });

  it('einen Tag davor nein', () => {
    expect(istVolljaehrig('15.09.2008', HEUTE)).toBe(false);
  });

  it('ein ungültiges Datum ist nicht volljährig — im Zweifel gesperrt', () => {
    // Die Richtung zählt: bei einer unlesbaren Eingabe darf niemand durch.
    for (const e of ['31.02.2008', '', 'x']) expect(istVolljaehrig(e, HEUTE)).toBe(false);
  });

  it('die Grenze steht an EINER Stelle', () => {
    expect(MINDESTALTER).toBe(18);
  });
});

describe('Der Bildschirm nutzt die Bibliothek, nicht seine eigene Kopie', () => {
  it('onboarding-kyc.tsx hat kein eigenes calcAge mehr', () => {
    // Eine Bindungsfrage, und die ist eine Quelltext-Frage: zwei Fassungen
    // derselben Regel liefern denselben Wert, bis sie es nicht mehr tun.
    const quelle = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'app', 'onboarding-kyc.tsx'), 'utf8');
    expect(quelle).not.toMatch(/function calcAge/);
    expect(quelle).toMatch(/from '\.\.\/lib\/alter'/);
  });
});
