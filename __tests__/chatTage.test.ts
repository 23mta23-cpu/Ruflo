/**
 * Tests fuer lib/chatTage.ts — Tagestrenner im Chat.
 *
 * ANLASS: Founder-Screenshot vom 07.09.2026. Im Verlauf stand „01:10" ueber
 * „00:05". Die Nachrichten waren von verschiedenen Tagen, der Chat zeigte aber
 * nur Uhrzeiten — der Verlauf sah kaputt aus, obwohl er stimmte.
 */
import { tagesTrenner, trennerFuer, uhrzeit, tagesSchluessel } from '../lib/chatTage';

const heute = new Date(2026, 8, 7, 10, 0);   // Montag, 07.09.2026

describe('tagesTrenner', () => {
  it('nennt heute und gestern beim Namen', () => {
    expect(tagesTrenner(new Date(2026, 8, 7, 1, 30), heute)).toBe('Heute');
    expect(tagesTrenner(new Date(2026, 8, 6, 23, 59), heute)).toBe('Gestern');
  });

  it('nennt innerhalb der Woche den Wochentag', () => {
    expect(tagesTrenner(new Date(2026, 8, 3), heute)).toBe('Donnerstag');
    expect(tagesTrenner(new Date(2026, 8, 1), heute)).toBe('Dienstag');
  });

  it('nennt ab einer Woche das Datum', () => {
    // Genau sieben Tage zurueck darf NICHT „Montag" heissen — das waere
    // derselbe Wochentag wie heute und damit zweideutig.
    expect(tagesTrenner(new Date(2026, 7, 31), heute)).toBe('31. August');
    expect(tagesTrenner(new Date(2026, 7, 16), heute)).toBe('16. August');
  });

  it('nennt ueber den Jahreswechsel auch das Jahr', () => {
    // Sonst stuende im Januar „12. Dezember", ohne zu sagen, welcher.
    expect(tagesTrenner(new Date(2025, 11, 12), heute)).toBe('12. Dezember 2025');
  });

  it('kippt an der Zeitumstellung nicht', () => {
    // In der Nacht zum 25.10.2026 wird zurueckgestellt. Ohne Rechnung ueber
    // Mittag verschoebe sich die Sieben-Tage-Grenze um eine Stunde.
    const spaeter = new Date(2026, 9, 28, 9, 0);
    expect(tagesTrenner(new Date(2026, 9, 27, 23, 30), spaeter)).toBe('Gestern');
    expect(tagesTrenner(new Date(2026, 9, 24, 0, 30), spaeter)).toBe('Samstag');
  });
});

describe('trennerFuer', () => {
  it('setzt einen Trenner nur vor der ERSTEN Nachricht eines Tages', () => {
    const t = trennerFuer([
      new Date(2026, 7, 16, 1, 2),
      new Date(2026, 7, 16, 1, 2),
      new Date(2026, 7, 16, 1, 10),
      new Date(2026, 8, 7, 0, 5),
      new Date(2026, 8, 7, 0, 6),
    ], heute);
    expect(t).toEqual(['16. August', null, null, 'Heute', null]);
  });

  it('setzt einen Trenner auch vor der allerersten Nachricht', () => {
    // Sonst beginnt ein monatealter Verlauf ohne jede Zeitangabe.
    expect(trennerFuer([new Date(2026, 5, 1, 9, 0)], heute)[0]).toBe('1. Juni');
  });

  it('genau der Fall aus dem Screenshot wird lesbar', () => {
    // „01:10" stand ueber „00:05" und sah aus wie eine kaputte Sortierung.
    const t = trennerFuer([
      new Date(2026, 7, 16, 1, 10),
      new Date(2026, 8, 7, 0, 5),
    ], heute);
    expect(t[0]).toBe('16. August');
    expect(t[1]).toBe('Heute');
  });

  it('uebergeht fehlende oder unlesbare Zeitpunkte, ohne den Rest zu verschieben', () => {
    const t = trennerFuer([
      new Date(2026, 8, 7, 9, 0),
      null,
      new Date(2026, 8, 7, 9, 5),
      new Date(2026, 8, 6, 9, 5),
    ], heute);
    expect(t).toEqual(['Heute', null, null, 'Gestern']);
  });
});

describe('uhrzeit und tagesSchluessel', () => {
  it('fuellt zweistellig auf', () => {
    expect(uhrzeit(new Date(2026, 8, 7, 9, 5))).toBe('09:05');
  });

  it('nimmt die Ortszeit, nicht UTC', () => {
    // toISOString() schoebe in deutscher Sommerzeit jeden Zeitpunkt vor 02:00
    // auf den Vortag — ein Trenner laege dann einen Tag daneben.
    expect(tagesSchluessel(new Date(2026, 8, 1, 0, 30))).toBe('2026-09-01');
  });
});

/* ═══ Kontakthinweis auf der Leseseite ════════════════════════════════════
   Founder-Screenshot 07.09.2026: zwei Telefonnummern gingen durch, und der
   EMPFAENGER sah nichts — der bestehende Hinweis erscheint beim Tippen, also
   nur beim Absender.                                                       */
import { kontaktHinweis } from '../lib/chatGuard';

describe('kontaktHinweis', () => {
  it('erkennt genau die Nachrichten aus dem Screenshot', () => {
    expect(kontaktHinweis('Ruf mich an 0123456789')).toContain('Telefonnummer');
    expect(kontaktHinweis('Ruf an 01765452527')).toContain('Telefonnummer');
  });

  it('nennt, was auf dem Spiel steht, statt zu belehren', () => {
    expect(kontaktHinweis('0221 4567890')).toContain('Werkant-Schutz');
  });

  it('erkennt E-Mail und Bankverbindung', () => {
    expect(kontaktHinweis('schreib mir an max@example.de')).toContain('E-Mail');
    expect(kontaktHinweis('DE89 3704 0044 0532 0130 00')).toContain('Bankverbindung');
  });

  it('schweigt bei gewoehnlichen Nachrichten', () => {
    // Ein Hinweis mit Fehlalarmen wird ignoriert und ist dann wertlos.
    for (const t of [
      'Ja sind es',
      'Noch da?',
      'Sind es wirklich 35 und welche Marke ist unter dem Putz?',
      'Ich komme am Donnerstag um 9 Uhr',
      'Der Preis liegt bei 240 Euro',
      'Wir brauchen etwa 12 Quadratmeter',
    ]) {
      expect(kontaktHinweis(t)).toBeNull();
    }
  });

  it('haelt eine Massangabe nicht fuer eine Nummer', () => {
    // 0170 Meter Kabel ist keine Handynummer.
    expect(kontaktHinweis('0170 Meter Kabel brauchen wir')).toBeNull();
  });
});

/* ═══ Terminlage ═══════════════════════════════════════════════════════════
   Founder-Screenshot 07.09.2026: „TERMIN BESTÄTIGT 28.08.2026, 09:00 ·
   Bestätigt" — zehn Tage nachdem der Termin vorbei war.                    */
import { terminLage } from '../lib/chatTage';

describe('terminLage', () => {
  const jetzt = new Date(2026, 8, 7, 10, 0);

  it('erkennt genau den Fall aus dem Screenshot', () => {
    expect(terminLage('accepted', new Date(2026, 7, 28, 9, 0), jetzt)).toBe('verstrichen');
  });

  it('nennt einen kommenden Termin bevorstehend', () => {
    expect(terminLage('accepted', new Date(2026, 8, 9, 9, 0), jetzt)).toBe('bevorstehend');
  });

  it('haelt abgelehnt und ueberholt auseinander', () => {
    expect(terminLage('rejected', new Date(2026, 8, 9), jetzt)).toBe('abgelehnt');
    expect(terminLage('superseded', new Date(2026, 8, 9), jetzt)).toBe('ueberholt');
  });

  it('faerbt einen offenen Vorschlag nicht ein, auch wenn er verstrichen ist', () => {
    // Ein unbeantworteter Vorschlag ist kein „verstrichener Termin" — es gab
    // nie eine Zusage. Ihn so zu nennen behauptete eine Vereinbarung.
    expect(terminLage('pending', new Date(2026, 7, 1), jetzt)).toBe('offen');
  });

  it('behauptet ohne Zeitpunkt nichts Verstrichenes', () => {
    expect(terminLage('accepted', null, jetzt)).toBe('bevorstehend');
    expect(terminLage('accepted', 'kein datum', jetzt)).toBe('bevorstehend');
  });

  it('zaehlt den laufenden Termin noch als bevorstehend', () => {
    // Eine Minute nach Beginn ist der Handwerker gerade da — „verstrichen"
    // waere zu diesem Zeitpunkt falsch und beunruhigend.
    expect(terminLage('accepted', new Date(2026, 8, 7, 10, 30), jetzt)).toBe('bevorstehend');
  });
});

/* ═══ Doppelte Termin-Notizen ══════════════════════════════════════════════
   Founder-Screenshot: unter der Karte „TERMIN BESTÄTIGT 28.08.2026, 09:00"
   stand noch einmal „Termin bestätigt: 28.08.2026 09:00".                  */
import { istDoppelteTerminNotiz } from '../lib/chatTage';

describe('istDoppelteTerminNotiz', () => {
  const karte = [new Date(2026, 7, 28, 9, 0)];

  it('erkennt die Notiz zur danebenstehenden Karte', () => {
    expect(istDoppelteTerminNotiz('Termin bestätigt: 28.08.2026 09:00', karte)).toBe(true);
    expect(istDoppelteTerminNotiz('Terminvorschlag: 28.08.2026 09:00', karte)).toBe(true);
  });

  it('behaelt eine Notiz, zu der es KEINE Karte gibt', () => {
    // Sonst verschwaende die einzige Spur des Termins.
    expect(istDoppelteTerminNotiz('Termin bestätigt: 09.09.2026 09:00', karte)).toBe(false);
    expect(istDoppelteTerminNotiz('Termin bestätigt: 28.08.2026 09:00', [])).toBe(false);
  });

  it('behandelt die Ablehnung ohne Datum ueber das Vorhandensein einer Karte', () => {
    expect(istDoppelteTerminNotiz('Terminvorschlag abgelehnt', karte)).toBe(true);
    expect(istDoppelteTerminNotiz('Terminvorschlag abgelehnt', [])).toBe(false);
  });

  it('laesst gewoehnliche System-Notizen unangetastet', () => {
    expect(istDoppelteTerminNotiz('Angebot angenommen — Auftrag ist beauftragt.', karte)).toBe(false);
    expect(istDoppelteTerminNotiz('Vertrag unterschrieben', karte)).toBe(false);
  });

  it('verwechselt nicht Termine derselben Uhrzeit an anderen Tagen', () => {
    expect(istDoppelteTerminNotiz('Termin bestätigt: 28.09.2026 09:00', karte)).toBe(false);
  });
});
