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

export type ConversationSummary = {
  jobId: string;
  jobTitle: string;
  providerId: string;
  businessName: string;
  lastMessage: string;
  lastMessageAt: string;
  isFromMe: boolean;
};

/**
 * Returns one entry per contract (job) the customer has participated in that
 * has at least one message, newest conversation first.
 */
export async function getConversationList(userId: string): Promise<ConversationSummary[]> {
  const { data: contracts, error } = await supabase
    .from('contracts')
    .select('job_id, provider_id, job:jobs!job_id(title), provider:provider_profiles!provider_id(business_name)')
    .eq('customer_id', userId)
    .order('created_at', { ascending: false });

  if (error || !contracts?.length) return [];

  const rows = await Promise.all(
    contracts.map(async (c) => {
      const { data: msgs } = await supabase
        .from('messages')
        .select('body, created_at, sender_id')
        .eq('job_id', c.job_id)
        .order('created_at', { ascending: false })
        .limit(1);

      const last = msgs?.[0];
      if (!last) return null;

      return {
        jobId: c.job_id,
        jobTitle: (c.job as any)?.title ?? 'Auftrag',
        providerId: c.provider_id,
        businessName: (c.provider as any)?.business_name ?? 'Anbieter',
        lastMessage: last.body,
        lastMessageAt: last.created_at,
        isFromMe: last.sender_id === userId,
      } satisfies ConversationSummary;
    }),
  );

  return rows.filter((r): r is ConversationSummary => r !== null);
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
