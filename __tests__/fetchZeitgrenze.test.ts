/**
 * Tests fuer lib/fetchZeitgrenze.ts — die Zeitgrenze jeder Supabase-Abfrage.
 *
 * ANLASS (06.09.2026): Beim Kalt-Durchlauf aller 44 Bildschirme zeigte
 * /anbieter?id=<unbekannt> bei nicht antwortender Gegenstelle eine weisse
 * Flaeche mit einem einzigen Zeichen Text — nach elf Sekunden immer noch.
 * Es war das dritte Mal derselbe Befund (16.08.: /rechnung und /vertrag).
 *
 * Der Unterschied zum Netzfehler ist der ganze Punkt: ein FEHLGESCHLAGENER
 * Aufruf loest den catch-Block aus und der Bildschirm zeigt seine Meldung.
 * Ein Aufruf, der NIE antwortet, tut nichts davon — `finally` wird nie
 * erreicht, `loading` bleibt fuer immer true. Genau das passiert im
 * Funkloch, im Aufzug und im Hotel-WLAN mit vorgeschalteter Anmeldeseite.
 *
 * Diese Tests pruefen deshalb den haengenden Fall, nicht den fehlerhaften.
 */
import { baueFetchMitZeitgrenze, istUpload } from '../lib/fetchZeitgrenze';

/** Ein fetch, das nie antwortet — das Hotel-WLAN. */
function haengenderFetch(): { fetch: typeof fetch; signale: (AbortSignal | undefined)[] } {
  const signale: (AbortSignal | undefined)[] = [];
  const f = ((_e: any, init?: RequestInit) => {
    signale.push(init?.signal ?? undefined);
    return new Promise<Response>((_aufloesen, ablehnen) => {
      init?.signal?.addEventListener('abort', () => ablehnen(new Error('AbortError')));
    });
  }) as typeof fetch;
  return { fetch: f, signale };
}

/**
 * Die Mikrotask-Schlange leeren.
 *
 * Ein einzelnes `await Promise.resolve()` reicht NICHT: die Ablehnung muss
 * erst durch `.finally()` und dann durch `.catch()` wandern. Mit nur einem
 * Tick blieb `entschieden` immer false — der Upload-Test war damit gruen,
 * egal was der Code tat. Aufgefallen erst bei der Gegenprobe (Mutation
 * "Uploads bekommen doch eine Grenze" liess ihn gruen).
 */
const leeren = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

const REST = 'https://x.supabase.co/rest/v1/jobs?select=*';
const UPLOAD = 'https://x.supabase.co/storage/v1/object/verification-docs/a.jpg';

describe('fetchZeitgrenze', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('bricht eine Abfrage ab, die nicht antwortet', async () => {
    const { fetch: roh } = haengenderFetch();
    const f = baueFetchMitZeitgrenze(roh, 20000);
    let stand = 'offen';
    const beobachtet = f(REST).then(() => { stand = 'aufgeloest'; }, () => { stand = 'abgelehnt'; });

    // Kurz VOR der Grenze darf noch nichts entschieden sein. Ohne diese
    // Haelfte wuerde der Test auch eine Grenze von 1 ms durchwinken — er
    // pruefte dann nur, DASS abgebrochen wird, nicht WANN.
    jest.advanceTimersByTime(19999);
    await leeren();
    expect(stand).toBe('offen');

    jest.advanceTimersByTime(2);
    await beobachtet;
    expect(stand).toBe('abgelehnt');
  });

  it('laesst einen Upload OHNE Grenze laufen — sonst reisst der Gewerbeschein ab', async () => {
    const { fetch: roh } = haengenderFetch();
    const f = baueFetchMitZeitgrenze(roh, 20000);
    let entschieden = false;
    f(UPLOAD).then(() => { entschieden = true; }).catch(() => { entschieden = true; });

    // Zehn Minuten. Ein 10-MB-Dokument (MAX_DOC_BYTES) braucht ueber eine
    // schwache Mobilverbindung genau so lange.
    jest.advanceTimersByTime(600000);
    await leeren();
    expect(entschieden).toBe(false);
  });

  it('erkennt Upload-Adressen an /storage/v1/, nicht an der Domain', () => {
    expect(istUpload(UPLOAD)).toBe(true);
    expect(istUpload(REST)).toBe(false);
    expect(istUpload('https://x.supabase.co/auth/v1/token')).toBe(false);
  });

  it('gibt ein bereits mitgegebenes Abbruch-Signal weiter', async () => {
    const { fetch: roh } = haengenderFetch();
    const f = baueFetchMitZeitgrenze(roh, 20000);
    const aussen = new AbortController();
    const beobachtet = f(REST, { signal: aussen.signal })
      .then(() => 'aufgeloest').catch(() => 'abgelehnt');

    // Der Bildschirm wird verlassen, lange vor der Zeitgrenze.
    aussen.abort();
    await expect(beobachtet).resolves.toBe('abgelehnt');
  });

  it('raeumt die Uhr auf, wenn die Antwort rechtzeitig kommt', async () => {
    const schnell = (() => Promise.resolve({ ok: true } as Response)) as typeof fetch;
    const f = baueFetchMitZeitgrenze(schnell, 20000);
    await f(REST);
    // Bliebe die Uhr stehen, haetten wir bei jeder Abfrage einen Timer, der
    // 20 Sekunden spaeter ins Leere feuert.
    expect(jest.getTimerCount()).toBe(0);
  });
});
