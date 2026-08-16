/**
 * Wochenberechnung fuer den Anbieter-Kalender.
 *
 * Ausgelagert aus app/betrieb/kalender.tsx, damit die Datumsarithmetik
 * pruefbar ist: der Bildschirm selbst haengt an Anmeldung und Anbieter-Rolle
 * und ist im Browser-Durchlauf gar nicht erreichbar. Genau hier lagen aber die
 * Fehler -- ein Kalender, der nur die laufende Woche kennt, und ein
 * Buchungs-Schluessel, der sich jede Woche wiederholt.
 */

/** Kalendertag als YYYY-MM-DD, in ORTSZEIT. */
export function isoTag(d: Date): string {
  // Bewusst NICHT toISOString(): das rechnet nach UTC um und schiebt in
  // deutscher Sommerzeit jeden Zeitpunkt vor 02:00 auf den Vortag -- ein
  // Termin am 01.09. um 00:30 landete damit auf dem 31.08.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Montag der Woche mit dem angegebenen Versatz (0 = laufende Woche,
 * -1 = vorige, +1 = naechste). `heute` ist einsetzbar, damit Tests nicht vom
 * Ausfuehrungstag abhaengen.
 */
export function montagDerWoche(wochenVersatz: number, heute: Date = new Date()): Date {
  const montag = new Date(heute);
  // getDay(): 0=Sonntag. (+6)%7 verschiebt auf 0=Montag, sonst faengt die
  // Woche am Sonntag an und der Sonntag gehoert zur falschen Woche.
  montag.setDate(heute.getDate() - ((heute.getDay() + 6) % 7) + wochenVersatz * 7);
  montag.setHours(0, 0, 0, 0);
  return montag;
}

/** Die sieben Kalendertage (Mo–So) der Woche mit dem angegebenen Versatz. */
export function wochenTage(wochenVersatz: number, heute: Date = new Date()): Date[] {
  const montag = montagDerWoche(wochenVersatz, heute);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(montag);
    d.setDate(montag.getDate() + i);
    return d;
  });
}
