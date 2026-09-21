// Welcher Stand der App liegt hier eigentlich vor?
//
// ANLASS (21.09.2026, zum zweiten Mal an einem Tag): Der Founder prueft am
// Geraet die Live-Seite, also `main`. Auf dem Arbeitszweig lagen dabei ueber
// 40 nicht gemergte Commits. Von vier gemeldeten Befunden war einer laengst
// behoben und nur nicht ausgeliefert -- gefunden erst nach einer halben
// Stunde Suche im falschen Stand.
//
// Ein Bildschirmfoto muss sagen koennen, welchen Stand es zeigt. Die
// Fusszeile trug bis dahin „Werkant v1.0.0" als LITERAL: eine Zahl, die sich
// seit dem ersten Tag nicht geaendert hat und deshalb nichts aussagt.
//
// Hier steht nur die Formatierung, ohne Netz- und ohne Expo-Import. Damit ist
// sie in Jest aufrufbar -- eine Funktion, die im Test nicht importierbar ist,
// wird sonst abgeschrieben statt geprueft (16.09.2026).

/**
 * Die Fusszeile mit Fassung und Auslieferungsstand.
 *
 * `build` kommt aus `EXPO_PUBLIC_BUILD`, das der Deploy-Workflow auf
 * Commit-Kuerzel und Datum setzt. Fehlt es, steht bewusst
 * „Entwicklungsstand" da und nicht etwa nichts: eine Live-Seite, die das
 * zeigt, hat ein Deploy-Problem, und das soll man sehen.
 */
export function standZeile(version?: string | null, build?: string | null): string {
  const v = version?.trim() || null;
  const b = build?.trim() || null;
  const name = v ? `Werkant ${v}` : 'Werkant';
  return b ? `${name} · Stand ${b}` : `${name} · Entwicklungsstand`;
}
