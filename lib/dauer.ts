/**
 * Wie lange liegt das schon?
 *
 * ANLASS (Founder-Screenshots 07.09.2026): Drei Auftraege standen auf „Wartet
 * auf Angebote", ausgestellt am 22., 23. und 26. Juli — am 7. September, also
 * seit sechs Wochen. Auf keiner Karte stand, wie lange. Fuer einen Marktplatz
 * ist genau das die wichtigste Angabe: sie sagt dem Kunden, ob er noch warten
 * oder etwas anderes versuchen soll, und sie sagt uns, dass die Angebotsseite
 * fehlt.
 *
 * Rein und ohne Datenbank, damit es mit Jest pruefbar ist (dieselbe Lehre wie
 * bei lib/chatGuard.ts, das sich wegen eines supabase-Imports nicht laden
 * liess).
 */
export function seitWann(erstellt: string | Date | null | undefined, jetzt: Date = new Date()): string | null {
  if (!erstellt) return null;
  const d = erstellt instanceof Date ? erstellt : new Date(erstellt);
  if (Number.isNaN(d.getTime())) return null;

  const ms = jetzt.getTime() - d.getTime();
  if (ms < 0) return null;                       // in der Zukunft: nichts behaupten

  const minuten = Math.floor(ms / 60000);
  if (minuten < 60) return 'gerade eben';

  const stunden = Math.floor(minuten / 60);
  if (stunden < 24) return `seit ${stunden} ${stunden === 1 ? 'Stunde' : 'Stunden'}`;

  // Ueber Mittag rechnen, damit die Zeitumstellung die Tagesgrenze nicht
  // verschiebt (eine Woche im Oktober hat 169 Stunden).
  const a = new Date(d); a.setHours(12, 0, 0, 0);
  const b = new Date(jetzt); b.setHours(12, 0, 0, 0);
  const tage = Math.round((b.getTime() - a.getTime()) / 86400000);

  if (tage <= 1) return 'seit gestern';
  if (tage < 14) return `seit ${tage} Tagen`;

  const wochen = Math.floor(tage / 7);
  // Grenze bei ACHT Wochen, nicht neun: ab neun Wochen (63 Tagen) ergaebe
  // Math.floor(tage / 30) bereits 2, und „seit 1 Monat" waere unerreichbarer
  // toter Zweig. Beim Testen aufgefallen — die Einzahl liess sich nicht
  // ausloesen.
  if (wochen < 8) return `seit ${wochen} Wochen`;

  const monate = Math.floor(tage / 30);
  return `seit ${monate} ${monate === 1 ? 'Monat' : 'Monaten'}`;
}
