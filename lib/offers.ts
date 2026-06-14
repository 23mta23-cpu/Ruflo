import { supabase } from './supabase';
import { calcHandwerkerFees, calcNachbarschaftFees } from './feeEngine';
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
  const { data: offer, error: offerErr } = await supabase
    .from('offers')
    .select('*')
    .eq('id', offerId)
    .single();
  if (offerErr) throw offerErr;

  const { data: job, error: jobErr } = await supabase
    .from('jobs')
    .select('track')
    .eq('id', jobId)
    .single();
  if (jobErr) throw jobErr;

  const price = offer.price;

  let werkrSchutzFee: number;
  let customerServiceFee: number;
  let providerCommission: number;
  let customerTotal: number;
  let providerPayout: number;

  if (job.track === 'nachbarschaft') {
    const fees = calcNachbarschaftFees(price);
    werkrSchutzFee = fees.werkrSchutz;
    customerServiceFee = 0;
    providerCommission = 0;
    customerTotal = fees.customerTotal;
    providerPayout = fees.providerPayout;
  } else {
    const fees = calcHandwerkerFees(price, false);
    werkrSchutzFee = 0;
    customerServiceFee = fees.customerServiceFee;
    providerCommission = fees.providerCommission;
    customerTotal = fees.customerTotal;
    providerPayout = fees.providerPayout;
  }

  const { data: contract, error: contractErr } = await supabase
    .from('contracts')
    .insert({
      job_id: jobId,
      offer_id: offerId,
      customer_id: customerId,
      provider_id: offer.provider_id,
      price_gross: price,
      werkr_schutz_fee: werkrSchutzFee,
      customer_service_fee: customerServiceFee,
      provider_commission: providerCommission,
      customer_total: customerTotal,
      provider_payout: providerPayout,
      track: job.track,
    })
    .select()
    .single();
  if (contractErr) throw contractErr;

  await supabase.from('offers').update({ status: 'accepted' }).eq('id', offerId);
  await supabase.from('offers').update({ status: 'declined' }).eq('job_id', jobId).neq('id', offerId).eq('status', 'pending');
  await supabase.from('jobs').update({ status: 'contracted', provider_id: offer.provider_id }).eq('id', jobId);

  return contract;
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
