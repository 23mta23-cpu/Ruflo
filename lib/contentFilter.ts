// Hard content filter for profile bios and job creation.
// Blocks: Ü18/erotik, illegal drug production, solicitation.
// Applied on both Nachbarschaft and Handwerker tracks.

const BLOCKED: Array<{ pattern: RegExp; key: string }> = [
  { key: 'adult',       pattern: /\b(escort|erotik|nackt(foto|shooting|aufnahme)?|nude|onlyfans|cam(girl|boy|show)?|stripper|strip[ -]?club|lapdance|bordell|puff\b|rotlicht|sexarbeit|sexdienst|aktfoto|aktaufnahme|erotikfoto|erotikfilm|erotikmodel|adult[- ]?content|x-?rated)\b/i },
  { key: 'drugs',       pattern: /\b(hanf[ -]?anbau|cannabis[ -]?anbau|indoor[ -]?grow(room|zelt|tent)?|grow[ -]?(room|tent|zelt|box)|thc[ -]?extrakt|drogenherstellung|drogenküche|drogen(labor|kochen)|koks[ -]?(abfüllen|produzieren)|meth[ -]?(kochen|labor)|crystal[ -]?meth|mdma[ -]?synthese)\b/i },
  { key: 'trafficking', pattern: /\b(prostituier|prostitution|zuhält(er|erin)|menschenhandel|trafficking|sexskla(ve|vin)|zwangsarbeit)\b/i },
];

export interface FilterResult {
  blocked: boolean;
  allowed: boolean;
  reason?: string;  // short key: 'adult' | 'drugs' | 'trafficking'
}

export const BLOCK_REASON_LABELS: Record<string, string> = {
  adult:       'Erotik / Ü18-Inhalte',
  drugs:       'Illegale Drogenherstellung',
  trafficking: 'Menschenhandel / Ausbeutung',
};

export function filterContent(text: string): FilterResult {
  for (const { pattern, key } of BLOCKED) {
    if (pattern.test(text)) {
      return { blocked: true, allowed: false, reason: key };
    }
  }
  return { blocked: false, allowed: true };
}

export const checkContent = filterContent;
