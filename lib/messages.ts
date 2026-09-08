// Messages data-layer — Supabase-backed.
// Table: messages (id, job_id, sender_id, sender_role, body, created_at)
// RLS: users can only read/write messages where their user_id matches sender_id
//      OR where they are a party to the job (job.customer_id or job.provider_id).
// Realtime: enabled via migration 008_enable_realtime_messages.sql

import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { MAIL } from '../constants/legal';

export type MessageRow = {
  id: string;
  job_id: string;
  sender_id: string;
  sender_role: 'customer' | 'provider';
  body: string;
  created_at: string;
  read_at?: string | null;
  // Thread-Schlüssel (Migration 0510): eine Konversation ist (job, provider).
  // Erlaubt Vor-Vertrags-Rückfragen mehrerer Anbieter am selben Auftrag.
  provider_id?: string | null;
  // Nachrichtentyp (Migration 0520): text | system | appointment.
  type?: 'text' | 'system' | 'appointment';
};

/**
 * Markiert alle fremden Nachrichten eines Jobs als gelesen (Migration 0490).
 * Security-definer-RPC prüft serverseitig, dass der Aufrufer Job-Partei ist.
 * Fehler sind unkritisch (Badge bleibt dann stehen) — nicht werfen.
 */
export async function markMessagesRead(jobId: string, providerId?: string): Promise<void> {
  const { error } = await supabase.rpc('mark_messages_read', {
    p_job_id: jobId,
    p_provider_id: providerId ?? null,
  });
  if (error) console.warn('[messages] markMessagesRead error:', error.message);
}

/**
 * Anzahl ungelesener fremder Nachrichten pro Job (RLS begrenzt ohnehin auf
 * eigene Jobs). Ein Query für alle Konversationen statt N Einzel-Counts.
 */
export async function getUnreadCounts(userId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('messages')
    .select('job_id, provider_id')
    .is('read_at', null)
    .neq('sender_id', userId);
  if (error || !data) return {};
  // Schlüssel = `${job_id}:${provider_id}` — ein Thread pro (Auftrag, Anbieter).
  const counts: Record<string, number> = {};
  for (const row of data as { job_id: string; provider_id: string | null }[]) {
    const key = `${row.job_id}:${row.provider_id ?? ''}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/**
 * Fetch messages for a conversation, ordered ascending by creation time.
 * Ein Thread ist (job, provider): mit providerId wird auf genau diesen
 * Anbieter-Thread gefiltert (Vor-Vertrags-Rückfragen, Migration 0510).
 */
export async function getMessagesForJob(jobId: string, providerId?: string): Promise<MessageRow[]> {
  let q = supabase
    .from('messages')
    .select('id, job_id, sender_id, sender_role, body, created_at, provider_id, type')
    .eq('job_id', jobId);
  if (providerId) q = q.eq('provider_id', providerId);

  const { data, error } = await q.order('created_at', { ascending: true });

  if (error) {
    console.warn('[messages] getMessagesForJob error:', error.message);
    return [];
  }
  return (data ?? []) as MessageRow[];
}

/** Send a message for a job. sender_id is the currently authenticated user. */
export async function sendMessage(
  jobId: string,
  senderId: string,
  senderRole: 'customer' | 'provider',
  body: string,
  providerId: string,
): Promise<MessageRow | null> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ job_id: jobId, sender_id: senderId, sender_role: senderRole, body, provider_id: providerId })
    .select()
    .single();

  if (error) {
    console.warn('[messages] sendMessage error:', error.message);
    return null;
  }
  return data as MessageRow;
}

const NEUTRAL_SEND_ERROR = 'Nachricht konnte nicht gesendet werden, bitte erneut versuchen.';

/**
 * Erklärt, WARUM das Senden fehlgeschlagen ist. Die RLS-Ablehnung liefert nur
 * „new row violates row-level security policy" — die UI zeigte daraufhin
 * „bitte erneut versuchen", obwohl ein erneuter Versuch bei einer strukturellen
 * Sperre nie funktionieren kann (Founder-Befund 26.07.).
 *
 * `isCustomerOfJob` ist zwingend: Der Kundenzweig der Send-Policy (0510:43-45)
 * hat KEINE dieser Bedingungen — weder E-Mail-Gate noch Strike-Sperre noch
 * Track-Trennung. Eine rollenblinde Diagnose behauptete einem Kunden mit
 * Anbieterprofil und 3 Strikes „dein Anbieter-Konto ist gesperrt", obwohl das
 * beweisbar nicht die Ursache war (gegen echtes Postgres nachgestellt).
 *
 * Reihenfolge entspricht den Bedingungen des Anbieterzweigs (0510:49-66).
 */
export async function explainSendFailure(
  isCustomerOfJob: boolean,
  jobId?: string,
): Promise<string> {
  // Als Kunde gibt es keine dieser strukturellen Sperren — nicht raten.
  if (isCustomerOfJob) return NEUTRAL_SEND_ERROR;

  try {
    // Dieselbe Funktion, die auch die RLS-Gates nutzen (0400/0430).
    const { data: confirmed, error } = await supabase.rpc('auth_email_confirmed');
    if (!error && confirmed === false) {
      return 'Ihre E-Mail-Adresse ist noch nicht bestätigt. Unter Einstellungen → Konto können Sie die Bestätigungs-Mail erneut anfordern.';
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NEUTRAL_SEND_ERROR;

    const { data: pp } = await supabase
      .from('provider_profiles')
      .select('is_nachbarschaft')
      .eq('id', user.id)
      .maybeSingle<{ is_nachbarschaft: boolean | null }>();

    // Bewusst NICHT provider_profiles.strike_count: die Spalte wird nur beim
    // Erteilen nachgefuehrt. Ein Strike verfaellt aber durch blossen
    // Zeitablauf (AGB §7(3), Migration 0720) — dabei findet kein
    // Schreibvorgang statt, und der Wert bliebe zu hoch stehen. Der Anbieter
    // bekaeme dann gesagt, er sei gesperrt, obwohl er wieder bieten darf.
    // aktive_strikes() rechnet zum Zeitpunkt der Abfrage.
    // meine_aktiven_strikes() statt aktive_strikes(p_provider): die Fassung mit
    // Argument war fuer jeden Angemeldeten aufrufbar und lieferte die Verstoesse
    // JEDES Anbieters (Pentest 07.09.2026, Migration 0820). Was kein Argument
    // hat, kann auch nicht auf einen Fremden zeigen.
    const { data: aktiveStrikes } = await supabase
      .rpc('meine_aktiven_strikes');
    if ((aktiveStrikes ?? 0) >= 3) {
      // kontakt@werkant.de, nicht support@ — AGB §7(5) nennt genau diese
      // Adresse fuer Beschwerden gegen eine Sperrung.
      return 'Ihr Anbieter-Konto ist wegen mehrfacher Regelverstöße gesperrt. '
        + `Sie können jederzeit Beschwerde an ${MAIL.kontakt} richten; `
        + 'die Gründe finden Sie in Ihrem Betriebs-Dashboard.';
    }

    // Dritte Sperre des Anbieterzweigs (0510:56-66): Nachbarschafts-Helfer
    // dürfen auf Handwerks-Aufträgen nicht schreiben.
    if (pp?.is_nachbarschaft && jobId) {
      const { data: job } = await supabase
        .from('jobs')
        .select('track')
        .eq('id', jobId)
        .maybeSingle<{ track: string | null }>();
      if (job?.track && job.track !== 'nachbarschaft') {
        return 'Dieser Auftrag gehört zum Handwerks-Bereich. Als Nachbarschaftshilfe kannst du dort nicht schreiben.';
      }
    }
  } catch {
    // Diagnose ist Zusatznutzen — im Fehlerfall die neutrale Meldung.
  }
  return NEUTRAL_SEND_ERROR;
}

export type ConversationSummary = {
  jobId: string;
  jobTitle: string;
  providerId: string;
  businessName: string;
  lastMessage: string;
  lastMessageAt: string;
  isFromMe: boolean;
  unreadCount: number;
};

/**
 * Kunden-Inbox: eine Zeile pro (Auftrag, Anbieter)-Thread mit mindestens einer
 * Nachricht, neueste zuerst. Nachrichten-basiert statt vertrags-basiert, damit
 * auch Vor-Vertrags-Rückfragen erscheinen (Migration 0510). RLS liefert dem
 * Kunden ohnehin nur Threads seiner eigenen Aufträge.
 */
export async function getConversationList(userId: string): Promise<ConversationSummary[]> {
  // Fruehere Fassung holte ALLE Nachrichten aller eigenen Auftraege ohne
  // `limit`, sortierte sie und behielt in JavaScript nur die jeweils neueste
  // pro Gespraech. Bei 300 Gespraechen mit je 40 Nachrichten waren das 12.000
  // Zeilen ueber die Leitung, um 300 anzuzeigen — und drei Rundreisen zur
  // Datenbank (jobs, messages, provider_public).
  //
  // `konversationen_kunde` (Migration 0760) macht daraus eine Abfrage, deren
  // Ergebnis durch die Zahl der GESPRAECHE begrenzt ist. Die Funktion liest
  // den Nutzer aus auth.uid(); `userId` wird hier nur noch fuer die
  // Ungelesen-Zaehler gebraucht.
  const { data, error } = await supabase.rpc('konversationen_kunde');
  if (error || !data?.length) return [];

  const unread = await getUnreadCounts(userId);

  return (data as any[]).map((r) => ({
    jobId: r.job_id,
    jobTitle: r.job_titel,
    providerId: r.provider_id,
    businessName: r.business_name,
    lastMessage: r.letzte_nachricht,
    lastMessageAt: r.letzte_am,
    isFromMe: r.von_mir,
    unreadCount: unread[`${r.job_id}:${r.provider_id}`] ?? 0,
  } satisfies ConversationSummary));
}

/**
 * Anbieter-Inbox: eine Zeile pro Auftrag, in dem der Anbieter einen eigenen
 * Thread hat. Spiegelbild zu getConversationList — dort ist der Einstieg
 * `jobs.customer_id`, hier `messages.provider_id`, denn ein Anbieter ist keine
 * Partei des Auftrags, solange kein Vertrag besteht.
 *
 * Ohne diese Liste war die Rückfrage eine Sackgasse: Sobald der Auftrag nicht
 * mehr `open` war, gab es in der App keinen Weg zurück in den eigenen Thread
 * (Review-Befund 26.07.).
 *
 * Der Kundenname bleibt bewusst verborgen, solange kein Vertrag besteht —
 * `profiles` ist erst für Vertragsparteien lesbar (Migration 0030). Vorher
 * steht schlicht „Kunde".
 */
export async function getProviderConversationList(userId: string): Promise<ConversationSummary[]> {
  // Wie bei der Kunden-Inbox: vorher eine unbegrenzte Abfrage saemtlicher
  // Nachrichten des Anbieters. Zusaetzlich passte der Index nicht — er lag
  // auf (job_id, provider_id), gefiltert wird hier aber NUR nach provider_id.
  // Migration 0760 legt (provider_id, created_at desc) nach.
  const { data, error } = await supabase.rpc('konversationen_anbieter');
  if (error || !data?.length) return [];

  const unread = await getUnreadCounts(userId);

  return (data as any[]).map((r) => ({
    jobId: r.job_id,
    jobTitle: r.job_titel,
    providerId: userId,
    // Vorher stand hier fest 'Kunde' — jede Zeile im Posteingang hiess gleich.
    // Der Kommentar behauptete, das gelte nur ohne Vertrag; der Code pruefte
    // es nie. Jetzt liefert die Datenbank den Namen, sobald die
    // profiles-Policy (0030) ihn freigibt, und sonst NULL (0790).
    businessName: r.kunde_name ?? 'Kunde',
    lastMessage: r.letzte_nachricht,
    lastMessageAt: r.letzte_am,
    isFromMe: r.von_mir,
    unreadCount: unread[`${r.job_id}:${userId}`] ?? 0,
  } satisfies ConversationSummary));
}

/**
 * Subscribe to new messages for a job via Supabase Realtime.
 * Returns the channel — caller must call channel.unsubscribe() on cleanup.
 */
export function subscribeToMessages(
  jobId: string,
  onNewMessage: (msg: MessageRow) => void,
): RealtimeChannel {
  return supabase
    .channel(`messages:job_id=eq.${jobId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `job_id=eq.${jobId}`,
      },
      (payload) => onNewMessage(payload.new as MessageRow),
    )
    .subscribe();
}
