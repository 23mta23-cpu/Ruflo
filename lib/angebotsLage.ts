/**
 * Was der leere Angebotszustand sagen soll.
 *
 * ANLASS. `docs/markt/wettbewerbsabgleich-2026-09.md`, Luecke 2: "Der leere
 * Zustand ist der Normalzustand, und er verspricht heute nichts, was man
 * halten koennte." Dort stand:
 *
 *     "Anbieter koennen jetzt Angebote einreichen.
 *      Sie werden benachrichtigt, sobald eines eingegangen ist."
 *
 * Der naheliegende Ausweg waere eine Zusage gewesen ("wir melden uns nach 48
 * Stunden"). Der faellt aus: genau solche Fristen wurden am 15.09.2026 aus dem
 * Produkt entfernt, weil niemand sie halten kann, und
 * `scripts/versprechen-check.py` wird seitdem rot dabei. Eine Zusage ohne
 * Mechanismus ist eine Luege mit Verzoegerung.
 *
 * Stattdessen eine TATSACHE, die es schon gibt und die niemand zeigt: wie
 * viele Betriebe ueber den Auftrag benachrichtigt wurden (0920). Der Fall, auf
 * den es ankommt, ist die Null.
 *
 * REINE FUNKTION, absichtlich. Sie bekommt `jetzt` uebergeben, damit ein Test
 * nicht nur an dem Tag gruen ist, an dem er geschrieben wurde (CLAUDE.md,
 * 16.08.: "ein Test, der nur montags gruen ist, ist kein Test").
 */

export type Lage =
  /** Die Benachrichtigung ist noch nicht gelaufen. Wir wissen nichts. */
  | { art: 'unbekannt' }
  /** Es wurden Betriebe benachrichtigt, es ist nur noch keiner so weit. */
  | { art: 'wartet'; betriebe: number; stunden: number }
  /** Niemand passte. Das ist die Nachricht, auf die es ankommt. */
  | { art: 'niemand'; stunden: number };

export type AuftragsLage = {
  created_at: string | null;
  benachrichtigte_betriebe: number | null;
  benachrichtigt_am?: string | null;
};

/** Volle Stunden seit dem Zeitpunkt. Negatives (Uhr schief) wird zu 0. */
export function stundenSeit(zeitpunkt: string | null, jetzt: Date): number {
  if (!zeitpunkt) return 0;
  const t = new Date(zeitpunkt).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((jetzt.getTime() - t) / 3_600_000));
}

export function lageBestimmen(auftrag: AuftragsLage, jetzt: Date = new Date()): Lage {
  const n = auftrag.benachrichtigte_betriebe;
  // NULL ist nicht 0. NULL heisst "noch nicht gelaufen" (0920), und daraus
  // duerfen wir nichts ableiten. Frueher stand hier `!n`, was die 0
  // mitverschluckt haette -- genau den Fall, fuer den die Spalte da ist.
  if (n === null || n === undefined) return { art: 'unbekannt' };
  const stunden = stundenSeit(auftrag.created_at, jetzt);
  if (n <= 0) return { art: 'niemand', stunden };
  return { art: 'wartet', betriebe: n, stunden };
}

/** „seit 3 Stunden" / „seit einer Stunde" / „gerade eben". */
export function seitText(stunden: number): string {
  if (stunden < 1) return 'gerade eben';
  if (stunden === 1) return 'seit einer Stunde';
  if (stunden < 24) return `seit ${stunden} Stunden`;
  const tage = Math.floor(stunden / 24);
  return tage === 1 ? 'seit einem Tag' : `seit ${tage} Tagen`;
}

/**
 * Der Text zum leeren Zustand. Keine Frist, keine Zusage, nur was wir wissen
 * und was der Kunde tun kann.
 */
export function lageText(lage: Lage): { titel: string; text: string } {
  switch (lage.art) {
    case 'unbekannt':
      return {
        titel: 'Noch keine Angebote',
        text: 'Ihr Auftrag ist eingestellt. Sobald ein Angebot eingeht, sehen Sie es hier.',
      };
    case 'wartet':
      return {
        titel: 'Noch keine Angebote',
        text: `${lage.betriebe === 1 ? 'Ein Betrieb' : `${lage.betriebe} Betriebe`} in Ihrem Postleitzahlenbereich ${lage.betriebe === 1 ? 'wurde' : 'wurden'} über Ihren Auftrag informiert. Ihr Auftrag ist ${seitText(lage.stunden)} offen. Ein Angebot zu schreiben kostet Zeit, deshalb dauert es meist ein bis zwei Werktage.`,
      };
    case 'niemand':
      return {
        titel: 'In Ihrer Gegend ist noch kein passender Betrieb dabei',
        text: 'Für dieses Gewerk konnten wir in Ihrem Postleitzahlenbereich noch niemanden benachrichtigen. Ihr Auftrag bleibt offen und wird sichtbar, sobald sich ein Betrieb anmeldet. Damit das schneller geht, hilft eine der Möglichkeiten unten.',
      };
  }
}
