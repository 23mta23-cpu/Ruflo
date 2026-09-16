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
import {
  CUSTOMER_FEE_RATE, MIN_CUSTOMER_FEE,
  PROVIDER_COMMISSION_RATE, MIN_PROVIDER_FEE, Werkant_SCHUTZ_FEE,
} from './feeEngine';

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

/**
 * Was ein BETRIEB zahlt, in einem Satz, der die drei Fragen beantwortet:
 * wovon, wie viel mindestens, und wann.
 *
 * ANLASS (Founder am Geraet, 16.09.2026): „Es steht i.was mit 8% provision wo
 * was warum es ist nicht klar was gemeint ist."
 *
 * Dort stand „8 % Provision, mindestens 3 €, erst nach Abschluss." als
 * Literal im Bildschirm. Wovon die 8 % sind und wer sie zahlt, stand
 * nirgends; und die Zahlen hingen an keiner Quelle, obwohl der Kopf dieser
 * Datei genau davor warnt.
 */
export function provisionKurz(): string {
  return `${prozent(PROVIDER_COMMISSION_RATE)} vom Rechnungsbetrag, mindestens ${betrag(MIN_PROVIDER_FEE)}`;
}

/** Dieselbe Aussage mit dem, was ein Betrieb wirklich wissen will. */
export function provisionLang(): string {
  return `Werkant behält ${provisionKurz()} ein, und zwar erst wenn der Auftrag `
    + 'abgeschlossen und bezahlt ist. Für Anfragen und Kontakte zahlen Sie nichts.';
}

/** Nachbarschaftshilfe: keine Provision, der Kunde zahlt die Schutzpauschale. */
export function nachbarschaftGebuehrLang(): string {
  return `Keine Provision. Sie erhalten den vereinbarten Preis vollständig; `
    + `der Kunde zahlt zusätzlich ${betrag(Werkant_SCHUTZ_FEE)} Werkant-Schutz.`;
}
