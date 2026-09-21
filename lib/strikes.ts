/**
 * Strike-Akte des Anbieters (Migration 0720).
 *
 * Bis 16.08.2026 gab es nur einen Zaehler auf provider_profiles. Aus einer
 * Zahl laesst sich weder eine Begruendung erzeugen noch eine Frist berechnen —
 * beides schuldet Werkant aber:
 *
 *   AGB §7(3)  "3 Strikes INNERHALB VON 12 MONATEN"  → Frist, also Zeitpunkte
 *   AGB §7(4)  Begruendung mit den massgeblichen Tatsachen, spaetestens zum
 *              Zeitpunkt der Massnahme (Art. 4 P2B-VO (EU) 2019/1150)
 *   AGB §7(5)  Beschwerdeweg
 *
 * Der Anbieter darf ausschliesslich SEINE eigenen Strikes lesen (RLS in 0720).
 */

import { supabase } from './supabase';

export type StrikeGrund =
  | 'kontaktdaten_umgehung'
  | 'preiserhoehung'
  | 'nichterscheinen'
  | 'falsche_angaben'
  | 'sonstiges';

export const STRIKE_GRUND_LABEL: Record<StrikeGrund, string> = {
  kontaktdaten_umgehung: 'Kontakt oder Zahlung außerhalb von Werkant',
  preiserhoehung:        'Preiserhöhung nach Vertragsabschluss',
  nichterscheinen:       'Nicht erschienen, ohne abzusagen',
  falsche_angaben:       'Falsche Angaben oder Nachweise',
  sonstiges:             'Sonstiger Verstoß',
};

export interface Strike {
  id: string;
  grund: StrikeGrund;
  begruendung: string;
  erteilt_am: string;
  verfaellt_am: string;
  aufgehoben_am: string | null;
}

/** Nur die Strikes, die gerade zaehlen: nicht verfallen, nicht aufgehoben. */
export function istAktiv(s: Strike, jetzt: Date = new Date()): boolean {
  return s.aufgehoben_am === null && new Date(s.verfaellt_am) > jetzt;
}

/** Tage bis zum Verfall, aufgerundet. 0, wenn bereits verfallen. */
export function tageBisVerfall(s: Strike, jetzt: Date = new Date()): number {
  const ms = new Date(s.verfaellt_am).getTime() - jetzt.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}

export async function getMeineStrikes(providerId: string): Promise<Strike[]> {
  const { data, error } = await supabase
    .from('provider_strikes')
    .select('id, grund, begruendung, erteilt_am, verfaellt_am, aufgehoben_am')
    .eq('provider_id', providerId)
    .order('erteilt_am', { ascending: false });
  // Der Fehler MUSS heraus. Bis zum 21.09.2026 stand hier `return []`, und
  // das Dashboard blendet die Strike-Leiste bei einer leeren Liste komplett
  // aus (`aktive.length === 0` -> `return null`). Ein GESPERRTER Betrieb sah
  // damit bei einem Netzfehler ein sauberes Dashboard: er kann nicht bieten
  // und erfaehrt nicht, warum.
  //
  // Genau daneben steht im Dashboard der Kommentar, der die Anzeige mit
  // Art. 4 P2B-VO begruendet („ohne zu wissen, was vorgeworfen wird, kann
  // niemand nach §7(5) Beschwerde einlegen"). Dieselbe Klasse wie die
  // Posteingaenge vom selben Tag: eine Absicht im Kommentar, die der Code
  // darunter aushebelt.
  if (error) throw error;
  return (data ?? []) as Strike[];
}
