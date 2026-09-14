/**
 * Geldbeträge anzeigen.
 *
 * ANLASS (14.09.2026): `eur()` stand DREIMAL im Baum — und die drei Fassungen
 * waren nicht gleich: zweimal „€ 1234,00" mit Leerzeichen, einmal „€1234,00"
 * ohne. Derselbe Betrag sah je nach Bildschirm anders aus, und keine der drei
 * hatte einen Tausenderpunkt.
 */

import { euro, euroRund } from '../lib/geld';

describe('euro', () => {
  it('setzt den Tausenderpunkt — der eigentliche Anlass', () => {
    // „€ 12500,00" liest sich zu leicht als 1250. Bei einem Betrag, den
    // jemand freigibt, ist das kein Schönheitsfehler.
    expect(euro(12500)).toBe('€12.500,00');
    expect(euro(1234.56)).toBe('€1.234,56');
    expect(euro(1000000)).toBe('€1.000.000,00');
  });

  it('deutsches Dezimalkomma, immer zwei Stellen', () => {
    expect(euro(8)).toBe('€8,00');
    expect(euro(8.5)).toBe('€8,50');
    expect(euro(0)).toBe('€0,00');
  });

  it('rundet kaufmännisch auf zwei Stellen', () => {
    expect(euro(1.005)).toBe('€1,01');
    expect(euro(1.004)).toBe('€1,00');
  });

  it('kein Leerzeichen nach dem Zeichen — eine Form für die ganze App', () => {
    expect(euro(5)).not.toMatch(/€\s/);
  });

  it('negative Beträge behalten ihr Vorzeichen', () => {
    // Eine negative Auszahlung soll nicht wie eine positive aussehen.
    expect(euro(-3)).toBe('-€3,00');
  });

  it('unbrauchbare Werte ergeben kein „€NaN"', () => {
    for (const v of [NaN, Infinity, -Infinity]) expect(euro(v)).toBe('…');
  });
});

describe('euroRund', () => {
  it('ganze Euro mit Tausenderpunkt', () => {
    expect(euroRund(12500)).toBe('€12.500');
    expect(euroRund(1234.56)).toBe('€1.235');
  });

  it('unbrauchbare Werte ergeben kein „€NaN"', () => {
    expect(euroRund(NaN)).toBe('…');
  });
});

describe('Kein Bildschirm führt seine eigene Fassung', () => {
  it('es gibt keine zweite eur-Funktion mehr', () => {
    // Eine Bindungsfrage, und die ist eine Quelltext-Frage.
    const fs = require('fs');
    const path = require('path');
    const wurzel = path.join(__dirname, '..');
    const treffer: string[] = [];
    for (const ordner of ['app', 'lib', 'components']) {
      const stapel = [path.join(wurzel, ordner)];
      while (stapel.length) {
        const p = stapel.pop()!;
        for (const e of fs.readdirSync(p, { withFileTypes: true })) {
          const voll = path.join(p, e.name);
          if (e.isDirectory()) { stapel.push(voll); continue; }
          if (!/\.tsx?$/.test(e.name)) continue;
          const inhalt: string = fs.readFileSync(voll, 'utf8');
          if (/function eur\s*\(/.test(inhalt)) treffer.push(path.relative(wurzel, voll) + ' (eigene eur-Funktion)');
          // Die zweite Art, das gemeinsame Format zu umgehen: toFixed(2)
          // direkt hinter dem Waehrungszeichen. Elf solcher Stellen gab es am
          // 14.09.2026 noch, darunter der Beleg und die Zahlungsseite — mit
          // Dezimalpunkt statt Komma und ohne Tausenderpunkt.
          if (/€\$?\{[^}]*toFixed\(2\)\}/.test(inhalt)) {
            treffer.push(path.relative(wurzel, voll) + ' (€ mit toFixed statt euro())');
          }
        }
      }
    }
    expect(treffer).toEqual([]);
  });
});
