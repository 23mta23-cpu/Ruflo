/**
 * Tests for lib/account.ts — loadAccount / saveAccount
 *
 * Both AsyncStorage and expo-secure-store are mocked with in-memory
 * implementations.  Each test starts from cleared stores (afterEach) to keep
 * tests fully independent.
 *
 * Key invariant being tested:
 *   - Non-sensitive fields (isBusinessUser, steuernummerProvided, stripeOnboarded)
 *     live in AsyncStorage under key 'werkr_account_v1'.
 *   - vatId lives in expo-secure-store under key 'werkr_vatid_v1' (ADR-0006).
 *   - loadAccount performs a one-time migration if it finds vatId in the old
 *     AsyncStorage blob.
 */

// ── AsyncStorage mock ────────────────────────────────────────────────────────
const _store = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem:    jest.fn(async (key: string) => _store.get(key) ?? null),
    setItem:    jest.fn(async (key: string, value: string) => { _store.set(key, value); }),
    removeItem: jest.fn(async (key: string) => { _store.delete(key); }),
    clear:      jest.fn(async () => { _store.clear(); }),
    getAllKeys:  jest.fn(async () => Array.from(_store.keys())),
  },
}));

// ── expo-secure-store mock ───────────────────────────────────────────────────
const _secureStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  __esModule: true,
  getItemAsync:    jest.fn(async (key: string) => _secureStore.get(key) ?? null),
  setItemAsync:    jest.fn(async (key: string, value: string) => { _secureStore.set(key, value); }),
  deleteItemAsync: jest.fn(async (key: string) => { _secureStore.delete(key); }),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { loadAccount, saveAccount, AccountProfile } from '../lib/account';
import { loadVatId } from '../lib/secure';

const DEFAULTS: AccountProfile = {
  isBusinessUser: false,
  vatId: null,
  steuernummerProvided: false,
  stripeOnboarded: false,
  userId: '',
  isProvider: false,
};

afterEach(async () => {
  await AsyncStorage.clear();
  _secureStore.clear();
  jest.clearAllMocks();
});

// ── loadAccount ──────────────────────────────────────────────────────────────

describe('loadAccount', () => {
  it('returns DEFAULTS when both stores are empty', async () => {
    const account = await loadAccount();
    expect(account).toEqual(DEFAULTS);
  });

  it('loads non-vatId fields from AsyncStorage and vatId from SecureStore', async () => {
    _store.set('werkr_account_v1', JSON.stringify({
      isBusinessUser: true,
      steuernummerProvided: true,
      stripeOnboarded: true,
    }));
    _secureStore.set('werkr_vatid_v1', 'DE123456789');

    const account = await loadAccount();
    expect(account.isBusinessUser).toBe(true);
    expect(account.steuernummerProvided).toBe(true);
    expect(account.stripeOnboarded).toBe(true);
    expect(account.vatId).toBe('DE123456789');
  });

  it('returns vatId: null when SecureStore is empty', async () => {
    _store.set('werkr_account_v1', JSON.stringify({ isBusinessUser: true }));

    const account = await loadAccount();
    expect(account.isBusinessUser).toBe(true);
    expect(account.vatId).toBeNull();
  });

  it('merges partial AsyncStorage data with DEFAULTS (missing keys fall back)', async () => {
    _store.set('werkr_account_v1', JSON.stringify({ isBusinessUser: true }));

    const account = await loadAccount();
    expect(account.isBusinessUser).toBe(true);
    expect(account.vatId).toBeNull();
    expect(account.steuernummerProvided).toBe(false);
    expect(account.stripeOnboarded).toBe(false);
  });

  it('returns DEFAULTS when AsyncStorage contains malformed JSON', async () => {
    _store.set('werkr_account_v1', 'NOT_VALID_JSON{{{');

    const account = await loadAccount();
    expect(account).toEqual(DEFAULTS);
  });

  it('returns DEFAULTS when AsyncStorage.getItem rejects', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('storage error'));

    const account = await loadAccount();
    expect(account).toEqual(DEFAULTS);
  });

  // ── Migration path (ADR-0006) ──────────────────────────────────────────────

  it('migrates vatId from old AsyncStorage blob to SecureStore on first load', async () => {
    // Simulate old data format: vatId in AsyncStorage blob
    _store.set('werkr_account_v1', JSON.stringify({
      isBusinessUser: true,
      vatId: 'DE999888777',
      stripeOnboarded: false,
    }));
    // SecureStore is empty (pre-migration state)

    const account = await loadAccount();

    // Returned profile has the correct vatId
    expect(account.vatId).toBe('DE999888777');
    expect(account.isBusinessUser).toBe(true);

    // vatId must now be in SecureStore
    const vatIdInSecure = await loadVatId();
    expect(vatIdInSecure).toBe('DE999888777');

    // vatId must have been removed from AsyncStorage blob
    const raw = await AsyncStorage.getItem('werkr_account_v1');
    const parsed = JSON.parse(raw!);
    expect(parsed.vatId).toBeUndefined();
    expect(parsed.isBusinessUser).toBe(true);
  });

  it('does not re-migrate if vatId already exists in SecureStore', async () => {
    // SecureStore already has vatId (migration already done)
    _secureStore.set('werkr_vatid_v1', 'DE111222333');
    // AsyncStorage blob also has vatId field (edge case)
    _store.set('werkr_account_v1', JSON.stringify({
      isBusinessUser: true,
      vatId: 'DE_OLD_VALUE',
    }));

    const account = await loadAccount();

    // SecureStore value wins; setItemAsync not called again
    expect(account.vatId).toBe('DE111222333');
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });
});

// ── saveAccount ──────────────────────────────────────────────────────────────

describe('saveAccount', () => {
  it('persists a patch and returns the merged profile', async () => {
    const result = await saveAccount({ isBusinessUser: true });

    expect(result.isBusinessUser).toBe(true);
    expect(result.vatId).toBeNull();
    expect(result.stripeOnboarded).toBe(false);
  });

  it('writes non-vatId fields to AsyncStorage and vatId to SecureStore', async () => {
    await saveAccount({ stripeOnboarded: true, vatId: 'DE987654321' });

    // Non-sensitive fields in AsyncStorage
    const raw = await AsyncStorage.getItem('werkr_account_v1');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.stripeOnboarded).toBe(true);
    expect(parsed.vatId).toBeUndefined(); // NOT in AsyncStorage

    // vatId in SecureStore
    const vatId = await loadVatId();
    expect(vatId).toBe('DE987654321');
  });

  it('accumulates multiple patches — later patch wins', async () => {
    await saveAccount({ isBusinessUser: true });
    const result = await saveAccount({ isBusinessUser: false, stripeOnboarded: true });

    expect(result.isBusinessUser).toBe(false);
    expect(result.stripeOnboarded).toBe(true);
  });

  it('preserves existing values not mentioned in the patch', async () => {
    await saveAccount({ vatId: 'DE111111111', steuernummerProvided: true });
    const result = await saveAccount({ stripeOnboarded: true });

    expect(result.vatId).toBe('DE111111111');
    expect(result.steuernummerProvided).toBe(true);
    expect(result.stripeOnboarded).toBe(true);
  });

  it('applying an empty patch returns the current profile unchanged', async () => {
    await saveAccount({ isBusinessUser: true });
    const result = await saveAccount({});

    expect(result.isBusinessUser).toBe(true);
    expect(result).toEqual({ ...DEFAULTS, isBusinessUser: true });
  });

  it('clears vatId from SecureStore when patched to null', async () => {
    await saveAccount({ vatId: 'DE123456789' });
    await saveAccount({ vatId: null });

    const vatId = await loadVatId();
    expect(vatId).toBeNull();

    const result = await loadAccount();
    expect(result.vatId).toBeNull();
  });
});
