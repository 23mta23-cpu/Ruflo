import { supabase } from './supabase';

export async function joinWaitlist(params: {
  email: string;
  city: string;
  plz?: string;
  source?: string;
  userId?: string;
}): Promise<void> {
  const email = params.email.trim().toLowerCase();
  const { error } = await supabase.from('waitlist').insert({
    email,
    city: params.city.trim(),
    plz: params.plz?.trim() || null,
    source: params.source ?? 'landing',
    user_id: params.userId ?? null,
  });
  if (error) throw error;

  // Fire-and-forget: trigger the double-opt-in confirmation mail (UWG §7).
  // Signup must not fail if the mail service is down — the entry simply
  // stays unconfirmed and gets no marketing mail.
  supabase.functions
    .invoke('waitlist-doi', { body: { email } })
    .catch((e) => console.warn('waitlist-doi invoke failed:', e));
}
