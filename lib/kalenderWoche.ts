/**
 * Wochenberechnung fuer den Anbieter-Kalender.
 *
 * Ausgelagert aus app/betrieb/kalender.tsx, damit die Datumsarithmetik
 * pruefbar ist: der Bildschirm selbst haengt an Anmeldung und Anbieter-Rolle
 * und ist im Browser-Durchlauf gar nicht erreichbar. Genau hier lagen aber die
 * Fehler -- ein Kalender, der nur die laufende Woche kennt, und ein
 * Buchungs-Schluessel, der sich jede Woche wiederholt.
 */

/** Kalendertag als YYYY-MM-DD, in ORTSZEIT. */
export function isoTag(d: Date): string {
  // Bewusst NICHT toISOString(): das rechnet nach UTC um und schiebt in
  // deutscher Sommerzeit jeden Zeitpunkt vor 02:00 auf den Vortag -- ein
  // Termin am 01.09. um 00:30 landete damit auf dem 31.08.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Montag der Woche mit dem angegebenen Versatz (0 = laufende Woche,
 * -1 = vorige, +1 = naechste). `heute` ist einsetzbar, damit Tests nicht vom
 * Ausfuehrungstag abhaengen.
 */
export function montagDerWoche(wochenVersatz: number, heute: Date = new Date()): Date {
  const montag = new Date(heute);
  // getDay(): 0=Sonntag. (+6)%7 verschiebt auf 0=Montag, sonst faengt die
  // Woche am Sonntag an und der Sonntag gehoert zur falschen Woche.
  montag.setDate(heute.getDate() - ((heute.getDay() + 6) % 7) + wochenVersatz * 7);
  montag.setHours(0, 0, 0, 0);
  return montag;
}

/** Die sieben Kalendertage (Mo–So) der Woche mit dem angegebenen Versatz. */
export function wochenTage(wochenVersatz: number, heute: Date = new Date()): Date[] {
  const montag = montagDerWoche(wochenVersatz, heute);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(montag);
    d.setDate(montag.getDate() + i);
    return d;
  });
}

/**
 * Wochen-Versatz zu einem beliebigen Zieltag.
 *
 * ANLASS (Founder am Geraet, 07.09.2026): "Ich moechte auch Kalender fuer die
 * naechsten Wochen etc. anklicken koennen oder 2027 — gerade ist es schlecht
 * geregelt mit +1 etc."
 *
 * Nachgemessen: der Kalender kannte nur `‹` und `›` in Wochenschritten, und
 * das Label sagte "+3 Wochen" statt eines Datums. Fuer Januar 2027 waeren das
 * rund 70 Tipper gewesen. Eine Bedienung, die theoretisch ans Ziel fuehrt,
 * aber praktisch niemand durchhaelt, ist keine.
 *
 * Gerechnet wird ueber die MONTAGE beider Wochen, nicht ueber die Differenz
 * der Tage: (ziel - heute) / 7 waere bei einem Zieltag mitten in der Woche
 * um eins daneben, und in der Zeitumstellungsnacht zusaetzlich um eine
 * Stunde — 7 Tage sind im Oktober 169 Stunden, nicht 168.
 */
export function wochenVersatzZu(ziel: Date, heute: Date = new Date()): number {
  const a = montagDerWoche(0, heute);
  const b = montagDerWoche(0, ziel);
  // Auf Mittag normieren, damit die Sommerzeit-Stunde die Division nicht kippt.
  a.setHours(12, 0, 0, 0);
  b.setHours(12, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

/** Die Kalendertage eines Monats, aufgefuellt zu vollen Mo–So-Wochen. */
export function monatsRaster(jahr: number, monat0: number): Date[] {
  const erster = new Date(jahr, monat0, 1);
  const start = montagDerWoche(0, erster);
  const tage: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    tage.push(d);
    // Nach einer vollen Woche abbrechen, sobald der Monat durch ist — sonst
    // haengen bis zu zwei komplett fremde Wochen unten dran.
    if (i % 7 === 6 && (d.getMonth() !== monat0 || d.getDate() >= 28)) {
      const naechster = new Date(d);
      naechster.setDate(d.getDate() + 1);
      if (naechster.getMonth() !== monat0) break;
    }
  }
  return tage;
}

const MONATE_KURZ = [
  'Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni',
  'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.',
];

/** Zeitraum einer Woche als "7.–13. Sep. 2026" — ein Datum statt "+3 Wochen". */
export function wochenZeitraum(wochenVersatz: number, heute: Date = new Date()): string {
  const tage = wochenTage(wochenVersatz, heute);
  const von = tage[0];
  const bis = tage[6];
  // Feste Abkuerzungen statt toLocaleDateString({month:'short'}): das liefert
  // je nach ICU-Datenbank "Sep", "Sept" oder "Sep." — die Anzeige saehe auf
  // iOS, Android und im Browser unterschiedlich aus, und der Test waere von
  // der Laufzeitumgebung abhaengig statt vom Code.
  const monatKurz = (d: Date) => MONATE_KURZ[d.getMonth()];
  const gleichesJahr = von.getFullYear() === bis.getFullYear();
  const links = von.getMonth() === bis.getMonth() && gleichesJahr
    ? `${von.getDate()}.`
    : `${von.getDate()}. ${monatKurz(von)}${gleichesJahr ? '' : ' ' + von.getFullYear()}`;
  return `${links}–${bis.getDate()}. ${monatKurz(bis)} ${bis.getFullYear()}`;
}
