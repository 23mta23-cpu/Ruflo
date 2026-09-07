/**
 * Tagestrenner und Zeitangaben im Chat.
 *
 * ANLASS (Founder-Screenshots 07.09.2026): Im Verlauf stand „01:10" ueber
 * „00:05" — es sah aus wie eine kaputte Sortierung. Die Nachrichten waren von
 * verschiedenen Tagen; der Chat zeigt aber ausschliesslich `HH:MM` und nie ein
 * Datum (app/chat.tsx, nowTime()). Ein Verlauf ueber Wochen ist damit nicht
 * lesbar, und schlimmer: er sieht falsch aus, obwohl er stimmt.
 *
 * Ausgelagert nach lib/, weil der Chat an Anmeldung UND einem Auftrag haengt
 * und im Browser-Durchlauf nicht erreichbar ist — dieselbe Ueberlegung wie bei
 * lib/kalenderWoche.ts. `heute` ist einsetzbar, damit die Tests nicht vom
 * Ausfuehrungstag abhaengen.
 */

const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONATE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

/** Kalendertag als YYYY-MM-DD in ORTSZEIT (nicht toISOString, siehe 0740). */
export function tagesSchluessel(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Die Beschriftung eines Tagestrenners.
 *
 * „Heute" und „Gestern" sind die einzigen Faelle, in denen ein Datum weniger
 * hilft als ein Wort. Innerhalb der letzten Woche der Wochentag, danach das
 * Datum — und ueber den Jahreswechsel hinaus mit Jahreszahl, sonst steht im
 * Januar „12. Dezember" ohne zu sagen, welcher.
 */
export function tagesTrenner(d: Date, heute: Date = new Date()): string {
  const heutigerSchluessel = tagesSchluessel(heute);
  const schluessel = tagesSchluessel(d);
  if (schluessel === heutigerSchluessel) return 'Heute';

  const gestern = new Date(heute);
  gestern.setDate(heute.getDate() - 1);
  if (schluessel === tagesSchluessel(gestern)) return 'Gestern';

  // Ueber Mittag rechnen: sonst verschiebt die Zeitumstellung die Grenze.
  const a = new Date(d); a.setHours(12, 0, 0, 0);
  const b = new Date(heute); b.setHours(12, 0, 0, 0);
  const tage = Math.round((b.getTime() - a.getTime()) / 86400000);

  if (tage > 0 && tage < 7) return WOCHENTAGE[d.getDay()];

  const mitJahr = d.getFullYear() !== heute.getFullYear();
  return `${d.getDate()}. ${MONATE[d.getMonth()]}${mitJahr ? ' ' + d.getFullYear() : ''}`;
}

/** Uhrzeit einer Nachricht — immer HH:MM, das Datum traegt der Trenner. */
export function uhrzeit(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Vor welchen Nachrichten steht ein Trenner?
 *
 * Erwartet die Nachrichten in Anzeigereihenfolge (aelteste zuerst) und liefert
 * je Eintrag die Trenner-Beschriftung oder null. Ein Trenner steht vor der
 * ERSTEN Nachricht eines Tages — auch vor der allerersten des Verlaufs, sonst
 * beginnt ein monatealter Chat ohne jede Zeitangabe.
 */
export function trennerFuer(
  zeitpunkte: (Date | null | undefined)[],
  heute: Date = new Date(),
): (string | null)[] {
  let letzterTag: string | null = null;
  return zeitpunkte.map((d) => {
    if (!d || Number.isNaN(d.getTime())) return null;
    const tag = tagesSchluessel(d);
    if (tag === letzterTag) return null;
    letzterTag = tag;
    return tagesTrenner(d, heute);
  });
}
