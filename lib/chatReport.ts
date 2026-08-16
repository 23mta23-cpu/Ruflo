/**
 * Eine erhaltene Nachricht melden (Migration 0700).
 *
 * Warum es diesen Weg zusaetzlich zu lib/chatGuard.ts gibt:
 * `logLeakEvent()` schreibt `chat_leak_flags`, und dessen RLS erlaubt das
 * ausschliesslich dem ABSENDER (`auth.uid() = sender_id`). Die Erkennung
 * haengt damit am Geraet desjenigen, gegen den sie sich richtet — wer die
 * Nummer bewusst weitergibt, ist genau die Person, deren Client den Fund
 * melden muesste. Ein aelterer Client, ein veraenderter Client oder eine
 * Schreibweise, die die Regex nicht trifft ("null eins sieben null"), erzeugt
 * gar keinen Fund. Der Empfaenger sah die Nummer und konnte nichts tun.
 *
 * Founder-Befund 16.08.2026: "es wird eine nummer weitergegeben kein strike
 * erhalten man kann auch nicht melden".
 */

import { supabase } from './supabase';

export type MeldeGrund =
  | 'kontaktdaten'
  | 'zahlung_ausserhalb'
  | 'beleidigung'
  | 'spam'
  | 'sonstiges';

export const MELDE_GRUENDE: { id: MeldeGrund; label: string }[] = [
  { id: 'kontaktdaten',       label: 'Telefonnummer, E-Mail oder Adresse geschickt' },
  { id: 'zahlung_ausserhalb', label: 'Zahlung außerhalb von Werkant vorgeschlagen' },
  { id: 'beleidigung',        label: 'Beleidigend oder bedrohlich' },
  { id: 'spam',               label: 'Werbung oder Spam' },
  { id: 'sonstiges',          label: 'Etwas anderes' },
];

export type MeldeErgebnis = 'ok' | 'schon_gemeldet' | 'fehler';

/**
 * Meldet eine Nachricht. Die Datenbank prueft dabei selbst, dass der Melder
 * Partei des Auftrags ist und der Gemeldete die andere Partei — der Client
 * entscheidet das nicht.
 *
 * Absichtlich KEIN automatischer Strike: eine Meldung ist frei ausloesbar,
 * drei davon wuerden sonst genuegen, um einen Anbieter zu sperren. Die
 * Meldung ist ein Pruefsignal fuer die Nachpruefung durch einen Menschen.
 */
export async function meldeNachricht(params: {
  jobId: string;
  messageId: string | null;
  reporterId: string;
  reportedId: string;
  grund: MeldeGrund;
  notiz?: string;
}): Promise<MeldeErgebnis> {
  const { error } = await supabase.from('chat_reports').insert({
    job_id: params.jobId,
    message_id: params.messageId,
    reporter_id: params.reporterId,
    reported_id: params.reportedId,
    grund: params.grund,
    notiz: params.notiz?.trim() ? params.notiz.trim().slice(0, 500) : null,
  });

  if (!error) return 'ok';
  // 23505 = unique_violation: dieselbe Nachricht wurde von dieser Person schon
  // gemeldet. Das ist kein Fehler des Nutzers und darf nicht als solcher
  // aussehen — sonst tippt er weiter, weil er denkt, es habe nicht geklappt.
  if ((error as { code?: string }).code === '23505') return 'schon_gemeldet';
  return 'fehler';
}
