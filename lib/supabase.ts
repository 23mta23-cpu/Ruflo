// Supabase client singleton.
// Local dev: uses localhost:54321 (supabase start).
// Production: set EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY
// in .env / EAS Secrets before build.
//
// ADR-0004 iron rule: NEVER use the service_role key on the client.
// Service-role usage is strictly limited to Deno Edge Functions.

import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;

// Production project: chnphpmpdpllnpqtvwhx.supabase.co
// Publishable (anon) key — safe to ship in client bundle (enforced by RLS).
// Override via EXPO_PUBLIC_* env vars for multi-environment builds.
// Guard: if env vars are empty strings (e.g. web build without secrets set),
// fall back to the hardcoded defaults so createClient does not throw at init time.
const envUrl = process.env['EXPO_PUBLIC_SUPABASE_URL'] ?? '';
const envKey = process.env['EXPO_PUBLIC_SUPABASE_ANON_KEY'] ?? '';

const SUPABASE_URL =
  extra['EXPO_PUBLIC_SUPABASE_URL'] ||
  envUrl ||
  'https://chnphpmpdpllnpqtvwhx.supabase.co';

const SUPABASE_ANON_KEY =
  extra['EXPO_PUBLIC_SUPABASE_ANON_KEY'] ||
  envKey ||
  'sb_publishable_VT6KsxSQDBOYJYbc4qNcgQ_t_NRrh-U';

export const isSupabaseConfigured = true;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});
