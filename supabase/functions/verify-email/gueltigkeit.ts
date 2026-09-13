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

/**
 * Gilt der Link noch?
 *
 * `sent_at` kommt aus der Datenbank und kann fehlen oder unlesbar sein. Dann
 * gilt der Link als ABGELAUFEN, nicht als gueltig: bei einem Zeitstempel, den
 * niemand deuten kann, ist die sichere Richtung die strengere.
 */
export function linkGueltig(
  sent_at: string | null | undefined,
  jetzt: Date = new Date(),
): boolean {
  if (!sent_at) return false;
  const gesendet = new Date(sent_at).getTime();
  if (!Number.isFinite(gesendet)) return false;

  const alterMs = jetzt.getTime() - gesendet;
  // Ein Zeitstempel aus der Zukunft (Uhrversatz zwischen Datenbank und
  // Laufzeit) darf nicht dazu fuehren, dass ein Link ewig gilt.
  if (alterMs < 0) return true;

  return alterMs <= TOKEN_GUELTIG_TAGE * 24 * 60 * 60 * 1000;
}
