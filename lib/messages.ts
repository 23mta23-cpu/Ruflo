// Messages data-layer — Supabase-backed.
// Table: messages (id, job_id, sender_id, sender_role, body, created_at)
// RLS: users can only read/write messages where their user_id matches sender_id
//      OR where they are a party to the job (job.customer_id or job.provider_id).
// Realtime: enabled via migration 008_enable_realtime_messages.sql

import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export type MessageRow = {
  id: string;
  job_id: string;
  sender_id: string;
  sender_role: 'customer' | 'provider';
  body: string;
  created_at: string;
};

/** Fetch all messages for a job, ordered ascending by creation time. */
export async function getMessagesForJob(jobId: string): Promise<MessageRow[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, job_id, sender_id, sender_role, body, created_at')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('[messages] getMessagesForJob error:', error.message);
    return [];
  }
  return (data ?? []) as MessageRow[];
}

/** Send a message for a job. sender_id is the currently authenticated user. */
export async function sendMessage(
  jobId: string,
  senderId: string,
  senderRole: 'customer' | 'provider',
  body: string,
): Promise<MessageRow | null> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ job_id: jobId, sender_id: senderId, sender_role: senderRole, body })
    .select()
    .single();

  if (error) {
    console.warn('[messages] sendMessage error:', error.message);
    return null;
  }
  return data as MessageRow;
}

/**
 * Subscribe to new messages for a job via Supabase Realtime.
 * Returns the channel — caller must call channel.unsubscribe() on cleanup.
 */
export function subscribeToMessages(
  jobId: string,
  onNewMessage: (msg: MessageRow) => void,
): RealtimeChannel {
  return supabase
    .channel(`messages:job_id=eq.${jobId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `job_id=eq.${jobId}`,
      },
      (payload) => onNewMessage(payload.new as MessageRow),
    )
    .subscribe();
}
