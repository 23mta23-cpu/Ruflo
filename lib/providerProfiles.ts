// Provider profile storage — fully Supabase-backed.
// Migration 010 added phone, min_hourly_rate, radius_km, category_ids to DB.
// AsyncStorage (werkr_provider_extras_v2) is read once as a migration source
// for existing users; all writes now go to the DB.
// ADR-0004: stripe_onboarded is NEVER written client-side.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export interface ProviderProfile {
  business_name: string | null;
  bio: string | null;
  phone: string | null;
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
  phone?: string | null;
  trade_id?: string | null;
  min_hourly_rate?: number;
  radius_km?: number;
  category_ids?: string[];
  available?: boolean;
  is_nachbarschaft?: boolean;
};

const LEGACY_KEY = 'werkr_provider_extras_v2';

const DEFAULTS: ProviderProfile = {
  business_name: null,
  bio: null,
  phone: null,
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

/** One-time migration: read legacy AsyncStorage data and write it to DB. */
async function migrateLegacyIfNeeded(userId: string): Promise<void> {
  try {
    for (const key of [LEGACY_KEY, 'werkr_provider_profile_v1']) {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) continue;
      const legacy = JSON.parse(raw) as Record<string, unknown>;
      const patch: Record<string, unknown> = {};
      if (typeof legacy.phone === 'string')         patch.phone = legacy.phone;
      if (typeof legacy.min_hourly_rate === 'number') patch.min_hourly_rate = legacy.min_hourly_rate;
      if (typeof legacy.radius_km === 'number')      patch.radius_km = legacy.radius_km;
      if (Array.isArray(legacy.category_ids))        patch.category_ids = legacy.category_ids;
      if (Object.keys(patch).length > 0) {
        await supabase.from('provider_profiles').update(patch).eq('id', userId);
      }
      await AsyncStorage.removeItem(key);
      break;
    }
  } catch {
    // non-critical migration — silently ignore errors
  }
}

export async function loadProviderProfile(): Promise<ProviderProfile> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ...DEFAULTS };

    // Migrate legacy AsyncStorage data to DB on first load (idempotent)
    await migrateLegacyIfNeeded(user.id);

    const { data } = await supabase
      .from('provider_profiles')
      .select('business_name, bio, phone, min_hourly_rate, radius_km, category_ids, available, rating_avg, rating_count, stripe_onboarded, kyc_status, trade_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!data) return { ...DEFAULTS };

    return {
      business_name: data.business_name ?? null,
      bio:           data.bio ?? null,
      phone:         data.phone ?? null,
      trade_id:      data.trade_id ?? null,
      min_hourly_rate: data.min_hourly_rate ?? DEFAULTS.min_hourly_rate,
      radius_km:     data.radius_km ?? DEFAULTS.radius_km,
      category_ids:  data.category_ids ?? [],
      available:     data.available ?? true,
      rating_avg:    data.rating_avg ?? 0,
      rating_count:  data.rating_count ?? 0,
      stripe_onboarded: data.stripe_onboarded ?? false,
      kyc_verified: (data.kyc_status as string) === 'approved',
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
    if (!user) return;

    const dbFields: Record<string, unknown> = {};
    if (resolvedPatch.business_name !== undefined) dbFields.business_name  = resolvedPatch.business_name;
    if (resolvedPatch.bio           !== undefined) dbFields.bio            = resolvedPatch.bio;
    if (resolvedPatch.available     !== undefined) dbFields.available      = resolvedPatch.available;
    if (resolvedPatch.trade_id      !== undefined) dbFields.trade_id       = resolvedPatch.trade_id;
    if (resolvedPatch.phone         !== undefined) dbFields.phone          = resolvedPatch.phone;
    if (resolvedPatch.min_hourly_rate !== undefined) dbFields.min_hourly_rate = resolvedPatch.min_hourly_rate;
    if (resolvedPatch.radius_km     !== undefined) dbFields.radius_km      = resolvedPatch.radius_km;
    if (resolvedPatch.category_ids    !== undefined) dbFields.category_ids    = resolvedPatch.category_ids;
    if (resolvedPatch.is_nachbarschaft !== undefined) dbFields.is_nachbarschaft = resolvedPatch.is_nachbarschaft;

    if (Object.keys(dbFields).length > 0) {
      await supabase.from('provider_profiles').update(dbFields).eq('id', user.id);
    }
  } catch {
    // Caller shows toast
  }
}
