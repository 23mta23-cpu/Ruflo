// PII patterns that must not leave the platform — masks matches and returns a nudge.

const PATTERNS: { re: RegExp; label: string }[] = [
  { re: /(\+?\d[\d\s\-().]{7,}\d)/g,                  label: 'Telefonnummer' },
  { re: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, label: 'E-Mail-Adresse' },
  { re: /\bDE\d{2}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{2}\b/gi, label: 'IBAN' },
  { re: /\b(whatsapp|telegram|signal)\b/gi,            label: 'Messenger-Kontakt' },
];

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
