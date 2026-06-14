// PStTG (Plattformen-Steuertransparenzgesetz) compliance logic.
// Private Nachbarschaftshelfer who exceed 30 transactions OR €2,000 revenue
// per calendar year must submit their tax ID to the Bundeszentralamt für Steuern.
// Reference: PStTG § 3 Abs. 1 Nr. 7 (Meldepflicht Plattformbetreiber).

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PStTGStats {
  year: number;
  jobCount: number;
  totalRevenue: number;
  taxIdSubmitted: boolean;
  frozen: boolean;
}

const keyFor = (year: number) => `werkr_pstTg_${year}`;

export async function getPStTGStats(year?: number): Promise<PStTGStats> {
  const y = year ?? new Date().getFullYear();
  const raw = await AsyncStorage.getItem(keyFor(y));
  const defaults: PStTGStats = { year: y, jobCount: 0, totalRevenue: 0, taxIdSubmitted: false, frozen: false };
  return raw ? { ...defaults, ...(JSON.parse(raw) as Partial<PStTGStats>) } : defaults;
}

export async function recordJobRevenue(amountEur: number): Promise<PStTGStats> {
  const year = new Date().getFullYear();
  const stats = await getPStTGStats(year);
  stats.jobCount += 1;
  stats.totalRevenue += amountEur;

  // Freeze threshold: 30 jobs OR €2,000 revenue, unless tax ID already submitted
  if (!stats.taxIdSubmitted && (stats.jobCount >= 30 || stats.totalRevenue >= 2000)) {
    stats.frozen = true;
  }

  await AsyncStorage.setItem(keyFor(year), JSON.stringify(stats));
  return stats;
}

export async function submitTaxId(taxId: string): Promise<void> {
  const year = new Date().getFullYear();
  const stats = await getPStTGStats(year);
  // Basic 11-digit German Steuer-ID format check
  if (!/^\d{11}$/.test(taxId.replace(/\s/g, ''))) {
    throw new Error('Ungültige Steuer-ID. Bitte 11-stellige Nummer eingeben.');
  }
  stats.taxIdSubmitted = true;
  stats.frozen = false;
  await AsyncStorage.setItem(keyFor(year), JSON.stringify(stats));
}

export function getPStTGWarningMessage(stats: PStTGStats): string | null {
  if (stats.frozen) {
    return `Meldepflicht nach PStTG: Sie haben ${stats.jobCount} Aufträge / €${stats.totalRevenue.toFixed(0)} Umsatz in ${stats.year} erreicht. Bitte hinterlegen Sie Ihre Steuer-ID, um das Konto zu entsperren.`;
  }
  const remaining = Math.min(30 - stats.jobCount, Math.ceil((2000 - stats.totalRevenue) / 1));
  if (stats.jobCount >= 25 || stats.totalRevenue >= 1700) {
    return `Hinweis PStTG: Sie nähern sich der Meldeschwelle (${stats.jobCount}/30 Aufträge, €${stats.totalRevenue.toFixed(0)}/2.000). Bitte Steuer-ID bereithalten.`;
  }
  return null;
}
