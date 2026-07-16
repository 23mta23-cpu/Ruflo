import { supabase } from './supabase';
import type { Job } from './database.types';

// ── Queries ───────────────────────────────────────────────────

export async function getJobById(id: string): Promise<Job | null> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data;
}

export async function createJob(params: {
  customerId: string;
  title: string;
  description: string;
  category: string;
  addressPlz: string;
  addressCity: string;
  addressStreet?: string;
  track?: 'handwerker' | 'nachbarschaft';
}): Promise<Job> {
  const { data, error } = await supabase
    .from('jobs')
    .insert({
      customer_id: params.customerId,
      title: params.title,
      description: params.description,
      category: params.category,
      address_plz: params.addressPlz,
      address_city: params.addressCity,
      address_street: params.addressStreet ?? null,
      track: params.track ?? 'handwerker',
      status: 'open',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export type MyOpenJob = Job & { offers: { count: number }[] };

/** Offene/gematchte Aufträge des Kunden inkl. Zahl eingegangener Angebote. */
export async function getMyOpenJobs(customerId: string): Promise<MyOpenJob[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*, offers(count)')
    .eq('customer_id', customerId)
    .in('status', ['open', 'matched'])
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as MyOpenJob[];
}
