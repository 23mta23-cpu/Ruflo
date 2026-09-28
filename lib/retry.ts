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

/**
 * Wie `mitZeitgrenze`, aber UNTERSCHEIDBAR.
 *
 * ANLASS (28.09.2026): `mitZeitgrenze` liefert bei Zeitablauf `null` — und
 * genau denselben Wert liefern die Ladefunktionen, wenn es den Datensatz
 * wirklich nicht gibt. Beide Faelle landeten deshalb im selben Zweig, und
 * /vertrag, /rechnung und /zahlung sagten bei einem Netzfehler Saetze wie
 * „Zu diesem Auftrag besteht kein offener Vertrag. Es wurde nichts
 * abgebucht." Das ist eine feststehende Aussage ueber einen Vertrag und eine
 * Abbuchung, hergeleitet aus einer Abfrage, die nie angekommen ist.
 *
 * Hier heisst `null` AUSSCHLIESSLICH „Zeitgrenze erreicht". Ein regulaeres
 * Ergebnis kommt als `{ wert }` zurueck, auch wenn der Wert selbst null ist.
 */
export function mitZeitgrenzeMarkiert<T>(
  p: Promise<T>,
  ms = 6000,
): Promise<{ wert: T } | null> {
  return mitZeitgrenze(p.then((wert) => ({ wert })), ms);
}
