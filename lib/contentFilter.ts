// Hard content filter for profile bios and job creation.
// Blocks: Ü18/erotik, illegal drug production, solicitation.
// Applied on both Nachbarschaft and Handwerker tracks.

const BLOCKED: RegExp[] = [
  // Ü18 / erotik / adult content
  /\b(escort|erotik|nackt(foto|shooting|aufnahme)?|nude|onlyfans|cam(girl|boy|show)?|stripper|strip[ -]?club|lapdance|bordell|puff\b|rotlicht|sexarbeit|sexdienst|aktfoto|aktaufnahme|erotikfoto|erotikfilm|erotikmodel|adult[- ]?content|x-?rated)\b/i,
  // Illegal drug production/assistance
  /\b(hanf[ -]?anbau|cannabis[ -]?anbau|indoor[ -]?grow(room|zelt|tent)?|grow[ -]?(room|tent|zelt|box)|thc[ -]?extrakt|drogenherstellung|drogenküche|drogen(labor|kochen)|koks[ -]?(abfüllen|produzieren)|meth[ -]?(kochen|labor)|crystal[ -]?meth|mdma[ -]?synthese)\b/i,
  // Human trafficking / exploitation
  /\b(prostituier|prostitution|zuhält(er|erin)|menschenhandel|trafficking|sexskla(ve|vin)|zwangsarbeit)\b/i,
];

export interface FilterResult {
  blocked: boolean;
  reason?: string;
}

export function filterContent(text: string): FilterResult {
  for (const pattern of BLOCKED) {
    if (pattern.test(text)) {
      return {
        blocked: true,
        reason: 'Dieser Inhalt verstößt gegen die WERKR-Nutzungsrichtlinien und kann nicht veröffentlicht werden.',
      };
    }
  }
  return { blocked: false };
}
