// Lokaler Account-State (Übergang bis Backend). Steuert Rechnungstyp
// (B2B Reverse-Charge-Prüfung vs. C2C mit 19% USt. auf Plattformgebühr)
// und den Stripe-Connect-Onboarding-Status.
// ADR-0006: vatId wird in expo-secure-store (Keychain/Keystore) gehalten,
// nicht in unverschlüsseltem AsyncStorage.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadVatId, saveVatId } from './secure';

const KEY = 'werkr_account_v1';

export interface AccountProfile {
  /** true = Unternehmer (Steuernummer/Gewerbe) → USt-relevante Rechnungsstellung */
  isBusinessUser: boolean;
  /** USt-IdNr. (optional, nur B2B) — in expo-secure-store, nicht AsyncStorage */
  vatId: string | null;
  steuernummerProvided: boolean;
  /** Stripe Connect Express Onboarding abgeschlossen (charges_enabled) */
  stripeOnboarded: boolean;
  /** Authenticated Supabase user ID (uuid). Empty string when not logged in. */
  userId: string;
  /** true when the user is registered as a provider (Handwerker / Nachbarschaftshelfer) */
  isProvider: boolean;
}

// Shape persisted to AsyncStorage (vatId excluded — kept in SecureStore)
type PersistedProfile = Omit<AccountProfile, 'vatId'>;

const DEFAULTS: AccountProfile = {
  isBusinessUser: false,
  vatId: null,
  steuernummerProvided: false,
  stripeOnboarded: false,
  userId: '',
  isProvider: false,
};

export async function loadAccount(): Promise<AccountProfile> {
  try {
    const [raw, vatId] = await Promise.all([
      AsyncStorage.getItem(KEY),
      loadVatId(),
    ]);

    if (!raw) return { ...DEFAULTS, vatId };

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { ...DEFAULTS, vatId };
    }

    const stored = parsed as Record<string, unknown>;

    // One-time migration: vatId was previously stored in AsyncStorage → move to SecureStore
    if (typeof stored['vatId'] === 'string' && stored['vatId'] && !vatId) {
      const migratedVatId = stored['vatId'] as string;
      await saveVatId(migratedVatId);
      const { vatId: _removed, ...withoutVatId } = stored;
      await AsyncStorage.setItem(KEY, JSON.stringify(withoutVatId));
      return { ...DEFAULTS, ...(withoutVatId as Partial<PersistedProfile>), vatId: migratedVatId };
    }

    const { vatId: _ignored, ...withoutVatId } = stored;
    return { ...DEFAULTS, ...(withoutVatId as Partial<PersistedProfile>), vatId };
  } catch {
    return DEFAULTS;
  }
}

export async function saveAccount(patch: Partial<AccountProfile>): Promise<AccountProfile> {
  const current = await loadAccount();
  const next = { ...current, ...patch };

  // Route vatId to SecureStore (separate from AsyncStorage blob)
  if ('vatId' in patch) await saveVatId(patch.vatId ?? null);

  // Persist all non-vatId fields to AsyncStorage
  const { vatId: _v, ...toStore } = next;
  await AsyncStorage.setItem(KEY, JSON.stringify(toStore));

  return next;
}
