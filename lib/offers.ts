import { supabase } from './supabase';
import type { Offer, Job, Contract } from './database.types';

// ── Types ─────────────────────────────────────────────────────

export type OfferWithJob = Offer & { job: Pick<Job, 'id' | 'title' | 'category' | 'address_city' | 'address_plz' | 'status'> };

// ── Queries ───────────────────────────────────────────────────

export async function getMyOffersAsProvider(providerId: string): Promise<OfferWithJob[]> {
  const { data, error } = await supabase
    .from('offers')
    .select('*, job:jobs(id, title, category, address_city, address_plz, status)')
    .eq('provider_id', providerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as OfferWithJob[];
}

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
}): Promise<Offer> {
  const { data, error } = await supabase
    .from('offers')
    .insert({
      job_id: params.jobId,
      provider_id: params.providerId,
      price: params.price,
      description: params.description ?? null,
      duration_hours: params.durationHours ?? null,
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
  customerId: string,
): Promise<Contract> {
  const { data, error } = await supabase
    .rpc('accept_offer', {
      p_offer_id: offerId,
      p_job_id: jobId,
      p_customer_id: customerId,
    })
    .single();
  if (error) throw error;
  return data as Contract;
}

export async function withdrawOffer(offerId: string): Promise<void> {
  const { error } = await supabase
    .from('offers')
    .update({ status: 'declined' })
    .eq('id', offerId);

  if (error) throw error;
}

// ── Formatters ────────────────────────────────────────────────

export function offerStatusLabel(status: Offer['status']): string {
  const map: Record<Offer['status'], string> = {
    pending: 'Ausstehend',
    accepted: 'Angenommen',
    declined: 'Abgelehnt',
    expired: 'Abgelaufen',
  };
  return map[status] ?? status;
}

export function offerStatusVariant(status: Offer['status']): 'green' | 'amber' | 'red' | 'muted' {
  const map: Record<Offer['status'], 'green' | 'amber' | 'red' | 'muted'> = {
    pending: 'amber',
    accepted: 'green',
    declined: 'red',
    expired: 'muted',
  };
  return map[status] ?? 'muted';
}
