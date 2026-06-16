// Provider profile types and AsyncStorage-backed persistence.
// Supabase upgrade path: replace load/save with SELECT/UPSERT on
// provider_profiles table using supabase-js once credentials are wired.

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ProviderProfile {
  business_name: string;
  bio: string;
  phone: string;
  trade_id: string | null;
  min_hourly_rate: number;
  radius_km: number;
  category_ids: string[];
  available: boolean;
  stripe_onboarded: boolean;   // NEVER set client-side — webhook only (ADR-0004)
  kyc_verified: boolean;
  rating_avg: number;
  rating_count: number;
}

/** Only these fields may be patched by the provider client */
export type ProfilePatch = {
  business_name?: string | null;
  bio?: string | null;
  phone?: string;
  trade_id?: string | null;
  min_hourly_rate?: number;
  radius_km?: number;
  category_ids?: string[];
  available?: boolean;
};

const KEY = 'werkr_provider_profile_v1';

const DEFAULTS: ProviderProfile = {
  business_name: '',
  bio: '',
  phone: '',
  trade_id: null,
  min_hourly_rate: 13,
  radius_km: 15,
  category_ids: [],
  available: true,
  stripe_onboarded: false,
  kyc_verified: false,
  rating_avg: 0,
  rating_count: 0,
};

export async function loadProviderProfile(): Promise<ProviderProfile> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<ProviderProfile>) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

/** Accepts optional userId arg (ignored in local-storage mode; used for Supabase upgrade path) */
export async function getMyProviderProfile(_userId?: string): Promise<ProviderProfile> {
  return loadProviderProfile();
}

export async function updateProviderProfile(_userIdOrPatch: string | ProfilePatch, patch?: ProfilePatch): Promise<void> {
  const resolvedPatch: ProfilePatch = typeof _userIdOrPatch === 'string' ? (patch ?? {}) : _userIdOrPatch;
  const current = await loadProviderProfile();
  const next = { ...current, ...resolvedPatch } as ProviderProfile;
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}
