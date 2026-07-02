import { supabase } from './supabase';
import type { Contract, Job, Offer } from './database.types';

// ── Types ─────────────────────────────────────────────────────

export type ContractWithOffer = Contract & {
  offer: Pick<Offer, 'id' | 'price' | 'description' | 'duration_hours'>;
};

export type ContractWithJobAndCustomer = Contract & {
  job: Pick<Job, 'id' | 'title' | 'category' | 'address_city' | 'address_plz' | 'status'>;
  customer: { full_name: string | null } | null;
};

export type ContractWithJobAndProvider = Contract & {
  job: Pick<Job, 'id' | 'title' | 'category' | 'address_city' | 'address_plz' | 'status'>;
  provider: { business_name: string | null; rating_avg: number; rating_count: number } | null;
};

export type ContractFull = Contract & {
  job: Pick<Job, 'id' | 'title' | 'category' | 'address_city' | 'address_plz' | 'status'>;
  customer: { full_name: string | null } | null;
  provider: { business_name: string | null } | null;
};

// ── Queries ───────────────────────────────────────────────────

export async function getMyContractsAsProvider(providerId: string): Promise<ContractWithJobAndCustomer[]> {
  const { data, error } = await supabase
    .from('contracts')
    .select('*, job:jobs(id, title, category, address_city, address_plz, status), customer:profiles!customer_id(full_name)')
    .eq('provider_id', providerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as ContractWithJobAndCustomer[];
}

export async function getContractByJobId(jobId: string): Promise<ContractWithJobAndProvider | null> {
  const { data, error } = await supabase
    .from('contracts')
    .select('*, job:jobs(id, title, category, address_city, address_plz, status), provider:provider_profiles!provider_id(business_name, rating_avg, rating_count)')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as ContractWithJobAndProvider | null;
}

export async function getMyContractsAsCustomerFull(customerId: string): Promise<ContractWithJobAndProvider[]> {
  const { data, error } = await supabase
    .from('contracts')
    .select('*, job:jobs(id, title, category, address_city, address_plz, status), provider:provider_profiles!provider_id(business_name, rating_avg, rating_count)')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as ContractWithJobAndProvider[];
}

export async function getContractByIdFull(contractId: string): Promise<ContractFull | null> {
  const { data, error } = await supabase
    .from('contracts')
    .select('*, job:jobs!job_id(id, title, category, address_city, address_plz, status), customer:profiles!customer_id(full_name), provider:provider_profiles!provider_id(business_name)')
    .eq('id', contractId)
    .maybeSingle();

  if (error) return null;
  return data as unknown as ContractFull | null;
}

// completeContract() intentionally removed — contracts.status='completed' may ONLY
// be set by the release-escrow Edge Function after successful Stripe payout.
// cancelContract() intentionally removed — cancellation must go through the
// cancel-contract Edge Function to handle Stripe refunds, job reopen, and push.

