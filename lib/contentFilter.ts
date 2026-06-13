// Blocks prohibited content in user-generated text fields (job descriptions, profiles).
// The filter is a deterrent layer — not a substitute for human moderation.

const BLOCKED_PATTERNS: { re: RegExp; reason: string }[] = [
  // Adult content
  { re: /\b(erotik|erotisch|escort|nackt[\s-]?shooting|nacktfoto|onlyfans|stripclub|stripper|sexarbeit|prostitution|bordell)\b/gi, reason: 'adult_content' },
  // Drug cultivation / illegal substances
  { re: /\b(cannabis[\s-]?anbau|hanf[\s-]?anbau|marihuana[\s-]?anbau|drogen[\s-]?anbau|pflanzen[\s-]?anbau.*illegal|grow[\s-]?box|growbox|growroom|growzelt)\b/gi, reason: 'illegal_substances' },
  // Weapons
  { re: /\b(waffen[\s-]?umbau|waffe[\s-]?illegal|3d[\s-]?druck[\s-]?waffe|munition[\s-]?verkauf)\b/gi, reason: 'weapons' },
  // Hacking / unauthorized access
  { re: /\b(hacken|passwort[\s-]?knacken|konto[\s-]?hacken|phishing|ddos)\b/gi, reason: 'illegal_access' },
];

export type FilterResult =
  | { allowed: true }
  | { allowed: false; reason: string };

export function checkContent(text: string): FilterResult {
  for (const { re, reason } of BLOCKED_PATTERNS) {
    if (re.test(text)) {
      re.lastIndex = 0; // reset stateful regex
      return { allowed: false, reason };
    }
    re.lastIndex = 0;
  }
  return { allowed: true };
}

export const BLOCK_REASON_LABELS: Record<string, string> = {
  adult_content: 'Erotische oder sexuelle Dienstleistungen',
  illegal_substances: 'Illegale Substanzen oder verbotener Anbau',
  weapons: 'Waffenhandel oder illegale Modifikationen',
  illegal_access: 'Unbefugter Zugriff oder Hacking',
};
