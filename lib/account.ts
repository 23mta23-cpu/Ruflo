// Lokaler Account-State (Übergang bis Backend). Steuert Rechnungstyp
// (B2B Reverse-Charge-Prüfung vs. C2C mit 19% USt. auf Plattformgebühr)
// und den Stripe-Connect-Onboarding-Status.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'werkr_account_v1';

export interface AccountProfile {
  /** true = Unternehmer (Steuernummer/Gewerbe) → USt-relevante Rechnungsstellung */
  isBusinessUser: boolean;
  /** USt-IdNr. (optional, nur B2B) — wird serverseitig via VIES validiert */
  vatId: string | null;
  steuernummerProvided: boolean;
  /** Stripe Connect Express Onboarding abgeschlossen (charges_enabled) */
  stripeOnboarded: boolean;
}

const DEFAULTS: AccountProfile = {
  isBusinessUser: false,
  vatId: null,
  steuernummerProvided: false,
  stripeOnboarded: false,
};

export async function loadAccount(): Promise<AccountProfile> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export async function saveAccount(patch: Partial<AccountProfile>): Promise<AccountProfile> {
  const current = await loadAccount();
  const next = { ...current, ...patch };
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
