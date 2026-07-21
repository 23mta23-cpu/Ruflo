/**
 * Tests für lib/retry.ts (withOneRetry) und lib/nav.ts (safeBack) — die zwei
 * Helfer hinter dem Kalt-Start-Fix (#99) und dem Zurück-Pfeil-Fix (#91).
 * Beides subtile Logik, die still regressieren könnte.
 */
import { withOneRetry } from '../lib/retry';
import { safeBack, resetTo } from '../lib/nav';

describe('withOneRetry', () => {
  it('returns the value without retrying when the first call succeeds', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    expect(await withOneRetry(fn, 1)).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries exactly once and returns the second result on first failure', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('cold-start token stale'))
      .mockResolvedValueOnce('recovered');
    expect(await withOneRetry(fn, 1)).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws when both attempts fail (real persistent error surfaces)', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('backend down'));
    await expect(withOneRetry(fn, 1)).rejects.toThrow('backend down');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('safeBack', () => {
  it('goes back when history exists', () => {
    const router = { canGoBack: () => true, back: jest.fn(), replace: jest.fn() };
    safeBack(router as any);
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('falls back to home on a cold deep-link (no history)', () => {
    const router = { canGoBack: () => false, back: jest.fn(), replace: jest.fn() };
    safeBack(router as any);
    expect(router.replace).toHaveBeenCalledWith('/');
    expect(router.back).not.toHaveBeenCalled();
  });
});

describe('resetTo', () => {
  it('dismisses the whole stack then replaces the root (kills the buried wizard)', () => {
    const router = { canDismiss: () => true, dismissAll: jest.fn(), replace: jest.fn() };
    resetTo(router as any, '/(tabs)');
    expect(router.dismissAll).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/(tabs)');
  });

  it('replaces without dismissing when there is nothing to dismiss (tabs root)', () => {
    const router = { canDismiss: () => false, dismissAll: jest.fn(), replace: jest.fn() };
    resetTo(router as any, '/(tabs)');
    expect(router.dismissAll).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/(tabs)');
  });

  it('still replaces when canDismiss/dismissAll throws (never leaves the user stuck)', () => {
    const router = {
      canDismiss: () => { throw new Error('no navigator'); },
      dismissAll: jest.fn(),
      replace: jest.fn(),
    };
    expect(() => resetTo(router as any, '/(tabs)')).not.toThrow();
    expect(router.replace).toHaveBeenCalledWith('/(tabs)');
  });

  it('passes a pathname+params object straight through to replace', () => {
    const router = { canDismiss: () => true, dismissAll: jest.fn(), replace: jest.fn() };
    const target = { pathname: '/auftrag-detail', params: { jobId: 'abc' } };
    resetTo(router as any, target);
    expect(router.replace).toHaveBeenCalledWith(target);
  });
});
