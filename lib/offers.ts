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
