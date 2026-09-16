// Anti-leakage regex for Werkant chat (ADR-0004 complement).
// Detects: German phone numbers, IBANs, email addresses.
// Passes clean: PLZ (5 digits), dimensions ("0170 Meter Kabel"),
// measurements, prices, and time strings.
//
// REINE TEXTREGELN, ohne Datenbank. Grund (07.09.2026): logLeakEvent zog
// lib/supabase.ts herein, und damit expo-constants — dieses Modul liess sich
// in Jest nicht laden. detectLeak war deshalb nie mit einem Test belegt,
// obwohl daran haengt, ob eine durchgereichte Telefonnummer auffaellt.
// Das Schreiben in die Datenbank steht jetzt in lib/chatGuardLog.ts.


// German mobile/landline: +49..., 0049..., or 0[1-9]... with 9-13 trailing digits
const PHONE_RE = /(?<!\d)(\+49|0049|0[1-9])([\s\-\/.]?\d){8,13}(?!\d)/;

// IBAN: 2 letters + 2 digits + 11-30 alphanumeric (with optional spaces every 4)
const IBAN_RE = /\b[A-Z]{2}\d{2}[\s]?[\dA-Z]{4}([\s]?[\dA-Z]{4}){1,6}\b/i;

// Standard email
const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;

// Unit words that mean a leading number is a measurement, not a phone number
const UNIT_WORDS = /^(m\b|cm|mm|km|kg|l\b|liter|meter|kabel|stück|stk|st\b|grad|volt|watt)/i;

export type LeakType = 'phone' | 'iban' | 'email';

export interface LeakResult {
  detected: boolean;
  types: LeakType[];
}

export function detectLeak(text: string): LeakResult {
  const types: LeakType[] = [];

  const phoneMatch = PHONE_RE.exec(text);
  if (phoneMatch) {
    // Exclude measurement patterns like "0170 Meter Kabel"
    const afterMatch = text.slice(phoneMatch.index + phoneMatch[0].length, phoneMatch.index + phoneMatch[0].length + 15).trimStart();
    if (!UNIT_WORDS.test(afterMatch)) {
      types.push('phone');
    }
  }

  if (IBAN_RE.test(text)) types.push('iban');
  if (EMAIL_RE.test(text)) types.push('email');

  return { detected: types.length > 0, types };
}

export const LEAKAGE_NUDGE =
  'Zahlung und Kontakt laufen geschützt über Werkant. Wer außerhalb abschließt, verliert den Schutz des Treuhandkontos; nach AGB §7 kann das als Verstoß vermerkt werden.';

// Fire-and-forget: persists the detection for admin/audit review (AGB §7
// Strike-System). Never blocks sending and never surfaces errors to the
// user — this is a background signal, not a client-enforced sanction.

/**
 * Ein kurzer Hinweis unter einer Nachricht, die Kontaktdaten enthaelt.
 *
 * ANLASS (Founder-Screenshots 07.09.2026): Zwei Telefonnummern gingen durch
 * („Ruf mich an 0123456789", „Ruf an 01765452527") — und der EMPFAENGER sah
 * nichts. Der bestehende Hinweis (LEAKAGE_NUDGE) erscheint beim Tippen, also
 * ausschliesslich auf dem Geraet dessen, der die Nummer schickt. Genau das
 * steht als Lehre schon in den Projektnotizen: „Erkennung, die am Geraet des
 * Taeters haengt, ist keine."
 *
 * Deshalb laeuft diese Pruefung beim LESEN, auf dem Geraet des Empfaengers.
 * Sie braucht keine Datenbankspalte, gilt rueckwirkend fuer alte Nachrichten,
 * und der Absender kann sie nicht umgehen — sein Client ist daran nicht
 * beteiligt.
 *
 * Bewusst KEINE Sperre: eine abgesprochene Rueckrufnummer nach Vertragsschluss
 * ist voellig in Ordnung. Gesagt wird nur, was auf dem Spiel steht.
 */
export function kontaktHinweis(
  text: string,
  binIchDerAbsender = false,
  meineRolle?: 'customer' | 'provider',
): string | null {
  const { detected, types } = detectLeak(text);
  if (!detected) return null;
  // Reihenfolge nach GENAUIGKEIT, nicht beliebig: eine IBAN enthaelt
  // Zifferngruppen und loest deshalb auch das Telefonmuster aus. Fragte man
  // zuerst nach 'phone', hiesse eine Bankverbindung „Telefonnummer" — der
  // Hinweis benennte dann die falsche Sache und waere schlechter als keiner.
  const was = types.includes('iban') ? 'Eine Bankverbindung'
    : types.includes('email') ? 'Eine E-Mail-Adresse'
    : 'Eine Telefonnummer';
  // Was auf dem Spiel steht, KONKRET und aus der Sicht dessen, der liest.
  //
  // ANLASS (Empfehlung 7 aus docs/markt/wettbewerbsabgleich-2026-09.md):
  // Vorher stand hier „deckt der Werkant-Schutz nicht ab". Ein Kunde liest
  // das als Regel, die die Plattform ihren Anteil sichern laesst, nicht als
  // etwas, das IHN schuetzt. Genannt wird deshalb, was er wirklich verliert
  // -- und zwar nur das, was es auch gibt (siehe constants/regeln.ts):
  // Treuhandkonto, gesperrtes Geld bei einer Reklamation, Bewertung danach.
  const folgeKunde =
    'Wird der Auftrag außerhalb von Werkant abgeschlossen, gilt für ihn nichts davon: '
    + 'kein Treuhandkonto, keine gesperrte Zahlung bei einer Reklamation, keine Bewertung danach. '
    + 'Sie zahlen dann direkt an den Betrieb und tragen das Risiko allein.';
  const folgeBetrieb =
    'Was außerhalb von Werkant abgesprochen wird, steht in keinem Vertrag, '
    + 'den wir im Streitfall vorlegen können, und zählt für Ihre Bewertungen nicht.';

  const folge = meineRolle === 'provider' ? folgeBetrieb
    : meineRolle === 'customer' ? folgeKunde
    // Ohne bekannte Rolle der gemeinsame Nenner. Lieber ungenau als falsch
    // zugeordnet.
    : 'Was außerhalb von Werkant abgesprochen wird, deckt der Werkant-Schutz nicht ab.';

  const grund = `${was} in der Nachricht. ${folge}`;
  // Die Folge gehoert NUR an den Absender.
  //
  // ANLASS (Founder am Geraet, 08.09.2026): "Was heißt es das man kein
  // werkant schutz hat? Es sollte doch gestriket werden?!" Er las den
  // Hinweis unter seiner EIGENEN Nachricht und erwartete eine Konsequenz.
  // Die gibt es (Migration 0720: drei Feststellungen in zwoelf Monaten
  // ergeben einen Strike), sie stand hier nur nicht. Der Nudge beim Tippen
  // nennt sie -- den sieht man aber nur, solange man schreibt.
  //
  // Dem EMPFAENGER darf sie nicht angezeigt werden: er hat nichts getan, und
  // eine Strafandrohung an den Falschen ist schlimmer als keine.
  if (!binIchDerAbsender) return grund;
  // Die Strike-Folge gilt NUR fuer Betriebe: `aktive_strikes` haengt an
  // provider_profiles, ein Kunde kann gar keinen bekommen. Vor dem 16.09.
  // bekam auch ein Kunde, der eine Nummer schickte, die Drohung zu lesen --
  // eine Strafandrohung, die es fuer ihn nicht gibt. Ohne bekannte Rolle
  // wird sie deshalb weggelassen, nicht geraten.
  if (meineRolle !== 'provider') return grund;
  return `${grund} Drei solcher Feststellungen in zwölf Monaten ergeben einen Strike (AGB §7).`;
}
