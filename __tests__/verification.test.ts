import { validateDoc, buildDocPath, MAX_DOC_BYTES } from '../lib/verification';

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('../lib/supabase', () => ({ supabase: {}, isSupabaseConfigured: true }));

describe('validateDoc', () => {
  it('akzeptiert JPG, PNG und PDF unter 10 MB', () => {
    expect(validateDoc({ mimeType: 'image/jpeg', size: 1024 })).toBeNull();
    expect(validateDoc({ mimeType: 'image/png', size: MAX_DOC_BYTES })).toBeNull();
    expect(validateDoc({ mimeType: 'application/pdf', size: 5_000_000 })).toBeNull();
  });

  it('lehnt fremde MIME-Typen ab (kein SVG/HTML/EXE in den Bucket)', () => {
    for (const mt of ['image/svg+xml', 'text/html', 'application/octet-stream', '', undefined, null]) {
      expect(validateDoc({ mimeType: mt as any, size: 1024 })).toMatch(/JPG, PNG oder PDF/);
    }
  });

  it('lehnt leere und übergroße Dateien ab', () => {
    expect(validateDoc({ mimeType: 'image/png', size: 0 })).toMatch(/leer/);
    expect(validateDoc({ mimeType: 'image/png', size: null })).toMatch(/leer/);
    expect(validateDoc({ mimeType: 'image/png', size: MAX_DOC_BYTES + 1 })).toMatch(/10 MB/);
  });
});

describe('buildDocPath', () => {
  it('legt Dateien im Ordner des Users ab (RLS-Voraussetzung aus Migration 037)', () => {
    const p = buildDocPath('user-123', 'gewerbeschein', 'application/pdf', 1700000000000);
    expect(p).toBe('user-123/gewerbeschein-1700000000000.pdf');
    expect(p.startsWith('user-123/')).toBe(true);
  });

  it('leitet die Endung aus dem MIME-Typ ab, nicht aus dem Dateinamen', () => {
    expect(buildDocPath('u', 'meisterbrief', 'image/png', 1)).toBe('u/meisterbrief-1.png');
    expect(buildDocPath('u', 'meisterbrief', 'image/jpeg', 1)).toBe('u/meisterbrief-1.jpg');
  });
});
