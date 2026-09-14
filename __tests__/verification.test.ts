import {
  validateDoc, buildDocPath, MAX_DOC_BYTES,
  dateiGroesse, uploadDocMitAusstieg, UPLOAD_ZEITGRENZE_MS,
  type PickedDoc,
} from '../lib/verification';

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
// Steuerbarer Upload: die Probe soll bestimmen, WANN er fertig wird.
let uploadAufloesen: ((v: { error: null }) => void) | null = null;
const uploadRuft: string[] = [];

jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u-1' } } } }) },
    storage: {
      from: () => ({
        upload: (pfad: string) => {
          uploadRuft.push(pfad);
          return new Promise((auf) => { uploadAufloesen = auf as never; });
        },
      }),
    },
  },
}));

// uploadDoc holt die Datei per fetch und macht daraus einen Blob.
(global as unknown as { fetch: unknown }).fetch = async () => ({ blob: async () => 'blob' });

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

// ---------------------------------------------------------------------------
// Dateigroesse, wie ein Mensch sie liest
// ---------------------------------------------------------------------------

describe('dateiGroesse', () => {
  it('nennt MB mit Komma und einer Nachkommastelle', () => {
    expect(dateiGroesse(6_488_064)).toBe('6,2 MB');
    expect(dateiGroesse(10 * 1024 * 1024)).toBe('10,0 MB');
  });

  it('kleinere Dateien in KB und B, ohne Nachkommastelle', () => {
    expect(dateiGroesse(2048)).toBe('2 KB');
    expect(dateiGroesse(500)).toBe('500 B');
  });

  it('unbrauchbare Werte ergeben nichts statt „NaN MB"', () => {
    for (const v of [0, -1, NaN, Infinity]) expect(dateiGroesse(v)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Hochladen mit Ausweg
// ---------------------------------------------------------------------------

describe('uploadDocMitAusstieg', () => {
  const datei: PickedDoc = {
    name: 'meisterbrief.jpg', uri: 'file:///x.jpg', mimeType: 'image/jpeg', size: 6_488_064,
  };
  const nie = new Promise<void>(() => {});

  /** uploadDoc hat mehrere await-Stufen (getSession, fetch, blob) — bis zum
   *  storage.upload() muss die Probe die Mikrotask-Warteschlange leeren. */
  async function bisZumUpload() {
    for (let i = 0; i < 50 && uploadAufloesen === null; i++) await Promise.resolve();
  }

  beforeEach(() => { uploadAufloesen = null; uploadRuft.length = 0; });

  // Den haengenden Upload aufloesen, sonst bleibt nach Abbruch- und
  // Zeitgrenzen-Proben ein Versprechen offen und Jest beendet sich nicht.
  // Mit --forceExit zuzudecken waere dieselbe Klasse wie ein gruener Haken,
  // der nichts prueft.
  afterEach(() => { uploadAufloesen?.({ error: null }); uploadAufloesen = null; });

  it('fertig, wenn die Übertragung vor allem anderen durchläuft', async () => {
    const lauf = uploadDocMitAusstieg('meisterbrief', datei, nie, 10_000);
    await bisZumUpload();
    expect(uploadRuft).toHaveLength(1);
    uploadAufloesen?.({ error: null });
    const e = await lauf;
    expect(e.art).toBe('fertig');
    expect(e.art === 'fertig' && e.path).toMatch(/^u-1\/meisterbrief-\d+\.jpg$/);
  });

  it('abgebrochen, wenn der Nutzer abbricht, während die Übertragung hängt', async () => {
    // Der Kern des Befunds: bis 14.09.2026 gab es diesen Ausweg nicht.
    let abbrechen!: () => void;
    const abbruch = new Promise<void>((auf) => { abbrechen = auf; });
    const lauf = uploadDocMitAusstieg('gewerbeschein', datei, abbruch, 10_000);
    await bisZumUpload();
    abbrechen();
    expect(await lauf).toEqual({ art: 'abgebrochen' });
  });

  it('Zeitgrenze greift, wenn niemand abbricht und nichts ankommt', async () => {
    const lauf = uploadDocMitAusstieg('gewerbeschein', datei, nie, 30);
    await bisZumUpload();
    expect(await lauf).toEqual({ art: 'zeit' });
  });

  it('weder Abbruch noch Zeitgrenze liefern einen Pfad', async () => {
    // Sonst schriebe der Bildschirm einen Pfad ins Profil, der nie ankam.
    let abbrechen!: () => void;
    const abbruch = new Promise<void>((auf) => { abbrechen = auf; });
    const lauf = uploadDocMitAusstieg('gewerbeschein', datei, abbruch, 10_000);
    await bisZumUpload();
    abbrechen();
    expect(await lauf).not.toHaveProperty('path');
  });

  it('die Zeitgrenze ist auf 45 Sekunden gesetzt', () => {
    expect(UPLOAD_ZEITGRENZE_MS).toBe(45_000);
  });
});
