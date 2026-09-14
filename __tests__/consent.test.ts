/**
 * Die DSGVO-Zustimmung — gegen den echten Code.
 *
 * ANLASS (14.09.2026): Die Entscheidung stand als `decide()` innerhalb eines
 * `useEffect` in app/_layout.tsx und wurde von nichts geprueft.
 * __tests__/compliance.test.ts trug eine zweite Fassung, die mit der
 * Zeichenkette 'true' verglich — gespeichert wird aber ein JSON-Objekt. Sie
 * modellierte ein Format, das es nicht gibt.
 *
 * Beim Herausziehen kam ein echter Fehler heraus: der Rueckfall auf die alte
 * Fassung stand im `catch`, und `JSON.parse('true')` WIRFT NICHT. Der
 * Rueckfall hat seit jeher nichts getan.
 */

import { zustimmungErteilt, CONSENT_SCHLUESSEL } from '../lib/consent';

const ERTEILT = JSON.stringify({
  accepted: true, analytics: false, pstg: true,
  version: '1.0', timestamp: '2026-09-14T00:00:00.000Z',
});

describe('zustimmungErteilt', () => {
  it('erkennt das gespeicherte Objekt', () => {
    expect(zustimmungErteilt(ERTEILT)).toBe(true);
  });

  it('erkennt die alte Fassung „true" — der Rückfall wirkt jetzt wirklich', () => {
    // Bis 14.09.2026 stand er im catch und wurde nie erreicht.
    expect(zustimmungErteilt('true')).toBe(true);
  });

  it('abgelehnt ist nicht erteilt', () => {
    expect(zustimmungErteilt(JSON.stringify({ accepted: false }))).toBe(false);
  });

  it('im Zweifel NICHT erteilt', () => {
    // Kaputter Speicher, leerer Wert, fremdes Format, blockierter Zugriff:
    // alles führt zum Banner, nie zum stillen Weitermachen ohne Zustimmung.
    for (const roh of [null, undefined, '', '{kaputt', 'false', '[]', '0', '{}',
                       JSON.stringify({ accepted: 'true' }),
                       JSON.stringify({ accepted: 1 })]) {
      expect(zustimmungErteilt(roh)).toBe(false);
    }
  });

  it('der Schlüssel steht an EINER Stelle', () => {
    expect(CONSENT_SCHLUESSEL).toBe('werkr_consent_v1');
  });

  it('kein Bildschirm tippt den Schlüssel selbst', () => {
    // Dieselbe Klasse wie die E-Mail-Adresse im Impressum: ein Literal, das
    // zufällig denselben Wert hat, bindet nichts.
    const fs = require('fs');
    const path = require('path');
    const wurzel = path.join(__dirname, '..');
    const treffer: string[] = [];
    for (const ordner of ['app', 'lib', 'components', 'contexts']) {
      const stapel = [path.join(wurzel, ordner)];
      while (stapel.length) {
        const p = stapel.pop()!;
        for (const e of fs.readdirSync(p, { withFileTypes: true })) {
          const voll = path.join(p, e.name);
          if (e.isDirectory()) { stapel.push(voll); continue; }
          if (!/\.tsx?$/.test(e.name)) continue;
          if (voll.endsWith(path.join('lib', 'consent.ts'))) continue;
          const inhalt: string = fs.readFileSync(voll, 'utf8');
          for (const [nr, zeile] of inhalt.split('\n').entries()) {
            const blank = zeile.trim();
            if (blank.startsWith('//') || blank.startsWith('*')) continue;
            if (zeile.includes("'werkr_consent_v1'") || zeile.includes('"werkr_consent_v1"')) {
              treffer.push(`${path.relative(wurzel, voll)}:${nr + 1}`);
            }
          }
        }
      }
    }
    expect(treffer).toEqual([]);
  });
});
