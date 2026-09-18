/**
 * Was eine Vertrauensperson erfaehrt, wenn der Kunde den Termin weitergibt.
 *
 * Der wichtigste Fall ist NICHT, dass der Text stimmt. Es ist, dass er die
 * Start-PIN NICHT enthaelt: sie ist das Mittel, mit dem der Kunde entscheidet,
 * wer seine Tuer passiert (0960), und eine weitergeleitete Nachricht mit der
 * Zahl hebt genau das auf.
 *
 * Die Zeitzone steht in jest.config.js auf Europe/Berlin. Ohne das waere der
 * Datumsteil in UTC gruen und auf jedem echten Geraet falsch (16.08.).
 */
import {
  terminWeitergabeText,
  terminZeitpunkt,
  terminDateiname,
  type TerminAngaben,
} from '../lib/terminText';

const BASIS: TerminAngaben = {
  leistung: 'Steckdose im Flur erneuern',
  betrieb: 'Elektro Yilmaz GmbH',
  stadt: 'Köln',
  wann: '2026-09-19T09:00:00+02:00',
  vertragNummer: 'WRK-4F2A9C01',
};

describe('terminWeitergabeText', () => {
  it('nennt Leistung, Betrieb, Ort, Termin und Vertragsnummer', () => {
    const t = terminWeitergabeText(BASIS);
    expect(t).toContain('Steckdose im Flur erneuern');
    expect(t).toContain('Elektro Yilmaz GmbH');
    expect(t).toContain('Köln');
    expect(t).toContain('WRK-4F2A9C01');
    expect(t).toContain('19. September 2026');
    expect(t).toContain('09:00');
  });

  it('gibt eine mitgereichte PIN NICHT weiter', () => {
    // Zwei Zusicherungen, und beide sind noetig:
    // 1. Die Signatur kennt kein Feld dafuer.
    // 2. Selbst wenn jemand eines mitgibt, landet es nicht im Text -- die
    //    Funktion baut die Zeilen aus benannten Feldern, nicht aus allem, was
    //    hereinkommt.
    //
    // Der erste Anlauf suchte stattdessen nach „vier Ziffern am Stueck" und
    // schlug am Jahr 2026 an. Ein Pruefer mit Fehlalarmen wird abgeschaltet
    // und nie wieder an; geprueft wird die Eigenschaft, nicht das Muster.
    expect(Object.keys(BASIS)).not.toContain('pin');
    const t = terminWeitergabeText(
      { ...BASIS, pin: '4821' } as TerminAngaben & { pin: string },
    );
    expect(t).not.toContain('4821');
  });

  it('gibt die Strasse nicht weiter, nur den Ort', () => {
    // Die Vertrauensperson soll wissen WER kommt, nicht wo genau der Kunde
    // wohnt -- das weiss sie meist ohnehin, und wenn nicht, geht es sie
    // nichts an.
    expect(Object.keys(BASIS)).not.toContain('strasse');
    expect(terminWeitergabeText(BASIS)).not.toMatch(/straße|strasse/i);
  });

  it('sagt beim fehlenden Termin, dass er nicht feststeht', () => {
    // Kein erfundenes Datum und kein leeres Feld: beides liest sich wie eine
    // Aussage, die wir nicht haben.
    expect(terminWeitergabeText({ ...BASIS, wann: null })).toContain('steht noch nicht fest');
  });

  it('benennt einen fehlenden Betriebsnamen, statt ihn zu ueberdecken', () => {
    // „Anbieter" sah auf dem Vertragsbildschirm aus wie ein Name und war
    // keiner (0800). Derselbe Fehler waere hier schlimmer.
    const t = terminWeitergabeText({ ...BASIS, betrieb: null });
    expect(t).toContain('liegt noch nicht vor');
    expect(t).not.toMatch(/Betrieb: Anbieter/);
  });

  it('faellt bei einem unbrauchbaren Datum auf den Hinweis zurueck', () => {
    expect(terminZeitpunkt('kein Datum')).toBeNull();
    expect(terminWeitergabeText({ ...BASIS, wann: 'kein Datum' })).toContain('steht noch nicht fest');
  });
});

describe('terminDateiname', () => {
  it('haengt die Vertragsnummer an und laesst nur Unbedenkliches durch', () => {
    expect(terminDateiname('WRK-4F2A9C01')).toBe('werkant-termin-WRK-4F2A9C01.txt');
    expect(terminDateiname('../../etc/passwd')).toBe('werkant-termin-etcpasswd.txt');
  });
});
