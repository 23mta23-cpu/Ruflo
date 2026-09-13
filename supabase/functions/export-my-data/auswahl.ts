// Zwei Stuecke reiner Logik aus export-my-data — ausfuehrbar testbar.
//
// Beides traegt eine Zusage, die `deno check` nicht sehen kann.

/** Ergebnis einer Supabase-Abfrage, so weit der Sammler es braucht. */
export interface Result {
  data: unknown;
  error: unknown;
}

/**
 * Sammelt die Kategorien einer Auskunft und merkt sich, welche gescheitert
 * sind.
 *
 * WARUM DAS ZAEHLT: Eine Auskunft nach Art. 15 DSGVO, der still eine Kategorie
 * fehlt, ist schlimmer als gar keine — der Betroffene haelt sie fuer
 * vollstaendig und hat keinen Anlass nachzufragen. Deshalb bricht der Export
 * ab, sobald EINE Kategorie gescheitert ist, statt das Uebrige auszuliefern.
 *
 * Die Antwort an den Client nennt nur die Kategorie, nie den Datenbankfehler:
 * Spalten- und Policy-Namen gehoeren nicht nach aussen.
 */
export class Collector {
  readonly failed: string[] = [];

  take(category: string, res: Result): unknown {
    if (res.error) {
      console.error(`export-my-data: Kategorie "${category}" fehlgeschlagen:`, res.error);
      this.failed.push(category);
      return null;
    }
    return res.data;
  }
}

/**
 * Der Filter, der bestimmt, WELCHE Gespraechsfaeden in die Auskunft kommen.
 *
 * ANLASS (Security-Befund L1): Ein Gespraechsfaden ist ein (Auftrag, Anbieter)-
 * Paar. Als Kunde gehoeren einem alle Faeden der eigenen Auftraege, als
 * Anbieter NUR der eigene. Ohne diese Trennung haette die Auskunft eines
 * Kunden die Vor-Vertrags-Rueckfragen KONKURRIERENDER Anbieter enthalten —
 * fremdes Personendatum und zugleich ein Wettbewerbsgeheimnis.
 *
 * Ein zusaetzliches `.in("job_id", …)` davor war frueher eine Luecke in die
 * andere Richtung: ein Anbieter, der zu einem offenen Auftrag rueckgefragt und
 * den Zuschlag NICHT bekommen hat, ist weder Kunde noch zugewiesener Anbieter
 * — sein eigener Faden fiel damit aus der Auskunft, obwohl es seine eigenen
 * Nachrichten sind.
 */
export function threadFilter(uid: string, eigeneAuftragsIds: string[]): string {
  return eigeneAuftragsIds.length
    ? `provider_id.eq.${uid},job_id.in.(${eigeneAuftragsIds.join(",")})`
    : `provider_id.eq.${uid}`;
}

/** Die Auftraege, bei denen der Nutzer der KUNDE ist — nur deren Faeden und
 *  Adressen gehoeren ihm. */
export function eigeneKundenAuftraege(
  uid: string,
  jobs: { id: string; customer_id: string }[],
): string[] {
  return jobs.filter((j) => j.customer_id === uid).map((j) => j.id);
}
