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
// Bis 20.09.2026 wortgleiche Uebernahme aus index.ts. Seitdem traegt der
// Filter eine zweite Bedingung: wer auf einen Anlage-A-Auftrag gar nicht
// bieten darf (0980), bekommt darueber auch keine Mitteilung.

export interface AuftragsEckdaten {
  address_plz?: string | null;
  track?: string | null;
  category_id?: string | null;
  category?: string | null;
}

export interface AnbieterZeile {
  is_nachbarschaft?: boolean | null;
  meister_verified?: boolean | null;
  profile?: { plz?: string | null } | null;
}

/**
 * Ein Gewerk der Anlage A zur HwO, so wie es in `meisterpflicht_gewerke` steht.
 *
 * BEWUSST HEREINGEREICHT statt hier hinterlegt: die Liste steht seit 0980 in
 * der Datenbank und in `data/categories.ts`, und zwei Stellen sind schon eine
 * zu viel (deshalb scripts/meisterpflicht-beleg-check.py). Eine dritte Kopie
 * hier waere die Stelle, die beim naechsten Mal vergessen wird.
 */
export interface MeisterGewerk {
  gewerk: string;
  name: string;
}

export function passendeAnbieter<T extends AnbieterZeile>(
  job: AuftragsEckdaten,
  anbieter: T[] | null | undefined,
  meisterGewerke: MeisterGewerk[] = [],
): T[] {
  const plzPrefix = (job.address_plz ?? "").slice(0, 2);
  const jobIsNb = job.track === "nachbarschaft";

  // Dieselbe Frage wie `auftrag_braucht_meister` in 0980, und aus demselben
  // Grund auch mit dem Rueckfall auf den Anzeigenamen: `jobs.category_id` darf
  // seit 0410 NULL sein.
  const kat = (job.category ?? "").toLowerCase();
  const brauchtMeister = meisterGewerke.some(
    (m) => m.gewerk === job.category_id || m.name.toLowerCase() === kat,
  );

  return (anbieter ?? []).filter((p) => {
    // Track-Trennung. Bewusst ein Vergleich auf Gleichheit und keine
    // Einbahnstrasse: ein Handwerker soll auch KEINE Nachbarschafts-Auftraege
    // bekommen, sonst wandert der guenstigere Zweig zum Gewerbe ab.
    if (Boolean(p.is_nachbarschaft) !== jobIsNb) return false;

    // Wer auf diesen Auftrag gar nicht bieten DARF (0980), bekommt auch keine
    // Mitteilung darueber. Eine Benachrichtigung, die in eine Sperre fuehrt,
    // ist schlechter als keine -- sie kostet Vertrauen und Zeit.
    if (brauchtMeister && !p.meister_verified) return false;

    const plz = p.profile?.plz ?? "";
    // Fehlt die PLZ am Auftrag, ist `plzPrefix` kuerzer als zwei Zeichen und
    // NIEMAND passt. Das ist Absicht: lieber keine Mitteilung als eine an alle.
    return plzPrefix.length === 2 && plz.startsWith(plzPrefix);
  });
}
