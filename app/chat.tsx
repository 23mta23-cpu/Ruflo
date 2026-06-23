import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, KeyboardAvoidingView, Platform,
  Animated, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { RowSkeleton } from '../components/ui/Skeleton';
import { detectLeak, LEAKAGE_NUDGE } from '../lib/chatGuard';
import { getMessagesForJob, sendMessage, subscribeToMessages, type MessageRow } from '../lib/messages';
import { loadAccount } from '../lib/account';
import { supabase } from '../lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

type UIMessage = {
  id: string;
  from: 'customer' | 'provider';
  text: string;
  time: string;
  pending?: boolean;
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
  return { id: row.id, from: row.sender_role, text: row.body, time };
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
  const [headerName, setHeaderName] = useState<string | null>(null);
  const [recipientPushToken, setRecipientPushToken] = useState<string | null>(null);
  const nudgeOpacity = useRef(new Animated.Value(0)).current;

  // Load user identity
  useEffect(() => {
    loadAccount().then((acc) => {
      if (acc.userId) setMyId(acc.userId);
      if (acc.isProvider) setMyRole('provider');
    });
  }, []);

  // Fetch conversation partner name + push token for message notifications
  useEffect(() => {
    if (providerId) {
      // Customer view: fetch provider's business name + profile push_token
      supabase
        .from('provider_profiles')
        .select('business_name, id')
        .eq('id', providerId)
        .single()
        .then(async ({ data }) => {
          if (data?.business_name) setHeaderName(data.business_name);
          const { data: prof } = await supabase.from('profiles').select('push_token').eq('id', providerId).single<{ push_token: string | null }>();
          if (prof?.push_token) setRecipientPushToken(prof.push_token);
        });
    } else if (jobId) {
      // Provider view: fetch customer's name + push token from the job's contract
      supabase
        .from('contracts')
        .select('customer_id, customer:profiles!customer_id(full_name, push_token)')
        .eq('job_id', jobId)
        .limit(1)
        .single()
        .then(({ data }) => {
          const name = (data?.customer as any)?.full_name;
          const token = (data?.customer as any)?.push_token;
          if (name) setHeaderName(name);
          if (token) setRecipientPushToken(token);
        });
    }
  }, [providerId, jobId]);

  // Load history + subscribe to realtime
  useEffect(() => {
    if (!jobId) {
      setLoading(false);
      return;
    }

    let channel: ReturnType<typeof subscribeToMessages> | null = null;

    async function init() {
      const rows = await getMessagesForJob(jobId!);
      setItems(rows.map(rowToUI));
      setLoading(false);

      channel = subscribeToMessages(jobId!, (newRow) => {
        // Skip echo of own optimistic messages (already in list by id)
        setItems((prev) => {
          if (prev.some((m) => m.id === newRow.id)) return prev;
          return [...prev, rowToUI(newRow)];
        });
      });
    }

    init();
    return () => { channel?.unsubscribe(); };
  }, [jobId]);

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
    const optimistic: UIMessage = { id: optimisticId, from: myRole, text, time: nowTime(), pending: true };
    setItems((prev) => [...prev, optimistic]);
    setInput('');
    nudgeOpacity.setValue(0);
    setLeakWarning(false);
    setSending(true);

    if (jobId) {
      const saved = await sendMessage(jobId, myId, myRole, text);
      setItems((prev) =>
        prev.map((m) =>
          m.id === optimisticId
            ? saved ? { ...rowToUI(saved) } : { ...optimistic, pending: false }
            : m,
        ),
      );
      if (recipientPushToken) {
        const senderLabel = headerName ?? (myRole === 'customer' ? 'Kunde' : 'Anbieter');
        const { detected: hasPii } = detectLeak(text);
        const notifBody = hasPii
          ? 'Sie haben eine neue Nachricht erhalten.'
          : text.length > 80 ? `${text.slice(0, 77)}…` : text;
        fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: recipientPushToken,
            title: `Neue Nachricht von ${senderLabel}`,
            body: notifBody,
            data: { screen: '/chat', jobId },
            sound: 'default',
          }),
        }).catch(() => {});
      }
    } else {
      // No jobId: local only (demo mode)
      setItems((prev) =>
        prev.map((m) => (m.id === optimisticId ? { ...optimistic, pending: false } : m)),
      );
    }
    setSending(false);
  }, [input, sending, jobId, myId, myRole, recipientPushToken, headerName]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
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
            {items.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="chatbubbles-outline" size={40} color={C.border} />
                <Text style={styles.emptyText}>Noch keine Nachrichten. Schreib die erste!</Text>
              </View>
            )}

            {items.map((item) => {
              if (isOffer(item)) return <OfferCardView key={item.id} offer={item} router={router} jobId={jobId ?? ''} />;
              const isMe = item.from === myRole;
              return (
                <View
                  key={item.id}
                  style={[styles.bubble, isMe ? styles.bubbleMe : null]}
                >
                  <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>
                    {item.text}
                  </Text>
                  <View style={styles.bubbleMeta}>
                    {item.pending && <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" style={{ marginRight: 4 }} />}
                    <Text style={[styles.bubbleTime, isMe && { color: 'rgba(255,255,255,0.6)' }]}>
                      {item.time}
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
            disabled={sending || input.length === 0}
            activeOpacity={0.8}
          >
            {sending
              ? <ActivityIndicator size="small" color={C.surface} />
              : <Ionicons name="send" size={18} color={input.length > 0 ? C.surface : C.muted} />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
        <OfferRow label="Preis"    value={`€${offer.price} (Festpreis)`} bold />
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
  sendBtn:            { width: 40, height: 40, borderRadius: 20, backgroundColor: C.border, alignItems: 'center', justifyContent: 'center' },
  sendBtnActive:      { backgroundColor: C.primary },
});
