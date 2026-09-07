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

/**
 * Wie steht es um einen Terminvorschlag — auch zeitlich?
 *
 * ANLASS (Founder-Screenshot 07.09.2026): Im Chat stand „TERMIN BESTÄTIGT
 * 28.08.2026, 09:00 · Bestätigt" — an einem Tag, an dem der 28.08. bereits
 * zehn Tage zurücklag. Die Karte sagt bis heute dasselbe wie am Tag der
 * Zusage. Wer einen laengeren Verlauf durchblaettert, kann nicht erkennen, ob
 * der Termin noch bevorsteht oder laengst vorbei ist — und im selben Verlauf
 * standen drei verschiedene Daten (Vertrag 16.08., Termin 28.08., abgelehnter
 * Vorschlag 09.09.).
 *
 * Bewusst NICHT als „erledigt" behandelt: ob die Arbeit stattgefunden hat,
 * weiss die App nicht. Gesagt wird nur, dass der Zeitpunkt vorbei ist.
 *
 * Liegt in lib/chatTage.ts und nicht in lib/appointments.ts, weil jenes Modul
 * supabase importiert und damit in Jest nicht ladbar ist — dieselbe Falle wie
 * bei lib/chatGuard.ts.
 */
export type TerminLage = 'bevorstehend' | 'verstrichen' | 'abgelehnt' | 'ueberholt' | 'offen';

export function terminLage(
  status: string,
  zeitpunkt: string | Date | null | undefined,
  jetzt: Date = new Date(),
): TerminLage {
  if (status === 'rejected') return 'abgelehnt';
  if (status === 'superseded') return 'ueberholt';
  if (status !== 'accepted') return 'offen';
  if (!zeitpunkt) return 'bevorstehend';
  const d = zeitpunkt instanceof Date ? zeitpunkt : new Date(zeitpunkt);
  if (Number.isNaN(d.getTime())) return 'bevorstehend';
  return d.getTime() < jetzt.getTime() ? 'verstrichen' : 'bevorstehend';
}

/**
 * Sagt diese System-Notiz dasselbe wie eine Terminkarte daneben?
 *
 * ANLASS (Founder-Screenshot 07.09.2026): Unter der Karte „TERMIN BESTÄTIGT
 * 28.08.2026, 09:00" stand noch einmal „Termin bestätigt: 28.08.2026 09:00",
 * und unter der abgelehnten Karte „Terminvorschlag abgelehnt". Zweimal
 * dasselbe, direkt untereinander.
 *
 * Die Notizen kommen aus der Datenbank (0520) und BLEIBEN dort: sie sind der
 * Beleg im Verlauf und liefern die Vorschau im Posteingang. Sie werden nur
 * nicht ein zweites Mal angezeigt, wenn die Karte danebensteht.
 *
 * Fehlt die Karte — etwa weil der Vorschlag nicht geladen wurde —, bleibt die
 * Notiz sichtbar. Sonst verschwaende die einzige Spur des Termins.
 */
const TERMIN_NOTIZ = /^(Terminvorschlag|Termin bestätigt|Terminvorschlag abgelehnt)/;

export function istDoppelteTerminNotiz(
  text: string,
  terminZeitpunkte: (string | Date | null | undefined)[],
): boolean {
  if (!TERMIN_NOTIZ.test(text.trim())) return false;

  // Ohne Datum („Terminvorschlag abgelehnt") genuegt, dass ueberhaupt eine
  // Karte da ist — die Notiz gehoert dann zu ihr.
  const datum = text.match(/(\d{2})\.(\d{2})\.(\d{4})[ ,]+(\d{2}):(\d{2})/);
  if (!datum) return terminZeitpunkte.length > 0;

  const [, tt, mm, jjjj, hh, min] = datum;
  return terminZeitpunkte.some((z) => {
    if (!z) return false;
    const d = z instanceof Date ? z : new Date(z);
    if (Number.isNaN(d.getTime())) return false;
    return d.getDate() === Number(tt)
      && d.getMonth() + 1 === Number(mm)
      && d.getFullYear() === Number(jjjj)
      && d.getHours() === Number(hh)
      && d.getMinutes() === Number(min);
  });
}
