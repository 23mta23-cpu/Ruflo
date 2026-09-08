/**
 * Zahl plus Substantiv, in richtigem Deutsch.
 *
 * ANLASS (Founder am Geraet, 08.09.2026): Auf dem Anbieter-Dashboard stand
 * „3 neue Auftrage wartet". Zwei Fehler in einer Zeile, beide aus derselben
 * Ursache:
 *
 *     `${n} neue${n === 1 ? 'r' : ''} Auftrag${n === 1 ? '' : 'e'} wartet`
 *
 *   1. Die Mehrzahl von „Auftrag" ist „Aufträge". Ein angehaengtes „e"
 *      kann den Umlaut nicht erzeugen — heraus kam „Auftrage".
 *   2. Das Verb blieb fest auf „wartet"; bei drei Auftraegen heisst es
 *      „warten".
 *
 * Deutsche Mehrzahl ist nicht aus der Einzahl ableitbar (Auftrag/Aufträge,
 * Termin/Termine, Angebot/Angebote, Haus/Häuser). Wer sie zusammensetzt,
 * baut den Fehler ein, sobald ein Umlaut oder ein anderes Verb im Spiel ist.
 *
 * Deshalb: BEIDE Formen ausschreiben. Das ist laenger und dafuer richtig.
 */
export function anzahlText(n: number, einzahl: string, mehrzahl: string): string {
  return n === 1 ? `1 ${einzahl}` : `${n} ${mehrzahl}`;
}
