import { supabase } from './supabase';
import { sendPushToUser } from './notifications';
import type { Offer, Contract } from './database.types';

// ── Queries ───────────────────────────────────────────────────

export async function getOffersForJob(jobId: string): Promise<Offer[]> {
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .eq('job_id', jobId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * Die eigenen ABGEGEBENEN Angebote, die noch auf eine Kundenantwort warten.
 *
 * ANLASS (28.09.2026, Founder am Geraet): „Zusaetzlich sehe ich nirgends, wo
 * meine aktiven Angebote sind." Sie gab es schon -- aber ausschliesslich auf
 * `/betrieb/dashboard`, als Abfrage direkt im Bildschirm. Wer unter
 * „Auftraege" suchte, fand nichts. Dieselbe Klasse wie „eine Mitteilung ohne
 * Empfaenger-Bildschirm": die Daten sind da, der Weg dorthin nicht.
 *
 * Steht hier statt zweimal im Bildschirm, damit nicht eine der beiden Kopien
 * irgendwann an einer Fehlerklasse vorbeisieht.
 *
 * WIRFT bei einem Abfragefehler. Ein leeres Feld waere sonst die Aussage
 * „Sie haben keine offenen Angebote" aus einem Netzfehler hergeleitet.
 */
export async function getMyPendingOffers(
  providerId: string,
  limit?: number,
): Promise<Array<{ offerId: string; jobId: string; title: string; price: number; createdAt: string }>> {
  let q = supabase
    .from('offers')
    .select('id, job_id, price, created_at, job:jobs!job_id(id, title)')
    .eq('provider_id', providerId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (limit !== undefined) q = q.limit(limit);

  const { data, error } = await q;
  if (error) throw error;

  // deno-lint-ignore no-explicit-any
  return (data ?? []).map((row: any) => ({
    offerId: row.id,
    jobId: row.job_id,
    // Kein Ersatztitel wie „Dienstleistung": ein erfundener Titel ist im
    // Browser von einem echten nicht zu unterscheiden (Lehre vom 21.09.).
    title: row.job?.title ?? '',
    price: Number(row.price ?? 0),
    createdAt: row.created_at,
  }));
}

export async function createOffer(params: {
  jobId: string;
  providerId: string;
  price: number;
  /**
   * Im Preis enthaltener Materialanteil. PFLICHT, nicht optional.
   *
   * ANLASS (Founder, 08.09.2026): Der Bildschirm erhob den Wert, gab ihn aber
   * nicht weiter -- es gab schlicht kein Feld dafuer. Ein optionaler Parameter
   * mit genau einem Aufrufer laesst genau das wieder zu, und `tsc` haette
   * keinen Grund zu widersprechen (dokumentierte Klasse, 16.08.2026).
   * Seit Migration 0830 ist er die Bemessungsgrundlage der Provision:
   * 8 % auf price - materialCost.
   */
  materialCost: number;
  description?: string;
  durationHours?: number;
  scheduledAt?: string | null;
}): Promise<Offer> {
  const { data, error } = await supabase
    .from('offers')
    .insert({
      job_id: params.jobId,
      provider_id: params.providerId,
      price: params.price,
      material_cost: params.materialCost,
      description: params.description ?? null,
      duration_hours: params.durationHours ?? null,
      scheduled_at: params.scheduledAt ?? null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function declineOffer(offerId: string): Promise<void> {
  const { error } = await supabase.rpc('decline_offer', { p_offer_id: offerId });
  if (error) throw error;
}

export async function acceptOffer(
  offerId: string,
  jobId: string,
): Promise<Contract> {
  const { data, error } = await supabase
    .rpc('accept_offer', {
      p_offer_id: offerId,
      p_job_id: jobId,
    })
    .single();
  if (error) throw error;
  const contract = data as Contract;

  // Notify the provider their offer was accepted (fire-and-forget).
  supabase
    .from('jobs')
    .select('title')
    .eq('id', jobId)
    .maybeSingle<{ title: string }>()
    .then(({ data: job }) => {
      const jobTitle = job?.title ?? 'Auftrag';
      sendPushToUser(
        contract.provider_id,
        'Angebot angenommen',
        `Ihr Angebot für „${jobTitle}" wurde angenommen. Der Vertrag ist erstellt.`,
        { screen: '/betrieb/auftraege', contractId: contract.id },
      );
    });

  return contract;
}
