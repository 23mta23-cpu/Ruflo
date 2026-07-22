import { supabase } from './supabase';

// Öffentliche Anbieter-Sicht (View provider_public, Migration 0560). Views haben
// keine FK-Beziehung → PostgREST-Embeds sind nicht möglich; stattdessen die
// Anbieter-Daten zu mehreren IDs in EINEM Query holen und in JS zusammenführen.
const DEFAULT_COLS =
  'id, business_name, trade_id, rating_avg, rating_count, meister_verified, is_nachbarschaft, kyc_status, available, created_at';

export async function fetchPublicProviders(
  ids: (string | null | undefined)[],
  columns: string = DEFAULT_COLS,
): Promise<Record<string, any>> {
  const unique = Array.from(new Set(ids.filter(Boolean) as string[]));
  if (!unique.length) return {};
  const sel = /(^|,\s*)id(\s*,|$)/.test(columns) ? columns : `id, ${columns}`;
  const { data } = await supabase.from('provider_public').select(sel).in('id', unique);
  const map: Record<string, any> = {};
  for (const p of data ?? []) map[(p as any).id] = p;
  return map;
}
