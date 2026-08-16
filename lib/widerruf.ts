/**
 * Widerrufs-Einwilligung beim Zahlungsschritt (Migration 0710).
 *
 * Bis 16.08.2026 lag die Zustimmung ausschliesslich in einem `useState` in
 * app/zahlung.tsx. Sie sperrte einen Knopf und verschwand mit dem Bildschirm.
 * Widerruft ein Kunde nach getaner Arbeit, konnte niemand belegen, dass er
 * zugestimmt hatte — der Haken schuetzte in genau dem Moment nicht, fuer den
 * er da ist.
 */

import { supabase } from './supabase';

/**
 * Kennung der Textfassung. Bei JEDER inhaltlichen Aenderung des Wortlauts
 * hochzaehlen — sonst behauptet die Datenbank spaeter, ein Kunde habe einem
 * Text zugestimmt, den es damals noch gar nicht gab.
 */
export const WIDERRUF_TEXT_VERSION = 'widerruf-2026-08-16';

/**
 * Der Wortlaut, dem der Kunde zustimmt.
 *
 * ANWALT: inhaltlich unveraendert gegenueber der Fassung davor — dieselbe Norm,
 * dieselbe Erklaerung. Geaendert ist nur, dass danebensteht, was sie bedeutet
 * (siehe WIDERRUF_ERKLAERUNG). Ob ein „Verzicht" hier ueberhaupt die richtige
 * Konstruktion ist (§356 Abs. 4 BGB beschreibt das ERLOESCHEN nach
 * vollstaendiger Erbringung; §361 Abs. 2 S. 1 BGB begrenzt Abweichungen zum
 * Nachteil des Verbrauchers) ist offen und gehoert vor den Marktstart geprueft.
 */
export const WIDERRUF_ZUSTIMMUNG =
  'Ich verzichte auf mein Widerrufsrecht gemäß §356 Abs. 4 BGB und stimme zu, '
  + 'dass die Leistung sofort beginnen kann.';

/**
 * Was das im Alltag heisst. Founder-Befund: „Den verzicht habe ich nicht
 * verstanden was steht da und muss das sein?" — ein Text, den der Verbraucher
 * nicht versteht, ist auch rechtlich wackelig (Transparenzgebot).
 *
 * Drei Saetze, keine Paragrafenkette im ersten: was Sie aufgeben, warum, und
 * was passiert, wenn Sie nicht zustimmen.
 */
export const WIDERRUF_ERKLAERUNG =
  'Normalerweise könnten Sie einen online geschlossenen Vertrag 14 Tage lang '
  + 'ohne Angabe von Gründen widerrufen. Damit der Handwerker sofort anfangen '
  + 'darf, geben Sie dieses Recht für den bereits erledigten Teil der Arbeit '
  + 'auf. Ohne Ihr Häkchen wird nichts abgebucht und der Auftrag startet nicht '
  + '— Ihr Angebot bleibt bestehen, Sie können jederzeit hier zurückkommen.';

export type ConsentErgebnis = 'ok' | 'schon_erteilt' | 'fehler';

/**
 * Haelt die Einwilligung fest — mit dem Wortlaut, den dieser Kunde gesehen
 * hat. Eine Zustimmung zu einem Text, den man spaeter nicht vorlegen kann, ist
 * als Nachweis wenig wert.
 */
export async function haltWiderrufsEinwilligungFest(
  contractId: string,
  customerId: string,
): Promise<ConsentErgebnis> {
  const { error } = await supabase.from('widerruf_consents').insert({
    contract_id: contractId,
    customer_id: customerId,
    text_version: WIDERRUF_TEXT_VERSION,
    angezeigter_text: WIDERRUF_ZUSTIMMUNG,
  });

  if (!error) return 'ok';
  // 23505 = unique_violation: fuer diesen Vertrag liegt bereits eine Erklaerung
  // vor (zweiter Zahlungsanlauf nach Abbruch). Das ist kein Fehler — der
  // Nachweis existiert, und ueberschrieben werden darf er ohnehin nicht.
  if ((error as { code?: string }).code === '23505') return 'schon_erteilt';
  return 'fehler';
}
