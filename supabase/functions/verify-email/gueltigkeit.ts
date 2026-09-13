// Wie lange ein Bestaetigungslink gilt — ausfuehrbar testbar.
//
// ANLASS (13.09.2026, Selbst-Check): Die Seite, die verify-email bei einem
// unbekannten Token ausliefert, sagte woertlich
//
//   „Dieser Bestaetigungslink wurde bereits verwendet oder IST ABGELAUFEN."
//
// Einen Ablauf gab es nicht. Die Abfrage war `.eq("token", token)`, sonst
// nichts; `sent_at` wurde gespeichert und nie gelesen, und keine Aufraeumung
// entfernte alte Zeilen. Ein Link aus einer Mail von vor einem Jahr haette
// unveraendert funktioniert.
//
// Das ist dieselbe Klasse wie AGB §7(3) („innerhalb von 12 Monaten"), wo der
// Code ohne Datumsgrenze zaehlte: eine Zusage im sichtbaren Text, die niemand
// gegen den Code gelegt hat.
//
// SIEBEN TAGE, und zwar bewusst nicht kuerzer: Die Mail kann im Spam liegen
// oder am Wochenende ungelesen bleiben, und wer den Link verpasst, kann in der
// App ohne Umstand eine neue anfordern — genau das sagt die Seite auch. Ein
// kurzes Fenster wuerde nur Menschen aussperren, ohne einen Angreifer
// aufzuhalten, der die Mail ohnehin sofort haette.

export const TOKEN_GUELTIG_TAGE = 7;

// Die Fristlogik selbst liegt seit 13.09.2026 in ../_shared/linkfrist.ts:
// waitlist-doi hatte denselben Fehler und braucht dieselbe Pruefung, nur mit
// einer anderen Frist. Zwei Kopien derselben Fristrechnung waeren die naechste
// Stelle, an der eine von beiden irgendwann abweicht.
import { linkGueltig as frist } from "../_shared/linkfrist.ts";

export function linkGueltig(
  sent_at: string | null | undefined,
  jetzt: Date = new Date(),
): boolean {
  return frist(sent_at, TOKEN_GUELTIG_TAGE, jetzt);
}
