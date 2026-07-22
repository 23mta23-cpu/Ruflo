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
  read_at?: string | null;
  // Thread-Schlüssel (Migration 0510): eine Konversation ist (job, provider).
  // Erlaubt Vor-Vertrags-Rückfragen mehrerer Anbieter am selben Auftrag.
  provider_id?: string | null;
  // Nachrichtentyp (Migration 0520): text | system | appointment.
  type?: 'text' | 'system' | 'appointment';
};

/**
 * Markiert alle fremden Nachrichten eines Jobs als gelesen (Migration 0490).
 * Security-definer-RPC prüft serverseitig, dass der Aufrufer Job-Partei ist.
 * Fehler sind unkritisch (Badge bleibt dann stehen) — nicht werfen.
 */
export async function markMessagesRead(jobId: string, providerId?: string): Promise<void> {
  const { error } = await supabase.rpc('mark_messages_read', {
    p_job_id: jobId,
    p_provider_id: providerId ?? null,
  });
  if (error) console.warn('[messages] markMessagesRead error:', error.message);
}

/**
 * Anzahl ungelesener fremder Nachrichten pro Job (RLS begrenzt ohnehin auf
 * eigene Jobs). Ein Query für alle Konversationen statt N Einzel-Counts.
 */
export async function getUnreadCounts(userId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('messages')
    .select('job_id, provider_id')
    .is('read_at', null)
    .neq('sender_id', userId);
  if (error || !data) return {};
  // Schlüssel = `${job_id}:${provider_id}` — ein Thread pro (Auftrag, Anbieter).
  const counts: Record<string, number> = {};
  for (const row of data as { job_id: string; provider_id: string | null }[]) {
    const key = `${row.job_id}:${row.provider_id ?? ''}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/**
 * Fetch messages for a conversation, ordered ascending by creation time.
 * Ein Thread ist (job, provider): mit providerId wird auf genau diesen
 * Anbieter-Thread gefiltert (Vor-Vertrags-Rückfragen, Migration 0510).
 */
export async function getMessagesForJob(jobId: string, providerId?: string): Promise<MessageRow[]> {
  let q = supabase
    .from('messages')
    .select('id, job_id, sender_id, sender_role, body, created_at, provider_id, type')
    .eq('job_id', jobId);
  if (providerId) q = q.eq('provider_id', providerId);

  const { data, error } = await q.order('created_at', { ascending: true });

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
  providerId: string,
): Promise<MessageRow | null> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ job_id: jobId, sender_id: senderId, sender_role: senderRole, body, provider_id: providerId })
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
  unreadCount: number;
};

/**
 * Kunden-Inbox: eine Zeile pro (Auftrag, Anbieter)-Thread mit mindestens einer
 * Nachricht, neueste zuerst. Nachrichten-basiert statt vertrags-basiert, damit
 * auch Vor-Vertrags-Rückfragen erscheinen (Migration 0510). RLS liefert dem
 * Kunden ohnehin nur Threads seiner eigenen Aufträge.
 */
export async function getConversationList(userId: string): Promise<ConversationSummary[]> {
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, title')
    .eq('customer_id', userId);
  if (!jobs?.length) return [];

  const jobIds = jobs.map((j: any) => j.id);
  const titleByJob = new Map<string, string>(jobs.map((j: any) => [j.id, j.title ?? 'Auftrag']));

  const { data: msgs, error } = await supabase
    .from('messages')
    .select('job_id, provider_id, body, created_at, sender_id')
    .in('job_id', jobIds)
    .order('created_at', { ascending: false });
  if (error || !msgs?.length) return [];

  const unread = await getUnreadCounts(userId);

  // Neueste Nachricht je (job, provider) behalten (Liste ist bereits desc).
  const seen = new Set<string>();
  const threads: { jobId: string; providerId: string; last: any }[] = [];
  for (const m of msgs as any[]) {
    if (!m.provider_id) continue;
    const key = `${m.job_id}:${m.provider_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    threads.push({ jobId: m.job_id, providerId: m.provider_id, last: m });
  }
  if (!threads.length) return [];

  // Anbieternamen in einem Query nachladen.
  const providerIds = Array.from(new Set(threads.map((t) => t.providerId)));
  const { data: provs } = await supabase
    .from('provider_public')
    .select('id, business_name')
    .in('id', providerIds);
  const nameById = new Map<string, string>((provs ?? []).map((p: any) => [p.id, p.business_name ?? 'Anbieter']));

  return threads.map((t) => ({
    jobId: t.jobId,
    jobTitle: titleByJob.get(t.jobId) ?? 'Auftrag',
    providerId: t.providerId,
    businessName: nameById.get(t.providerId) ?? 'Anbieter',
    lastMessage: t.last.body,
    lastMessageAt: t.last.created_at,
    isFromMe: t.last.sender_id === userId,
    unreadCount: unread[`${t.jobId}:${t.providerId}`] ?? 0,
  } satisfies ConversationSummary));
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
