/**
 * Alter aus einem eingegebenen Geburtsdatum.
 *
 * ANLASS (14.09.2026): Diese Rechnung stand in `app/onboarding-kyc.tsx` als
 * `calcAge()` INNERHALB der Bildschirm-Komponente. Getestet hat sie niemand.
 * `__tests__/compliance.test.ts` trug eine ZWEITE, voellig andere Fassung
 * (`isOver18(Date)`) und pruefte damit ausschliesslich sich selbst — im Kopf
 * der Datei steht das sogar als Vorzug: „The functions are co-located here so
 * that they stay in sync with the tests." Zwei Fassungen derselben Regel
 * laufen garantiert auseinander; hier waren sie schon auseinander.
 *
 * `heute` ist ein Parameter und kein `new Date()` im Rumpf: ein Test, der nur
 * an bestimmten Tagen gruen ist, ist kein Test (dieselbe Lehre wie bei
 * lib/kalenderWoche.ts).
 */

/** Die einzige Stelle, an der die Altersgrenze steht. */
export const MINDESTALTER = 18;

/**
 * Ein Datum im Format TT.MM.JJJJ einlesen — streng.
 *
 * `new Date(2000, 1, 31)` ergibt in JavaScript den 2. Maerz, nicht einen
 * Fehler. Der 31.02.2000 kam so als gueltiges Geburtsdatum durch, und das
 * Eingabefeld zeigte „bestaetigt". Deshalb die Gegenprobe: was hineingegeben
 * wurde, muss auch wieder herauskommen.
 */
export function datumLesen(eingabe: string): Date | null {
  const teile = eingabe.split('.');
  if (teile.length !== 3) return null;
  const [t, m, j] = teile.map(Number);
  if (!Number.isInteger(t) || !Number.isInteger(m) || !Number.isInteger(j)) return null;
  if (j < 1900 || m < 1 || m > 12 || t < 1 || t > 31) return null;

  const d = new Date(j, m - 1, t);
  if (d.getFullYear() !== j || d.getMonth() !== m - 1 || d.getDate() !== t) return null;

  return d;
}

/**
 * Alter in vollen Jahren am Stichtag `heute`, oder null bei ungueltiger Eingabe.
 *
 * Am 18. Geburtstag ist man 18 — die Grenze zaehlt einschliesslich.
 */
export function alterAm(eingabe: string, heute: Date = new Date()): number | null {
  const geburt = datumLesen(eingabe);
  if (!geburt) return null;
  if (geburt > heute) return null;

  let jahre = heute.getFullYear() - geburt.getFullYear();
  const gehabt =
    heute.getMonth() > geburt.getMonth() ||
    (heute.getMonth() === geburt.getMonth() && heute.getDate() >= geburt.getDate());
  if (!gehabt) jahre -= 1;
  return jahre;
}

/**
 * Ist die Person volljaehrig?
 *
 * Grund fuer die Grenze ist NICHT das Jugendarbeitsschutzgesetz (das regelt die
 * Beschaeftigung durch einen Arbeitgeber, und Werkant ist keiner). Tragend ist:
 * ein Minderjaehriger kann ohne seinen gesetzlichen Vertreter keinen wirksamen
 * Vertrag schliessen (§§ 106, 107 BGB) — ein Auftrag ueber 800 EUR waere
 * schwebend unwirksam.
 */
export function istVolljaehrig(eingabe: string, heute: Date = new Date()): boolean {
  const alter = alterAm(eingabe, heute);
  return alter !== null && alter >= MINDESTALTER;
}
