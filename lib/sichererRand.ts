/**
 * Wie viel Luft eine festgeklebte Aktionsleiste nach unten braucht.
 *
 * ANLASS: Sieben Bildschirme haben unten eine Leiste mit
 * `position: 'absolute', bottom: 0` und darin den wichtigsten Knopf des
 * Bildschirms (zahlen, Angebot senden, Auftrag abschliessen, bewerten,
 * stornieren, Vertrag bestaetigen, Anfrage stellen). Alle sieben hatten
 * eine feste Zahl darunter stehen: 28 px, einmal 32.
 *
 * Diese Zahl ist auf JEDEM Geraet falsch:
 *   - iPhone mit Hausknopf, Android mit drei Knoepfen: unterer Rand 0.
 *     28 px sind dann tote Flaeche.
 *   - iPhone ab X, Android mit Gestensteuerung: unterer Rand 34 px.
 *     Der Knopf endet dann INNERHALB des Streifens, in dem das System
 *     die Wischgeste abfaengt. Apple HIG („Layout", Safe Areas) sagt
 *     dazu: keine Bedienelemente in den Bereich der Home-Anzeige legen.
 *
 * Die Leiste liegt bewusst NICHT in einer `SafeAreaView` mit unterer
 * Kante: dann entstuende unter ihr ein Streifen Hintergrund, und die
 * Leiste reichte nicht mehr bis zum Bildschirmrand. Der Rand gehoert
 * also in die Leiste selbst.
 *
 * GRENZE, ehrlich benannt: react-native-web meldet ueberall 0. Der
 * Prueftstand im Browser kann den Unterschied NICHT sehen. Nachgewiesen
 * ist hier die Rechnung (Jest) und die Verdrahtung
 * (scripts/sichere-aktionsleiste-check.py) -- nicht die Wirkung am Geraet.
 */

/** Abstand, wenn das Geraet keinen geschuetzten Bereich unten hat. */
export const LEISTEN_GRUNDABSTAND = 16;

/**
 * @param untererRand `useSafeAreaInsets().bottom`
 * @returns paddingBottom fuer die Leiste
 */
export function aktionsleistenRand(untererRand: number): number {
  if (!Number.isFinite(untererRand) || untererRand <= 0) return LEISTEN_GRUNDABSTAND;
  return LEISTEN_GRUNDABSTAND + untererRand;
}
