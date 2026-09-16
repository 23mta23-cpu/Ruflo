/**
 * Bewertungsfrist und Antwortrecht.
 *
 * Die Frist ist KEINE Anzeige-Hilfe, sondern die zweite Haelfte einer Regel,
 * deren erste in `supabase/migrations/0930_bewertung_frist_und_antwort.sql`
 * steht. Steht hier eine andere Zahl als dort, sagt die App etwas zu, was der
 * Server danach ablehnt -- deshalb bindet `scripts/bewertung-check.py` beide
 * Seiten aneinander.
 *
 * `jetzt` wird uebergeben, nicht innen erzeugt: ein Test, der nur an einem
 * bestimmten Tag gruen ist, ist kein Test (Lehre 16.08.).
 */

/** Tage ab Vertragsabschluss, in denen bewertet werden kann. */
export const BEWERTUNGSFRIST_TAGE = 14;

const MS_PRO_TAG = 86_400_000;

export type FristLage =
  | { art: 'offen'; verbleibendeTage: number }
  | { art: 'letzterTag' }
  | { art: 'abgelaufen' }
  | { art: 'unbekannt' };

/**
 * Wie weit ist die Frist?
 *
 * `abgeschlossenAm` ist `contracts.completed_at`. Fehlt der Wert, ist die
 * Lage `unbekannt` -- und die Migration laesst die Bewertung dann ebenfalls
 * zu. Ein fehlender Zeitstempel darf kein Recht nehmen.
 */
export function fristLage(
  abgeschlossenAm: string | null | undefined,
  jetzt: Date = new Date(),
): FristLage {
  if (!abgeschlossenAm) return { art: 'unbekannt' };
  const start = new Date(abgeschlossenAm).getTime();
  if (Number.isNaN(start)) return { art: 'unbekannt' };

  const ende = start + BEWERTUNGSFRIST_TAGE * MS_PRO_TAG;
  const restMs = ende - jetzt.getTime();
  if (restMs <= 0) return { art: 'abgelaufen' };

  // Aufrunden: solange noch irgendetwas von einem Tag uebrig ist, ist es
  // dieser Tag. Abrunden wuerde am letzten Tag "0 Tage" anzeigen, obwohl die
  // Bewertung noch geht.
  const tage = Math.ceil(restMs / MS_PRO_TAG);
  if (tage <= 1) return { art: 'letzterTag' };
  return { art: 'offen', verbleibendeTage: tage };
}

/** Darf jetzt noch bewertet werden? Gleiche Bedingung wie die Policy in 0930. */
export function darfBewerten(
  abgeschlossenAm: string | null | undefined,
  jetzt: Date = new Date(),
): boolean {
  return fristLage(abgeschlossenAm, jetzt).art !== 'abgelaufen';
}

/** Satz fuer den Bewertungs-Bildschirm. Nennt die Frist, statt sie zu verschweigen. */
export function fristText(lage: FristLage): string {
  switch (lage.art) {
    case 'offen':
      return `Sie können diesen Auftrag noch ${lage.verbleibendeTage} Tage lang bewerten.`;
    case 'letzterTag':
      return 'Heute ist der letzte Tag, an dem Sie diesen Auftrag bewerten können.';
    case 'abgelaufen':
      return `Die Bewertungsfrist von ${BEWERTUNGSFRIST_TAGE} Tagen ist abgelaufen.`;
    case 'unbekannt':
      return 'Sie können diesen Auftrag bewerten.';
  }
}

/**
 * Darf diese Person auf diese Bewertung antworten?
 *
 * Gleiche Bedingung wie die Update-Policy in 0930: nur die bewertete Person,
 * und nur solange noch keine Antwort steht.
 */
export function darfAntworten(
  bewertung: { reviewed_id: string; antwort: string | null },
  meineId: string | null | undefined,
): boolean {
  if (!meineId) return false;
  if (bewertung.reviewed_id !== meineId) return false;
  return bewertung.antwort === null;
}
