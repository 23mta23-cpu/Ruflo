/**
 * Was eine Vertrauensperson erfaehrt, wenn der Kunde den Termin weitergibt.
 *
 * ANLASS: `docs/markt/wettbewerbsabgleich-2026-09.md`, Punkt 4 nach Nutzen:
 * „Termin teilen fuer den Kunden. Klein, billig, und es adressiert die Sorge,
 * die eine Person hat, bevor ein Fremder in die Wohnung kommt."
 *
 * REINE FUNKTION, absichtlich ohne Netz- und ohne Platform-Import: `lib/teilen.ts`
 * zieht react-native nach, `lib/contracts.ts` Expo-Module. Ein Test muesste den
 * Wortlaut sonst abschreiben und sich mit sich selbst vergleichen.
 *
 * DIE START-PIN GEHOERT HIER NICHT HINEIN, und deshalb nimmt die Funktion sie
 * gar nicht erst entgegen. Sie ist das Mittel, mit dem der Kunde entscheidet,
 * wer seine Tuer passiert (0960). Eine Nachricht, die weitergeleitet wird und
 * die Zahl enthaelt, hebt genau das auf. Was man nicht uebergeben kann, kann
 * auch nicht versehentlich mitgeschickt werden -- dieselbe Ueberlegung wie bei
 * `meine_aktiven_strikes()` ohne Argument (07.09.).
 */

export type TerminAngaben = {
  /** Was gemacht wird. */
  leistung: string | null;
  /** Wer kommt. Ohne Namen wird das BENANNT, nicht mit „Anbieter" ueberdeckt. */
  betrieb: string | null;
  /** Wo. Nur Ort, nicht die Strasse: die geht die Vertrauensperson nichts an. */
  stadt: string | null;
  /** Wann, als ISO-Zeichenkette. Fehlt oft, und dann steht das auch da. */
  wann: string | null;
  /** Vertragsnummer, damit sich im Ernstfall etwas zuordnen laesst. */
  vertragNummer: string;
};

/** „Freitag, 19. September 2026 um 09:00 Uhr". Ohne Datum: null. */
export function terminZeitpunkt(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const tag = d.toLocaleDateString('de-DE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const uhr = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${tag} um ${uhr} Uhr`;
}

export function terminWeitergabeText(a: TerminAngaben): string {
  const wann = terminZeitpunkt(a.wann);
  const zeilen = [
    'Ich habe einen Handwerkertermin über Werkant.',
    '',
    `Leistung: ${a.leistung?.trim() || 'nicht angegeben'}`,
    `Betrieb: ${a.betrieb?.trim() || 'Name liegt noch nicht vor'}`,
    `Ort: ${a.stadt?.trim() || 'nicht angegeben'}`,
    `Termin: ${wann ?? 'steht noch nicht fest'}`,
    `Vertrag: ${a.vertragNummer}`,
    '',
    'Ich melde mich, wenn der Termin vorbei ist.',
  ];
  return zeilen.join('\n');
}

/** Dateiname für den Fall, dass der Browser nur einen Download anbietet. */
export function terminDateiname(vertragNummer: string): string {
  return `werkant-termin-${vertragNummer.replace(/[^A-Za-z0-9-]/g, '')}.txt`;
}
