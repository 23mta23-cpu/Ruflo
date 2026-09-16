/**
 * Der Satz, der neben jedem Preis stehen muss, den ein Kunde zuerst sieht.
 *
 * ANLASS. `docs/markt/wettbewerbsabgleich-2026-09.md`, Empfehlung 5: Die
 * Ergebniskarte zeigt „ab €X/h", das Profil „Stundensatz ab €X", und die
 * Servicegebuehr steht erst als Fussnote in Schritt 4 des Auftragsformulars.
 *
 * Werkant ist unter den verglichenen Plattformen die einzige, bei der der
 * Kunde ueberhaupt etwas zahlt (MyHammer 0, Check24 „keine zusaetzlichen
 * Kosten", Airbnb in Deutschland im Preis enthalten). Genau deshalb darf die
 * Zahl nicht spaet kommen.
 *
 * Drei Gruende, und nur der erste ist Hoeflichkeit:
 *
 *  1. AGB §6(1) sagt zu, die Gebuehr werde „vor Auftragsbestaetigung
 *     transparent ausgewiesen". Eine Fussnote in Schritt 4 ist die schwaechste
 *     denkbare Auslegung dieser Zusage.
 *  2. § 5a UWG: das Vorenthalten einer wesentlichen Information. Der Preis,
 *     den man am Ende zahlt, ist wesentlich.
 *  3. Airbnb hat die Gesamtpreisanzeige erst nach einem europaeischen
 *     Verfahren eingefuehrt. Das ist ein Weg, den man nicht zweimal gehen
 *     muss.
 *
 * DIE ZAHLEN STEHEN NICHT HIER. Sie kommen aus `lib/feeEngine.ts`, sonst gibt
 * es zwei Wahrheiten ueber dieselbe Gebuehr und eine davon veraltet. Genau
 * diese Klasse hat das Projekt schon dreimal getroffen (drei
 * Reklamationsfristen, drei Firmenschreibweisen, zwei
 * Datenschutzerklaerungen).
 */
import { CUSTOMER_FEE_RATE, MIN_CUSTOMER_FEE } from './feeEngine';

/** „2,5 %" aus dem Satz, ohne Nachkommastelle wenn glatt. */
function prozent(satz: number): string {
  const p = satz * 100;
  return (Number.isInteger(p) ? String(p) : p.toFixed(1).replace('.', ',')) + ' %';
}

/** „1,50 €" aus dem Betrag. */
function betrag(wert: number): string {
  return wert.toFixed(2).replace('.', ',') + ' €';
}

/** Nur der Satz („2,5 %"), fuer Beschriftungen mit eigenem Betrag daneben. */
export function servicegebuehrSatz(): string {
  return prozent(CUSTOMER_FEE_RATE);
}

/**
 * Der kurze Hinweis fuer die Stelle, an der ein Preis zuerst auftaucht.
 * Bewusst EIN Satz: neben einer Ergebniskarte hat nichts Laengeres Platz,
 * und ein Hinweis, den man wegen der Laenge weglaesst, wirkt nicht.
 */
export function servicegebuehrKurz(): string {
  return `zzgl. ${prozent(CUSTOMER_FEE_RATE)} Servicegebühr, mindestens ${betrag(MIN_CUSTOMER_FEE)}`;
}

/** Dieselbe Aussage mit dem Grund. Fuer Stellen, an denen Platz ist. */
export function servicegebuehrLang(): string {
  return `${servicegebuehrKurz()}. Sie deckt das Treuhandkonto und die Abnahme. Den genauen Betrag sehen Sie vor der Bestätigung.`;
}
