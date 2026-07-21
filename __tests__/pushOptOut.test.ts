/**
 * Tests für den Push-Opt-out (lib/notifications.ts) — der Blindspot-Fix vom
 * 19.07.: der Einstellungs-Toggle war vorher rein lokal, der Token blieb
 * serverseitig gesetzt und send-push erreichte den Nutzer weiter.
 *
 * Kern-Invariante: registerPushToken (läuft bei App-Start/Sign-in) darf den
 * Token NICHT erneut schreiben, wenn der Nutzer Push abgeschaltet hat.
 *
 * expo-notifications wird beim Modul-Import wegen setNotificationHandler
 * benötigt und daher komplett gemockt; supabase ebenso, AsyncStorage
 * in-memory (wie in account.test.ts).
 */

// ── AsyncStorage mock ────────────────────────────────────────────────────────
const _store = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem:    jest.fn(async (key: string) => _store.get(key) ?? null),
    setItem:    jest.fn(async (key: string, value: string) => { _store.set(key, value); }),
    removeItem: jest.fn(async (key: string) => { _store.delete(key); }),
  },
}));

// ── react-native mock (nur Platform.OS wird gebraucht) ───────────────────────
jest.mock('react-native', () => ({ __esModule: true, Platform: { OS: 'ios' } }));

// ── expo-notifications mock (nur Modul-Load-Nebenwirkungen abfangen) ──────────
jest.mock('expo-notifications', () => ({
  __esModule: true,
  setNotificationHandler: jest.fn(),
  AndroidNotificationPriority: { HIGH: 'high' },
  AndroidImportance: { HIGH: 4 },
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExpoPushToken[xxx]' })),
  addNotificationResponseReceivedListener: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
}));

// ── supabase mock: profiles.update-Kette beobachtbar ─────────────────────────
const updateEq = jest.fn(async () => ({ error: null }));
const update = jest.fn(() => ({ eq: updateEq }));
jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({ update })),
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
    supabaseUrl: 'https://example.supabase.co',
  },
}));

import { isPushOptedOut, registerPushToken } from '../lib/notifications';

const PREFS_KEY = 'werkr_prefs_v1';

afterEach(() => {
  _store.clear();
  jest.clearAllMocks();
});

describe('isPushOptedOut', () => {
  it('is false when no prefs are stored (default = push on)', async () => {
    expect(await isPushOptedOut()).toBe(false);
  });

  it('is true only when pushNotifs is explicitly false', async () => {
    _store.set(PREFS_KEY, JSON.stringify({ pushNotifs: false }));
    expect(await isPushOptedOut()).toBe(true);
  });

  it('is false when pushNotifs is true or absent', async () => {
    _store.set(PREFS_KEY, JSON.stringify({ pushNotifs: true }));
    expect(await isPushOptedOut()).toBe(false);
    _store.set(PREFS_KEY, JSON.stringify({ other: 1 }));
    expect(await isPushOptedOut()).toBe(false);
  });

  it('is false (fail-open) on malformed JSON rather than throwing', async () => {
    _store.set(PREFS_KEY, '{not json');
    expect(await isPushOptedOut()).toBe(false);
  });
});

describe('registerPushToken respects the opt-out', () => {
  it('does NOT write the token when the user opted out', async () => {
    _store.set(PREFS_KEY, JSON.stringify({ pushNotifs: false }));
    await registerPushToken('user-1');
    expect(update).not.toHaveBeenCalled();
  });

  it('writes the token when push is enabled', async () => {
    await registerPushToken('user-1');
    expect(update).toHaveBeenCalledWith({ push_token: 'ExpoPushToken[xxx]' });
    expect(updateEq).toHaveBeenCalledWith('id', 'user-1');
  });
});
