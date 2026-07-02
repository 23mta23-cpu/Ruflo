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
        `Ihr Angebot fuer "${jobTitle}" wurde angenommen - Vertrag erstellt.`,
        { screen: '/(provider)/auftraege', contractId: contract.id },
      );
    });

  return contract;
}
