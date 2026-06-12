// Metro web platform override for lib/secure.ts.
// On web, expo-secure-store is unavailable; localStorage is the best-effort fallback.
// vatId is not sensitive enough to block web usage entirely (see ADR-0006).
const VAT_KEY = 'werkr_vatid_v1';

export async function loadVatId(): Promise<string | null> {
  try {
    return localStorage.getItem(VAT_KEY) ?? null;
  } catch {
    return null;
  }
}

export async function saveVatId(vatId: string | null): Promise<void> {
  try {
    if (vatId) localStorage.setItem(VAT_KEY, vatId);
    else localStorage.removeItem(VAT_KEY);
  } catch {
    // localStorage blocked (private mode / quota exceeded)
  }
}
