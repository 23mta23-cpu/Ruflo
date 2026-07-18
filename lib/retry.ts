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
