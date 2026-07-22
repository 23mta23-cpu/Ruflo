// Terminvorschläge im Chat (Migration 0520). Server-autoritativ über RPCs —
// der Client kann Status/Termin nicht fälschen.
import { supabase } from './supabase';

export type AppointmentProposal = {
  id: string;
  job_id: string;
  provider_id: string;
  proposed_by: string;
  proposed_at: string;
  status: 'pending' | 'accepted' | 'rejected' | 'superseded';
  created_at: string;
};

/** Termin vorschlagen. Gibt die Vorschlag-ID zurück oder null bei Fehler. */
export async function proposeAppointment(
  jobId: string,
  providerId: string,
  whenISO: string,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('propose_appointment', {
    p_job_id: jobId,
    p_provider_id: providerId,
    p_when: whenISO,
  });
  if (error) {
    console.warn('[appointments] proposeAppointment error:', error.message);
    return null;
  }
  return data as string;
}

/** Auf einen Terminvorschlag antworten (annehmen/ablehnen). */
export async function respondAppointment(
  proposalId: string,
  accept: boolean,
): Promise<boolean> {
  const { error } = await supabase.rpc('respond_appointment', {
    p_proposal_id: proposalId,
    p_accept: accept,
  });
  if (error) {
    console.warn('[appointments] respondAppointment error:', error.message);
    return false;
  }
  return true;
}

/** Alle Terminvorschläge eines (job, provider)-Threads. */
export async function getProposalsForThread(
  jobId: string,
  providerId: string,
): Promise<AppointmentProposal[]> {
  const { data, error } = await supabase
    .from('appointment_proposals')
    .select('id, job_id, provider_id, proposed_by, proposed_at, status, created_at')
    .eq('job_id', jobId)
    .eq('provider_id', providerId)
    .order('created_at', { ascending: true });
  if (error) {
    console.warn('[appointments] getProposalsForThread error:', error.message);
    return [];
  }
  return (data ?? []) as AppointmentProposal[];
}
