import { supabase } from './supabase';
import type { MessageType } from './database.types';

export type DbMessage = {
  id: string;
  job_id: string;
  sender_id: string;
  content: string;
  type: MessageType;
  offer_id: string | null;
  created_at: string;
};

export async function getMessagesForJob(jobId: string): Promise<DbMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as DbMessage[];
}

export async function sendMessage(
  jobId: string,
  senderId: string,
  content: string,
): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .insert({ job_id: jobId, sender_id: senderId, content, type: 'text' as MessageType });

  if (error) throw error;
}
