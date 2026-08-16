/**
 * Verfuegbarkeit des Anbieters, stundenweise (Migration 0740).
 *
 * Bis 16.08.2026 lagen die Frei/Gesperrt-Markierungen des Kalenders nur im
 * Bildschirmzustand — und wurden von NICHTS gelesen. Weder der Terminvorschlag
 * noch das Matching haben je gefragt, ob der Anbieter zu dieser Stunde kann.
 * Ein Anbieter konnte den Freitag sperren und bekam weiter Vorschlaege fuer
 * Freitag.
 *
 * Gespeichert wird nur, was ausdruecklich FREI ist. Fehlt die Zeile, gilt die
 * Stunde als gesperrt: Verfuegbarkeit wird zugesagt, nicht unterstellt.
 */

import { supabase } from './supabase';

/** Schluessel `YYYY-MM-DD-H` — derselbe Zuschnitt wie im Kalender. */
export type SlotSchluessel = string;

export function slotSchluessel(isoTag: string, stunde: number): SlotSchluessel {
  return `${isoTag}-${stunde}`;
}

/** Alle als frei gemeldeten Stunden im Zeitraum, als Menge von Schluesseln. */
export async function ladeFreieStunden(
  providerId: string,
  vonIso: string,
  bisIso: string,
): Promise<Set<SlotSchluessel>> {
  const { data, error } = await supabase
    .from('provider_availability')
    .select('tag, stunde')
    .eq('provider_id', providerId)
    .gte('tag', vonIso)
    .lte('tag', bisIso);
  if (error || !data) return new Set();
  return new Set(data.map((r: any) => slotSchluessel(r.tag, r.stunde)));
}

/**
 * Eine Stunde freigeben oder sperren.
 *
 * Sperren heisst LOESCHEN, nicht einen Status schreiben: 'gesperrt' ist die
 * Vorgabe, und eine Zeile dafuer waere eine Zeile fuer jede Stunde, in der
 * jemand nicht arbeitet.
 */
export async function setzeStunde(
  providerId: string,
  isoTag: string,
  stunde: number,
  frei: boolean,
): Promise<boolean> {
  if (frei) {
    const { error } = await supabase
      .from('provider_availability')
      // upsert statt insert: zweimal dieselbe Stunde freigeben ist kein Fehler,
      // sondern derselbe Wunsch noch einmal.
      .upsert({ provider_id: providerId, tag: isoTag, stunde }, { onConflict: 'provider_id,tag,stunde' });
    return !error;
  }
  const { error } = await supabase
    .from('provider_availability')
    .delete()
    .eq('provider_id', providerId)
    .eq('tag', isoTag)
    .eq('stunde', stunde);
  return !error;
}

/** Alle freien Stunden eines Zeitraums sperren („Woche sperren"). */
export async function sperreZeitraum(
  providerId: string,
  vonIso: string,
  bisIso: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('provider_availability')
    .delete()
    .eq('provider_id', providerId)
    .gte('tag', vonIso)
    .lte('tag', bisIso);
  return !error;
}

/**
 * Hat der Anbieter diese Stunde als frei gemeldet?
 *
 * Bewusst nur eine Auskunft, keine Sperre: die beiden koennen sich im Chat auf
 * einen Termin ausserhalb der gemeldeten Zeiten geeinigt haben, und dann darf
 * die Plattform nicht dazwischenfahren. Was gefehlt hat, war die Information —
 * der Vorschlagende sah gar nicht, dass er eine gesperrte Stunde waehlt.
 */
export async function istAnbieterFrei(
  providerId: string,
  zeitpunktIso: string,
): Promise<boolean | null> {
  const { data, error } = await supabase.rpc('ist_anbieter_frei', {
    p_provider: providerId,
    p_zeitpunkt: zeitpunktIso,
  });
  // null heisst "nicht feststellbar" — daraus darf der Aufrufer KEINE Warnung
  // bauen. Eine Warnung, die bei jedem Netzfehler erscheint, wird weggeklickt
  // und schuetzt dann auch nicht mehr, wenn sie stimmt.
  if (error) return null;
  return data === true;
}
