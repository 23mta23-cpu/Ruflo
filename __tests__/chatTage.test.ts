import { readFileSync } from 'fs';
import { join } from 'path';
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

  /* Founder am Geraet (08.09.2026), unter seiner EIGENEN Nachricht:
     "Was heißt es das man kein werkant schutz hat? Es sollte doch gestriket
     werden?!" Die Folge gibt es (0720: drei Feststellungen in zwoelf Monaten
     = ein Strike), sie stand im Hinweis nur nicht. */
  it('nennt dem absendenden BETRIEB die Folge, sonst niemandem', () => {
    const alsBetrieb = kontaktHinweis('Ruf an 01765452527', true, 'provider');
    expect(alsBetrieb).toContain('Strike');
    expect(alsBetrieb).toContain('zwölf Monaten');

    // Der Empfaenger hat nichts getan — eine Strafandrohung an den Falschen
    // ist schlimmer als keine.
    expect(kontaktHinweis('Ruf an 01765452527', false, 'provider')).not.toContain('Strike');

    // Und ein KUNDE kann gar keinen Strike bekommen: `aktive_strikes` haengt
    // an provider_profiles. Vor dem 16.09. las auch er die Drohung.
    expect(kontaktHinweis('Ruf an 01765452527', true, 'customer')).not.toContain('Strike');

    // Ohne bekannte Rolle wird sie weggelassen, nicht geraten.
    expect(kontaktHinweis('Ruf an 01765452527', true)).not.toContain('Strike');
    expect(kontaktHinweis('Ruf an 01765452527')).not.toContain('Strike');
  });

  it('sagt dem Kunden, was ER verliert, nicht was die Plattform will', () => {
    // Empfehlung 7 aus dem Wettbewerbsabgleich. Vorher stand da nur
    // „deckt der Werkant-Schutz nicht ab" -- ein Kunde liest das als Regel
    // zugunsten der Plattform, nicht als etwas, das ihn schuetzt.
    const alsKunde = kontaktHinweis('Ruf an 01765452527', false, 'customer') ?? '';
    expect(alsKunde).toContain('Treuhandkonto');
    expect(alsKunde).toContain('Reklamation');
    expect(alsKunde).toContain('Risiko');
  });

  it('verspricht dem Kunden nur, was es wirklich gibt', () => {
    // Genau hier ist das Projekt schon dreimal falsch abgebogen
    // („Haftpflicht verifiziert"). Jede genannte Leistung muss eine Regel
    // aus constants/regeln.ts sein, keine erfundene.
    const alsKunde = kontaktHinweis('Ruf an 01765452527', false, 'customer') ?? '';
    for (const erfunden of ['Versicherung', 'Haftpflicht', 'Garantie', 'Geld-zurück']) {
      expect(alsKunde).not.toContain(erfunden);
    }
  });

  it('sagt dem Betrieb etwas anderes als dem Kunden', () => {
    const k = kontaktHinweis('Ruf an 01765452527', false, 'customer');
    const b = kontaktHinweis('Ruf an 01765452527', false, 'provider');
    expect(k).not.toEqual(b);
  });

  it('erfindet auch fuer den Absender nichts, wo nichts ist', () => {
    expect(kontaktHinweis('Ich komme am Donnerstag um 9 Uhr', true)).toBeNull();
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

describe('Die Verdrahtung im Chat', () => {
  // Die Logik oben ist gut geprueft. Was sie NICHT prueft: ob der Bildschirm
  // sie mit dem richtigen zweiten Argument ruft. Waere dort `true` fest
  // verdrahtet, bekaeme JEDER Empfaenger eine Strafandrohung fuer etwas, das
  // ein anderer getan hat; waere es `false` oder gar nichts, erfuehre der
  // Absender die Folge nie. Beides sieht man nur am Quelltext, nicht am
  // Rueckgabewert (Lehre vom 16.08.2026: ein Wertvergleich kann eine Bindung
  // nicht beweisen).
  const chat = readFileSync(join(__dirname, '..', 'app', 'chat.tsx'), 'utf8');

  it('ruft kontaktHinweis mit der Absender-Frage, nicht mit einer Konstanten', () => {
    const aufruf = chat.match(/kontaktHinweis\(([^)]*)\)/);
    expect(aufruf).not.toBeNull();
    const args = (aufruf as RegExpMatchArray)[1].split(',').map((a) => a.trim());
    expect(args).toHaveLength(3);
    expect(args[1]).toBe('isMe');
    // Die dritte Angabe ist die Rolle. Sie entscheidet, ob die Strike-Folge
    // ueberhaupt genannt werden darf -- ein Kunde kann keinen bekommen.
    // Wuerde hier eine Konstante stehen, waere die Unterscheidung wertlos.
    expect(args[2]).toBe('myRole');
  });

  it('isMe wird aus der eigenen Rolle bestimmt, nicht gesetzt', () => {
    expect(chat).toMatch(/const isMe = [^;]*myRole/);
    expect(chat).not.toMatch(/const isMe = (true|false)\b/);
  });

  it('der Hinweis wird auch wirklich angezeigt', () => {
    // Ein berechneter Hinweis, den niemand rendert, ist derselbe Fehler wie
    // gar keiner.
    expect(chat).toMatch(/hinweis\s*&&|hinweis\s*\?|\{hinweis\}/);
  });
});
