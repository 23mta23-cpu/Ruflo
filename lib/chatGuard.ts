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
  'Zahlung & Kontakt laufen geschützt über Werkant. Externe Vermittlung beendet den Escrow-Schutz und kann laut AGB §7 einen Strike zur Folge haben.';

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
export function kontaktHinweis(text: string): string | null {
  const { detected, types } = detectLeak(text);
  if (!detected) return null;
  // Reihenfolge nach GENAUIGKEIT, nicht beliebig: eine IBAN enthaelt
  // Zifferngruppen und loest deshalb auch das Telefonmuster aus. Fragte man
  // zuerst nach 'phone', hiesse eine Bankverbindung „Telefonnummer" — der
  // Hinweis benennte dann die falsche Sache und waere schlechter als keiner.
  const was = types.includes('iban') ? 'Eine Bankverbindung'
    : types.includes('email') ? 'Eine E-Mail-Adresse'
    : 'Eine Telefonnummer';
  return `${was} in der Nachricht. Was Sie außerhalb von Werkant absprechen, deckt der Werkant-Schutz nicht ab.`;
}
