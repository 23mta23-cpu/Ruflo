import { supabase } from './supabase';

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
