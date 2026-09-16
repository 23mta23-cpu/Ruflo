import { supabase } from './supabase';
import { schnitteAusZeilen, type Bewertungsschnitt } from './bewertungsschnitt';
export { schnitteAusZeilen, type Bewertungsschnitt };

export async function createReview(params: {
  contractId: string;
  reviewedId: string;
  reviewerId: string;
  rating: number;
  comment?: string;
}): Promise<void> {
  const { error } = await supabase.from('reviews').insert({
    contract_id: params.contractId,
    reviewed_id: params.reviewedId,
    reviewer_id: params.reviewerId,
    rating: params.rating,
    comment: params.comment ?? null,
  });
  if (error) throw error;
}

/**
 * Die einmalige Antwort der bewerteten Person speichern.
 *
 * Der Zeitstempel wird NICHT mitgeschickt: ihn setzt der Trigger aus
 * 0930. Ein Client, der ihn selbst setzen darf, kann eine Antwort
 * nachträglich alt aussehen lassen. Aus demselben Grund erlaubt die
 * Spaltenberechtigung dort nur `antwort` — `rating` und `comment` bleiben
 * unantastbar, sonst könnte die bewertete Person die Bewertung umschreiben,
 * die ihr nicht gefällt.
 */
export async function antwortSpeichern(reviewId: string, antwort: string): Promise<void> {
  const text = antwort.trim();
  if (!text) throw new Error('Bitte schreiben Sie zuerst eine Antwort.');
  const { error } = await supabase
    .from('reviews')
    .update({ antwort: text })
    .eq('id', reviewId);
  if (error) throw error;
}

/**
 * Welche Vertraege habe ich bereits bewertet?
 *
 * Gebraucht, damit ein Bildschirm keinen Knopf „bewerten" anbietet, den der
 * Server danach am Unique-Index (contract_id, reviewer_id) abweist. Ein Knopf,
 * der in einen Fehler fuehrt, ist kein Angebot.
 */
export async function meineBewerteteVertraege(reviewerId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('reviews')
    .select('contract_id')
    .eq('reviewer_id', reviewerId);
  if (error) throw error;
  return new Set((data ?? []).map((r: { contract_id: string }) => r.contract_id));
}

/**
 * Bewertungen MEHRERER Personen auf einen Schlag, als Durchschnitt und Anzahl.
 *
 * ANLASS (16.09.2026): Mit der Gegenbewertung schreibt ein Betrieb eine
 * Bewertung ueber einen Kunden -- und bis hierhin sah die niemand. Ein
 * Knopf, dessen Ergebnis nirgends auftaucht, ist dieselbe Klasse wie ein
 * Knopf ohne `onPress`. `provider_profiles.rating_avg` gibt es nur fuer
 * Anbieter; fuer Kunden wird hier gerechnet statt eine Spalte zu fuehren,
 * die jemand setzen koennte, ohne dass sie wirkt.
 */
export async function bewertungsschnitte(
  personenIds: string[],
): Promise<Record<string, Bewertungsschnitt>> {
  const ids = Array.from(new Set(personenIds.filter(Boolean)));
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from('reviews')
    .select('reviewed_id, rating')
    .in('reviewed_id', ids);
  if (error) throw error;

  return schnitteAusZeilen((data ?? []) as { reviewed_id: string; rating: number }[]);
}
