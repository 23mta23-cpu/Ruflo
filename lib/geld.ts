/**
 * Geldbetraege anzeigen.
 *
 * ANLASS (14.09.2026): `eur()` stand DREIMAL im Baum, in app/angebot.tsx,
 * app/auftrag-detail.tsx und app/vertrag.tsx — und die drei Fassungen waren
 * nicht gleich: zweimal „€ 1234,00" mit Leerzeichen, einmal „€1234,00" ohne.
 * Derselbe Betrag sah also je nach Bildschirm anders aus.
 *
 * Keine davon hatte einen Tausenderpunkt. Bei einer Kuechenrenovierung stand
 * dort „€ 12500,00", und das liest sich zu leicht als 1250. Bei einem Betrag,
 * den jemand freigibt, ist das kein Schoenheitsfehler.
 *
 * Vereinheitlicht auf die Form ohne Leerzeichen, weil sie im Baum ueberwiegt
 * (rechnung.tsx, zahlung.tsx, betrieb/auftraege.tsx schreiben alle `€${…}`).
 */

/**
 * Das Vorzeichen gehoert VOR das Waehrungszeichen.
 *
 * `'€' + (-3).toLocaleString('de-DE')` ergibt „€-3,00" — das Minus steht dann
 * zwischen Zeichen und Zahl und ist leicht zu uebersehen. Richtig ist
 * „-€3,00". Relevant, weil ein Auftrag unter der Mindestgebuehr eine negative
 * Auszahlung ergibt (siehe __tests__/fee.test.ts).
 */
function mitVorzeichen(betrag: number, zahl: string): string {
  return betrag < 0 ? '-€' + zahl.replace('-', '') : '€' + zahl;
}

/** Der uebliche Fall: zwei Nachkommastellen, Tausenderpunkt. „€1.234,56" */
export function euro(betrag: number): string {
  if (!Number.isFinite(betrag)) return '…';
  return mitVorzeichen(betrag, betrag.toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }));
}

/**
 * Fuer Kennzahlen, die ohnehin auf ganze Euro gerundet sind (Statistik).
 * „€1.234". Nicht fuer Betraege, die jemand zahlt oder freigibt — dort sind
 * die Cent Teil der Aussage.
 */
export function euroRund(betrag: number): string {
  if (!Number.isFinite(betrag)) return '…';
  return mitVorzeichen(betrag, Math.round(betrag).toLocaleString('de-DE'));
}
