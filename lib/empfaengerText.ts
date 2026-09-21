/**
 * Wer bekommt die Anfrage? Ein Satz, zwei Wege, und beide muessen stimmen.
 *
 * ANLASS (Founder am Geraet, 21.09.2026): „Warum benoetigen die fuer
 * Nachbarschaftshilfe geprüfte Gewerbescheine?" Er hatte „4 Kartons muessen
 * getragen werden" aufgegeben, also Umzugshilfe, und danach stand da:
 * „Wir leiten Ihre Anfrage an passende Betriebe mit geprüftem Gewerbeschein
 * weiter."
 *
 * Der Satz stand als Literal im Bildschirm, ohne jede Unterscheidung. Fuer
 * den Nachbarschaftsweg ist er FALSCH: `app/onboarding-kyc.tsx` verlangt dort
 * keinen Gewerbeschein. Geprueft wird die schriftliche
 * Volljaehrigkeitserklaerung (Migration 0990) und danach entscheidet ein
 * Mensch im Pruef-Postfach. Eine Ausweispruefung findet bewusst NICHT statt
 * (§ 20 PAuswG).
 *
 * Eine Zusage, die der eigene Code nicht einloest, ist irrefuehrend (§ 5 UWG)
 * -- und zwar zulasten des Kunden, der glaubt, ein Gewerbe stehe dahinter.
 *
 * Deshalb hier und nicht im Bildschirm: zwei Literale an zwei Stellen laufen
 * auseinander, sobald eines davon jemand anfasst. Die Herkunft prueft
 * scripts/versprechen-check.py ueber den Quelltext.
 */

export type Auftragsweg = 'handwerker' | 'nachbarschaft';

/** Ein Satz fuer den Erfolgsbildschirm: an wen die Anfrage geht. */
export function empfaengerSatz(weg: Auftragsweg): string {
  return weg === 'nachbarschaft'
    ? 'Wir leiten Ihre Anfrage an Helferinnen und Helfer aus der Nachbarschaft weiter, die Werkant freigegeben hat.'
    : 'Wir leiten Ihre Anfrage an passende Betriebe mit geprüftem Gewerbeschein weiter.';
}

/** Dieselbe Aussage als Hinweis unter der Zusammenfassung. */
export function empfaengerHinweis(weg: Auftragsweg): string {
  return weg === 'nachbarschaft'
    ? 'Ihre Daten werden nur an freigegebene Helferinnen und Helfer weitergegeben.'
    : 'Ihre Daten werden nur an Betriebe mit geprüftem Gewerbeschein weitergegeben.';
}

/**
 * Die Pruefungs-Kachel auf der Startseite.
 *
 * NACHTRAG 21.09.2026 (nachts): Am Nachmittag habe ich den Satz im Hero
 * korrigiert und die Kachel drei Bildschirmhoehen weiter oben uebersehen.
 * Dort stand unter einem Schild-Symbol „Gewerbeschein und Meisterbrief
 * geprueft" als Aussage ueber ALLE „Anbieter", unabhaengig vom Weg. Auf dem
 * Nachbarschaftsweg legt niemand einen Gewerbeschein vor.
 *
 * `nachbarschaftAn` ist NICHT der Weg eines einzelnen Auftrags, sondern die
 * Frage, ob es den Nachbarschaftsweg ueberhaupt gibt (FEATURES.NACHBARSCHAFT).
 * Die Startseite kennt keinen Auftrag; sie beschreibt das ganze Angebot.
 *
 * Was hier NICHT steht und bewusst nicht: eine Alterspruefung. Der
 * Nachbarschaftsweg nimmt eine schriftliche Volljaehrigkeitserklaerung
 * entgegen (Selbstauskunft, Migration 0990), er prueft sie nicht.
 * Stripe dagegen gilt fuer BEIDE Wege -- die Auszahlung laeuft ueberall
 * ueber Stripe Connect, und dort findet die Identitaetspruefung statt.
 */
export function pruefungTitel(nachbarschaftAn: boolean): string {
  return nachbarschaftAn
    ? 'Jedes Profil wird einzeln freigegeben'
    : 'Gewerbeschein und Meisterbrief geprüft';
}

export function pruefungSatz(nachbarschaftAn: boolean): string {
  const gemeinsam = 'Ausweiskopien nehmen wir bewusst nicht entgegen. Die Identität prüft unser Zahlungsdienstleister Stripe.';
  return nachbarschaftAn
    ? 'Betriebe weisen ihren Gewerbeschein nach, in meisterpflichtigen Gewerken zusätzlich den Meisterbrief. '
      + 'Nachbarschaftshilfe ist kein Gewerbe: dort wird kein Gewerbeschein verlangt, und Werkant gibt jedes Profil einzeln frei. '
      + gemeinsam
    : 'Anbieter weisen ihren Gewerbeschein nach, in meisterpflichtigen Gewerken zusätzlich den Meisterbrief. '
      + gemeinsam;
}
