/**
 * Widerrufs-Einwilligung beim Zahlungsschritt (Migration 0710).
 *
 * Bis 16.08.2026 lag die Zustimmung ausschliesslich in einem `useState` in
 * app/zahlung.tsx. Sie sperrte einen Knopf und verschwand mit dem Bildschirm.
 * Widerruft ein Kunde nach getaner Arbeit, konnte niemand belegen, dass er
 * zugestimmt hatte — der Haken schuetzte in genau dem Moment nicht, fuer den
 * er da ist.
 *
 * SEIT 14.09.2026 nach Track getrennt. Vorher sah JEDER Kunde denselben Satz,
 * auch im Nachbarschafts-Track. Dort stand damit zweierlei Falsches:
 *
 *   - „der Handwerker" — im Nachbarschafts-Track gibt es keinen. Der Helfer
 *     ist eine Privatperson.
 *   - „Normalerweise koennten Sie einen online geschlossenen Vertrag 14 Tage
 *     lang widerrufen" — gegenueber einer Privatperson nicht. §§ 312 ff. BGB
 *     gelten fuer Vertraege zwischen einem Unternehmer (§ 14 BGB) und einem
 *     Verbraucher. Zwei Verbraucher untereinander loesen kein Widerrufsrecht
 *     aus.
 *
 * Der Kunde gab also einen Verzicht auf ein Recht ab, das er nicht hatte, und
 * zwar gegenueber jemandem, den es nicht gab. Festgehalten wurde das auch noch
 * in `widerruf_consents` — ein Nachweis ueber eine unzutreffende Erklaerung.
 *
 * Ein Widerrufsrecht besteht im Nachbarschafts-Track sehr wohl, nur gegen
 * WERKANT: der Werkant-Schutz ist eine entgeltliche Leistung eines
 * Unternehmers an einen Verbraucher, online geschlossen (§ 312g Abs. 1 BGB).
 * Es geht aber um den Schutzbetrag, nicht um den Auftragswert.
 *
 * OFFEN, ANWALT (siehe docs/recht/rechts-audit-2026-09-13.md, Nachtrag
 * 14.09.2026): In beiden Tracks bestehen ZWEI Vertraege — der ueber die
 * Arbeit und der mit Werkant ueber die Vermittlung. Ein Haken kann streng
 * genommen nicht beide abdecken. Der Wortlaut hier folgt jetzt dem Gesetz
 * statt einem „Verzicht", die Vertragsstruktur bleibt zu klaeren.
 */

import { supabase } from './supabase';
import { Werkant_SCHUTZ_FEE } from './feeEngine';

/**
 * Kennung der Textfassung. Bei JEDER inhaltlichen Aenderung des Wortlauts
 * hochzaehlen — sonst behauptet die Datenbank spaeter, ein Kunde habe einem
 * Text zugestimmt, den es damals noch gar nicht gab.
 *
 * Alte Erklaerungen tragen weiter `widerruf-2026-08-16` und bleiben damit
 * ihrem damaligen Wortlaut zugeordnet.
 */
export const WIDERRUF_TEXT_VERSION = 'widerruf-2026-09-14';

/** Welcher Track — und damit, wer der Unternehmer ist. */
export type Widerrufslage = 'handwerker' | 'nachbarschaft';

/**
 * Die Weiche aus der Vertragszeile. Steht hier und nicht im Bildschirm, damit
 * sie pruefbar ist: eine falsche Weiche zeigt den falschen Text UND schreibt
 * den falschen Nachweis fest, und beides faellt am Bildschirm nicht auf.
 *
 * Alles ausser 'nachbarschaft' ist 'handwerker' — so ist es auch die Vorgabe
 * der Spalte (0021: default 'handwerker').
 */
export function lageAusVertrag(track: string | null | undefined): Widerrufslage {
  return track === 'nachbarschaft' ? 'nachbarschaft' : 'handwerker';
}

export type Widerrufstext = {
  /** Der Satz neben dem Haken. Genau dieser wird als Nachweis gespeichert. */
  zustimmung: string;
  /** Was das im Alltag heisst. Kein Nachweis, sondern Transparenz. */
  erklaerung: string;
};

/**
 * Der Wortlaut, dem der Kunde zustimmt.
 *
 * Beide Fassungen bilden die zwei Erklaerungen ab, die § 356 Abs. 4 BGB
 * verlangt: das ausdrueckliche Verlangen nach fruehem Beginn und die
 * Bestaetigung, das Widerrufsrecht bei vollstaendiger Erfuellung zu verlieren.
 * Das vorherige „Ich verzichte auf mein Widerrufsrecht" bildete keine der
 * beiden ab — und ein Verzicht im Voraus waere nach § 361 Abs. 2 Satz 1 BGB
 * ohnehin unwirksam, weil zum Nachteil des Verbrauchers abgewichen wird.
 */
export function widerrufstext(lage: Widerrufslage): Widerrufstext {
  if (lage === 'nachbarschaft') {
    return {
      zustimmung:
        'Ich verlange ausdrücklich, dass Werkant den Käuferschutz sofort '
        + 'einrichtet und mein Geld bis zur Freigabe verwahrt. Mir ist bekannt, '
        + 'dass mein Widerrufsrecht gegenüber Werkant erlischt, sobald diese '
        + 'Leistung vollständig erbracht ist.',
      erklaerung:
        'Das betrifft nur den Werkant-Schutz von '
        + `€${Werkant_SCHUTZ_FEE.toFixed(2)}, nicht Ihre Absprache mit dem Helfer. `
        + 'Ihr Helfer ist eine Privatperson und kein Gewerbe; gegenüber einer '
        + 'Privatperson gibt es kein gesetzliches Widerrufsrecht, dort gilt, was '
        + 'Sie miteinander vereinbaren. Ohne Ihr Häkchen wird nichts abgebucht '
        + 'und der Auftrag startet nicht. Ihre Anfrage bleibt bestehen, Sie '
        + 'können jederzeit hier zurückkommen.',
    };
  }
  return {
    zustimmung:
      'Ich verlange ausdrücklich, dass der Handwerker vor Ablauf der '
      + 'Widerrufsfrist mit der Arbeit beginnt. Mir ist bekannt, dass mein '
      + 'Widerrufsrecht erlischt, sobald er den Auftrag vollständig erfüllt hat.',
    erklaerung:
      'Normalerweise könnten Sie einen online geschlossenen Vertrag 14 Tage '
      + 'lang ohne Angabe von Gründen widerrufen. Damit der Handwerker sofort '
      + 'anfangen darf, verlangen Sie den früheren Beginn. Widerrufen Sie '
      + 'danach, zahlen Sie die bis dahin geleistete Arbeit; ist der Auftrag '
      + 'fertig, entfällt das Widerrufsrecht ganz. Ohne Ihr Häkchen wird nichts '
      + 'abgebucht und der Auftrag startet nicht. Ihr Angebot bleibt bestehen, '
      + 'Sie können jederzeit hier zurückkommen.',
  };
}

export type ConsentErgebnis = 'ok' | 'schon_erteilt' | 'fehler';

/**
 * Haelt die Einwilligung fest — mit dem Wortlaut, den dieser Kunde gesehen
 * hat. Eine Zustimmung zu einem Text, den man spaeter nicht vorlegen kann, ist
 * als Nachweis wenig wert.
 *
 * `lage` ist PFLICHT und hat bewusst keinen Vorgabewert. Es gibt genau einen
 * Aufrufer; ein optionaler Parameter waere hier die bekannte Falle, dass ein
 * Feld still verschwindet und der Uebersetzer keinen Grund hat zu
 * widersprechen. Ein falscher Track schreibt einen falschen Nachweis fest.
 */
export async function haltWiderrufsEinwilligungFest(
  contractId: string,
  customerId: string,
  lage: Widerrufslage,
): Promise<ConsentErgebnis> {
  const { error } = await supabase.from('widerruf_consents').insert({
    contract_id: contractId,
    customer_id: customerId,
    text_version: WIDERRUF_TEXT_VERSION,
    angezeigter_text: widerrufstext(lage).zustimmung,
  });

  if (!error) return 'ok';
  // 23505 = unique_violation: fuer diesen Vertrag liegt bereits eine Erklaerung
  // vor (zweiter Zahlungsanlauf nach Abbruch). Das ist kein Fehler — der
  // Nachweis existiert, und ueberschrieben werden darf er ohnehin nicht.
  if ((error as { code?: string }).code === '23505') return 'schon_erteilt';
  return 'fehler';
}
