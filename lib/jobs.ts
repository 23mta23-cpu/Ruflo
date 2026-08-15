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
  // BEWUSST nicht optional. Ein `?` hat die Straße von #140 bis 16.08.2026
  // stillschweigend verschwinden lassen: der einzige Aufrufer hat sie schlicht
  // nicht übergeben, und der Typprüfer hatte keinen Grund zu widersprechen.
  // Als Pflichtfeld ist das Weglassen ein Übersetzungsfehler. Ein leerer String
  // bleibt erlaubt (unten abgefangen) — das ist dann eine Entscheidung, kein
  // Versehen.
  addressStreet: string;
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
      track: params.track ?? 'handwerker',
      status: 'open',
    })
    .select()
    .single();

  if (error) throw error;
  // Straße getrennt speichern (Migration 0570): nur Kunde + zugewiesener
  // Anbieter dürfen sie lesen — Bieter sehen vor der Vergabe nur Stadt/PLZ.
  if (params.addressStreet && data?.id) {
    const { error: addrError } = await supabase
      .from('job_addresses')
      .insert({ job_id: data.id, address_street: params.addressStreet });
    // Bis 16.08.2026 wurde dieser Fehler verschluckt. Solange die Straße gar
    // nicht erhoben wurde, fiel das nicht auf; jetzt ist sie Pflichtfeld, und
    // ein stiller Verlust heißt: der Handwerker fährt nirgendwohin. Der
    // Auftrag selbst steht aber schon in der Datenbank — ihn mit einem
    // gewöhnlichen Fehler zu quittieren würde den Kunden zum zweiten Absenden
    // verleiten und einen Doppel-Auftrag erzeugen. Deshalb ein eigener
    // Fehlertyp, den der Wizard als "angelegt, aber Adresse fehlt" behandelt.
    if (addrError) throw new JobAddressNotSavedError(data);
  }
  return data;
}

/**
 * Der Auftrag wurde angelegt, nur die Straße nicht. `job` ist der bereits
 * gespeicherte Auftrag — der Aufrufer darf NICHT erneut anlegen.
 */
export class JobAddressNotSavedError extends Error {
  readonly job: Job;
  constructor(job: Job) {
    super('Auftrag angelegt, Adresse konnte nicht gespeichert werden');
    this.name = 'JobAddressNotSavedError';
    this.job = job;
  }
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
