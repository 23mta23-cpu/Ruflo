// PII patterns that must not leave the platform — masks matches and returns a nudge.

// German phone detector: requires a recognisable German prefix and at least 8 digits total.
// Explicitly avoids matching 5-digit postal codes (standalone) and numbers followed by
// a unit word (Meter, cm, kg, Euro, €, m, km, etc.).
const PHONE_RE =
  /(?<!\d)(\+49[\s\-]?|0049[\s\-]?|(?:0(?:15|16|17)\d)[\s\-]?\d{3,4}[\s\-]?\d{3,5}|(?:0[2-9]\d{1,4})[\s\-]?\d{3,8})(?!\s*(?:meter|cm|kg|euro|€|m\b|km|g\b|ml|l\b|prozent|%))/gi;

const PATTERNS: { re: RegExp; label: string }[] = [
  { re: PHONE_RE,                                                              label: 'Telefonnummer' },
  { re: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,               label: 'E-Mail-Adresse' },
  { re: /\bDE\d{2}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{2}\b/gi, label: 'IBAN' },
  { re: /\b(whatsapp|telegram|signal)\b/gi,                                   label: 'Messenger-Kontakt' },
];

export const NUDGE_MESSAGE = 'Zahlung & Kontakt laufen geschützt über WERKR — externe Vermittlung beendet den Escrow-Schutz.';

export type GuardResult =
  | { safe: true }
  | { safe: false; masked: string; labels: string[] };

export function checkMessage(text: string): GuardResult {
  const labels: string[] = [];
  let masked = text;

  for (const { re, label } of PATTERNS) {
    const found = masked.match(re);
    if (found) {
      labels.push(label);
      masked = masked.replace(re, '●●●');
    }
  }

  if (labels.length === 0) return { safe: true };
  return { safe: false, masked, labels: [...new Set(labels)] };
}
