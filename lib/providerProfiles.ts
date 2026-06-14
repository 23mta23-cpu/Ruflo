// Provider profile types and AsyncStorage-backed persistence.
// Supabase upgrade path: replace load/save with SELECT/UPSERT on
// provider_profiles table using supabase-js once credentials are wired.

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ProviderProfile {
  business_name: string;
  bio: string;
  phone: string;
  min_hourly_rate: number;
  radius_km: number;
  category_ids: string[];
  available: boolean;
  stripe_onboarded: boolean;   // NEVER set client-side — webhook only (ADR-0004)
  kyc_verified: boolean;
}

/** Only these fields may be patched by the provider client */
export type ProfilePatch = Partial<Pick<ProviderProfile,
  'business_name' | 'bio' | 'phone' | 'min_hourly_rate' | 'radius_km' | 'category_ids' | 'available'
>>;

const KEY = 'werkr_provider_profile_v1';

const DEFAULTS: ProviderProfile = {
  business_name: '',
  bio: '',
  phone: '',
  min_hourly_rate: 13,
  radius_km: 15,
  category_ids: [],
  available: true,
  stripe_onboarded: false,
  kyc_verified: false,
};

export async function loadProviderProfile(): Promise<ProviderProfile> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<ProviderProfile>) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function updateProviderProfile(patch: ProfilePatch): Promise<void> {
  const current = await loadProviderProfile();
  const next: ProviderProfile = { ...current, ...patch };
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}
