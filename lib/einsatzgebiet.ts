/**
 * Welche Auftraege ein Betrieb ueberhaupt zu sehen bekommt.
 *
 * ANLASS (16.09.2026). `supabase/functions/notify-matching-providers/
 * auswahl.ts` entscheidet ueber die ersten ZWEI Ziffern der Postleitzahl:
 *
 *     const plzPrefix = (job.address_plz ?? "").slice(0, 2);
 *     return plzPrefix.length === 2 && plz.startsWith(plzPrefix);
 *
 * Diese eine Zeile bestimmt den gesamten Auftragsfluss eines Betriebs. Und
 * beim Nachmessen zeigte sich:
 *
 *   * Der Betrieb sieht seine Postleitzahl NIRGENDS. `app/betrieb/profil.tsx`
 *     und `profil-bearbeiten.tsx` fuehren sie nicht, sie steht auf
 *     `profiles.plz` und ist nur ueber den Kunden-Bildschirm zu aendern.
 *   * Er kann sie also auch nicht korrigieren.
 *   * Und die Regel steht in keinem Text, den er je liest.
 *   * Ist sie leer, bekommt er **gar keine** Anfragen -- `"".startsWith("50")`
 *     ist falsch -- ohne dass irgendwo etwas davon stuende.
 *
 * Das ist dieselbe Klasse wie die unsichtbaren guten Regeln: eine Mechanik,
 * die alles bestimmt und die niemand erklaert. Nur schlimmer, weil sie den
 * Betrieb Geld kostet und er nicht weiss, warum nichts kommt.
 *
 * DIE ZAHL STEHT HIER NUR EINMAL. `scripts/einsatzgebiet-check.py` prueft,
 * dass sie mit `auswahl.ts` uebereinstimmt -- laufen die beiden auseinander,
 * erklaert der Text eine Regel, die es nicht gibt.
 */

/** So viele Anfangsziffern muessen uebereinstimmen (auswahl.ts, `slice(0, 2)`). */
export const PLZ_BEREICH_STELLEN = 2;

/** Eine deutsche Postleitzahl hat fuenf Ziffern. */
export function plzGueltig(plz: string | null | undefined): boolean {
  return typeof plz === 'string' && /^\d{5}$/.test(plz.trim());
}

/** „50" aus „50667". Leer, wenn die Postleitzahl nicht taugt. */
export function bereichVon(plz: string | null | undefined): string {
  if (!plzGueltig(plz)) return '';
  return (plz as string).trim().slice(0, PLZ_BEREICH_STELLEN);
}

export type Einsatzgebiet =
  | { art: 'ohne'; }
  | { art: 'bereich'; bereich: string; muster: string };

export function einsatzgebiet(plz: string | null | undefined): Einsatzgebiet {
  const b = bereichVon(plz);
  if (!b) return { art: 'ohne' };
  return { art: 'bereich', bereich: b, muster: b + 'xxx' };
}

/**
 * Der Satz, der dem Betrieb sagt, woran er ist.
 *
 * Bewusst ohne Beschoenigung im Fall `ohne`: wer keine Postleitzahl hinterlegt
 * hat, bekommt nichts, und das muss dastehen. Ein „Sie erhalten passende
 * Anfragen" waere an dieser Stelle schlicht falsch.
 */
export function einsatzgebietText(plz: string | null | undefined): string {
  const g = einsatzgebiet(plz);
  if (g.art === 'ohne') {
    return 'Ohne Postleitzahl bekommen Sie keine Anfragen. Tragen Sie sie ein, '
      + 'damit wir Ihnen Aufträge aus Ihrer Gegend melden können.';
  }
  return `Sie bekommen Anfragen für Aufträge, deren Postleitzahl mit ${g.bereich} `
    + `beginnt (${g.muster}). Aufträge außerhalb dieses Bereichs erreichen Sie nicht.`;
}
