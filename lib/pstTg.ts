// PStTG (Plattformen-Steuertransparenzgesetz) compliance logic.
// Reads authoritative values from profiles table (updated by release-escrow Edge Function).
// Falls back to AsyncStorage if not authenticated.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export interface PStTGStats {
  year: number;
  jobCount: number;
  totalRevenue: number;
  taxIdSubmitted: boolean;
  frozen: boolean;
}

const storageKey = (year: number) => `werkr_pstTg_${year}`;

export async function getPStTGStats(year?: number): Promise<PStTGStats> {
  const y = year ?? new Date().getFullYear();

  // Try reading from Supabase (authoritative source)
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('pstg_tx_count, pstg_revenue, pstg_locked')
      .eq('id', user.id)
      .maybeSingle();

    if (data) {
      // Check if Steuer-ID was submitted locally (unlock is admin-gated in DB)
      const taxIdSubmitted = !!(await AsyncStorage.getItem(`werkr_pstTg_taxId_${y}`));
      return {
        year: y,
        jobCount: data.pstg_tx_count ?? 0,
        totalRevenue: data.pstg_revenue ?? 0,
        taxIdSubmitted,
        frozen: (data.pstg_locked ?? false) && !taxIdSubmitted,
      };
    }
  }

  // Fallback: AsyncStorage
  const raw = await AsyncStorage.getItem(storageKey(y));
  const defaults: PStTGStats = { year: y, jobCount: 0, totalRevenue: 0, taxIdSubmitted: false, frozen: false };
  return raw ? { ...defaults, ...(JSON.parse(raw) as Partial<PStTGStats>) } : defaults;
}

export async function submitTaxId(taxId: string): Promise<void> {
  const year = new Date().getFullYear();
  if (!/^\d{11}$/.test(taxId.replace(/\s/g, ''))) {
    throw new Error('Ungültige Steuer-ID. Bitte 11-stellige Nummer eingeben.');
  }

  // Store Steuer-ID in provider_profiles.steuer_id (server validates and unlocks pstg_locked)
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { error } = await supabase
      .from('provider_profiles')
      .update({ steuer_id: taxId.replace(/\s/g, '') })
      .eq('id', user.id);
    if (error) throw new Error('Steuer-ID konnte nicht gespeichert werden.');
  }

  // Mark locally so the freeze gate lifts immediately (server unlock is async)
  await AsyncStorage.setItem(`werkr_pstTg_taxId_${year}`, taxId.replace(/\s/g, ''));
}

export function getPStTGWarningMessage(stats: PStTGStats): string | null {
  if (stats.frozen) {
    return `Meldepflicht nach PStTG: Sie haben ${stats.jobCount} Aufträge / €${stats.totalRevenue.toFixed(0)} Umsatz in ${stats.year} erreicht. Bitte hinterlegen Sie Ihre Steuer-ID, um das Konto zu entsperren.`;
  }
  if (stats.jobCount >= 25 || stats.totalRevenue >= 1700) {
    return `Hinweis PStTG: Sie nähern sich der Meldeschwelle (${stats.jobCount}/30 Aufträge, €${stats.totalRevenue.toFixed(0)}/2.000). Bitte Steuer-ID bereithalten.`;
  }
  return null;
}
