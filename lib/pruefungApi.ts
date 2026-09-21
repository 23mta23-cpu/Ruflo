/**
 * Die Aufrufe an die Edge Function `pruefung`.
 *
 * GETRENNT von lib/pruefung.ts, und das ist kein Ordnungssinn: die reine Logik
 * dort darf `lib/supabase.ts` NICHT importieren. Sonst zieht sie
 * `expo-constants` mit, Jest kann die Datei nicht laden, und die Testdatei
 * meldet dann „0 Tests" statt rot zu werden.
 *
 * Genau das ist am 14.09.2026 passiert: der Gesamtlauf zeigte weiter
 * „555 passed", weil eine Suite, die gar nicht laedt, keine roten Tests hat.
 * Ein gruener Haken, der nichts prueft — diesmal im Testlauf selbst.
 */

import { supabase, SUPABASE_FUNCTIONS_URL } from './supabase';
import type { Einreichung } from './pruefung';

export type EinreichungMitLinks = Einreichung & {
  gewerbeschein_url: string | null;
  meisterbrief_url: string | null;
};

async function rufen(koerper: Record<string, unknown>): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  return fetch(`${SUPABASE_FUNCTIONS_URL}/pruefung`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    },
    body: JSON.stringify(koerper),
  });
}

export type ListenErgebnis =
  | { art: 'ok'; einreichungen: EinreichungMitLinks[]; linkGiltSekunden: number }
  | { art: 'kein_betreiber' }
  | { art: 'fehler'; text: string };

export async function einreichungenLaden(): Promise<ListenErgebnis> {
  try {
    const a = await rufen({ aktion: 'liste' });
    // 404 ist die Antwort fuer „nicht Betreiber". Absichtlich ununterscheidbar
    // von „gibt es nicht": wer nicht Betreiber ist, soll nicht erfahren, dass
    // es diesen Weg gibt.
    if (a.status === 404 || a.status === 401) return { art: 'kein_betreiber' };
    if (!a.ok) return { art: 'fehler', text: 'Die Liste konnte nicht geladen werden.' };
    const j = await a.json();
    return {
      art: 'ok',
      einreichungen: (j.einreichungen ?? []) as EinreichungMitLinks[],
      linkGiltSekunden: Number(j.link_gilt_sekunden ?? 0),
    };
  } catch {
    return { art: 'fehler', text: 'Keine Verbindung zum Prüf-Postfach.' };
  }
}

export type EntscheidErgebnis = { ok: true } | { ok: false; text: string };

export async function entscheiden(
  providerId: string,
  aktion: 'freigeben' | 'ablehnen',
  grund?: string,
): Promise<EntscheidErgebnis> {
  try {
    const a = await rufen({ aktion, providerId, ...(grund ? { grund } : {}) });
    if (a.ok) return { ok: true };
    const j = await a.json().catch(() => ({}));
    return { ok: false, text: j?.error ?? 'Die Entscheidung wurde nicht gespeichert.' };
  } catch {
    return { ok: false, text: 'Keine Verbindung. Es wurde nichts gespeichert.' };
  }
}

/** Dieselbe Untergrenze wie im Server, damit das Formular sie anzeigen kann. */
export const MIN_ABLEHNUNGSGRUND = 20;

/**
 * Was sonst noch auf einen Menschen wartet: Reklamationen und
 * Inhalts-Meldungen. AUSDRUECKLICH NUR LESEND (Begruendung in der Edge
 * Function): eine Entscheidung ueber eine Reklamation bewegt Geld.
 */
export type WartendeReklamation = {
  id: string;
  case_id: string;
  category: string;
  description: string | null;
  status: string;
  created_at: string | null;
  contract?: { id: string; customer_total: number | null; provider_payout: number | null } | null;
};

export type WartendeMeldung = {
  id: string;
  inhalt_art: string;
  fundstelle: string;
  begruendung: string | null;
  eingegangen_am: string | null;
  melder_name: string;
};

export type WartendesErgebnis =
  | { art: 'ok'; reklamationen: WartendeReklamation[]; meldungen: WartendeMeldung[] }
  | { art: 'kein_betreiber' }
  | { art: 'fehler'; text: string };

export async function wartendesLaden(): Promise<WartendesErgebnis> {
  try {
    const a = await rufen({ aktion: 'wartendes' });
    if (a.status === 404 || a.status === 401) return { art: 'kein_betreiber' };
    if (!a.ok) return { art: 'fehler', text: 'Die Vorgänge konnten nicht geladen werden.' };
    const j = await a.json();
    return {
      art: 'ok',
      reklamationen: (j.reklamationen ?? []) as WartendeReklamation[],
      meldungen: (j.meldungen ?? []) as WartendeMeldung[],
    };
  } catch {
    return { art: 'fehler', text: 'Keine Verbindung zum Prüf-Postfach.' };
  }
}
