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
