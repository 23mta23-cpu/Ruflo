/**
 * Die 18+-Erklärung: Wortlaut und Fassung.
 *
 * ANLASS (20.09.2026): das Geburtsdatum wurde im Browser geprüft und dann
 * weggeworfen (`nbDob` in `useState`), während der Kunde „18+ verifiziert"
 * las. Festgehalten wird jetzt die Erklärung samt Wortlaut (0990).
 */
import { VOLLJAEHRIGKEIT_FASSUNG, volljaehrigkeitsText } from '../lib/volljaehrigkeit';
import { MINDESTALTER } from '../lib/alter';
import { vorpruefen, freigabeGesperrt } from '../lib/pruefung';

describe('18+-Erklärung', () => {
  it('nennt dieselbe Zahl wie lib/alter', () => {
    // GRENZE, ausdrücklich: das beweist keine BINDUNG. Stünde im Text eine
    // hartkodierte 18, wäre dieser Test genauso grün (dieselbe Klasse wie
    // COMPANY.email gegen MAIL.kontakt am 16.08.). Ein eigener Quelltext-
    // Prüfer dafür ist bewusst NICHT gebaut: die Zahl ändert sich nicht, und
    // ein falscher Wert wäre inhaltlich folgenlos. Bei der Meisterpflicht-
    // Liste ist das anders, deshalb gibt es sie dort
    // (scripts/meisterpflicht-beleg-check.py).
    expect(volljaehrigkeitsText(MINDESTALTER)).toContain(String(MINDESTALTER));
  });

  it('sagt ausdrücklich, dass Werkant es NICHT prüft', () => {
    // Der ganze Zweck: eine Erklärung darf sich nicht wie eine Prüfung lesen.
    expect(volljaehrigkeitsText(18)).toMatch(/eigene Angabe/);
    expect(volljaehrigkeitsText(18)).toMatch(/prüft sie nicht/);
  });

  it('ist lang genug für die Untergrenze der Datenbank (0990: 20 Zeichen)', () => {
    expect(volljaehrigkeitsText(18).length).toBeGreaterThanOrEqual(20);
    expect(volljaehrigkeitsText(18).length).toBeLessThanOrEqual(2000);
  });

  it('trägt eine Fassungskennung im Rahmen der Datenbank (3 bis 64)', () => {
    expect(VOLLJAEHRIGKEIT_FASSUNG.length).toBeGreaterThanOrEqual(3);
    expect(VOLLJAEHRIGKEIT_FASSUNG.length).toBeLessThanOrEqual(64);
  });
});

const nb = (extra: Record<string, unknown> = {}) => ({
  id: 'h1', business_name: 'Sami Hilft', trade_id: null,
  gewerbeschein_path: null, meisterbrief_path: null,
  kyc_submitted_at: new Date().toISOString(),
  is_nachbarschaft: true, category_ids: ['garten'],
  hat_volljaehrigkeitserklaerung: true, ...extra,
});

describe('Vorprüfung im Nachbarschaftszweig', () => {
  it('verlangt KEINEN Gewerbeschein', () => {
    // Ohne diese Unterscheidung stünde bei JEDEM Helfer „Kein Gewerbeschein
    // hochgeladen" als `sperrt` — eine Warteschlange, aus der niemand
    // herauskommt.
    const befunde = vorpruefen(nb());
    expect(befunde.some((b) => /Gewerbeschein hochgeladen/.test(b.text))).toBe(false);
    expect(freigabeGesperrt(befunde)).toBe(false);
  });

  it('sperrt ohne 18+-Erklärung', () => {
    expect(freigabeGesperrt(vorpruefen(nb({ hat_volljaehrigkeitserklaerung: false })))).toBe(true);
  });

  it('sperrt ohne angegebene Leistung', () => {
    expect(freigabeGesperrt(vorpruefen(nb({ category_ids: [] })))).toBe(true);
  });

  it('sperrt bei einem meisterpflichtigen Gewerk (§ 1 HwO)', () => {
    const befunde = vorpruefen(nb({ category_ids: ['garten', 'elektro'] }));
    expect(freigabeGesperrt(befunde)).toBe(true);
    expect(befunde.some((b) => /elektro/.test(b.text))).toBe(true);
  });

  it('sagt dem Prüfer, dass das Alter eine Selbstauskunft ist', () => {
    // Sonst liest der Betreiber „geprüft" in einen Haken hinein, den es
    // nicht gibt — und genau das war der Befund auf der Kundenseite.
    expect(vorpruefen(nb()).some((b) => /Selbstauskunft/.test(b.text))).toBe(true);
  });

  it('lässt den Handwerkszweig unberührt', () => {
    // Gegenprobe: die neue Weiche darf den alten Weg nicht mitnehmen.
    const hw = vorpruefen({
      id: 'b1', business_name: 'Elektro Wassermann', trade_id: 'elektro',
      gewerbeschein_path: 'x/g.pdf', meisterbrief_path: null,
      kyc_submitted_at: new Date().toISOString(), full_name: 'Tayyip Wassermann',
    });
    expect(freigabeGesperrt(hw)).toBe(true);
    expect(hw.some((b) => /meisterpflichtig/.test(b.text))).toBe(true);
  });
});
