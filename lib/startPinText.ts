/**
 * Was der Betrieb liest, wenn er die Start-PIN eintippt.
 *
 * REINE FUNKTION, absichtlich ohne Netz-Import. `lib/startPin.ts` zieht ueber
 * `./supabase` Expo-Module nach, die Jest nicht uebersetzt -- ein Test
 * muesste die Regel dann abschreiben und sich mit sich selbst vergleichen
 * (genau das ist am 16.09. bei `bewertungsschnitt` passiert). Hier steht
 * deshalb nur die Zuordnung Zustand -> Wortlaut, und der Test importiert das
 * Echte.
 *
 * Die beiden Zahlen stehen NICHT zweimal im Produkt: sie kommen aus 0960 und
 * werden von `scripts/startpin-beleg-check.py` gegen die Migration geprueft.
 * Ein Text, der "drei Versuche" sagt, waehrend die Datenbank nach fuenf
 * sperrt, ist dieselbe Klasse wie eine Zusage ohne Mechanismus.
 */

/** Nach so vielen Fehlversuchen sperrt 0960 die Eingabe. */
export const STARTPIN_VERSUCHE = 3;
/** So lange bleibt sie dann gesperrt. */
export const STARTPIN_SPERRE_MINUTEN = 15;

/** Die Zustaende, die `arbeit_beginnen()` zurueckgibt, plus Netzfehler. */
export type StartPinZustand =
  | 'ok'
  | 'falsch'
  | 'gesperrt'
  | 'schon_begonnen'
  | 'keine_pin'
  | 'nicht_berechtigt'
  | 'fehler';

export type StartPinMeldung = {
  titel: string;
  text: string;
  /** Nur hier ist der Arbeitsbeginn belegt. */
  erfolg: boolean;
};

export function startPinMeldung(zustand: StartPinZustand): StartPinMeldung {
  switch (zustand) {
    case 'ok':
      return {
        titel: 'Arbeitsbeginn belegt',
        text: 'Der Zeitpunkt ist festgehalten. Beide Seiten sehen ihn im Vertrag.',
        erfolg: true,
      };
    case 'falsch':
      return {
        titel: 'Die Zahl stimmt nicht',
        text: `Lassen Sie sich die vierstellige Zahl bitte noch einmal nennen. Nach ${STARTPIN_VERSUCHE} Fehlversuchen ist die Eingabe ${STARTPIN_SPERRE_MINUTEN} Minuten gesperrt.`,
        erfolg: false,
      };
    case 'gesperrt':
      return {
        titel: 'Die Eingabe ist gesperrt',
        text: `Die Zahl war ${STARTPIN_VERSUCHE} mal falsch. In ${STARTPIN_SPERRE_MINUTEN} Minuten können Sie es erneut versuchen. Ihr Auftraggeber wurde darüber informiert.`,
        erfolg: false,
      };
    case 'schon_begonnen':
      return {
        titel: 'Der Arbeitsbeginn ist schon belegt',
        text: 'Für diesen Auftrag wurde die Zahl bereits eingelöst. Der Zeitpunkt steht im Vertrag.',
        erfolg: false,
      };
    case 'keine_pin':
      return {
        titel: 'Für diesen Auftrag gibt es keine Zahl',
        text: 'Bei Nachbarschaftshilfe wird der Arbeitsbeginn nicht belegt.',
        erfolg: false,
      };
    case 'nicht_berechtigt':
      return {
        titel: 'Dieser Auftrag gehört nicht zu Ihnen',
        text: 'Bitte öffnen Sie den Auftrag noch einmal aus Ihrer Liste.',
        erfolg: false,
      };
    case 'fehler':
    default:
      return {
        titel: 'Es hat nicht geklappt',
        text: 'Die Verbindung war gestört. Bitte versuchen Sie es noch einmal.',
        erfolg: false,
      };
  }
}

/**
 * Vier Ziffern, sonst nichts. Die Prüfung steht auch in der Datenbank
 * (`check (pin ~ '^[0-9]{4}$')`); hier spart sie dem Betrieb einen Aufruf,
 * sie ersetzt sie nicht.
 */
export function istVollstaendigeEingabe(eingabe: string): boolean {
  return /^[0-9]{4}$/.test(eingabe);
}
