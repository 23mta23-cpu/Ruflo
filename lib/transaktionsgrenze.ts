/**
 * Die Obergrenze je Auftrag.
 *
 * ANLASS (20.09.2026): Beim Durchzaehlen aller Betraege im sichtbaren Text
 * stand auf `app/garantie.tsx` als Tatsache:
 *
 *   „Im Beta liegt das Transaktionslimit bei 5.000 € pro Auftrag, beim Launch
 *    bei 25.000 €."
 *
 * Gemessen: es gab KEINE Grenze. Weder im Client (`lib/offers.ts`,
 * `app/betrieb/angebot-erstellen.tsx`), noch in einer Edge Function, noch in
 * der Datenbank -- dort steht nur `check (price > 0)` aus 0040. Ein Angebot
 * ueber 40.000 € waere durchgegangen, und der Treuhandbetrag haette in
 * derselben Hoehe auf dem Konto gelegen.
 *
 * Dieselbe Klasse wie die Haftpflicht (14.09.) und die Meisterpflicht
 * (20.09.): eine Zusage ueber eine Schutzvorrichtung, die es nicht gab. Hier
 * kommt hinzu, dass ein unbegrenzter Treuhandbetrag die offene ZAG-Frage
 * (docs/recht/ki-vo-und-bfsg.md §4) spuerbar verschaerft.
 *
 * Die Zahl steht hier EINMAL und wird von der Datenbank gespiegelt
 * (Migration 1000). Beide haelt `scripts/transaktionsgrenze-check.py`
 * aneinander -- ein Wertvergleich zur Laufzeit koennte die Bindung nicht
 * beweisen, wenn beide Seiten dieselbe Zahl tragen.
 */

/** Hoechster Auftragswert im Beta, in Euro. */
export const TRANSAKTIONSGRENZE_EUR = 5000;

/** Der Satz, den ein Betrieb liest, wenn sein Angebot darueber liegt. */
export function ueberGrenzeText(): string {
  return `Der Auftragswert liegt über ${TRANSAKTIONSGRENZE_EUR.toLocaleString('de-DE')} €. `
    + 'So hohe Aufträge nimmt Werkant im Beta noch nicht an. '
    + 'Teilen Sie den Auftrag auf, oder schreiben Sie uns.';
}

/** Liegt dieser Preis (in Euro) über der Grenze? */
export const ueberGrenze = (preisEuro: number): boolean =>
  Number.isFinite(preisEuro) && preisEuro > TRANSAKTIONSGRENZE_EUR;
