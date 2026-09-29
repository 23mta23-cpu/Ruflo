/**
 * Weiche Trennstellen nur bei vergroesserter Systemschrift.
 *
 * ANLASS (29.09.2026, Store-Frage des Founders): bei grosser Systemschrift
 * (iOS „xxxLarge", fontScale ~1,35) passt „Nachbarschaftshilfe," in der
 * Ueberschrift der Landing nicht mehr in eine Zeile. Das Geraet bricht das
 * Wort dann mitten im Zeichen um, ohne Trennstrich; im Browser laeuft es ueber
 * den Rand.
 *
 * Ein weiches Trennzeichen (­) behebt das, veraendert aber auch die
 * NORMALE Darstellung: der Zeilenumbruch fuellt gierig, und bei 390 px stand
 * dann „Nachbar-/schaftshilfe" in der Ueberschrift. GEMESSEN, nicht vermutet.
 * Deshalb bleiben die Trennstellen nur ab `GROSSE_SCHRIFT_AB` stehen.
 *
 * GRENZE: react-native-web meldet `fontScale` immer als 1. Der Browser-
 * Pruefstand sieht deshalb nur den Normalfall; die Weiche selbst prueft Jest
 * (__tests__/grosseSchrift.test.ts), und scripts/rand-ueberstand-check.cjs
 * fuehrt die Stelle als begruendete Ausnahme mit Verfallspruefung.
 */
export const GROSSE_SCHRIFT_AB = 1.1;

export function trennbar(text: string, fontScale: number): string {
  return fontScale >= GROSSE_SCHRIFT_AB ? text : text.replace(/­/g, '');
}
