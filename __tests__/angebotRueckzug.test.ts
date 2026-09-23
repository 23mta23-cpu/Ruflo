import { rueckzugErgebnis } from '../lib/angebotRueckzug';

describe('rueckzugErgebnis', () => {
  it('meldet Erfolg nur, wenn genau eine Zeile umgestellt wurde', () => {
    const r = rueckzugErgebnis(false, 1);
    expect(r.ausgang).toBe('zurueckgezogen');
    expect(r.ausListeEntfernen).toBe(true);
    expect(r.neuLaden).toBe(false);
  });

  it('behandelt null betroffene Zeilen NICHT als Erfolg', () => {
    const r = rueckzugErgebnis(false, 0);
    expect(r.ausgang).toBe('nicht_mehr_offen');
    expect(r.ausListeEntfernen).toBe(false);
  });

  it('nennt im Fall „null Zeilen" den Grund, der den Betrieb bindet', () => {
    // Der Kunde kann in derselben Sekunde angenommen haben. Wer dann liest
    // „zurueckgezogen", haelt sich faelschlich fuer frei.
    const r = rueckzugErgebnis(false, 0);
    expect(r.meldung).toContain('angenommen');
    expect(r.meldung).not.toContain('zurückgezogen');
  });

  it('laedt bei null Zeilen neu, damit der echte Stand sichtbar wird', () => {
    expect(rueckzugErgebnis(false, 0).neuLaden).toBe(true);
  });

  it('meldet einen Fehler als Fehler und behaelt die Zeile', () => {
    const r = rueckzugErgebnis(true, 0);
    expect(r.ausgang).toBe('fehlgeschlagen');
    expect(r.ausListeEntfernen).toBe(false);
    // „konnte nicht zurueckgezogen werden" enthaelt das Wort ebenfalls --
    // gemessen wird deshalb die VERNEINUNG, nicht die Abwesenheit.
    expect(r.meldung).toContain('konnte nicht');
  });

  it('ein Fehler schlaegt eine gemeldete Zeilenzahl', () => {
    // Denkbar, wenn eine Antwort halb ankommt: die Zahl darf den Fehler
    // nicht ueberstimmen.
    expect(rueckzugErgebnis(true, 1).ausgang).toBe('fehlgeschlagen');
  });

  it('keine Erfolgsmeldung enthaelt einen Gedankenstrich', () => {
    for (const r of [rueckzugErgebnis(false, 1), rueckzugErgebnis(false, 0), rueckzugErgebnis(true, 0)]) {
      expect(r.meldung).not.toMatch(/[—–]/);
    }
  });
});
