/**
 * Tests for lib/account.ts — loadAccount / saveAccount
 *
 * AsyncStorage is mocked via the official jest mock so that no real
 * persistence layer is involved.  Each test starts from a cleared store
 * (afterEach wipes the mock) to keep tests fully independent.
 */

// The v3 package ships its mock as an ES-module file that Jest's CommonJS
// transform cannot require from node_modules.  We provide an equivalent
// in-memory implementation directly so the test has no external dependency.
const _store = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem:   jest.fn(async (key: string) => _store.get(key) ?? null),
    setItem:   jest.fn(async (key: string, value: string) => { _store.set(key, value); }),
    removeItem: jest.fn(async (key: string) => { _store.delete(key); }),
    clear:     jest.fn(async () => { _store.clear(); }),
    getAllKeys: jest.fn(async () => Array.from(_store.keys())),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadAccount, saveAccount, AccountProfile } from '../lib/account';

const DEFAULTS: AccountProfile = {
  isBusinessUser: false,
  vatId: null,
  steuernummerProvided: false,
  stripeOnboarded: false,
};

afterEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// loadAccount
// ---------------------------------------------------------------------------

describe('loadAccount', () => {
  it('returns DEFAULTS when storage is empty', async () => {
    const account = await loadAccount();
    expect(account).toEqual(DEFAULTS);
  });

  it('returns stored values when storage contains a valid JSON blob', async () => {
    const stored: AccountProfile = {
      isBusinessUser: true,
      vatId: 'DE123456789',
      steuernummerProvided: true,
      stripeOnboarded: true,
    };
    await AsyncStorage.setItem('werkr_account_v1', JSON.stringify(stored));

    const account = await loadAccount();
    expect(account).toEqual(stored);
  });

  it('merges partial storage data with DEFAULTS (missing keys fall back)', async () => {
    // Only persist one field — the rest must come from DEFAULTS.
    await AsyncStorage.setItem('werkr_account_v1', JSON.stringify({ isBusinessUser: true }));

    const account = await loadAccount();
    expect(account.isBusinessUser).toBe(true);
    expect(account.vatId).toBeNull();
    expect(account.steuernummerProvided).toBe(false);
    expect(account.stripeOnboarded).toBe(false);
  });

  it('returns DEFAULTS when storage contains malformed JSON', async () => {
    await AsyncStorage.setItem('werkr_account_v1', 'NOT_VALID_JSON{{{');

    const account = await loadAccount();
    expect(account).toEqual(DEFAULTS);
  });

  it('returns DEFAULTS when AsyncStorage.getItem rejects', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('storage error'));

    const account = await loadAccount();
    expect(account).toEqual(DEFAULTS);
  });
});

// ---------------------------------------------------------------------------
// saveAccount
// ---------------------------------------------------------------------------

describe('saveAccount', () => {
  it('persists a patch and returns the merged profile', async () => {
    const result = await saveAccount({ isBusinessUser: true });

    expect(result.isBusinessUser).toBe(true);
    // Unpatched fields stay at their default values.
    expect(result.vatId).toBeNull();
    expect(result.stripeOnboarded).toBe(false);
  });

  it('writes the merged profile to AsyncStorage under the correct key', async () => {
    await saveAccount({ stripeOnboarded: true, vatId: 'DE987654321' });

    const raw = await AsyncStorage.getItem('werkr_account_v1');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.stripeOnboarded).toBe(true);
    expect(parsed.vatId).toBe('DE987654321');
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

    // vatId and steuernummerProvided must survive the second save.
    expect(result.vatId).toBe('DE111111111');
    expect(result.steuernummerProvided).toBe(true);
    expect(result.stripeOnboarded).toBe(true);
  });

  it('applying an empty patch returns the current profile unchanged', async () => {
    await saveAccount({ isBusinessUser: true });
    const result = await saveAccount({});

    expect(result.isBusinessUser).toBe(true);
    expect(result).toEqual({
      ...DEFAULTS,
      isBusinessUser: true,
    });
  });
});
