/**
 * Tests for lib/jobDraft.ts — getJobDraftResume()
 *
 * Pins the guest-order resume logic: after login/registration the wizard must
 * be reopened with the correct track, and a Nachbarschafts-Entwurf must NOT be
 * mistaken for a Handwerker order (that mismatch previously dropped the draft).
 */

const _store = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem:    jest.fn(async (key: string) => _store.get(key) ?? null),
    setItem:    jest.fn(async (key: string, value: string) => { _store.set(key, value); }),
    removeItem: jest.fn(async (key: string) => { _store.delete(key); }),
    clear:      jest.fn(async () => { _store.clear(); }),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getJobDraftResume, JOB_DRAFT_KEY } from '../lib/jobDraft';

afterEach(async () => { _store.clear(); jest.clearAllMocks(); });

describe('getJobDraftResume', () => {
  it('returns null when no draft is stored', async () => {
    expect(await getJobDraftResume()).toBeNull();
  });

  it('returns an empty target (no track) for a Handwerker draft', async () => {
    await AsyncStorage.setItem(JOB_DRAFT_KEY, JSON.stringify({ nbMode: false, jobTitle: 'Bad fliesen' }));
    expect(await getJobDraftResume()).toEqual({});
  });

  it('treats a missing nbMode flag as a Handwerker draft', async () => {
    await AsyncStorage.setItem(JOB_DRAFT_KEY, JSON.stringify({ jobTitle: 'Steckdose' }));
    expect(await getJobDraftResume()).toEqual({});
  });

  it('carries the nachbarschaft track for a neighbourhood draft', async () => {
    await AsyncStorage.setItem(JOB_DRAFT_KEY, JSON.stringify({ nbMode: true, jobTitle: 'Einkaufshilfe' }));
    expect(await getJobDraftResume()).toEqual({ track: 'nachbarschaft' });
  });

  it('returns null on a corrupt draft instead of throwing', async () => {
    await AsyncStorage.setItem(JOB_DRAFT_KEY, '{not valid json');
    expect(await getJobDraftResume()).toBeNull();
  });
});
