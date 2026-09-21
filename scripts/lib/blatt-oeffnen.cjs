// Ein Blatt von unten oder einen Schieber aufmachen, bevor gemessen wird.
//
// ANLASS (21.09.2026): Weder beruehrflaeche-check.cjs noch kontrast-check.cjs
// hat je ein Blatt geoeffnet. Sechs Blaetter blieben damit unvermessen,
// darunter das Einwilligungs-Blatt -- der erste Bildschirm, den ueberhaupt
// jemand sieht. Dieselbe Luecke wie am 16.09. bei den Reitern: „Ein Pruefer,
// der einen Reiter nie antippt, sieht die Haelfte nicht."
//
// Hier und nicht zweimal, weil zwei Kopien desselben Auszugs bedeuten, dass
// eine irgendwann an einer Fehlerklasse vorbeisieht.

/** Wie viele Knoepfe gerade wirklich sichtbar sind. */
async function sichtbareKnoepfe(p) {
  return p.evaluate(() => Array.from(
    document.querySelectorAll('[role="button"], [role="tab"]'),
  ).filter((e) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
  }).length);
}

/**
 * Tippt die Beschriftungen der Reihe nach an. Ein '@' davor heisst: das ist
 * ein aria-label, kein sichtbarer Text.
 *
 * Nach dem LETZTEN Antippen wird geprueft, ob wirklich etwas aufgegangen ist.
 * Ohne diese Pruefung meldet der Pruefer den Bildschirm DAHINTER als gruen,
 * und das Blatt bleibt ungemessen -- ein gruener Haken, der nichts prueft.
 *
 * @returns {Promise<string[]>} leere Liste, wenn alles aufging
 */
async function oeffneFolge(p, folge) {
  const fehler = [];
  let vorLetztem = 0;
  for (let i = 0; i < folge.length; i++) {
    const marke = folge[i];
    if (i === folge.length - 1) vorLetztem = await sichtbareKnoepfe(p);
    const ziel = marke.startsWith('@')
      ? p.locator(`[role="button"][aria-label="${marke.slice(1)}"]:visible`).first()
      : p.locator('[role="button"]:visible').filter({ hasText: marke }).first();
    try {
      await ziel.click({ timeout: 4000 });
    } catch {
      // Nicht abbrechen: ein Pruefer, der beim ersten Fehler haengen bleibt,
      // zeigt nur den ERSTEN Fehler -- die Liste danach braucht man aber.
      fehler.push(`„${marke}" nicht antippbar`);
    }
    await p.waitForTimeout(600);
  }
  const danach = await sichtbareKnoepfe(p);
  if (danach <= vorLetztem) {
    fehler.push(`nichts geöffnet (${vorLetztem} -> ${danach} Knöpfe sichtbar)`);
  }
  return fehler;
}

module.exports = { oeffneFolge, sichtbareKnoepfe };
