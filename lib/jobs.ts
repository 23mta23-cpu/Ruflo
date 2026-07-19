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
  categoryId?: string;
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
      // Kategorie-ID zusätzlich zum Anzeige-Label — Grundlage fürs
      // Anbieter-Matching (notify-matching-providers, BUG 9).
      category_id: params.categoryId ?? null,
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

/**
 * Offenen Auftrag bearbeiten (nur Titel/Beschreibung — mehr wird nicht
 * persistiert). RLS erlaubt das nur dem Owner und nur bei status='open'
 * (Migration 0460); .select().single() macht ein stilles RLS-No-op als
 * Fehler sichtbar.
 */
export async function updateOpenJob(
  jobId: string,
  patch: { title?: string; description?: string },
): Promise<Job> {
  const { data, error } = await supabase
    .from('jobs')
    .update(patch)
    .eq('id', jobId)
    .eq('status', 'open')
    .select()
    .single();
  if (error) throw error;
  return data as Job;
}

/** Offenen Auftrag stornieren (vor Vertrags-Annahme; danach cancel-contract). */
export async function cancelOpenJob(jobId: string, reason: string): Promise<void> {
  const { error, data } = await supabase
    .from('jobs')
    .update({ status: 'cancelled', cancel_reason: reason })
    .eq('id', jobId)
    .eq('status', 'open')
    .select('id')
    .single();
  if (error) throw error;
  if (!data) throw new Error('Auftrag nicht stornierbar');
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
