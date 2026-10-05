/**
 * Die Preisaufstellung eines Anbieter-Angebots.
 *
 * ANLASS (Founder am Geraet, 08.09.2026): „Wo sind die 100€ materialkosten?"
 *
 * Nachgemessen, und es war schlimmer als die Frage vermuten liess. Der
 * Bildschirm rechnete bei 230 € Preis und 100 € Material:
 *
 *     Leistungspreis                €230,00
 *     Materialkosten                €100,00
 *     Werkant-Gebuehr (8%)         −€18,40
 *     Nettobetrag                   €211,60
 *     Auszahlungsbetrag via Stripe: €311,60   <- versprochen
 *
 * Der Kunde zahlt aber 230 € plus Servicegebuehr, und der Anbieter bekommt
 * 211,60 €. Die Anzeige versprach 100 € zu viel. Zusaetzlich kannte
 * `createOffer` gar kein Materialfeld: die Angabe wurde nirgendwohin
 * geschickt und erreichte den Kunden nie.
 *
 * FESTGELEGT (Entscheidung, nicht Geschmack): Die Materialkosten sind ein
 * TEIL des Angebotspreises, kein Aufschlag darauf.
 *   - Der Escrow sperrt genau EINEN Betrag. Ein zweiter, getrennt berechneter
 *     Posten braucht Spalte, Vertrag, Rechnung und Webhook -- das ist ein
 *     Feature, keine Fehlerbehebung, und gehoert dem Founder vorgelegt.
 *   - Der bestehende Hinweis im Bildschirm („Bei Materialkosten empfehlen wir
 *     eine Aufstellung im Kommentar") behandelt die Angabe ohnehin als
 *     Offenlegung, nicht als zweite Rechnung.
 *
 * Daraus folgt: Material darf den Angebotspreis nicht uebersteigen, und die
 * Auszahlung ist Preis minus Gebuehr -- ohne Material obendrauf.
 */

import { provisionAufArbeitsanteil } from './feeEngine';

/**
 * Werkant-Gebuehr: 8 % auf die ARBEITSLEISTUNG, mindestens 3 €.
 * Nachbarschaft: 1,99 € pauschal, dort spielt Material keine Rolle.
 *
 * FOUNDER-ENTSCHEIDUNG (08.09.2026): „Lass uns es ausweisen aber nicht
 * provisionieren." Bemessungsgrundlage ist seither `preis - material`.
 *
 * Diese Rechnung MUSS mit Migration 0830 uebereinstimmen. Weicht sie ab,
 * sieht der Anbieter eine Zahl und bekommt eine andere -- genau der Fehler,
 * der diese Datei ueberhaupt entstehen liess.
 */
export function werkantGebuehr(arbeitsanteil: number, istNachbarschaft: boolean): number {
  // NACHBARSCHAFT: KEINE Provision. Der Helfer erhaelt 100 % des vereinbarten
  // Preises; die 1,99 EUR Werkant-Schutz zahlt der AUFTRAGGEBER zusaetzlich.
  //
  // BEFUND (Founder-Frage am 28.09.2026, „beim Angebot erstellen ist alles
  // richtig oder?"): hier stand `return 1.99`. Der Angebots-Bildschirm zog
  // dem Helfer also 1,99 ab und zeigte bei 600 EUR eine Auszahlung von
  // 598,01. Migration 0830 rechnet serverseitig
  //     v_provider_commission := 0;  v_provider_payout := v_price;
  // und zahlt 600,00. Die Anzeige log um 1,99 EUR zu Lasten des Helfers --
  // und widersprach sechs Stellen in der App, darunter dem Satz beim
  // Anmelden: „Keine Provision. Als Privatperson erhalten Sie 100 % des
  // vereinbarten Betrags." (app/onboarding-kyc.tsx).
  //
  // Die Rechnung war gedeckt, die Anzeige nicht -- Pruefregel 4.
  if (istNachbarschaft) return 0;
  // Delegiert: die Regel steht seit dem 28.09.2026 an EINER Stelle
  // (lib/feeEngine.ts). Vorher gab es zwei Fassungen, und eine davon
  // rechnete seit Migration 0830 auf der falschen Bemessungsgrundlage.
  return provisionAufArbeitsanteil(arbeitsanteil);
}

/**
 * Die Untergrenze, ab der ein Angebot ueberhaupt etwas einbringt.
 *
 * ANLASS (16.09.2026, gefunden beim Schreiben der Geldweg-Reise): Bei einem
 * Preis von 0 zeigte das Angebotsformular
 *
 *     Werkant-Gebuehr (8%)   -3,00 EUR
 *     Nettobetrag            -3,00 EUR
 *     Auszahlungsbetrag via Stripe: -3,00 EUR (nach Auftragsabschluss)
 *
 * und der Absendeknopf war benutzbar, weil `isValid` nur `preis > 0` verlangte.
 * Migration 0910 weist solche Angebote in der Datenbank ab (`price > 3.00`) --
 * der Anbieter haette also eine negative Auszahlung gesehen, gesendet, und
 * einen Datenbankfehler zurueckbekommen.
 *
 * Die Zahl ist dieselbe wie in 0910 und in MIN_PROVIDER_FEE. Sie steht hier,
 * weil die Oberflaeche sie braucht, BEVOR die Datenbank sie durchsetzt.
 */
export const MINDESTPREIS = 3.0;

/**
 * Bringt dieses Angebot dem Anbieter etwas ein?
 *
 * Bewusst `> MINDESTPREIS` und nicht `>=`: bei genau 3,00 EUR bliebe eine
 * Auszahlung von 0,00 EUR. Genauso weist es 0910 ab, und eine Oberflaeche, die
 * grosszuegiger ist als die Datenbank, erzeugt nur eine Fehlermeldung spaeter.
 */
export function angebotLohntSich(preis: number, istNachbarschaft: boolean): boolean {
  // Ohne Provision bleibt jeder Preis ueber 0 beim Helfer. Die 1,99 zahlt der
  // Auftraggeber obendrauf und schmaelern seine Auszahlung nicht.
  if (istNachbarschaft) return preis > 0;
  return preis > MINDESTPREIS;
}

export interface Preisaufstellung {
  /** Was der Kunde fuer die Leistung zahlt (Material ist darin enthalten). */
  leistungspreis: number;
  /** Der als Material ausgewiesene Anteil daran. 0, wenn nichts angegeben. */
  materialAnteil: number;
  /** Preis minus Material. Bemessungsgrundlage der Provision (0830). */
  arbeitsanteil: number;
  /** Werkant-Gebuehr, wird vom Preis abgezogen. */
  gebuehr: number;
  /** Was beim Anbieter ankommt. */
  auszahlung: number;
}

export function preisAufstellung(
  preis: number,
  materialEnthalten: boolean,
  material: number,
  istNachbarschaft: boolean,
): Preisaufstellung {
  const materialAnteil = materialEnthalten ? material : 0;
  // greatest(...,0) wie in 0830: eine negative Bemessungsgrundlage waere der
  // teuerste denkbare Fehler.
  const arbeitsanteil = Math.max(preis - materialAnteil, 0);
  const gebuehr = werkantGebuehr(arbeitsanteil, istNachbarschaft);
  return {
    leistungspreis: preis,
    materialAnteil,
    arbeitsanteil,
    gebuehr,
    // KEIN `+ material`: das war der Fehler. Material steckt im Preis.
    auszahlung: preis - gebuehr,
  };
}

/**
 * Warum das Angebot so nicht abgeschickt werden darf, oder null.
 *
 * Material groesser als der Preis heisst, der Anbieter arbeitet mit Verlust
 * und die Aufstellung ergibt keinen Sinn. Das faellt sonst erst auf, wenn
 * der Kunde fragt.
 */
export function materialFehler(
  preis: number,
  materialEnthalten: boolean,
  material: number,
): string | null {
  if (!materialEnthalten || material <= 0) return null;
  if (material > preis) {
    return 'Die Materialkosten sind höher als der Angebotspreis. '
      + 'Das Material ist im Preis enthalten, nicht zusätzlich.';
  }
  return null;
}

/**
 * Die Zeile, die der KUNDE zu sehen bekommt.
 *
 * Bis zum 08.09.2026 gab es sie nicht: die Angabe blieb auf dem Geraet des
 * Anbieters. Jetzt geht sie in die Angebotsbeschreibung, dorthin, wo auch
 * Terminvorschlag und Anmerkung stehen.
 */
const MATERIAL_ZEILE_ANFANG = 'Im Preis enthaltene Materialkosten:';

export function materialZeile(materialEnthalten: boolean, material: number): string | null {
  if (!materialEnthalten || material <= 0) return null;
  const betrag = material.toFixed(2).replace('.', ',');
  return `${MATERIAL_ZEILE_ANFANG} €${betrag}`;
}

/**
 * Die Beschreibung OHNE die Materialzeile. Seit 0830 steht der Betrag in
 * `offers.material_cost` und die Angebotskarte zeigt ihn als eigene Zeile
 * (05.10.2026); im Freitext stuende er sonst ein zweites Mal.
 */
export function ohneMaterialZeile(beschreibung: string): string {
  return beschreibung.split('\n\n')
    .filter((teil) => !teil.startsWith(MATERIAL_ZEILE_ANFANG))
    .join('\n\n').trim();
}

/**
 * Der Push an den Kunden, wenn ein Angebot eingeht.
 *
 * Bis zum 03.10.2026 stand hier `user.email` des Anbieters als Absendername.
 * Die E-Mail-Adresse ging damit per Push an einen Kunden, der noch keinen
 * Vertrag hat, und lud geradezu ein, an Werkant vorbei Kontakt aufzunehmen.
 * Name und Bewertung sieht der Kunde in der App am Angebot.
 */
export function angebotPushText(istNachbarschaft: boolean, titel: string, preis: string): string {
  const wer = istNachbarschaft ? 'Ein Helfer' : 'Ein Betrieb';
  return `${wer} hat ein Angebot für „${titel}" abgegeben: ${preis}`;
}
