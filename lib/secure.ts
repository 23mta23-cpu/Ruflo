// Secure storage wrapper — iOS Keychain / Android Keystore via expo-secure-store.
// On web the native module is unavailable (empty stub); try/catch falls back
// gracefully: loadVatId returns null, saveVatId is a no-op.
// See ADR-0006 for the migration plan and documented web residual risk.
import * as SecureStore from 'expo-secure-store';

const VAT_KEY = 'werkr_vatid_v1';

export async function loadVatId(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(VAT_KEY);
  } catch {
    return null;
  }
}

export async function saveVatId(vatId: string | null): Promise<void> {
  try {
    if (vatId) await SecureStore.setItemAsync(VAT_KEY, vatId);
    else await SecureStore.deleteItemAsync(VAT_KEY);
  } catch { /* SecureStore unavailable (web) — vatId not persisted on this platform */ }
}
