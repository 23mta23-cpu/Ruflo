// DSA — Melde- und Abhilfeverfahren (Art. 16) und Begründung (Art. 17).
//
// Der Meldeweg läuft bewusst über eine Edge Function und nicht direkt über
// PostgREST: die Tabelle inhalts_meldungen hat kein Insert-Recht für anon oder
// authenticated (0810). Der Grund steht dort — ein anonym beschreibbarer Tisch
// wäre binnen Tagen voll Müll, und Art. 16 Abs. 6 verlangt eine Bearbeitung,
// die dann niemand leisten kann.

import { supabase, SUPABASE_FUNCTIONS_URL } from './supabase';

export const INHALT_ARTEN = [
  { wert: 'auftrag',   label: 'Ein Auftrag' },
  { wert: 'profil',    label: 'Ein Anbieterprofil' },
  { wert: 'nachricht', label: 'Eine Nachricht' },
  { wert: 'bewertung', label: 'Eine Bewertung' },
  { wert: 'nachweis',  label: 'Ein hochgeladener Nachweis' },
  { wert: 'sonstiges', label: 'Etwas anderes' },
] as const;

export type InhaltArt = (typeof INHALT_ARTEN)[number]['wert'];

/** Untergrenzen aus Art. 16 Abs. 2 — hier gespiegelt, damit das Formular sie
 *  anzeigen kann, statt den Fehler erst vom Server zu holen. Die verbindliche
 *  Prüfung steht in der Edge Function und im CHECK der Tabelle. */
export const MIN_BEGRUENDUNG = 30;
export const MIN_FUNDSTELLE = 3;

export type MeldungEingabe = {
  inhaltArt: InhaltArt;
  inhaltId?: string | null;
  fundstelle: string;
  begruendung: string;
  melderName: string;
  melderEmail: string;
  treuUndGlauben: boolean;
  straftatVerdacht?: boolean;
};

export type MeldungQuittung = { id: string; eingegangenAm: string };

/**
 * Reicht eine Meldung nach Art. 16 DSA ein.
 *
 * Funktioniert OHNE Anmeldung. Liegt eine Sitzung vor, wird ihr Token
 * mitgeschickt und die Meldung der Person zugeordnet — dann sieht sie ihre
 * Meldung später in der App wieder.
 */
export async function meldeInhalt(eingabe: MeldungEingabe): Promise<MeldungQuittung> {
  if (!eingabe.treuUndGlauben) {
    throw new Error('Ohne die Erklärung in gutem Glauben kann die Meldung nicht bearbeitet werden.');
  }

  const kopf: Record<string, string> = { 'Content-Type': 'application/json' };
  // Fehlt die Sitzung oder ist sie abgelaufen, wird ohne Token gemeldet —
  // der Weg darf nicht an einer alten Anmeldung scheitern.
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) kopf.Authorization = `Bearer ${data.session.access_token}`;
  } catch {
    // bewusst leer
  }

  const antwort = await fetch(`${SUPABASE_FUNCTIONS_URL}/inhalts-meldung`, {
    method: 'POST',
    headers: kopf,
    body: JSON.stringify({
      inhaltArt: eingabe.inhaltArt,
      inhaltId: eingabe.inhaltId ?? null,
      fundstelle: eingabe.fundstelle.trim(),
      begruendung: eingabe.begruendung.trim(),
      melderName: eingabe.melderName.trim(),
      melderEmail: eingabe.melderEmail.trim(),
      treuUndGlauben: true,
      straftatVerdacht: eingabe.straftatVerdacht === true,
    }),
  });

  if (antwort.status === 429) {
    throw new Error('Es sind zu viele Meldungen in kurzer Zeit eingegangen. Bitte später erneut versuchen.');
  }
  if (!antwort.ok) {
    const text = await antwort.text().catch(() => '');
    throw new Error(text || 'Die Meldung konnte nicht übermittelt werden.');
  }
  return (await antwort.json()) as MeldungQuittung;
}

export type Beschraenkung = {
  id: string;
  art: string;
  erteilt_am: string;
  aufgehoben_am: string | null;
};

/** Die eigenen Beschränkungen — Art. 17 gibt dem Betroffenen ein Recht darauf. */
export async function meineBeschraenkungen(): Promise<Beschraenkung[]> {
  const { data, error } = await supabase
    .from('beschraenkungen')
    .select('id, art, erteilt_am, aufgehoben_am')
    .order('erteilt_am', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Beschraenkung[];
}

/** Die vollständige Begründung nach Art. 17 Abs. 3 als übermittelbarer Text. */
export async function begruendungLesen(id: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('beschraenkung_begruendung', { p_id: id });
  if (error) throw error;
  return (data as string | null) ?? null;
}
