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

/**
 * Ab dieser Schriftgroesse stehen waagerechte Zeilen mit UNTEILBAREM Inhalt
 * untereinander statt nebeneinander.
 *
 * ANLASS (29.09.2026): bei fontScale 1,65 (iOS AX1, die erste
 * Bedienungshilfen-Stufe) liefen vier Zeilen ueber den Rand, deren Inhalt
 * sich nicht umbrechen laesst: ein Geldbetrag („€294,40"), ein einzelnes
 * langes Wort („Nachbarschaftshilfe") und drei Vertrauensbegriffe in je einem
 * Drittel. Umbruch hilft dort nicht, Stapeln schon; genau das empfiehlt
 * Apple fuer Bedienungshilfen-Groessen.
 *
 * Wo sich Inhalt UMBRECHEN laesst, wird nicht gestapelt, sondern der
 * Umbruch erlaubt (flexWrap/flexShrink). Das verhaelt sich im Web und auf
 * dem Geraet gleich; diese Weiche hier sieht der Browser-Pruefstand nicht.
 */
export const STAPELN_AB = 1.5;

export function stapeln(fontScale: number): boolean {
  return fontScale >= STAPELN_AB;
}
