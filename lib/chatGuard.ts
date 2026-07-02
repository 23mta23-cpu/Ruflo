// Anti-leakage regex for WERKR chat (ADR-0004 complement).
// Detects: German phone numbers, IBANs, email addresses.
// Passes clean: PLZ (5 digits), dimensions ("0170 Meter Kabel"),
// measurements, prices, and time strings.

import { supabase } from './supabase';

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
  'Zahlung & Kontakt laufen geschützt über WERKR — externe Vermittlung beendet den Escrow-Schutz und kann laut AGB §7 einen Strike zur Folge haben.';

// Fire-and-forget: persists the detection for admin/audit review (AGB §7
// Strike-System). Never blocks sending and never surfaces errors to the
// user — this is a background signal, not a client-enforced sanction.
export function logLeakEvent(jobId: string, senderId: string, types: LeakType[]) {
  supabase
    .from('chat_leak_flags')
    .insert({ job_id: jobId, sender_id: senderId, leak_types: types })
    .then(({ error }) => {
      if (error) console.warn('logLeakEvent failed:', error);
    });
}
