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
