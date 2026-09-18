/**
 * Was Werkant anders macht, und wodurch es durchgesetzt wird.
 *
 * ANLASS. `docs/markt/wettbewerbsabgleich-2026-09.md` nennt als dritte der
 * drei groessten Luecken: „Die guten Regeln sind unsichtbar: verifizierte
 * Bewertungen, Provision nur bei Abschluss und ein begruendeter, befristeter
 * Strike sind besser als beim Wettbewerb und stehen in keinem Text, den ein
 * Kunde oder ein Betrieb je liest."
 *
 * Das ist die teuerste Sorte Luecke: das bessere Produkt, das niemand
 * erfaehrt.
 *
 * WARUM MIT BELEG. Genau hier ist dieses Projekt schon zweimal falsch
 * abgebogen: „Haftpflicht verifiziert" (nie eine Police gesehen), „Sie zahlen
 * erst, wenn Sie zufrieden sind" (falsch herum), „24h Verifizierung" (nie
 * gemessen). Eine Liste von Vorzuegen ist genau die Stelle, an der so etwas
 * wieder entsteht.
 *
 * Deshalb traegt jede Regel hier ihren eigenen Nachweis: Datei und
 * Textstelle, die sie durchsetzt. `scripts/regeln-beleg-check.py` prueft in
 * der CI, dass jede dieser Stellen noch existiert. Verschwindet die
 * Durchsetzung, wird die Pruefung rot, bevor die Zusage zur Luege wird.
 *
 * REGEL FUER NEUE EINTRAEGE: kein Eintrag ohne Beleg, und der Beleg muss die
 * Regel WIRKLICH durchsetzen. Ein Kommentar, der die Regel beschreibt, ist
 * kein Beleg. Laesst sich kein Beleg finden, gehoert die Zusage nicht in die
 * Liste, sondern auf die Aufgabenliste.
 */

export type Regel = {
  /** Kurzform fuer die Ueberschrift. */
  titel: string;
  /** Ein Satz, den ein Kunde oder Betrieb versteht. Kein Marketing. */
  text: string;
  /** Wen es betrifft. Eine Strafregel gehoert nicht an den Falschen. */
  fuer: 'kunde' | 'betrieb' | 'beide';
  /** Ionicon. Keine Emojis (Design-System). */
  symbol: string;
  /** Datei, die die Regel durchsetzt, relativ zur Wurzel. */
  belegDatei: string;
  /**
   * Textstelle darin. Muss woertlich und GENAU EINMAL vorkommen.
   *
   * Die Eindeutigkeit ist keine Pedanterie: „interval '12 months'" stand
   * dreimal in derselben Migration. Die Mutation „Verfallsdatum entfernt"
   * blieb damit gruen, weil die Zeichenkette an zwei anderen Stellen weiter
   * da war. Ein Beleg, der mehrfach vorkommt, haelt nichts fest.
   */
  belegStelle: string;
};

export const REGELN: Regel[] = [
  {
    titel: 'Gebühr nur bei einem abgeschlossenen Auftrag',
    text: 'Für Anfragen und Kontakte zahlt ein Betrieb bei uns nichts. Die Gebühr von 8 % auf die Arbeitsleistung fällt erst an, wenn ein Auftrag abgeschlossen und bezahlt ist. Keine Grundgebühr, keine Laufzeit.',
    fuer: 'betrieb',
    symbol: 'cash-outline',
    belegDatei: 'lib/feeEngine.ts',
    belegStelle: 'export const PROVIDER_COMMISSION_RATE = 0.08;',
  },
  {
    titel: 'Das Geld liegt bis zum Abschluss fest',
    text: 'Ihre Zahlung geht auf ein Treuhandkonto bei unserem Zahlungsdienstleister und ist dem Auftrag zugeordnet. Der Betrieb bekommt sie erst nach der Abnahme, nicht vorher.',
    fuer: 'kunde',
    symbol: 'lock-closed-outline',
    belegDatei: 'supabase/functions/create-payment-intent/handler.ts',
    belegStelle: 'transfer_group: contract_id,',
  },
  {
    titel: 'Bewerten darf nur, wer den Auftrag hatte',
    text: 'Eine Bewertung ist an einen abgeschlossenen Auftrag zwischen genau diesen beiden Parteien gebunden. Gekaufte oder erfundene Bewertungen kann es hier technisch nicht geben.',
    fuer: 'beide',
    symbol: 'star-outline',
    belegDatei: 'supabase/migrations/0310_fix_reviews_insert_policy.sql',
    belegStelle: "c.status = 'completed'",
  },
  {
    titel: 'Ein Verstoß verfällt nach zwölf Monaten',
    text: 'Wir begründen jede Maßnahme schriftlich und nennen das Datum, an dem sie verfällt. Nach zwölf Monaten zählt sie nicht mehr mit. Kein Eintrag bleibt für immer.',
    fuer: 'betrieb',
    symbol: 'time-outline',
    belegDatei: 'supabase/migrations/0720_strike_verfall_und_begruendung.sql',
    belegStelle: "verfaellt_am timestamptz not null default (now() + interval '12 months')",
  },
  {
    titel: 'Die Reihenfolge lässt sich nicht kaufen',
    text: 'Wer weiter oben steht, entscheidet sich nach dem Bewertungsdurchschnitt und der Anzahl der Bewertungen. Eine bezahlte Platzierung gibt es nicht, und es gibt auch keinen Weg, dafür zu bezahlen.',
    fuer: 'beide',
    symbol: 'swap-vertical-outline',
    belegDatei: 'app/(tabs)/index.tsx',
    belegStelle: ".order('rating_avg', { ascending: false })",
  },
  {
    titel: 'Eine Reklamation hält die Frist an',
    text: 'Melden Sie innerhalb der Frist einen Mangel, bleibt das Geld gesperrt, bis die Sache geklärt ist. Die Abnahmefrist läuft in dieser Zeit nicht weiter.',
    fuer: 'kunde',
    symbol: 'pause-circle-outline',
    belegDatei: 'supabase/migrations/0770_abnahme_frist.sql',
    belegStelle: "dispute_state is distinct from 'open'",
  },
  {
    titel: 'Ihre Zahl entscheidet, wer anfängt',
    text: 'Zu jedem Auftrag gehört eine vierstellige Zahl, die nur Sie sehen. Erst wenn Sie sie an der Tür nennen und der Betrieb sie einträgt, gilt der Arbeitsbeginn als belegt. Der Betrieb kann sie nicht einsehen.',
    fuer: 'kunde',
    symbol: 'keypad-outline',
    belegDatei: 'supabase/migrations/0960_start_pin.sql',
    belegStelle: 'where c.id = contract_id and c.customer_id = auth.uid()',
  },
  {
    titel: 'Kein Auftrag kann Sie Geld kosten',
    text: 'Ein Angebot, bei dem nach Abzug der Mindestgebühr nichts übrig bliebe, lässt sich gar nicht erst abgeben. Die Datenbank weist es ab.',
    fuer: 'betrieb',
    symbol: 'shield-checkmark-outline',
    belegDatei: 'supabase/migrations/0910_angebotspreis_untergrenze.sql',
    belegStelle: 'add constraint offers_price_positiver_payout',
  },
];

/** Die Regeln, die eine bestimmte Seite angehen. */
export function regelnFuer(wer: 'kunde' | 'betrieb'): Regel[] {
  return REGELN.filter((r) => r.fuer === wer || r.fuer === 'beide');
}
