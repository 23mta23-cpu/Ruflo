<<<<<<< HEAD
import React, { useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, KeyboardAvoidingView, Platform,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { T } from '../constants/typography';
import { showAlert } from '../lib/alert';
import { checkMessage, NUDGE_MESSAGE } from '../lib/chatGuard';

const SCREEN_WIDTH = Dimensions.get('window').width;
const BUBBLE_MAX_WIDTH = SCREEN_WIDTH * 0.75;
=======
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
>>>>>>> main

// ── Types ─────────────────────────────────────────────────────────────────────

type UIMessage = {
  id: string;
<<<<<<< HEAD
  from: 'customer' | 'provider' | 'system';
  text?: string;
  type?: 'offer';
  offer?: { service: string; price: number; date: string; duration: string };
  time: string;
};

const MESSAGES: Message[] = [
  { id: '1', from: 'customer', text: 'Guten Tag! Ich habe ein Problem mit meinem Heizkörper im Wohnzimmer. Er wird nicht mehr warm.', time: '10:12' },
  { id: '2', from: 'provider', text: 'Hallo! Das klingt nach einem Thermostatventil oder einem Entlüftungsproblem. Wann passt Ihnen ein Termin?', time: '10:15' },
  { id: '3', from: 'customer', text: 'Morgen ab 14 Uhr wäre ideal.', time: '10:17' },
  { id: '5', from: 'system', text: 'Yilmaz GmbH hat ein Angebot gesendet', time: '10:21' },
  {
    id: '4',
    from: 'provider',
    type: 'offer',
    offer: { service: 'Heizkörper-Diagnose & Thermostat', price: 120, date: 'Mo., 09. Jun · 14:00 Uhr', duration: '1–2 Stunden' },
    time: '10:21',
  },
];

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState(MESSAGES);
  const [offerDeclined, setOfferDeclined] = useState(false);
  const [piiNudge, setPiiNudge] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  function handleSend() {
    if (!input.trim()) return;
    const guard = checkMessage(input.trim());
    if (!guard.safe) {
      const labelList = guard.labels.join(', ');
      setPiiNudge(`Bitte teile ${labelList} nicht im Chat — ${NUDGE_MESSAGE}`);
      return;
    }
    setPiiNudge(null);
    const now = new Date();
    const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    setMessages((prev) => [
      ...prev,
      { id: String(Date.now()), from: 'customer', text: input.trim(), time },
    ]);
    setInput('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }

  const handleDecline = () => {
    showAlert(
      'Angebot ablehnen',
      'Möchten Sie das Angebot wirklich ablehnen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Ablehnen',
          style: 'destructive',
          onPress: () => setOfferDeclined(true),
        },
      ],
    );
  };

  const handleAttachment = () => {
    showAlert('Dateianhang', 'Dateianhang kommt bald');
  };
=======
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
  const { jobId } = useLocalSearchParams<{ jobId?: string }>();
  const scrollRef = useRef<ScrollView>(null);

  const [items, setItems] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [leakWarning, setLeakWarning] = useState(false);
  const [myId, setMyId] = useState<string>('local-user');
  const [myRole, setMyRole] = useState<'customer' | 'provider'>('customer');
  const nudgeOpacity = useRef(new Animated.Value(0)).current;

  // Load user identity
  useEffect(() => {
    loadAccount().then((acc) => {
      if (acc.userId) setMyId(acc.userId);
      if (acc.isProvider) setMyRole('provider');
    });
  }, []);

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
    } else {
      // No jobId: local only (demo mode)
      setItems((prev) =>
        prev.map((m) => (m.id === optimisticId ? { ...optimistic, pending: false } : m)),
      );
    }
    setSending(false);
  }, [input, sending, jobId, myId, myRole]);

  // ── Render ──────────────────────────────────────────────────────────────────
>>>>>>> main

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.avatarWrap}>
            <View style={styles.miniAvatar}>
              <Text style={styles.miniAvatarText}>Y</Text>
            </View>
            <View style={styles.onlineDot} />
          </View>
          <View>
            <Text style={styles.headerName}>Yilmaz GmbH</Text>
            <Text style={styles.headerSub}>
              Sanitär & Heizung{jobId ? ` · #${jobId.slice(-6)}` : ''}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.push('/anbieter')} style={styles.infoBtnWrap}>
          <Ionicons name="information-circle-outline" size={24} color={C.ink} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
<<<<<<< HEAD
        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={{ padding: 16, paddingBottom: 12 }}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg) => {
            if (msg.from === 'system') {
              return (
                <View key={msg.id} style={styles.systemRow}>
                  <Text style={styles.systemText}>{msg.text}</Text>
                </View>
              );
            }

            const isCustomer = msg.from === 'customer';
=======
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
>>>>>>> main

            {items.map((item) => {
              if (isOffer(item)) return <OfferCardView key={item.id} offer={item} router={router} />;
              const isMe = item.from === myRole;
              return (
<<<<<<< HEAD
                <View key={msg.id} style={styles.offerCard}>
                  <View style={styles.offerHeader}>
                    <Ionicons name="document-text" size={16} color={C.gold} />
                    <Text style={styles.offerHeaderText}>Verbindliches Angebot</Text>
                    <Text style={styles.offerTime}>{msg.time}</Text>
                  </View>

                  <View style={styles.providerRow}>
                    <View style={styles.providerAvatar}>
                      <Text style={styles.providerAvatarText}>Y</Text>
                    </View>
                    <Text style={styles.providerName}>Yilmaz GmbH</Text>
                  </View>

                  <View style={styles.offerDivider} />

                  <View style={styles.offerBody}>
                    <Text style={styles.offerServiceName}>{msg.offer.service}</Text>
                    <Text style={styles.offerPrice}>€{msg.offer.price}</Text>
                    <View style={styles.offerMeta}>
                      <Ionicons name="calendar-outline" size={13} color={C.sub} />
                      <Text style={styles.offerMetaText}>{msg.offer.date}</Text>
                    </View>
                    <View style={styles.offerMeta}>
                      <Ionicons name="time-outline" size={13} color={C.sub} />
                      <Text style={styles.offerMetaText}>{msg.offer.duration}</Text>
                    </View>
                  </View>

                  <View style={styles.offerDivider} />

                  <View style={styles.escrowNotice}>
                    <Ionicons name="lock-closed" size={13} color={C.amber} />
                    <Text style={styles.escrowText}>
                      Zahlung wird erst nach Auftragsabschluss freigegeben (Escrow)
                    </Text>
                  </View>

                  {offerDeclined ? (
                    <View style={styles.declinedChip}>
                      <Text style={styles.declinedChipText}>Abgelehnt</Text>
                    </View>
                  ) : (
                    <View style={styles.offerActions}>
                      <TouchableOpacity
                        style={styles.declineBtn}
                        onPress={handleDecline}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.declineBtnText}>Ablehnen</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.acceptBtn}
                        onPress={() => router.push('/angebot')}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="checkmark" size={16} color={C.surface} />
                        <Text style={styles.acceptBtnText}>Annehmen</Text>
                      </TouchableOpacity>
                    </View>
                  )}
=======
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
>>>>>>> main
                </View>
              );
            })}
          </ScrollView>
        )}

<<<<<<< HEAD
            return (
              <View
                key={msg.id}
                style={[styles.bubbleRow, isCustomer && styles.bubbleRowCustomer]}
              >
                <View
                  style={[
                    styles.bubble,
                    isCustomer ? styles.bubbleCustomer : styles.bubbleProvider,
                  ]}
                >
                  <Text style={[styles.bubbleText, isCustomer && styles.bubbleTextCustomer]}>
                    {msg.text}
                  </Text>
                </View>
                <Text style={[styles.bubbleTime, isCustomer && styles.bubbleTimeCustomer]}>
                  {msg.time}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        {piiNudge && (
          <View style={styles.piiNudge}>
            <Ionicons name="shield-checkmark" size={14} color="#b45309" />
            <Text style={styles.piiNudgeText}>{piiNudge}</Text>
            <TouchableOpacity onPress={() => setPiiNudge(null)}>
              <Ionicons name="close" size={14} color="#b45309" />
            </TouchableOpacity>
          </View>
        )}
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity onPress={handleAttachment} style={styles.attachBtn}>
            <Ionicons name="attach" size={22} color={C.sub} />
          </TouchableOpacity>
=======
        {/* Anti-leakage nudge */}
        <Animated.View style={[styles.leakNudge, { opacity: nudgeOpacity }]} pointerEvents="none">
          <Ionicons name="shield-checkmark-outline" size={14} color={C.amber} />
          <Text style={styles.leakNudgeText}>{LEAKAGE_NUDGE}</Text>
        </Animated.View>

        {/* Input bar */}
        <View style={styles.inputBar}>
>>>>>>> main
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={handleInputChange}
            placeholder="Nachricht schreiben …"
            placeholderTextColor={C.muted}
            multiline
            numberOfLines={4}
            maxLength={2000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendBtn, input.length > 0 && !sending && styles.sendBtnActive]}
            onPress={handleSend}
            disabled={sending || input.length === 0}
            activeOpacity={0.8}
            disabled={input.length === 0}
            onPress={handleSend}
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

<<<<<<< HEAD
const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: C.bg },

  header:              { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn:             { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerInfo:          { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarWrap:          { position: 'relative' },
  miniAvatar:          { width: 36, height: 36, borderRadius: 18, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center' },
  miniAvatarText:      { ...T.h4, color: C.gold },
  onlineDot:           { position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: 5, backgroundColor: C.primary, borderWidth: 1.5, borderColor: C.surface },
  headerName:          { fontSize: 14, fontWeight: '700', color: C.ink },
  headerSub:           { ...T.xs, color: C.sub },
  infoBtnWrap:         { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  messages:            { flex: 1, backgroundColor: C.bg },

  systemRow:           { alignItems: 'center', marginVertical: 8 },
  systemText:          { ...T.xs, color: C.muted },

  bubbleRow:           { alignSelf: 'flex-start', maxWidth: BUBBLE_MAX_WIDTH, marginBottom: 10 },
  bubbleRowCustomer:   { alignSelf: 'flex-end' },
  bubble:              { borderRadius: 14, padding: 12 },
  bubbleProvider:      { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  bubbleCustomer:      { backgroundColor: C.ink },
  bubbleText:          { ...T.body, color: C.ink },
  bubbleTextCustomer:  { color: C.surface },
  bubbleTime:          { fontSize: 10, color: C.muted, marginTop: 3, alignSelf: 'flex-start' },
  bubbleTimeCustomer:  { alignSelf: 'flex-end' },

  offerCard:           { backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.gold, borderRadius: 14, overflow: 'hidden', marginVertical: 8 },
  offerHeader:         { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.goldBg, paddingHorizontal: 14, paddingVertical: 10 },
  offerHeaderText:     { flex: 1, ...T.btnSm, color: C.gold },
  offerTime:           { ...T.xs, color: C.amber },

  providerRow:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  providerAvatar:      { width: 28, height: 28, borderRadius: 14, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center' },
  providerAvatarText:  { fontSize: 12, fontWeight: '700', color: C.gold },
  providerName:        { fontSize: 13, fontWeight: '600', color: C.ink },

  offerDivider:        { height: 1, backgroundColor: C.border, marginHorizontal: 14, marginVertical: 12 },

  offerBody:           { paddingHorizontal: 14, paddingBottom: 4 },
  offerServiceName:    { fontSize: 14, fontWeight: '600', color: C.ink, marginBottom: 4 },
  offerPrice:          { fontSize: 28, fontWeight: '800', color: C.gold, marginBottom: 10 },
  offerMeta:           { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  offerMetaText:       { ...T.sm, color: C.sub },

  escrowNotice:        { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.amberBg, paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 14, borderRadius: 8, marginBottom: 14 },
  escrowText:          { flex: 1, ...T.xs, color: C.amber },

  offerActions:        { flexDirection: 'row', gap: 10, padding: 14, paddingTop: 0 },
  declineBtn:          { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: C.red, alignItems: 'center' },
  declineBtnText:      { fontSize: 14, fontWeight: '600', color: C.red },
  acceptBtn:           { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: C.primary },
  acceptBtnText:       { fontSize: 14, fontWeight: '700', color: C.surface },

  declinedChip:        { marginHorizontal: 14, marginBottom: 14, alignSelf: 'flex-start', backgroundColor: C.redBg, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  declinedChipText:    { fontSize: 12, fontWeight: '600', color: C.red },

  piiNudge:            { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#fffbeb', borderTopWidth: 1, borderTopColor: '#fde68a', paddingHorizontal: 14, paddingVertical: 10 },
  piiNudgeText:        { flex: 1, fontSize: 12, color: '#b45309', lineHeight: 17 },

  inputBar:            { flexDirection: 'row', alignItems: 'flex-end', gap: 8, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: 12, paddingTop: 10 },
  attachBtn:           { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  input:               { flex: 1, backgroundColor: C.bg, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, ...T.body, color: C.ink, maxHeight: 100 },
  sendBtn:             { width: 40, height: 40, borderRadius: 20, backgroundColor: C.border, alignItems: 'center', justifyContent: 'center' },
  sendBtnActive:       { backgroundColor: C.gold },
=======
// ── Offer card sub-component ──────────────────────────────────────────────────

function OfferCardView({ offer, router }: { offer: OfferCard; router: ReturnType<typeof useRouter> }) {
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
          onPress={() => router.push('/vertrag')}
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
  acceptBtn:          { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: C.ink },
  acceptBtnText:      { fontSize: 14, fontWeight: '700', color: C.surface },
  leakNudge:          { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.amberBg, borderTopWidth: 1, borderTopColor: '#E8B84B', paddingHorizontal: 16, paddingVertical: 10 },
  leakNudgeText:      { flex: 1, fontSize: 12, color: C.amber, lineHeight: 17 },
  inputBar:           { flexDirection: 'row', alignItems: 'flex-end', gap: 10, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: 16, paddingVertical: 10, paddingBottom: 16 },
  input:              { flex: 1, backgroundColor: C.bg, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: C.ink, maxHeight: 100 },
  sendBtn:            { width: 40, height: 40, borderRadius: 20, backgroundColor: C.border, alignItems: 'center', justifyContent: 'center' },
  sendBtnActive:      { backgroundColor: C.ink },
>>>>>>> main
});
