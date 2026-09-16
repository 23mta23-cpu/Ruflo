/**
 * Durchschnitt und Anzahl von Bewertungen, als reine Rechenregel.
 *
 * Eigene Datei OHNE Netz-Import: `lib/reviews.ts` zieht `./supabase` und damit
 * Expo-Module nach, die Jest nicht uebersetzt. Ein Test koennte die Funktion
 * dort also gar nicht aufrufen -- und die erste Fassung des Tests hatte
 * deshalb die Schleife abgeschrieben und sich selbst bestaetigt.
 */

export type Bewertungsschnitt = { schnitt: number; anzahl: number };

/**
 * Die Rechenregel allein, ohne Netz.
 *
 * Ausgelagert, damit ein Test sie WIRKLICH aufruft. Ein Test, der dieselbe
 * Schleife noch einmal hinschreibt und das Ergebnis mit sich selbst
 * vergleicht, kann keinen Fehler in dieser Datei finden.
 */
export function schnitteAusZeilen(
  zeilen: { reviewed_id: string; rating: number }[],
): Record<string, Bewertungsschnitt> {
  const summe: Record<string, { s: number; n: number }> = {};
  for (const r of zeilen) {
    const e = summe[r.reviewed_id] ?? { s: 0, n: 0 };
    e.s += r.rating; e.n += 1;
    summe[r.reviewed_id] = e;
  }
  const aus: Record<string, Bewertungsschnitt> = {};
  // Wer in `zeilen` nicht vorkommt, bekommt KEINEN Eintrag. Eine 0 waere eine
  // Aussage ueber den Kunden, die niemand getroffen hat; die Anzeige fragt
  // deshalb auf "kein Eintrag" ab, nicht auf "Schnitt 0".
  for (const [id, e] of Object.entries(summe)) {
    aus[id] = { schnitt: e.s / e.n, anzahl: e.n };
  }
  return aus;
}
