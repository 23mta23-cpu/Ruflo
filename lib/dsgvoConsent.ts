/**
 * Nachweis der DSGVO-Einwilligung (Migration 0730).
 *
 * Bis 16.08.2026 lag die Einwilligung ausschliesslich im localStorage bzw.
 * AsyncStorage des Nutzergeraets (`werkr_consent_v1`). Der Nutzer kann sie
 * loeschen, und Werkant hatte nichts in der Hand — waehrend Art. 7 Abs. 1
 * DSGVO ausdruecklich verlangt, dass der Verantwortliche die Einwilligung
 * NACHWEISEN kann. Die Datenschutzerklaerung behauptete zusaetzlich, es werde
 * ein Consent-Log drei Jahre lang gefuehrt.
 *
 * Dieselbe Fehlerklasse wie der Widerrufs-Haken (lib/widerruf.ts): eine
 * Zustimmung, die nur im Bildschirmzustand existiert.
 */

import { supabase } from './supabase';

/**
 * Fassungskennung. Bei JEDER inhaltlichen Aenderung des Einwilligungstextes
 * hochzaehlen — sonst behauptet die Datenbank spaeter, jemand habe einem Text
 * zugestimmt, den es damals noch gar nicht gab.
 */
export const DSGVO_TEXT_VERSION = 'dsgvo-2026-09-14';

/**
 * Der Wortlaut, dem zugestimmt wird — derselbe, den components/ui/DsgvoConsent
 * anzeigt. Bewusst hier und nicht dort: der Nachweis braucht ihn, und zwei
 * getrennt gepflegte Fassungen desselben Satzes laufen garantiert auseinander.
 */
// In drei Teilen, weil im Bildschirm zwei Verweise mitten im Satz stehen
// (Datenschutzerklärung, AGB). Zusammengesetzt ergibt sich exakt der Satz, den
// der Nutzer liest — components/ui/DsgvoConsent.tsx baut ihn aus DIESEN Teilen
// zusammen, statt den Text ein zweites Mal zu führen. Zwei getrennt gepflegte
// Fassungen desselben Satzes laufen garantiert auseinander, und dann steht im
// Nachweis etwas anderes als auf dem Bildschirm.
export const DSGVO_TEIL_1 = 'Werkant verarbeitet Ihre Daten gemäß ';
export const DSGVO_TEIL_2 = ' und ';
/**
 * ANLASS (14.09.2026): Hier stand „(§ JArbSchG)" — ein Paragrafenzeichen ohne
 * Nummer, und das falsche Gesetz dazu. Das Jugendarbeitsschutzgesetz regelt
 * die BESCHAEFTIGUNG Minderjaehriger durch einen Arbeitgeber. Es schliesst
 * niemanden von einer Plattform aus, und Werkant ist kein Arbeitgeber seiner
 * Nutzer.
 *
 * Der tragende Grund ist ein anderer und ein besserer: Ein Minderjaehriger
 * kann ohne seinen gesetzlichen Vertreter keinen wirksamen Vertrag schliessen
 * (§§ 106, 107 BGB) — ein Auftrag ueber 800 EUR waere schwebend unwirksam.
 *
 * Diese Zeile steht im Einwilligungs-Nachweis. Eine falsche Norm darin ist
 * nicht nur unsauber: sie steht spaeter als das, wozu der Nutzer zugestimmt
 * haben soll. Deshalb ist DSGVO_TEXT_VERSION mitgezaehlt worden.
 */
export const DSGVO_TEIL_3 =
  '. Mindestens 18 Jahre erforderlich: Minderjährige können Verträge nicht '
  + 'allein wirksam schließen (§§ 106 und 107 BGB).';

/** Der vollständige Wortlaut, wie er im Nachweis festgehalten wird. */
export const DSGVO_ZUSTIMMUNG =
  DSGVO_TEIL_1 + 'Datenschutzerklärung' + DSGVO_TEIL_2 + 'AGB' + DSGVO_TEIL_3;

/**
 * Haelt die Einwilligung serverseitig fest.
 *
 * Bewusst ohne `await` am Aufrufort und ohne Fehleranzeige: die Einwilligung
 * ist bereits erteilt, sobald der Nutzer tippt, und der lokale Wert ist da.
 * Ein Netzfehler darf ihn nicht am Weiterkommen hindern — er wuerde sonst vor
 * einem Bildschirm stehen, den er gerade bestaetigt hat. Der Nachweis ist
 * wichtig, aber nicht wichtiger als die Benutzbarkeit der App.
 *
 * `userId` ist meist null: das Consent-Blatt liegt VOR jeder Anmeldung.
 */
export function haltDsgvoEinwilligungFest(params: {
  userId: string | null;
  analytics: boolean;
  pstg: boolean;
}): void {
  supabase
    .from('dsgvo_consents')
    .insert({
      user_id: params.userId,
      text_version: DSGVO_TEXT_VERSION,
      angezeigter_text: DSGVO_ZUSTIMMUNG,
      // Die drei Haken EINZELN. Waeren sie ein Feld, liesse sich spaeter nicht
      // mehr sagen, wozu genau jemand ja gesagt hat — und `pflicht` (Art. 6
      // Abs. 1 lit. b) und `analytics` (freiwillig) haben voellig
      // unterschiedliche Rechtsgrundlagen.
      pflicht: true,
      analytics: params.analytics,
      pstg: params.pstg,
    })
    .then(({ error }) => {
      if (error) console.warn('dsgvo_consents insert failed:', error.message);
    });
}
