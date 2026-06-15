import { supabase } from './supabase';
import type { Database } from './database.types';

export type ProviderProfile = Database['public']['Tables']['provider_profiles']['Row'];

export async function getMyProviderProfile(userId: string): Promise<ProviderProfile | null> {
  const { data, error } = await supabase
    .from('provider_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateProviderProfile(
  userId: string,
  patch: Partial<Pick<ProviderProfile, 'available' | 'bio' | 'business_name' | 'trade_id'>>,
): Promise<void> {
  const { error } = await supabase
    .from('provider_profiles')
    .update(patch)
    .eq('id', userId);

  if (error) throw error;
}
