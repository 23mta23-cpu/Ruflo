// Wie lange ein Link aus einer Mail gilt — an EINER Stelle.
//
// ANLASS (13.09.2026): Zwei Funktionen sagten ihren Nutzern woertlich, ein Link
// sei „abgelaufen", und keine von beiden hatte einen Ablauf:
//
//   * verify-email  — „bereits verwendet oder IST ABGELAUFEN"
//   * waitlist-doi  — „ist unguelig oder ABGELAUFEN"
//
// Dieselbe Klasse wie AGB §7(3) („innerhalb von 12 Monaten"), wo der Code ohne
// Datumsgrenze zaehlte: eine Zusage im sichtbaren Text, die niemand gegen den
// Code gelegt hat.
//
// Die Frist ist ein Parameter und keine Konstante hier drin: sieben Tage fuer
// eine Kontobestaetigung und dreissig fuer eine Warteliste sind verschiedene
// Abwaegungen, und sie gehoeren dorthin, wo sie begruendet werden.

/**
 * Gilt der Link noch?
 *
 * `gesendetAm` kommt aus der Datenbank und kann fehlen oder unlesbar sein.
 * Dann gilt der Link als ABGELAUFEN, nicht als gueltig: bei einem Zeitstempel,
 * den niemand deuten kann, ist die sichere Richtung die strengere.
 */
export function linkGueltig(
  gesendetAm: string | null | undefined,
  tage: number,
  jetzt: Date = new Date(),
): boolean {
  if (!gesendetAm) return false;
  const gesendet = new Date(gesendetAm).getTime();
  if (!Number.isFinite(gesendet)) return false;

  const alterMs = jetzt.getTime() - gesendet;
  // Ein Zeitstempel aus der Zukunft (Uhrversatz zwischen Datenbank und
  // Laufzeit) darf nicht dazu fuehren, dass ein Link ewig gilt — er laeuft
  // ueber die negative Differenz, nicht ueber die Frist.
  if (alterMs < 0) return true;

  return alterMs <= tage * 24 * 60 * 60 * 1000;
}
