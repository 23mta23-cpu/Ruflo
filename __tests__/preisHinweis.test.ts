/**
 * Der Preishinweis muss aus den Gebuehren-Konstanten kommen, nicht aus einem
 * Literal. Ein Wertvergleich allein koennte das nicht beweisen: „2,5 %" ist
 * derselbe Text, ob er berechnet oder hingeschrieben wurde (Lehre vom
 * 16.08.2026, COMPANY.email gegen MAIL.kontakt). Deshalb wird die BINDUNG
 * geprueft, indem der Test gegen die Konstanten rechnet und zusaetzlich den
 * Quelltext auf ein fest verdrahtetes Literal absucht.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { servicegebuehrKurz, servicegebuehrLang } from '../lib/preisHinweis';
import { CUSTOMER_FEE_RATE, MIN_CUSTOMER_FEE } from '../lib/feeEngine';

const quelle = readFileSync(join(__dirname, '..', 'lib', 'preisHinweis.ts'), 'utf8');

describe('servicegebuehrKurz', () => {
  it('nennt den Satz aus der Konstante', () => {
    const erwartet = String(CUSTOMER_FEE_RATE * 100).replace('.', ',');
    expect(servicegebuehrKurz()).toContain(erwartet + ' %');
  });

  it('nennt den Mindestbetrag aus der Konstante', () => {
    expect(servicegebuehrKurz()).toContain(MIN_CUSTOMER_FEE.toFixed(2).replace('.', ',') + ' €');
  });

  it('sagt „zzgl.", nicht „inkl."', () => {
    // Die Gebuehr kommt OBEN DRAUF. „inkl." waere die teurere Sorte Fehler.
    expect(servicegebuehrKurz()).toMatch(/^zzgl\./);
  });

  it('bleibt kurz genug fuer eine Ergebniskarte', () => {
    expect(servicegebuehrKurz().length).toBeLessThanOrEqual(60);
  });
});

describe('servicegebuehrLang', () => {
  it('enthaelt den kurzen Satz und nennt den Grund', () => {
    expect(servicegebuehrLang()).toContain(servicegebuehrKurz());
    expect(servicegebuehrLang()).toMatch(/Treuhandkonto/);
  });

  it('verspricht keine Frist und setzt keinen Gedankenstrich', () => {
    for (const t of [servicegebuehrKurz(), servicegebuehrLang()]) {
      expect(t).not.toMatch(/innerhalb von \d|—| – /);
      expect(t).not.toMatch(/\b(du|dein|dir)\b/i);
    }
  });
});

describe('Bindung an die Konstanten', () => {
  it('keine fest verdrahtete Zahl im Quelltext', () => {
    // Quelltextfrage, kein Laufzeit-Assert: ob die Zahl berechnet oder
    // hingeschrieben ist, sieht man nur am Quelltext.
    const ohneKommentar = quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(ohneKommentar).not.toMatch(/['"`][^'"`]*2,5\s*%/);
    expect(ohneKommentar).not.toMatch(/['"`][^'"`]*1,50\s*€/);
    expect(ohneKommentar).toMatch(/CUSTOMER_FEE_RATE/);
    expect(ohneKommentar).toMatch(/MIN_CUSTOMER_FEE/);
  });

  it('zieht mit, wenn sich der Satz aendert', () => {
    // Keine Mutation noetig: die Rechnung wird direkt nachvollzogen.
    expect(servicegebuehrKurz()).toBe(
      `zzgl. ${String(CUSTOMER_FEE_RATE * 100).replace('.', ',')} % Servicegebühr, `
      + `mindestens ${MIN_CUSTOMER_FEE.toFixed(2).replace('.', ',')} €`);
  });
});

describe('Keine zweite Wahrheit ueber die Gebuehr in der Oberflaeche', () => {
  // Am 16.09.2026 gab es SECHS handgeschriebene Fassungen desselben Satzes:
  // suche (keine), anbieter.tsx:599, angebot.tsx:203, auftrag-aufgeben:892,
  // zahlung.tsx:361, garantie.tsx:151, support-chat.tsx:46. Bei der naechsten
  // Satzaenderung waeren fuenf davon falsch geworden, ohne dass etwas rot
  // wird. Dieselbe Klasse wie die drei Reklamationsfristen (14.09.) und die
  // zwei Datenschutzerklaerungen (16.09.).
  const AUSNAHMEN: Record<string, string> = {
    'app/agb.tsx':
      'Die AGB sind der verbindliche Text, aus dem die Konstante folgt, nicht '
      + 'umgekehrt. Die Gegenrichtung prueft scripts/agb-code-check.py (§6(1)).',
  };

  const dateien = (): string[] => {
    const { readdirSync, statSync } = require('fs');
    const raus: string[] = [];
    const lauf = (d: string) => {
      for (const e of readdirSync(join(__dirname, '..', d))) {
        const rel = d + '/' + e;
        if (statSync(join(__dirname, '..', rel)).isDirectory()) lauf(rel);
        else if (e.endsWith('.tsx')) raus.push(rel);
      }
    };
    lauf('app');
    lauf('components');
    return raus;
  };

  it('nirgends ein fest verdrahteter Gebuehrensatz', () => {
    const treffer: string[] = [];
    for (const datei of dateien()) {
      if (AUSNAHMEN[datei]) continue;
      const roh = readFileSync(join(__dirname, '..', datei), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .filter((z) => !z.trim().startsWith('//'))
        .join('\n');
      if (/2,5\s*%|2\.5\s*%/.test(roh)) treffer.push(datei);
    }
    expect(treffer).toEqual([]);
  });

  it('jede Ausnahme ist begruendet', () => {
    for (const [datei, grund] of Object.entries(AUSNAHMEN)) {
      expect(grund.length).toBeGreaterThan(40);
      expect(() => readFileSync(join(__dirname, '..', datei), 'utf8')).not.toThrow();
    }
  });
});
