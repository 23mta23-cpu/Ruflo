/**
 * Wie lange wartet ein Vorgang schon, und ist die Zusage überschritten?
 *
 * ANLASS (21.09.2026): `disputes` und `inhalts_meldungen` werden geschrieben
 * und von niemandem gelesen. Bei den Reklamationen hängt Geld daran (0770
 * friert den Treuhandbetrag ein), und `app/reklamation.tsx` sagt dem Kunden
 * eine Prüfung „innerhalb von 2 Werktagen" zu.
 *
 * Eigene Datei OHNE Netz-Import, damit der Test die echte Funktion aufruft
 * statt sie abzuschreiben (Lehre vom 16.09.).
 *
 * `jetzt` ist ein PARAMETER. Ein Test, der nur an Werktagen grün ist, ist
 * kein Test (Lehre vom 16.08.).
 */
import { REKLAMATION_FRIST_WERKTAGE } from '../constants/legal';

/**
 * Volle Werktage zwischen zwei Zeitpunkten, Samstag und Sonntag zählen nicht.
 *
 * BEWUSST ohne Feiertage: ein Feiertagskalender für 16 Bundesländer wäre eine
 * eigene Abhängigkeit, und die Zahl dient der Sortierung eines Postfachs,
 * nicht der Fristberechnung vor Gericht. Das steht auch so im Postfach.
 */
export function werktageDazwischen(von: Date, bis: Date): number {
  if (!(von instanceof Date) || Number.isNaN(von.getTime())) return 0;
  if (!(bis instanceof Date) || Number.isNaN(bis.getTime())) return 0;
  if (bis <= von) return 0;

  let tage = 0;
  // Auf Tagesbeginn normalisieren, sonst zählt ein Vorgang von Montag 23:00
  // bis Dienstag 01:00 als „ein Werktag", obwohl zwei Stunden vergangen sind.
  const lauf = new Date(von.getFullYear(), von.getMonth(), von.getDate());
  const ende = new Date(bis.getFullYear(), bis.getMonth(), bis.getDate());
  while (lauf < ende) {
    lauf.setDate(lauf.getDate() + 1);
    const wt = lauf.getDay();
    if (wt !== 0 && wt !== 6) tage += 1;
  }
  return tage;
}

export type Dringlichkeit = 'frisch' | 'faellig' | 'ueberfaellig';

/**
 * Der Zustand einer Reklamation gegenüber der Zusage aus `reklamation.tsx`.
 *
 * `faellig` heißt: die zugesagte Frist ist erreicht, aber noch nicht
 * überschritten. Die Trennung ist der Sinn der Sache -- wer nur „überfällig"
 * kennt, erfährt es erst, wenn die Zusage schon gebrochen ist.
 */
export function reklamationsLage(erstelltAm: string | null | undefined, jetzt: Date): Dringlichkeit {
  if (!erstelltAm) return 'frisch';
  const d = new Date(erstelltAm);
  if (Number.isNaN(d.getTime())) return 'frisch';
  const tage = werktageDazwischen(d, jetzt);
  if (tage > REKLAMATION_FRIST_WERKTAGE) return 'ueberfaellig';
  if (tage >= REKLAMATION_FRIST_WERKTAGE) return 'faellig';
  return 'frisch';
}

/**
 * Der Zustand einer Inhalts-Meldung.
 *
 * Art. 16 DSA nennt keine Zahl, sondern „zeitnah". Die 24 Stunden sind eine
 * Betriebsgröße, keine Rechtsauslegung -- und sie stehen hier, damit der
 * Betreiber überhaupt eine Reihenfolge hat.
 */
export const MELDUNG_FRIST_STUNDEN = 24;

export function meldungsLage(eingegangenAm: string | null | undefined, jetzt: Date): Dringlichkeit {
  if (!eingegangenAm) return 'frisch';
  const d = new Date(eingegangenAm);
  if (Number.isNaN(d.getTime())) return 'frisch';
  const stunden = (jetzt.getTime() - d.getTime()) / 3_600_000;
  if (stunden > MELDUNG_FRIST_STUNDEN) return 'ueberfaellig';
  if (stunden >= MELDUNG_FRIST_STUNDEN) return 'faellig';
  return 'frisch';
}

/** „seit 3 Werktagen" / „seit 5 Stunden" — für die Zeile im Postfach. */
export function wartetSeitText(seit: string | null | undefined, jetzt: Date): string {
  if (!seit) return 'Zeitpunkt unbekannt';
  const d = new Date(seit);
  if (Number.isNaN(d.getTime())) return 'Zeitpunkt unbekannt';
  const stunden = Math.floor((jetzt.getTime() - d.getTime()) / 3_600_000);
  if (stunden < 1) return 'seit weniger als einer Stunde';
  if (stunden < 24) return `seit ${stunden} ${stunden === 1 ? 'Stunde' : 'Stunden'}`;
  const tage = Math.floor(stunden / 24);
  return `seit ${tage} ${tage === 1 ? 'Tag' : 'Tagen'}`;
}
