// Der Vergleich des Admin-Secrets — an EINER Stelle.
//
// ANLASS (13.09.2026): Dieselbe Prüfung stand dreimal im Baum
// (pstg-annual-report, zustellung, release-escrow/handler). Ein
// sicherheitskritisches Grundstueck in drei Kopien ist drei Gelegenheiten, es
// beim naechsten Anfassen unterschiedlich falsch zu machen — und niemand faellt
// auf, weil jede Kopie fuer sich funktioniert.
//
// KONSTANTZEIT beim INHALT (Security-Befund L4): die Schleife laeuft immer ueber
// die volle Laenge, statt beim ersten abweichenden Zeichen auszusteigen. Sonst
// verraet die Antwortzeit das Secret zeichenweise.
//
// NICHT konstantzeit bei der LAENGE, und das ist ausdruecklich so: bei
// unterschiedlicher Laenge wird sofort abgelehnt. Ein Angreifer erfaehrt damit
// die Laenge des Secrets. Das ist hingenommen — die Laenge allein hilft bei
// einem zufaellig erzeugten Secret nicht weiter, und ein laengenverbergender
// Vergleich waere deutlich fehleranfaelliger als der Gewinn wert ist. Es steht
// hier, damit niemand den Kommentar "Konstantzeit" spaeter fuer mehr haelt, als
// er verspricht.

export function adminSecretStimmt(
  gemeldet: string | null | undefined,
  erwartet: string | null | undefined,
): boolean {
  // Fehlt eines von beiden, ist die Antwort nein — auch wenn BEIDE fehlen.
  // Das ist der wichtigste Fall: waere hier ein blosses `gemeldet === erwartet`
  // gestanden, haette eine Umgebung ohne gesetztes Werkant_ADMIN_SECRET jeden
  // Aufrufer durchgelassen, der einen leeren Header schickt. Ein leerer String
  // ist in JavaScript falsy und wird davon mit erfasst.
  if (!erwartet || !gemeldet) return false;
  if (gemeldet.length !== erwartet.length) return false;

  let diff = 0;
  for (let i = 0; i < erwartet.length; i++) {
    diff |= gemeldet.charCodeAt(i) ^ erwartet.charCodeAt(i);
  }
  return diff === 0;
}
