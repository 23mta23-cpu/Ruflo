// Provider profile storage — Supabase-backed with AsyncStorage fallback
// for fields not yet in DB schema (min_hourly_rate, category_ids, radius_km, phone).
// ADR-0004: stripe_onboarded is NEVER written client-side.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export interface ProviderProfile {
  business_name: string;
  bio: string;
  phone: string;
  trade_id: string | null;
  min_hourly_rate: number;
  radius_km: number;
  category_ids: string[];
  available: boolean;
  stripe_onboarded: boolean;   // read-only on client — webhook only (ADR-0004)
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

const LOCAL_KEY = 'werkr_provider_extras_v2'; // local-only fields not in DB schema

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

async function getLocalExtras(): Promise<Partial<ProviderProfile>> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_KEY);
    // Also try the old key for migration
    const oldRaw = !raw ? await AsyncStorage.getItem('werkr_provider_profile_v1') : null;
    const src = raw ?? oldRaw;
    return src ? (JSON.parse(src) as Partial<ProviderProfile>) : {};
  } catch {
    return {};
  }
}

export async function loadProviderProfile(): Promise<ProviderProfile> {
  try {
    const localExtras = await getLocalExtras();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ...DEFAULTS, ...localExtras };

    const { data } = await supabase
      .from('provider_profiles')
      .select('business_name, bio, available, rating_avg, rating_count, stripe_onboarded, kyc_status, trade_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!data) return { ...DEFAULTS, ...localExtras };

    return {
      ...DEFAULTS,
      ...localExtras,
      business_name: data.business_name ?? '',
      bio: data.bio ?? '',
      available: data.available,
      rating_avg: data.rating_avg,
      rating_count: data.rating_count,
      stripe_onboarded: data.stripe_onboarded,
      kyc_verified: (data.kyc_status as string) === 'approved',
      trade_id: data.trade_id,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

/** Accepts optional userId arg (ignored — auth user inferred from session) */
export async function getMyProviderProfile(_userId?: string): Promise<ProviderProfile> {
  return loadProviderProfile();
}

export async function updateProviderProfile(
  _userIdOrPatch: string | ProfilePatch,
  patch?: ProfilePatch,
): Promise<void> {
  const resolvedPatch: ProfilePatch =
    typeof _userIdOrPatch === 'string' ? (patch ?? {}) : _userIdOrPatch;

  try {
    const { data: { user } } = await supabase.auth.getUser();

    // DB-backed fields (must match provider_profiles column names)
    const dbFields: Record<string, unknown> = {};
    if (resolvedPatch.business_name !== undefined) dbFields.business_name = resolvedPatch.business_name;
    if (resolvedPatch.bio !== undefined) dbFields.bio = resolvedPatch.bio;
    if (resolvedPatch.available !== undefined) dbFields.available = resolvedPatch.available;
    if (resolvedPatch.trade_id !== undefined) dbFields.trade_id = resolvedPatch.trade_id;

    if (user && Object.keys(dbFields).length > 0) {
      await supabase.from('provider_profiles').update(dbFields).eq('id', user.id);
    }

    // Local-only fields (not yet in DB schema)
    const localFields: Record<string, unknown> = {};
    if (resolvedPatch.min_hourly_rate !== undefined) localFields.min_hourly_rate = resolvedPatch.min_hourly_rate;
    if (resolvedPatch.radius_km !== undefined) localFields.radius_km = resolvedPatch.radius_km;
    if (resolvedPatch.category_ids !== undefined) localFields.category_ids = resolvedPatch.category_ids;
    if (resolvedPatch.phone !== undefined) localFields.phone = resolvedPatch.phone;

    if (Object.keys(localFields).length > 0) {
      const current = await getLocalExtras();
      await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify({ ...current, ...localFields }));
    }
  } catch {
    // Caller shows toast
  }
}
