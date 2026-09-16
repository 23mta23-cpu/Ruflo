/**
 * Benachrichtigungen: gespeicherte Pflichtmitteilungen und abgeleitete Hinweise
 * in EINER Liste.
 *
 * HINTERGRUND (12.09.2026): `app/benachrichtigungen.tsx` baute die Liste bei
 * jedem Oeffnen aus `jobs`, `messages` und `offers` neu zusammen. `read` stand
 * fest auf `false` im Code, „als gelesen markieren" lebte nur im
 * Bildschirmzustand und war beim naechsten Oeffnen wieder weg. Und Ereignisse
 * ohne eigene Zeile tauchten nie auf -- darunter Strike und DSA-Beschraenkung,
 * also gerade die, bei denen es zaehlt.
 *
 * Seit Migration 0860 gibt es `public.notifications`. Bewusst NICHT alles
 * dorthin gespiegelt: ein Angebot und eine Chat-Nachricht stehen bereits in
 * ihren eigenen Tabellen, und eine zweite Wahrheit ueber denselben Vorgang
 * waere die schlechtere Loesung. Zusammengefuehrt wird deshalb beim Lesen.
 *
 * Die Reihenfolge ist kein Geschmack: Pflichtmitteilungen zuerst. Ein Strike
 * darf nicht unter drei Chat-Nachrichten verschwinden -- er traegt eine Frist
 * und einen Beschwerdeweg (AGB §7(5), DSA Art. 17).
 */

export type MitteilungsArt =
  | 'strike' | 'beschraenkung' | 'auszahlung' | 'system'
  | 'offer' | 'message' | 'escrow' | 'review' | 'pstg';

export interface Mitteilung {
  id: string;
  art: MitteilungsArt;
  titel: string;
  text: string;
  /** Zeitpunkt als ISO-Zeichenkette, fuer die Sortierung. */
  iso: string;
  gelesen: boolean;
  route?: string | null;
  /**
   * Steht die Mitteilung in `notifications`? Nur dann ueberlebt der
   * Gelesen-Status das Schliessen des Bildschirms.
   */
  gespeichert: boolean;
  /** Pflichtmitteilung nach AGB §7(4) / DSA Art. 17. */
  pflicht: boolean;
}

/**
 * Eine Liste aus beiden Quellen: Pflichtmitteilungen zuerst, darin und danach
 * die neueste zuerst.
 *
 * Doppelte Kennungen werden entfernt und die GESPEICHERTE Fassung behalten:
 * sie traegt den echten Gelesen-Status.
 */
export function zusammenfuehren(
  gespeichert: Mitteilung[],
  abgeleitet: Mitteilung[],
): Mitteilung[] {
  const nachId = new Map<string, Mitteilung>();
  for (const m of abgeleitet) nachId.set(m.id, m);
  for (const m of gespeichert) nachId.set(m.id, m);

  return [...nachId.values()].sort((a, b) => {
    if (a.pflicht !== b.pflicht) return a.pflicht ? -1 : 1;
    return b.iso.localeCompare(a.iso);
  });
}

/** Wie viele sind ungelesen? */
export function ungeleseneAnzahl(liste: Mitteilung[]): number {
  return liste.filter((m) => !m.gelesen).length;
}

/**
 * Der Text unter der Ueberschrift, wenn nichts da ist.
 *
 * Kein „Keine Benachrichtigungen" allein: ein leerer Bildschirm ohne Erklaerung
 * sieht aus wie ein Fehler.
 */
export const LEER_TITEL = 'Nichts Neues';
export const LEER_TEXT =
  'Angebote, Nachrichten und Mitteilungen zu Ihren Aufträgen erscheinen hier.';

/**
 * Wie viele ungelesene Pflichtmitteilungen liegen fuer mich bereit?
 *
 * ANLASS (16.09.2026, Stand-Aufnahme statt Founder-Befund): Der
 * Betriebsbereich hat fuenf Reiter und KEINEN Weg zu `/benachrichtigungen`.
 * Zwei Trigger aus 0860 schreiben aber genau dorthin, und beide betreffen
 * ausschliesslich Betriebe:
 *
 *   `strike_benachrichtigen()`        ein Verstoss samt Begruendung
 *   `beschraenkung_benachrichtigen()` eine Beschraenkung des Dienstes
 *
 * Beide sind nach Art. 4 P2B-VO geschuldete Uebermittlungen, und die
 * Freigabe der Verifizierung laeuft denselben Weg. In der Produktion wartet
 * gerade ein Betrieb auf seine Freigabe (`/health`: `pruef_offen: 1`);
 * Mailversand ist aus. Ohne diesen Zaehler haette er nie erfahren, dass die
 * Entscheidung da ist.
 *
 * Absichtlich nur `notifications`, nicht die abgeleiteten Kundenquellen: was
 * hier gezaehlt wird, muss der Betrieb auf dem Zielbildschirm auch finden.
 */
export async function ungeleseneMitteilungen(
  abfrage: () => Promise<{ data: { gelesen_am: string | null }[] | null; error: unknown }>,
): Promise<number> {
  const { data, error } = await abfrage();
  // Ein Fehler darf keine Zahl erfinden. Lieber kein Punkt als ein falscher.
  if (error || !data) return 0;
  return data.filter((z) => z.gelesen_am == null).length;
}
