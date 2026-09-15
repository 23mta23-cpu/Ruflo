/**
 * Die Regeln aus `constants/regeln.ts` muessen (a) in sich stimmen und
 * (b) tatsaechlich irgendwo angezeigt werden.
 *
 * (b) ist die ausdrueckliche Grenze von `scripts/regeln-beleg-check.py`: der
 * prueft, dass jede Zusage im Code durchgesetzt ist, aber nicht, dass ein
 * Mensch sie je zu sehen bekommt. Genau das war die Luecke, die diese Liste
 * schliessen soll. Eine Liste guter Regeln, die niemand rendert, waere die
 * Luecke mit mehr Schritten.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { REGELN, regelnFuer } from '../constants/regeln';

const WURZEL = join(__dirname, '..');
const lies = (p: string) => readFileSync(join(WURZEL, p), 'utf8');

describe('constants/regeln.ts', () => {
  it('hat Regeln', () => {
    expect(REGELN.length).toBeGreaterThanOrEqual(5);
  });

  it('jede Regel ist vollstaendig', () => {
    for (const r of REGELN) {
      expect(r.titel.length).toBeGreaterThan(8);
      expect(r.text.length).toBeGreaterThan(40);
      expect(r.belegDatei).toMatch(/\.(ts|tsx|sql)$/);
      expect(r.belegStelle.length).toBeGreaterThan(8);
      expect(['kunde', 'betrieb', 'beide']).toContain(r.fuer);
    }
  });

  it('kein Titel doppelt (der Titel ist der React-key)', () => {
    expect(new Set(REGELN.map((r) => r.titel)).size).toBe(REGELN.length);
  });

  it('kein Gedankenstrich im sichtbaren Text', () => {
    for (const r of REGELN) {
      expect(r.titel + r.text).not.toMatch(/—| – /);
    }
  });

  it('siezt', () => {
    for (const r of REGELN) {
      expect(r.text).not.toMatch(/\b(du|dein|deine|dir|dich)\b/i);
    }
  });

  it('beide Seiten bekommen etwas zu sehen', () => {
    expect(regelnFuer('kunde').length).toBeGreaterThanOrEqual(3);
    expect(regelnFuer('betrieb').length).toBeGreaterThanOrEqual(3);
    // „beide" muss in beiden Listen auftauchen.
    const gemeinsam = REGELN.filter((r) => r.fuer === 'beide');
    for (const r of gemeinsam) {
      expect(regelnFuer('kunde')).toContain(r);
      expect(regelnFuer('betrieb')).toContain(r);
    }
  });
});

describe('Die Regeln werden angezeigt', () => {
  // Quelltextfrage, kein Laufzeit-Assert: ob ein Baustein EINGEBUNDEN ist,
  // laesst sich nur am Quelltext entscheiden. Ein Wertvergleich koennte
  // zufaellig stimmen (Lehre vom 16.08.2026, COMPANY.email gegen MAIL.kontakt).
  const rendert = (datei: string) => {
    const q = lies(datei);
    return /<RegelListe\b/.test(q) && /from '.*RegelListe'/.test(q);
  };

  it('die Kundenseite zeigt sie', () => {
    expect(rendert('app/garantie.tsx')).toBe(true);
  });

  it('die Anbieterseite zeigt sie', () => {
    expect(rendert('app/anbieter-warteliste.tsx')).toBe(true);
  });

  it('der Baustein liest die Liste, statt eigene Texte zu fuehren', () => {
    const q = lies('components/ui/RegelListe.tsx');
    expect(q).toMatch(/from '\.\.\/\.\.\/constants\/regeln'/);
    // Keine fest verdrahtete Zusage im Baustein selbst: sonst gibt es wieder
    // zwei Fassungen derselben Aussage.
    expect(q).not.toMatch(/Treuhand|Provision|8 %|verifiziert/i);
  });
});
