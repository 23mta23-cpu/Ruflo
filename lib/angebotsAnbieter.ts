/**
 * Wer steht hinter einem Angebot?
 *
 * ANLASS (Selbst-Check 18.09.2026). Die Angebotskarte in `app/auftrag-detail.tsx`
 * zeigte Preis, Gebuehren und Auszahlung -- und sonst NICHTS. Kein Name, keine
 * Bewertung, kein Hinweis. Der Bestaetigungsdialog sagte „Ein verbindlicher
 * Vertrag wird erstellt" und nannte ebenfalls nur den Betrag.
 *
 * Der Name taucht erst NACH der Annahme auf (`contract.provider.business_name`,
 * Zeile 453). Der Kunde entscheidet also genau in dem Moment blind, in dem die
 * Entscheidung bindet.
 *
 * Die Daten gab es die ganze Zeit: `provider_public` (0560) fuehrt
 * business_name, rating_avg und rating_count, und der Typ `OfferWithProvider`
 * steht seit Monaten in database.types.ts, ohne benutzt zu werden. Dieselbe
 * Fehlerklasse wie alles diese Woche: gebaut, gepflegt, erreicht niemanden.
 *
 * REINE FUNKTION ohne Netz-Import, damit der Test das Echte importiert.
 */

export type OeffentlicherAnbieter = {
  business_name?: string | null;
  rating_avg?: number | null;
  rating_count?: number | null;
} | null | undefined;

export type AnbieterZeile = {
  /** Was auf der Karte steht. Nie leer. */
  name: string;
  /** Erklaerender Satz, wenn der Name fehlt. Sonst null. */
  hinweis: string | null;
  /** „4,8 · 12 Bewertungen" oder „Noch keine Bewertungen". */
  bewertung: string;
};

/**
 * `provider_public` zeigt nur freigegebene und verfuegbare Betriebe (0010,
 * 0560). Fehlt der Eintrag, ist das KEIN Anzeigefehler, sondern eine Aussage:
 * dieser Betrieb ist fuer den Kunden nicht aufrufbar. Genau das gehoert
 * hingeschrieben, statt „Anbieter" hinzustellen -- das sah bis 0800 aus wie
 * ein Name und war keiner.
 */
export function anbieterZeile(p: OeffentlicherAnbieter): AnbieterZeile {
  const name = (p?.business_name ?? '').trim();
  if (!name) {
    return {
      name: 'Name nicht öffentlich',
      hinweis: 'Dieser Betrieb ist derzeit nicht im Verzeichnis aufrufbar. '
        + 'Fragen Sie nach, bevor Sie annehmen.',
      bewertung: 'Keine Bewertungen einsehbar',
    };
  }
  return { name, hinweis: null, bewertung: bewertungsZeile(p) };
}

/** „4,8 · 12 Bewertungen" · „4,8 · 1 Bewertung" · „Noch keine Bewertungen". */
export function bewertungsZeile(p: OeffentlicherAnbieter): string {
  const schnitt = p?.rating_avg;
  const anzahl = p?.rating_count ?? 0;
  if (typeof schnitt !== 'number' || anzahl <= 0) return 'Noch keine Bewertungen';
  // Deutsche Mehrzahl ausgeschrieben, nicht zusammengesetzt (CLAUDE.md, 08.09.).
  const wort = anzahl === 1 ? 'Bewertung' : 'Bewertungen';
  return `${schnitt.toFixed(1).replace('.', ',')} · ${anzahl} ${wort}`;
}

/**
 * Der Satz im Bestaetigungsdialog. Er nennt den Betrieb beim Namen: „fuer
 * 320,00 EUR annehmen" laesst offen, mit WEM man den Vertrag schliesst.
 */
export function annahmeFrage(name: string, betrag: string): string {
  return `Möchten Sie das Angebot von ${name} über ${betrag} annehmen? `
    + 'Damit kommt ein verbindlicher Vertrag zustande.';
}
