// Die Pruefung der Anbieter-Verifizierung — Logik, ausfuehrbar testbar.
//
// ANLASS (Founder-Frage 14.09.2026: „Wie prueft es Werkant, muss ich das dann
// machen?"). Die Antwort war: ja, von Hand im Supabase-Dashboard, ueber Storage
// und Table-Editor, und NIEMAND sagt ihm, dass etwas wartet.
//
// WER DARF: der Server entscheidet, nicht der Bildschirm. Die Liste der
// Betreiber-Adressen steht in der Umgebungsvariablen WERKANT_ADMIN_EMAILS
// (kommagetrennt). Ist sie NICHT gesetzt, ist NIEMAND Betreiber — Standard ist
// Verweigerung. Ein Client-seitiges Routen-Gate waere Zierde; das eigentliche
// Tor steht hier.

export type Rolle = 'betreiber' | 'fremd';

/**
 * Ist dieser Anrufer Betreiber?
 *
 * Getrennt und rein, weil genau hier ein Fehler teuer ist: waere die leere
 * Liste ein Freibrief, kaeme jeder Angemeldete an fremde Gewerbescheine.
 */
export function istBetreiber(
  email: string | null | undefined,
  liste: string | null | undefined,
): boolean {
  if (!email || !liste) return false;
  const erlaubt = liste.split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
  if (erlaubt.length === 0) return false;
  return erlaubt.includes(email.trim().toLowerCase());
}

export type Entscheidung =
  | { art: 'freigeben'; providerId: string }
  | { art: 'ablehnen'; providerId: string; grund: string };

/** Untergrenze aus AGB §4 und Art. 4 P2B-VO: eine Ablehnung braucht einen Grund. */
export const MIN_GRUND = 20;

export type Pruefergebnis =
  | { ok: true; status: 'approved' | 'rejected'; grund: string | null }
  | { ok: false; fehler: string; code: number };

/**
 * Was aus einer Entscheidung wird — ohne Datenbank, damit es pruefbar ist.
 *
 * Der Grund ist bei einer Ablehnung PFLICHT und hat eine Untergrenze. Art. 4
 * Abs. 1 P2B-VO verlangt eine Begruendung; „passt nicht" ist keine. Dieselbe
 * Untergrenze steht bereits bei den Strikes (0720) und bei den Meldungen
 * (Art. 16 Abs. 2 DSA, MIN_BEGRUENDUNG in lib/dsa.ts) — hier ist sie nicht neu
 * erfunden, sondern uebernommen.
 */
export function entscheidungPruefen(e: Entscheidung): Pruefergebnis {
  if (!e.providerId || !/^[0-9a-f-]{36}$/i.test(e.providerId)) {
    return { ok: false, fehler: 'providerId fehlt oder ist keine UUID.', code: 400 };
  }
  if (e.art === 'freigeben') {
    return { ok: true, status: 'approved', grund: null };
  }
  const grund = (e.grund ?? '').trim();
  if (grund.length < MIN_GRUND) {
    return {
      ok: false,
      code: 400,
      fehler: `Eine Ablehnung braucht eine Begründung von mindestens ${MIN_GRUND} Zeichen. `
        + 'Der Betrieb muss wissen, was er ändern soll (Art. 4 P2B-VO).',
    };
  }
  return { ok: true, status: 'rejected', grund };
}

/**
 * Der Text, den der abgelehnte Betrieb bekommt.
 *
 * Er wird als Mitteilung festgehalten und zugestellt, nicht nur in eine Spalte
 * geschrieben. Genau dieser Unterschied war der Befund aus 0860: eine
 * Begruendung in einer Spalte ist keine Uebermittlung.
 */
export function ablehnungsText(grund: string): { titel: string; text: string } {
  return {
    titel: 'Ihre Verifizierung konnte nicht abgeschlossen werden',
    text: `${grund}\n\n`
      + 'Sie können die Unterlagen ergänzen und erneut einreichen; Ihr Konto '
      + 'bleibt bestehen. Halten Sie die Entscheidung für falsch, antworten Sie '
      + 'auf diese Nachricht. Eine Person sieht sie sich an.',
  };
}
