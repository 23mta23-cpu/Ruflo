/**
 * Welche offenen Auftraege zeigt der Betriebsbereich zuerst?
 *
 * ANLASS (Selbst-Check 18.09.2026). Migration 0950 schickt dem Betrieb eine
 * Mitteilung: „In Ihrem Postleitzahlenbereich sind N offene Auftraege
 * ausgeschrieben, die zu Ihren Gewerken passen. Sie finden sie unter
 * Anfragen." Die Anfragen-Liste zeigt aber ALLE offenen Auftraege seines
 * Zweigs, die zwanzig neuesten, ohne Filter auf Gewerk oder Region. Der
 * Betrieb tippt also auf eine Mitteilung, die zwei bestimmte Auftraege meint,
 * und landet in einer Liste, in der er sie suchen muss.
 *
 * NICHT gefiltert wird trotzdem, und das ist eine Entscheidung: im Kaltstart
 * ist Sichtbarkeit fuer die wenigen Auftraege, die es gibt, mehr wert als
 * Genauigkeit. Ein Betrieb, der einen Nachbarort mitnehmen wuerde, soll ihn
 * sehen koennen. Sortiert wird stattdessen, und die Passung wird benannt.
 *
 * REINE FUNKTION, ohne Netz- und ohne Platform-Import, damit der Test das
 * Echte importiert statt es abzuschreiben.
 */

export type Anfrage = {
  id: string;
  category_id?: string | null;
  address_plz?: string | null;
  /** Wunschanbieter des Kunden (Migration 1020), sonst null. */
  requested_provider_id?: string | null;
};

export type BetriebsProfil = {
  /** Die Gewerke des Betriebs (`provider_profiles.category_ids`). */
  gewerke: string[];
  /** Die ersten zwei Ziffern seiner Postleitzahl, oder null. */
  plzBereich: string | null;
  /**
   * Die eigene Anbieterkennung. BEWUSST Pflicht und nicht `?`: ohne sie
   * waere `direkt` immer false, und die Direktanfrage verschwaende still --
   * genau die Klasse, aus der diese Spalte entstanden ist (1020).
   */
  id: string | null;
};

export type Passung = {
  gewerk: boolean;
  region: boolean;
  /** Der Kunde hat genau diesen Betrieb auf seinem Profil ausgewaehlt. */
  direkt: boolean;
};

/** Die ersten zwei Ziffern, oder null wenn es keine zwei gibt. */
export function plzBereich(plz: string | null | undefined): string | null {
  const zwei = (plz ?? '').trim().slice(0, 2);
  return /^[0-9]{2}$/.test(zwei) ? zwei : null;
}

export function passungVon(anfrage: Anfrage, betrieb: BetriebsProfil): Passung {
  // Dieselben zwei Bedingungen wie in notify-matching-providers/auswahl.ts und
  // im Trigger aus 0950. Gehen sie auseinander, sortiert der Bildschirm nach
  // einer anderen Regel, als die Mitteilung behauptet.
  const gewerk = !!anfrage.category_id
    && betrieb.gewerke.includes(anfrage.category_id);
  const region = !!betrieb.plzBereich
    && plzBereich(anfrage.address_plz) === betrieb.plzBereich;
  // Ohne eigene Kennung ist die Frage nicht beantwortbar, und `null === null`
  // waere die falsche Antwort: ein Auftrag ohne Wunschanbieter gilt sonst
  // jedem Betrieb ohne Kennung als Direktanfrage.
  const direkt = !!betrieb.id && anfrage.requested_provider_id === betrieb.id;
  return { gewerk, region, direkt };
}

/** Rang: kleiner ist weiter oben. */
function rang(p: Passung): number {
  // Eine Direktanfrage steht ueber allem: der Kunde hat sich dieses Profil
  // angesehen und diesen Betrieb ausgesucht. Sie in einer nach Gewerk
  // sortierten Liste untergehen zu lassen, waere derselbe stille Verlust,
  // den die Spalte gerade behebt.
  if (p.direkt) return -1;
  if (p.gewerk && p.region) return 0;
  // Das Gewerk wiegt schwerer als die Entfernung: wer Elektro kann, faehrt
  // auch in den Nachbarort; wer es nicht kann, nuetzt auch nebenan nichts.
  if (p.gewerk) return 1;
  if (p.region) return 2;
  return 3;
}

/**
 * Sortiert die Anfragen nach Passung. Innerhalb einer Gruppe bleibt die
 * eingehende Reihenfolge erhalten (die Abfrage liefert neueste zuerst) --
 * `Array.prototype.sort` ist seit ES2019 stabil.
 */
export function sortiereAnfragen<T extends Anfrage>(
  anfragen: T[],
  betrieb: BetriebsProfil,
): Array<T & { passung: Passung }> {
  return anfragen
    .map((a) => ({ ...a, passung: passungVon(a, betrieb) }))
    .sort((x, y) => rang(x.passung) - rang(y.passung));
}

/**
 * Was auf der Karte steht. `null` heisst: nichts hinschreiben.
 *
 * Kein Etikett ohne Gegenstand: „Empfohlen" oder „Fuer Sie" waere eine
 * Behauptung ueber eine Auswahl, die es nicht gibt. Gesagt wird nur, was
 * nachpruefbar ist.
 */
export function passungText(p: Passung): string | null {
  if (p.direkt) return 'Direkt an Sie gerichtet';
  if (p.gewerk && p.region) return 'Ihr Gewerk, Ihre Region';
  if (p.gewerk) return 'Ihr Gewerk';
  if (p.region) return 'Ihre Region';
  return null;
}
