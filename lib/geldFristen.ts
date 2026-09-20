/**
 * Wie lange Geld unterwegs ist. An EINER Stelle.
 *
 * ANLASS (20.09.2026): Beim Durchzaehlen aller Zeitzusagen im sichtbaren Text
 * standen zwei Antworten auf dieselbe Geldfrage nebeneinander, teils auf
 * DEMSELBEN Bildschirm:
 *
 *   app/auftrag-abschliessen.tsx  „wird der Betrag sofort ausgezahlt"
 *   app/auftrag-abschliessen.tsx  „in der Regel innerhalb von 1-3 Werktagen"
 *   app/garantie.tsx              „Sofort nach Schliessen der Reklamation"
 *   app/stornierung.tsx           „innerhalb von 3-5 Werktagen zurueckgebucht"
 *
 * Beides stimmte fuer verschiedene Dinge -- die Freigabe geht sofort hinaus,
 * das Geld ist Tage unterwegs. Nur stand das nirgends, und ein Kunde, der
 * zwei Zahlen liest, glaubt keiner von beiden.
 *
 * Dieselbe Loesung wie beim Provisionssatz (lib/preisHinweis.ts aus
 * feeEngine): die Zahl steht einmal, die Saetze werden daraus gebildet.
 * Geprueft von scripts/geldfristen-check.py ueber den Quelltext -- ein
 * Wertvergleich zur Laufzeit koennte die Bindung nicht beweisen, wenn beide
 * Seiten denselben Text tragen (Lehre vom 16.08. und 16.09.).
 *
 * WOHER DIE ZAHLEN: Stripe-Auszahlungen an ein deutsches Bankkonto laufen als
 * SEPA-Ueberweisung; Rueckerstattungen auf Karte gehen ueber das Kartennetz
 * zurueck und dauern laenger. Beides sind Erfahrungswerte des Dienstleisters,
 * keine Zusage von Werkant -- deshalb steht „in der Regel" in jedem Satz.
 */

/**
 * Auszahlung an den Anbieter nach der Freigabe.
 *
 * DIESE ZAHL IST EINE ZUSAGE, KEIN ERFAHRUNGSWERT. AGB §6 Abs. 3 woertlich:
 * „Die Auszahlung an den Anbieter erfolgt … innerhalb von 2 Werktagen nach
 * Freigabe." Mein erster Entwurf schrieb hier „1 bis 3" -- das haette dem
 * Anbieter auf dem Bildschirm eine laengere Frist genannt, als die AGB ihm
 * zusichern. Dieselbe Klasse wie der Widerspruch zwischen AGB und
 * Strike-Automatik vom selben Tag, nur diesmal beim Geld.
 *
 * Wer sie aendern will, aendert zuerst die AGB. Deshalb steht sie hier und
 * nicht als Zahl im Bildschirm.
 */
export const AUSZAHLUNG_WERKTAGE = 2;

/**
 * Rueckerstattung an den Kunden nach Stornierung oder Reklamation.
 *
 * Anders als oben KEINE Zusage: die AGB nennen dafuer keine Frist, und der
 * Weg zurueck laeuft ueber Kartennetz oder SEPA. Deshalb eine Spanne und
 * deshalb „in der Regel".
 */
export const ERSTATTUNG_WERKTAGE = [3, 5] as const;

/** „innerhalb von 2 Werktagen" (AGB §6 Abs. 3) */
export const auszahlungsdauer = () => `innerhalb von ${AUSZAHLUNG_WERKTAGE} Werktagen`;

/** „in der Regel nach 3 bis 5 Werktagen" */
export const erstattungsdauer = () =>
  `in der Regel nach ${ERSTATTUNG_WERKTAGE[0]} bis ${ERSTATTUNG_WERKTAGE[1]} Werktagen`;
