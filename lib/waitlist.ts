import { supabase } from './supabase';

export async function joinWaitlist(params: {
  email: string;
  city: string;
  plz?: string;
  source?: string;
  userId?: string;
}): Promise<void> {
  const { error } = await supabase.from('waitlist').insert({
    email: params.email.trim().toLowerCase(),
    city: params.city.trim(),
    plz: params.plz?.trim() || null,
    source: params.source ?? 'landing',
    user_id: params.userId ?? null,
  });
  if (error) throw error;
}
