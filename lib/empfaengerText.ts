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

/**
 * ZWEITER ANLASS (22.09.2026): Der Knopf „Unverbindliche Anfrage stellen"
 * unter einem Anbieterprofil uebergab eine Anbieterkennung, die der Trichter
 * nie gelesen hat. Seit Migration 1020 wird sie als Wunschanbieter
 * gespeichert -- und dann darf der Satz nicht mehr so tun, als ginge die
 * Anfrage nur an eine anonyme Menge.
 *
 * Gesagt werden muss BEIDES, und zwar in dieser Reihenfolge:
 *   1. der gewuenschte Betrieb wird benachrichtigt (das hat der Kunde gewollt),
 *   2. die Anfrage bleibt trotzdem fuer andere offen (sonst wartet er
 *      moeglicherweise auf eine Antwort, die nie kommt).
 * Ein Wunsch bindet niemanden. Wer das verschweigt, verspricht eine
 * Zusage, die der eigene Code nicht einloest -- dieselbe Klasse wie der
 * Gewerbeschein-Satz oben.
 *
 * `wunschName` ist bewusst PFLICHT und nicht `?`: genau ein optionaler
 * Parameter hat diese Fehlerklasse ueberhaupt erst entstehen lassen.
 * `null` heisst „ohne Wunschanbieter" und muss ausgeschrieben werden.
 */
function wunschVorsatz(wunschName: string | null): string {
  const name = wunschName?.trim();
  if (!name) return '';
  return `Ihre Anfrage geht zuerst an ${name}. `;
}

function wunschZusatz(wunschName: string | null): string {
  return wunschName?.trim()
    ? ' Eine Anfrage ist unverbindlich: antwortet der Betrieb nicht, bleiben die Angebote der anderen.'
    : '';
}

/** Ein Satz fuer den Erfolgsbildschirm: an wen die Anfrage geht. */
export function empfaengerSatz(weg: Auftragsweg, wunschName: string | null): string {
  const kern = weg === 'nachbarschaft'
    ? 'Wir leiten Ihre Anfrage an Helferinnen und Helfer aus der Nachbarschaft weiter, die Werkant freigegeben hat.'
    : 'Wir leiten Ihre Anfrage an passende Betriebe mit geprüftem Gewerbeschein weiter.';
  return wunschVorsatz(wunschName) + kern + wunschZusatz(wunschName);
}

/** Dieselbe Aussage als Hinweis unter der Zusammenfassung. */
export function empfaengerHinweis(weg: Auftragsweg, wunschName: string | null): string {
  const kern = weg === 'nachbarschaft'
    ? 'Ihre Daten werden nur an freigegebene Helferinnen und Helfer weitergegeben.'
    : 'Ihre Daten werden nur an Betriebe mit geprüftem Gewerbeschein weitergegeben.';
  return wunschVorsatz(wunschName) + kern + wunschZusatz(wunschName);
}

/**
 * Die Pruefungs-Kachel auf der Startseite.
 *
 * NACHTRAG 21.09.2026 (nachts): Am Nachmittag habe ich den Satz im Hero
 * korrigiert und die Kachel drei Bildschirmhoehen weiter oben uebersehen.
 * Dort stand unter einem Schild-Symbol „Gewerbeschein und Meisterbrief
 * geprueft" als Aussage ueber ALLE „Anbieter", unabhaengig vom Weg. Auf dem
 * Nachbarschaftsweg legt niemand einen Gewerbeschein vor.
 *
 * `nachbarschaftAn` ist NICHT der Weg eines einzelnen Auftrags, sondern die
 * Frage, ob es den Nachbarschaftsweg ueberhaupt gibt (FEATURES.NACHBARSCHAFT).
 * Die Startseite kennt keinen Auftrag; sie beschreibt das ganze Angebot.
 *
 * Was hier NICHT steht und bewusst nicht: eine Alterspruefung. Der
 * Nachbarschaftsweg nimmt eine schriftliche Volljaehrigkeitserklaerung
 * entgegen (Selbstauskunft, Migration 0990), er prueft sie nicht.
 * Stripe dagegen gilt fuer BEIDE Wege -- die Auszahlung laeuft ueberall
 * ueber Stripe Connect, und dort findet die Identitaetspruefung statt.
 */
export function pruefungTitel(nachbarschaftAn: boolean): string {
  return nachbarschaftAn
    ? 'Jedes Profil wird einzeln freigegeben'
    : 'Gewerbeschein und Meisterbrief geprüft';
}

export function pruefungSatz(nachbarschaftAn: boolean): string {
  const gemeinsam = 'Ausweiskopien nehmen wir bewusst nicht entgegen. Die Identität prüft unser Zahlungsdienstleister Stripe.';
  return nachbarschaftAn
    ? 'Betriebe weisen ihren Gewerbeschein nach, in meisterpflichtigen Gewerken zusätzlich den Meisterbrief. '
      + 'Nachbarschaftshilfe ist kein Gewerbe: dort wird kein Gewerbeschein verlangt, und Werkant gibt jedes Profil einzeln frei. '
      + gemeinsam
    : 'Anbieter weisen ihren Gewerbeschein nach, in meisterpflichtigen Gewerken zusätzlich den Meisterbrief. '
      + gemeinsam;
}

/**
 * Welche Sorte Anbieter steht hier in der Liste?
 *
 * ANLASS (22.09.2026): `app/suche.tsx` listet BEIDE Wege gemischt
 * (`kundenKategorien(FEATURES.NACHBARSCHAFT)` nimmt die
 * Nachbarschafts-Startkategorien ausdruecklich auf), waehlt
 * `is_nachbarschaft` aber gar nicht aus. Fuer den Kunden waren eine Helferin
 * und ein Meisterbetrieb dort optisch nicht zu unterscheiden -- bei
 * verschiedenem Pruefumfang, verschiedener Gebuehr und verschiedener
 * Rechtslage.
 *
 * Die Wortwahl ist mit `app/anbieter.tsx` abgestimmt und behauptet je Weg
 * genau das, was Werkant wirklich getan hat: beim Betrieb wurden DOKUMENTE
 * geprueft (Gewerbeschein, Steuernummer), bei der Nachbarschaftshilfe wurde
 * ein Profil FREIGEGEBEN, ohne Dokumente.
 */
export function anbieterArt(istNachbarschaft: boolean): string {
  return istNachbarschaft
    ? 'Nachbarschaftshilfe · von Werkant freigegeben'
    : 'Handwerksbetrieb · von Werkant geprüft';
}

/**
 * Die kurze Zusage im Vertrauens-Strip der Startseite.
 *
 * ANLASS (22.09.2026): Dort stand „Gewerbeschein geprüft" als LITERAL, neben
 * einem Segment-Umschalter, der ausdruecklich zwischen Handwerk und
 * Nachbarschaftshilfe wechselt. Auf dem Nachbarschaftsweg legt niemand einen
 * Gewerbeschein vor. Dieselbe Klasse wie die Vorteils-Kachel der
 * Landingpage (21.09.), nur im Produkt selbst.
 *
 * Drei Spalten mit 15-px-Symbol: der Text muss kurz bleiben. „Freigegeben"
 * statt „geprueft" ist dabei die schwaechere, aber fuer BEIDE Wege wahre
 * Aussage -- jedes Profil geht durch das Pruef-Postfach.
 */
export function pruefungKurz(nachbarschaftAn: boolean): string {
  return nachbarschaftAn ? 'Anbieter einzeln freigegeben' : 'Gewerbeschein geprüft';
}

/**
 * Die Vertrauenszeile unter den Avataren der Startseite.
 *
 * FUENFTE Fundstelle derselben Zusage (22.09.2026), und die staerkste
 * Formulierung von allen: „Jeder Anbieter persönlich verifiziert:
 * Gewerbeschein, in meisterpflichtigen Gewerken der Meisterbrief."
 * Mit aktivem Nachbarschaftsweg ist das ueber „jeden Anbieter" unwahr.
 *
 * Gefunden nicht durch Suchen, sondern weil ein anderer Pruefer den
 * sichtbaren Text des Blattes ausgab. Wer eine Zusage korrigiert, sucht die
 * GANZE Datei nach ihr ab -- und danach noch einmal den gerenderten Text.
 */
export function pruefungSozial(nachbarschaftAn: boolean): { fett: string; rest: string } {
  return nachbarschaftAn
    ? {
        fett: 'Jedes Profil einzeln freigegeben',
        rest: ': Betriebe mit geprüftem Gewerbeschein, Nachbarschaftshilfe ohne Gewerbe',
      }
    : {
        fett: 'Jeder Anbieter persönlich verifiziert',
        rest: ': Gewerbeschein, in meisterpflichtigen Gewerken der Meisterbrief',
      };
}

/**
 * Der Eingangssatz der Garantieseite.
 *
 * SECHSTE Fundstelle (22.09.2026), gefunden durch eine Messung im
 * GERENDERTEN Text: „Werkant sichert jeden Auftrag über ein Treuhandkonto,
 * geprüfte Gewerbenachweise und schriftliche Verträge." Einen
 * Gewerbenachweis gibt es auf dem Nachbarschaftsweg nicht, „jeden Auftrag"
 * ist damit unwahr.
 *
 * Treuhandkonto und schriftlicher Vertrag gelten dagegen fuer BEIDE Wege --
 * die stehen deshalb weiter ohne Einschraenkung da.
 */
export function schutzSatz(nachbarschaftAn: boolean): string {
  const gemeinsam = 'Ihr Geld wird vor Beginn hinterlegt und erst nach Abschluss ausgezahlt.';
  return nachbarschaftAn
    ? 'Werkant sichert jeden Auftrag über ein Treuhandkonto und einen schriftlichen Vertrag. '
      + 'Bei Handwerksbetrieben kommt der geprüfte Gewerbenachweis dazu. '
      + gemeinsam
    : 'Werkant sichert jeden Auftrag über ein Treuhandkonto, geprüfte Gewerbenachweise und schriftliche Verträge. '
      + gemeinsam;
}
