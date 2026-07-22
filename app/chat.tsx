import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, KeyboardAvoidingView, Platform,
  Animated, ActivityIndicator, Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { safeBack } from '../lib/nav';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { RowSkeleton } from '../components/ui/Skeleton';
import { detectLeak, logLeakEvent, LEAKAGE_NUDGE } from '../lib/chatGuard';
import { getMessagesForJob, sendMessage, subscribeToMessages, markMessagesRead, type MessageRow } from '../lib/messages';
import { loadAccount } from '../lib/account';
import { supabase } from '../lib/supabase';
import { sendPushToUser } from '../lib/notifications';
import { proposeAppointment, respondAppointment, getProposalsForThread, type AppointmentProposal } from '../lib/appointments';
import { toast } from '../components/ui/Toast';

// ── Types ─────────────────────────────────────────────────────────────────────

type UIMessage = {
  id: string;
  from: 'customer' | 'provider';
  text: string;
  time: string;
  pending?: boolean;
  system?: boolean;   // type='system' → zentrierte Notiz statt Sprechblase
  ts?: number;        // created_at als Epoch für die Timeline-Sortierung
};

type OfferCard = {
  id: string;
  type: 'offer';
  service: string;
  price: number;
  date: string;
  duration: string;
  time: string;
};

type ChatItem = UIMessage | OfferCard;

function isOffer(item: ChatItem): item is OfferCard {
  return (item as OfferCard).type === 'offer';
}

function rowToUI(row: MessageRow): UIMessage {
  const d = new Date(row.created_at);
  const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  return { id: row.id, from: row.sender_role, text: row.body, time, system: row.type === 'system', ts: d.getTime() };
}

// "TT.MM.JJJJ HH:MM" oder "TT.MM.JJJJ" → ISO-String, sonst null.
function parseGermanDateTime(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[ ,]+(\d{1,2}):(\d{2}))?$/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, min] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), hh ? Number(hh) : 9, min ? Number(min) : 0);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function nowTime() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const router = useRouter();
  const { jobId, providerId } = useLocalSearchParams<{ jobId?: string; providerId?: string }>();
  const scrollRef = useRef<ScrollView>(null);

  const [items, setItems] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [leakWarning, setLeakWarning] = useState(false);
  const [myId, setMyId] = useState<string>('local-user');
  const [myRole, setMyRole] = useState<'customer' | 'provider'>('customer');
  const [accountReady, setAccountReady] = useState(false);
  const [headerName, setHeaderName] = useState<string | null>(null);
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [proposals, setProposals] = useState<AppointmentProposal[]>([]);
  const [apptModal, setApptModal] = useState(false);
  const [apptInput, setApptInput] = useState('');
  const [apptBusy, setApptBusy] = useState(false);
  const nudgeOpacity = useRef(new Animated.Value(0)).current;

  // Thread-Schlüssel (Migration 0510): eine Konversation ist (job, provider).
  // Der Anbieter chattet immer in seinem EIGENEN Thread; der Kunde im Thread
  // des per Param übergebenen Anbieters (Rückfrage / Vertrag).
  const threadProviderId = myRole === 'provider' ? myId : (providerId ?? undefined);

  // Load user identity
  useEffect(() => {
    loadAccount().then((acc) => {
      if (acc.userId) setMyId(acc.userId);
      if (acc.isProvider) setMyRole('provider');
      setAccountReady(true);
    });
  }, []);

  // Fetch conversation partner name + ID for message notifications
  useEffect(() => {
    if (!accountReady) return;
    if (myRole === 'provider') {
      // Anbieter-Sicht: Kundenname direkt aus dem Auftrag (funktioniert auch
      // VOR Vertragsschluss, für Rückfragen an offenen Aufträgen).
      if (!jobId) return;
      supabase
        .from('jobs')
        .select('customer_id, customer:profiles!customer_id(full_name)')
        .eq('id', jobId)
        .maybeSingle()
        .then(({ data }) => {
          const name = (data?.customer as any)?.full_name;
          if (name) setHeaderName(name);
          if (data?.customer_id) setRecipientId(data.customer_id);
        });
    } else if (providerId) {
      // Kunden-Sicht: Firmenname des Anbieters, an den geschrieben wird.
      supabase
        .from('provider_profiles')
        .select('business_name')
        .eq('id', providerId)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.business_name) setHeaderName(data.business_name);
          setRecipientId(providerId);
        });
    }
  }, [accountReady, myRole, providerId, jobId]);

  // Load history + subscribe to realtime (scoped auf den (job, provider)-Thread)
  useEffect(() => {
    if (!accountReady) return;
    if (!jobId || !threadProviderId) {
      setLoading(false);
      return;
    }

    let channel: ReturnType<typeof subscribeToMessages> | null = null;

    async function init() {
      try {
        const [rows, props] = await Promise.all([
          getMessagesForJob(jobId!, threadProviderId),
          getProposalsForThread(jobId!, threadProviderId!),
        ]);
        // 'appointment'-Nachrichten werden als Karte (aus proposals) gerendert,
        // nicht als Textblase → hier herausfiltern.
        setItems(rows.filter((r) => r.type !== 'appointment').map(rowToUI));
        setProposals(props);
        // Verlauf ist jetzt sichtbar → fremde Nachrichten als gelesen markieren
        // (Badge in der Nachrichten-Liste verschwindet beim Zurückgehen).
        markMessagesRead(jobId!, threadProviderId);
      } catch {
        // Verlauf konnte nicht geladen werden — Spinner darf nicht ewig drehen.
        toast.error('Nachrichten konnten nicht geladen werden');
      } finally {
        setLoading(false);
      }

      channel = subscribeToMessages(jobId!, (newRow) => {
        // Nur Nachrichten dieses (job, provider)-Threads übernehmen.
        if (newRow.provider_id && newRow.provider_id !== threadProviderId) return;
        // Termin-Ereignisse → Vorschläge (Status) neu laden.
        if (newRow.type === 'appointment' || newRow.type === 'system') {
          getProposalsForThread(jobId!, threadProviderId!).then(setProposals);
        }
        if (newRow.type !== 'appointment') {
          // Skip echo of own optimistic messages (already in list by id)
          setItems((prev) => {
            if (prev.some((m) => m.id === newRow.id)) return prev;
            return [...prev, rowToUI(newRow)];
          });
        }
        // Chat ist offen — eingehende fremde Nachricht sofort als gelesen markieren.
        markMessagesRead(jobId!, threadProviderId);
      });
    }

    init();
    return () => { channel?.unsubscribe(); };
  }, [jobId, threadProviderId, accountReady]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (!loading) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [items, loading]);

  function handleInputChange(text: string) {
    setInput(text);
    const { detected } = detectLeak(text);
    if (detected && !leakWarning) {
      setLeakWarning(true);
      Animated.sequence([
        Animated.timing(nudgeOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(4000),
        Animated.timing(nudgeOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => setLeakWarning(false));
    }
  }

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    const optimisticId = `opt-${Date.now()}`;
    const optimistic: UIMessage = { id: optimisticId, from: myRole, text, time: nowTime(), pending: true, ts: Date.now() };
    setItems((prev) => [...prev, optimistic]);
    setInput('');
    nudgeOpacity.setValue(0);
    setLeakWarning(false);
    setSending(true);

    if (jobId && threadProviderId) {
      const saved = await sendMessage(jobId, myId, myRole, text, threadProviderId);
      if (!saved) {
        // Senden fehlgeschlagen (sendMessage liefert null): Nachricht NICHT als
        // gesendet anzeigen — Bubble entfernen, Text zurück ins Eingabefeld,
        // Fehler melden. Vorher wurde sie fälschlich als zugestellt gerendert
        // und der Empfänger sogar per Push benachrichtigt.
        setItems((prev) => prev.filter((m) => m.id !== optimisticId));
        setInput(text);
        toast.error('Nachricht konnte nicht gesendet werden — bitte erneut versuchen');
        setSending(false);
        return;
      }
      setItems((prev) =>
        prev.map((m) => (m.id === optimisticId ? { ...rowToUI(saved) } : m)),
      );
      const { detected: hasPii, types: leakTypes } = detectLeak(text);
      if (hasPii) logLeakEvent(jobId, myId, leakTypes);

      if (recipientId) {
        const senderLabel = headerName ?? (myRole === 'customer' ? 'Kunde' : 'Anbieter');
        const notifBody = hasPii
          ? 'Sie haben eine neue Nachricht erhalten.'
          : text.length > 80 ? `${text.slice(0, 77)}…` : text;
        sendPushToUser(
          recipientId,
          `Neue Nachricht von ${senderLabel}`,
          notifBody,
          { screen: '/chat', jobId: jobId ?? '', providerId: threadProviderId ?? '' },
        );
      }
    } else if (jobId && !threadProviderId) {
      // Thread nicht auflösbar (z. B. alter Deep-Link/Push ohne providerId) —
      // NICHT still als zugestellt faken (früher: stiller Nachrichtenverlust,
      // Test-Befund H1). Nachricht zurücknehmen und Fehler zeigen.
      setItems((prev) => prev.filter((m) => m.id !== optimisticId));
      setInput(text);
      toast.error('Konversation konnte nicht geöffnet werden — bitte über die Nachrichten-Liste erneut öffnen');
    } else {
      // Kein jobId (reiner Direktkontakt-Platzhalter) — lokale Vorschau.
      setItems((prev) =>
        prev.map((m) => (m.id === optimisticId ? { ...optimistic, pending: false } : m)),
      );
    }
    setSending(false);
  }, [input, sending, jobId, threadProviderId, myId, myRole, recipientId, headerName]);

  const submitAppointment = useCallback(async () => {
    if (!jobId || !threadProviderId) return;
    const iso = parseGermanDateTime(apptInput);
    if (!iso) { toast.error('Bitte Datum wie 25.07.2026 14:00 eingeben'); return; }
    setApptBusy(true);
    const id = await proposeAppointment(jobId, threadProviderId, iso);
    setApptBusy(false);
    if (!id) { toast.error('Terminvorschlag konnte nicht gesendet werden'); return; }
    setApptModal(false);
    setApptInput('');
    setProposals(await getProposalsForThread(jobId, threadProviderId));
    if (recipientId) {
      sendPushToUser(
        recipientId,
        `Terminvorschlag von ${headerName ?? (myRole === 'provider' ? 'Anbieter' : 'Kunde')}`,
        'Neuer Terminvorschlag im Chat',
        { screen: '/chat', jobId, providerId: threadProviderId },
      );
    }
  }, [jobId, threadProviderId, apptInput, recipientId, headerName, myRole]);

  const respondToProposal = useCallback(async (id: string, accept: boolean) => {
    const ok = await respondAppointment(id, accept);
    if (!ok) { toast.error('Aktion fehlgeschlagen — bitte erneut versuchen'); return; }
    if (jobId && threadProviderId) {
      setProposals(await getProposalsForThread(jobId, threadProviderId));
      const rows = await getMessagesForJob(jobId, threadProviderId);
      setItems(rows.filter((r) => r.type !== 'appointment').map(rowToUI));
    }
  }, [jobId, threadProviderId]);

  // Timeline: Textnachrichten/System-Notizen + Terminkarten, chronologisch.
  const timeline: Array<
    | { kind: 'msg'; ts: number; msg: ChatItem }
    | { kind: 'appt'; ts: number; proposal: AppointmentProposal }
  > = [
    ...items.map((m) => ({ kind: 'msg' as const, ts: (m as UIMessage).ts ?? 0, msg: m })),
    ...proposals.map((p) => ({ kind: 'appt' as const, ts: new Date(p.created_at).getTime(), proposal: p })),
  ].sort((a, b) => a.ts - b.ts);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zurück" onPress={() => safeBack(router)} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.miniAvatar}>
            <Text style={styles.miniAvatarText}>{(headerName ?? '?').charAt(0).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.headerName}>{headerName ?? (myRole === 'provider' ? 'Kunde' : 'Anbieter')}</Text>
            {jobId ? <Text style={styles.headerSub}>#{jobId.slice(-6)}</Text> : null}
          </View>
        </View>
        {providerId ? (
          <TouchableOpacity onPress={() => router.push({ pathname: '/anbieter', params: { id: providerId } })}>
            <Ionicons name="information-circle-outline" size={24} color={C.ink} />
          </TouchableOpacity>
        ) : null}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={{ flex: 1 }}>
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.messages}
            contentContainerStyle={{ padding: 16, paddingBottom: 12 }}
            showsVerticalScrollIndicator={false}
          >
            {timeline.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="chatbubbles-outline" size={40} color={C.border} />
                <Text style={styles.emptyText}>Noch keine Nachrichten. Schreib die erste!</Text>
              </View>
            )}

            {timeline.map((entry) => {
              if (entry.kind === 'appt') {
                return <AppointmentCardView key={entry.proposal.id} p={entry.proposal} myId={myId} onRespond={respondToProposal} />;
              }
              const item = entry.msg;
              if (isOffer(item)) return <OfferCardView key={item.id} offer={item} router={router} jobId={jobId ?? ''} />;
              const um = item as UIMessage;
              if (um.system) {
                return (
                  <View key={um.id} style={styles.systemNote}>
                    <Ionicons name="checkmark-circle-outline" size={13} color={C.sub} />
                    <Text style={styles.systemNoteText}>{um.text}</Text>
                  </View>
                );
              }
              const isMe = um.from === myRole;
              return (
                <View
                  key={um.id}
                  style={[styles.bubble, isMe ? styles.bubbleMe : null]}
                >
                  <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>
                    {um.text}
                  </Text>
                  <View style={styles.bubbleMeta}>
                    {um.pending && <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" style={{ marginRight: 4 }} />}
                    <Text style={[styles.bubbleTime, isMe && { color: 'rgba(255,255,255,0.6)' }]}>
                      {um.time}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* Anti-leakage nudge */}
        <Animated.View style={[styles.leakNudge, { opacity: nudgeOpacity }]} pointerEvents="none">
          <Ionicons name="shield-checkmark-outline" size={14} color={C.amber} />
          <Text style={styles.leakNudgeText}>{LEAKAGE_NUDGE}</Text>
        </Animated.View>

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity
            style={styles.apptBtn}
            onPress={() => setApptModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Termin vorschlagen"
            disabled={!jobId || !threadProviderId}
          >
            <Ionicons name="calendar-outline" size={20} color={(!jobId || !threadProviderId) ? C.muted : C.primary} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={handleInputChange}
            placeholder="Nachricht schreiben …"
            placeholderTextColor={C.muted}
            multiline
            maxLength={2000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendBtn, input.length > 0 && !sending && styles.sendBtnActive]}
            onPress={handleSend}
            disabled={sending || input.length === 0 || !jobId}
            activeOpacity={0.8}
          >
            {sending
              ? <ActivityIndicator size="small" color={C.surface} />
              : <Ionicons name="send" size={18} color={input.length > 0 ? C.surface : C.muted} />
            }
          </TouchableOpacity>
        </View>

        {/* Termin-vorschlagen-Modal */}
        <Modal visible={apptModal} transparent animationType="fade" onRequestClose={() => setApptModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Termin vorschlagen</Text>
              <Text style={styles.modalHint}>Datum und Uhrzeit, z. B. 25.07.2026 14:00</Text>
              <TextInput
                style={styles.modalInput}
                value={apptInput}
                onChangeText={setApptInput}
                placeholder="TT.MM.JJJJ HH:MM"
                placeholderTextColor={C.muted}
                autoFocus
              />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setApptModal(false)} accessibilityRole="button">
                  <Text style={styles.modalCancelText}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirm} onPress={submitAppointment} disabled={apptBusy} accessibilityRole="button">
                  {apptBusy ? <ActivityIndicator size="small" color={C.surface} /> : <Text style={styles.modalConfirmText}>Vorschlagen</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Appointment card sub-component ────────────────────────────────────────────

function AppointmentCardView({ p, myId, onRespond }: {
  p: AppointmentProposal;
  myId: string;
  onRespond: (id: string, accept: boolean) => void;
}) {
  const when = new Date(p.proposed_at).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Berlin',
  });
  const iProposed = p.proposed_by === myId;
  return (
    <View style={styles.apptCard}>
      <View style={styles.apptHeader}>
        <Ionicons name="calendar" size={15} color={C.primary} />
        <Text style={styles.apptHeaderText}>Terminvorschlag</Text>
      </View>
      <Text style={styles.apptWhen}>{when}</Text>
      {p.status === 'accepted' && (
        <View style={styles.apptStatusRow}>
          <Ionicons name="checkmark-circle" size={15} color={C.primary} />
          <Text style={[styles.apptStatusText, { color: C.primary }]}>Bestätigt</Text>
        </View>
      )}
      {p.status === 'rejected' && (
        <View style={styles.apptStatusRow}>
          <Ionicons name="close-circle" size={15} color={C.muted} />
          <Text style={[styles.apptStatusText, { color: C.muted }]}>Abgelehnt</Text>
        </View>
      )}
      {p.status === 'superseded' && (
        <View style={styles.apptStatusRow}>
          <Ionicons name="time-outline" size={15} color={C.muted} />
          <Text style={[styles.apptStatusText, { color: C.muted }]}>Überholt</Text>
        </View>
      )}
      {p.status === 'pending' && iProposed && (
        <Text style={styles.apptStatusText}>Warte auf Antwort …</Text>
      )}
      {p.status === 'pending' && !iProposed && (
        <View style={styles.apptActions}>
          <TouchableOpacity style={styles.apptReject} onPress={() => onRespond(p.id, false)} accessibilityRole="button">
            <Text style={styles.apptRejectText}>Ablehnen</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.apptAccept} onPress={() => onRespond(p.id, true)} accessibilityRole="button">
            <Text style={styles.apptAcceptText}>Annehmen</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Offer card sub-component ──────────────────────────────────────────────────

function OfferCardView({ offer, router, jobId }: { offer: OfferCard; router: ReturnType<typeof useRouter>; jobId: string }) {
  return (
    <View style={styles.offerCard}>
      <View style={styles.offerHeader}>
        <Ionicons name="document-text" size={16} color={C.gold} />
        <Text style={styles.offerHeaderText}>Verbindliches Angebot</Text>
        <Text style={styles.offerTime}>{offer.time}</Text>
      </View>
      <View style={styles.offerBody}>
        <OfferRow label="Leistung" value={offer.service} />
        <OfferRow label="Preis"    value={`€${offer.price} (verbindlich)`} bold />
        <OfferRow label="Termin"   value={offer.date} />
        <OfferRow label="Dauer"    value={offer.duration} />
      </View>
      <View style={styles.escrowNotice}>
        <Ionicons name="lock-closed" size={13} color={C.amber} />
        <Text style={styles.escrowText}>
          Zahlung wird erst nach Auftragsabschluss freigegeben (Escrow)
        </Text>
      </View>
      <View style={styles.offerActions}>
        <TouchableOpacity style={styles.declineBtn} activeOpacity={0.8}>
          <Text style={styles.declineBtnText}>Ablehnen</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.acceptBtn}
          onPress={() => router.push({ pathname: '/vertrag', params: { jobId: jobId ?? '' } })}
          activeOpacity={0.85}
        >
          <Ionicons name="checkmark" size={16} color={C.surface} />
          <Text style={styles.acceptBtnText}>Annehmen & Vertrag</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function OfferRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
      <Text style={{ fontSize: 12, color: C.sub }}>{label}</Text>
      <Text style={{ fontSize: 13, color: C.ink, fontWeight: bold ? '700' : '500' }}>{value}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: C.bg },
  header:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn:            { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerInfo:         { flexDirection: 'row', alignItems: 'center', gap: 10 },
  miniAvatar:         { width: 36, height: 36, borderRadius: 18, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center' },
  miniAvatarText:     { fontSize: 15, fontWeight: '700', color: C.gold },
  headerName:         { fontSize: 14, fontWeight: '700', color: C.ink },
  headerSub:          { fontSize: 11, color: C.sub },
  loadingCenter:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messages:           { flex: 1, backgroundColor: C.bg },
  emptyState:         { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12 },
  emptyText:          { fontSize: 14, color: C.muted, textAlign: 'center' },
  bubble:             { maxWidth: '80%', borderRadius: 14, padding: 12, marginBottom: 8, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignSelf: 'flex-start' },
  bubbleMe:           { backgroundColor: C.ink, alignSelf: 'flex-end', borderColor: C.ink },
  bubbleText:         { fontSize: 14, color: C.ink, lineHeight: 20 },
  bubbleTextMe:       { color: C.surface },
  bubbleMeta:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  bubbleTime:         { fontSize: 10, color: C.muted },
  offerCard:          { backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.gold, borderRadius: 14, overflow: 'hidden', marginVertical: 8 },
  offerHeader:        { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.goldBg, paddingHorizontal: 14, paddingVertical: 10 },
  offerHeaderText:    { flex: 1, fontSize: 13, fontWeight: '700', color: C.gold },
  offerTime:          { fontSize: 11, color: C.amber },
  offerBody:          { padding: 14 },
  escrowNotice:       { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.amberBg, paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 14, borderRadius: 8, marginBottom: 14 },
  escrowText:         { flex: 1, fontSize: 11, color: C.amber, lineHeight: 16 },
  offerActions:       { flexDirection: 'row', gap: 10, padding: 14, paddingTop: 0 },
  declineBtn:         { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, alignItems: 'center' },
  declineBtnText:     { fontSize: 14, fontWeight: '600', color: C.sub },
  acceptBtn:          { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: C.primary },
  acceptBtnText:      { fontSize: 14, fontWeight: '700', color: C.surface },
  leakNudge:          { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.amberBg, borderTopWidth: 1, borderTopColor: C.goldBd, paddingHorizontal: 16, paddingVertical: 10 },
  leakNudgeText:      { flex: 1, fontSize: 12, color: C.amber, lineHeight: 17 },
  inputBar:           { flexDirection: 'row', alignItems: 'flex-end', gap: 10, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: 16, paddingVertical: 10, paddingBottom: 16 },
  input:              { flex: 1, backgroundColor: C.bg, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: C.ink, maxHeight: 100 },
  apptBtn:            { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  // System-Notiz (zentriert, keine Sprechblase)
  systemNote:         { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 5, backgroundColor: C.bgWarm, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, marginVertical: 8 },
  systemNoteText:     { fontSize: 12, color: C.sub, fontWeight: '500' },

  // Terminvorschlag-Karte
  apptCard:           { alignSelf: 'stretch', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 12, marginBottom: 8 },
  apptHeader:         { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  apptHeaderText:     { fontSize: 12, fontWeight: '700', color: C.primary, textTransform: 'uppercase', letterSpacing: 0.3 },
  apptWhen:           { fontSize: 16, fontWeight: '700', color: C.ink, marginBottom: 8 },
  apptStatusRow:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
  apptStatusText:     { fontSize: 13, fontWeight: '600', color: C.sub },
  apptActions:        { flexDirection: 'row', gap: 8, marginTop: 4 },
  apptReject:         { flex: 1, minHeight: 44, borderWidth: 1, borderColor: C.border, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  apptRejectText:     { fontSize: 14, fontWeight: '700', color: C.ink },
  apptAccept:         { flex: 1, minHeight: 44, backgroundColor: C.primary, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  apptAcceptText:     { fontSize: 14, fontWeight: '700', color: C.surface },

  // Termin-Modal
  modalOverlay:       { flex: 1, backgroundColor: C.overlay, justifyContent: 'center', paddingHorizontal: 28 },
  modalCard:          { backgroundColor: C.surface, borderRadius: 16, padding: 20 },
  modalTitle:         { fontSize: 18, fontWeight: '700', color: C.ink, marginBottom: 4 },
  modalHint:          { fontSize: 12, color: C.sub, marginBottom: 12 },
  modalInput:         { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: C.ink },
  modalActions:       { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalCancel:        { flex: 1, minHeight: 46, borderWidth: 1, borderColor: C.border, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalCancelText:    { fontSize: 15, fontWeight: '700', color: C.ink },
  modalConfirm:       { flex: 1, minHeight: 46, backgroundColor: C.primary, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalConfirmText:   { fontSize: 15, fontWeight: '700', color: C.surface },
  sendBtn:            { width: 40, height: 40, borderRadius: 20, backgroundColor: C.border, alignItems: 'center', justifyContent: 'center' },
  sendBtnActive:      { backgroundColor: C.primary },
});
