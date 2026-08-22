/**
 * Ein automatischer Wiederholversuch für Lade-Aufrufe. Grund (Founder-Befund
 * 18.07., 05:58): Beim Kalt-Start feuert der erste Query oft, bevor die
 * gespeicherte Auth-Session aufgefrischt ist (abgelaufenes Token) — der
 * Fehler verschwindet eine Sekunde später von selbst. Statt sofort einen
 * Fehler-Toast zu zeigen, einmal kurz warten und erneut versuchen; erst
 * danach ist es ein echter Fehler.
 */
export async function withOneRetry<T>(fn: () => Promise<T>, delayMs = 1500): Promise<T> {
  try {
    return await fn();
  } catch {
    await new Promise((r) => setTimeout(r, delayMs));
    return fn();
  }
}

/**
 * Einen Ladeaufruf mit einer Zeitgrenze versehen.
 *
 * ANLASS (16.08.2026): /rechnung und /vertrag standen bei gestoerter Verbindung
 * ZEHN SEKUNDEN lang leer da — Supabase-Aufrufe haben keine eingebaute
 * Zeitgrenze, und bis der Netz-Stack aufgibt, zeigt der Bildschirm nichts.
 * Zehn Sekunden ohne jede Rueckmeldung sind auf einem Rechnungsbildschirm
 * nicht hinnehmbar: der Nutzer weiss nicht, ob seine Zahlung durchgelaufen ist.
 *
 * app/suche.tsx hatte dafuer bereits eine eigene Loesung; hier steht sie an
 * einer Stelle.
 */
export function mitZeitgrenze<T>(p: Promise<T>, ms = 6000): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>((aufloesen) => setTimeout(() => aufloesen(null), ms)),
  ]);
}
