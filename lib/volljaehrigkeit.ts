/**
 * Die 18+-Erklaerung eines Nachbarschaftshelfers.
 *
 * ANLASS (20.09.2026): `app/onboarding-kyc.tsx` fragte das Geburtsdatum ab,
 * prueft es im Browser und warf es dann weg -- `nbDob` lebte in `useState` und
 * war mit dem Bildschirm verschwunden. Gleichzeitig sagte
 * `app/nachbarschaft-profil.tsx` dem Kunden „18+ verifiziert".
 *
 * Festgehalten wird deshalb die ERKLAERUNG samt Wortlaut und Fassung, nicht
 * das Geburtsdatum (Art. 5 Abs. 1 lit. c DSGVO, Begruendung in 0990).
 *
 * Eigene Datei OHNE Netz-Import, damit der Test die echte Funktion aufrufen
 * kann statt sie abzuschreiben (Lehre vom 16.09.).
 */

/** Kennung der Textfassung. Aendert sich der Wortlaut, aendert sich sie mit. */
export const VOLLJAEHRIGKEIT_FASSUNG = 'volljaehrigkeit-2026-09-20';

/**
 * Der Wortlaut, den der Helfer sieht und der als Nachweis gespeichert wird.
 *
 * Er sagt ausdruecklich, dass es eine Selbstauskunft ist. Eine Erklaerung als
 * Pruefung auszugeben, waere genau der Fehler, der hier behoben wird.
 */
export function volljaehrigkeitsText(mindestalter: number): string {
  return `Ich erkläre, dass ich mindestens ${mindestalter} Jahre alt bin. `
    + 'Das ist meine eigene Angabe; Werkant prüft sie nicht. '
    + 'Meine Identität wird geprüft, sobald ich die Auszahlung einrichte. '
    + 'Eine falsche Angabe kann zur Sperrung führen (AGB §7).';
}
