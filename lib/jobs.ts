import { supabase } from './supabase';
import type { Job, Profile } from './database.types';

// ── Types ─────────────────────────────────────────────────────

export type JobWithCustomer = Job & { customer: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> };

// ── Queries ───────────────────────────────────────────────────

export async function getMyJobsAsCustomer(customerId: string): Promise<Job[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getOpenJobs(plz?: string): Promise<Job[]> {
  let query = supabase
    .from('jobs')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(30);

  if (plz) {
    query = query.eq('address_plz', plz);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

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

// ── Formatters ────────────────────────────────────────────────

export function jobStatusLabel(status: Job['status']): string {
  const map: Record<Job['status'], string> = {
    open: 'Offen',
    matched: 'Anbieter gefunden',
    contracted: 'Vertraglich',
    in_progress: 'In Bearbeitung',
    completed: 'Abgeschlossen',
    cancelled: 'Storniert',
    disputed: 'Streitfall',
  };
  return map[status] ?? status;
}

export function jobStatusColor(status: Job['status']): string {
  const map: Record<Job['status'], string> = {
    open: '#3b82f6',
    matched: '#8b5cf6',
    contracted: '#f59e0b',
    in_progress: '#10b981',
    completed: '#6b7280',
    cancelled: '#ef4444',
    disputed: '#ef4444',
  };
  return map[status] ?? '#6b7280';
}
