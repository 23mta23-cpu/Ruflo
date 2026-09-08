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
  if (istNachbarschaft) return 1.99;
  return Math.max(arbeitsanteil * 0.08, 3.0);
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
export function materialZeile(materialEnthalten: boolean, material: number): string | null {
  if (!materialEnthalten || material <= 0) return null;
  const betrag = material.toFixed(2).replace('.', ',');
  return `Im Preis enthaltene Materialkosten: €${betrag}`;
}
