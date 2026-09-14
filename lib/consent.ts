/**
 * Ist die DSGVO-Zustimmung erteilt?
 *
 * ANLASS (14.09.2026): Diese Entscheidung stand als `decide()` INNERHALB eines
 * `useEffect` in `app/_layout.tsx` und wurde von nichts geprueft.
 * `__tests__/compliance.test.ts` trug eine zweite Fassung namens
 * `isConsentRequired(storageValue)`, die ein Format modellierte, das es NICHT
 * gibt: sie verglich mit der Zeichenkette `'true'`, gespeichert wird aber ein
 * JSON-Objekt (`{ accepted, analytics, pstg, version, timestamp }`). Ihr
 * eigener Kommentar widersprach sich dabei auch noch selbst („der Banner wird
 * nicht erneut gezeigt ... We still return `true`").
 *
 * Die Richtung ist das Entscheidende und steht deshalb hier, an einer Stelle:
 * **im Zweifel NICHT erteilt.** Kaputter Speicher, leerer Wert, fremdes
 * Format, blockierter Zugriff — alles fuehrt zum Banner, nie zum stillen
 * Weitermachen ohne Zustimmung.
 */

/** Der Schluessel im Speicher. Steht hier, damit ihn niemand zweimal tippt. */
export const CONSENT_SCHLUESSEL = 'werkr_consent_v1';

/**
 * @param roh Der rohe Wert aus AsyncStorage oder localStorage, oder null.
 */
export function zustimmungErteilt(roh: string | null | undefined): boolean {
  if (!roh) return false;
  // Die alte Fassung legte die nackte Zeichenkette 'true' ab.
  //
  // GEFUNDEN AM 14.09.2026 beim Herausziehen: in app/_layout.tsx stand dieser
  // Rueckfall im `catch` — und `JSON.parse('true')` WIRFT NICHT, sondern
  // liefert den Wahrheitswert true. Der `catch` wurde also nie erreicht, und
  // `true?.accepted` ist undefined. Der Rueckfall hat seit jeher nichts getan:
  // wer die alte Fassung gespeichert hatte, wurde erneut gefragt.
  if (roh === 'true') return true;


  try {
    const gelesen = JSON.parse(roh);
    return gelesen?.accepted === true;
  } catch {
    // Kein gueltiges JSON und nicht die alte Fassung: nicht erteilt.
    return false;
  }
}
