/**
 * Zeitgrenze fuer JEDE Supabase-Abfrage — an einer Stelle, statt auf 17
 * Bildschirmen.
 *
 * ANLASS: Dreimal derselbe Befund. Am 16.08.2026 standen /rechnung und
 * /vertrag bei gestoerter Verbindung zehn Sekunden leer da; am 06.09.2026
 * zeigte /anbieter eine weisse Flaeche, die auch nach elf Sekunden nicht
 * verschwand. Ursache ist jedes Mal dieselbe: supabase-js hat KEINE
 * eingebaute Zeitgrenze. Antwortet die Gegenstelle nicht — Funkloch, Aufzug,
 * Hotel-WLAN mit Anmeldeseite, das im Hintergrund alles schluckt — dann loest
 * das `await` nie auf. Kein Fehler, kein Ergebnis, `finally` wird nie
 * erreicht, `loading` bleibt fuer immer true.
 *
 * Bisher wurde das je Bildschirm mit mitZeitgrenze() geflickt; vier von
 * siebzehn hatten es. Die uebrigen dreizehn laden nur im angemeldeten
 * Zustand und sind mit dem Browser-Durchlauf deshalb gar nicht nachweisbar.
 * Hier greift die Grenze fuer alle, und zwar so, dass die bestehenden
 * catch-Bloecke sie auffangen: aus "haengt ewig" wird ein abgelehntes
 * Promise, also genau der Fall, fuer den sie geschrieben wurden.
 *
 * AUSGENOMMEN: Datei-Uploads. Ein Gewerbeschein darf bis 10 MB gross sein
 * (MAX_DOC_BYTES in lib/verification.ts); ueber eine schwache
 * Mobilverbindung sind das viele Minuten. Eine Zeitgrenze wuerde
 * ausgerechnet den Schritt abschneiden, an dem die Bewerbung eines
 * Handwerkers haengt. Der Upload hat eigene Fehlerbehandlung.
 *
 * Eigene Datei, damit die Regel ohne Supabase-Client pruefbar ist
 * (__tests__/fetchZeitgrenze.test.ts).
 */
export const ABFRAGE_ZEITGRENZE_MS = 20000;

/** Storage-Aufrufe laufen ohne Grenze — siehe Kopf. */
export function istUpload(url: string): boolean {
  return url.includes('/storage/v1/');
}

export function baueFetchMitZeitgrenze(
  echterFetch: typeof fetch,
  grenzeMs: number = ABFRAGE_ZEITGRENZE_MS,
): typeof fetch {
  return function fetchMitZeitgrenze(eingabe: any, init?: RequestInit): Promise<Response> {
    const url = typeof eingabe === 'string' ? eingabe : (eingabe?.url ?? String(eingabe));
    if (istUpload(url)) return echterFetch(eingabe, init);

    const abbruch = new AbortController();
    // Ein bereits mitgegebenes Signal darf nicht verloren gehen — sonst
    // laufen Abfragen verlassener Bildschirme weiter.
    if (init?.signal) {
      if (init.signal.aborted) abbruch.abort();
      else init.signal.addEventListener('abort', () => abbruch.abort(), { once: true });
    }
    const uhr = setTimeout(() => abbruch.abort(), grenzeMs);
    return echterFetch(eingabe, { ...init, signal: abbruch.signal })
      .finally(() => clearTimeout(uhr));
  } as typeof fetch;
}
