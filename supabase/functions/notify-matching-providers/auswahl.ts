// Wer bekommt die Mitteilung über einen neuen Auftrag? — ausfuehrbar testbar.
//
// ANLASS: Der Founder fand am 20.07.2026 auf dem Geraet, dass ein
// Nachbarschaftshelfer Handwerks-Anfragen sah und darauf bieten konnte. Das ist
// kein Anzeigefehler, sondern ein §1-HwO-Risiko: meisterpflichtige Arbeiten
// duerfen nicht ueber den Nachbarschafts-Zweig vermittelt werden. Behoben
// wurde es damals in Migration 0480 (offers-Policy) UND in diesem Filter.
//
// Die Policy ist seit 0480 durch scripts/db-test/ abgedeckt. Dieser Filter war
// es NICHT — er lag in index.ts und wurde nur typgeprueft. Ein Filter, der die
// Trennung zweier Rechtsraeume traegt, gehoert ausgefuehrt.
//
// Wortgleiche Uebernahme aus index.ts; keine Bedingung geaendert.

export interface AuftragsEckdaten {
  address_plz?: string | null;
  track?: string | null;
}

export interface AnbieterZeile {
  is_nachbarschaft?: boolean | null;
  profile?: { plz?: string | null } | null;
}

export function passendeAnbieter<T extends AnbieterZeile>(
  job: AuftragsEckdaten,
  anbieter: T[] | null | undefined,
): T[] {
  const plzPrefix = (job.address_plz ?? "").slice(0, 2);
  const jobIsNb = job.track === "nachbarschaft";

  return (anbieter ?? []).filter((p) => {
    // Track-Trennung. Bewusst ein Vergleich auf Gleichheit und keine
    // Einbahnstrasse: ein Handwerker soll auch KEINE Nachbarschafts-Auftraege
    // bekommen, sonst wandert der guenstigere Zweig zum Gewerbe ab.
    if (Boolean(p.is_nachbarschaft) !== jobIsNb) return false;

    const plz = p.profile?.plz ?? "";
    // Fehlt die PLZ am Auftrag, ist `plzPrefix` kuerzer als zwei Zeichen und
    // NIEMAND passt. Das ist Absicht: lieber keine Mitteilung als eine an alle.
    return plzPrefix.length === 2 && plz.startsWith(plzPrefix);
  });
}
