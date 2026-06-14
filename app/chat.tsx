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
import { showAlert } from '../lib/alert';
import { checkMessage, NUDGE_MESSAGE } from '../lib/chatGuard';

const SCREEN_WIDTH = Dimensions.get('window').width;
const BUBBLE_MAX_WIDTH = SCREEN_WIDTH * 0.75;

type Message = {
  id: string;
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
            <Text style={styles.headerSub}>Sanitär & Heizung · Antwortet ~2h</Text>
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

            if (msg.type === 'offer' && msg.offer) {
              return (
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
                </View>
              );
            }

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
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Nachricht schreiben …"
            placeholderTextColor={C.muted}
            multiline
            numberOfLines={4}
            maxLength={2000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, input.length > 0 && styles.sendBtnActive]}
            activeOpacity={0.8}
            disabled={input.length === 0}
            onPress={handleSend}
          >
            <Ionicons name="send" size={18} color={input.length > 0 ? C.surface : C.muted} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: C.bg },

  header:              { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn:             { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerInfo:          { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarWrap:          { position: 'relative' },
  miniAvatar:          { width: 36, height: 36, borderRadius: 18, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center' },
  miniAvatarText:      { fontSize: 15, fontWeight: '700', color: C.gold },
  onlineDot:           { position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: 5, backgroundColor: C.green, borderWidth: 1.5, borderColor: C.surface },
  headerName:          { fontSize: 14, fontWeight: '700', color: C.ink },
  headerSub:           { fontSize: 11, color: C.sub },
  infoBtnWrap:         { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  messages:            { flex: 1, backgroundColor: C.bg },

  systemRow:           { alignItems: 'center', marginVertical: 8 },
  systemText:          { fontSize: 11, color: C.muted },

  bubbleRow:           { alignSelf: 'flex-start', maxWidth: BUBBLE_MAX_WIDTH, marginBottom: 10 },
  bubbleRowCustomer:   { alignSelf: 'flex-end' },
  bubble:              { borderRadius: 14, padding: 12 },
  bubbleProvider:      { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  bubbleCustomer:      { backgroundColor: C.ink },
  bubbleText:          { fontSize: 14, color: C.ink, lineHeight: 20 },
  bubbleTextCustomer:  { color: C.surface },
  bubbleTime:          { fontSize: 10, color: C.muted, marginTop: 3, alignSelf: 'flex-start' },
  bubbleTimeCustomer:  { alignSelf: 'flex-end' },

  offerCard:           { backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.gold, borderRadius: 14, overflow: 'hidden', marginVertical: 8 },
  offerHeader:         { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.goldBg, paddingHorizontal: 14, paddingVertical: 10 },
  offerHeaderText:     { flex: 1, fontSize: 13, fontWeight: '700', color: C.gold },
  offerTime:           { fontSize: 11, color: C.amber },

  providerRow:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  providerAvatar:      { width: 28, height: 28, borderRadius: 14, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center' },
  providerAvatarText:  { fontSize: 12, fontWeight: '700', color: C.gold },
  providerName:        { fontSize: 13, fontWeight: '600', color: C.ink },

  offerDivider:        { height: 1, backgroundColor: C.border, marginHorizontal: 14, marginVertical: 12 },

  offerBody:           { paddingHorizontal: 14, paddingBottom: 4 },
  offerServiceName:    { fontSize: 14, fontWeight: '600', color: C.ink, marginBottom: 4 },
  offerPrice:          { fontSize: 28, fontWeight: '800', color: C.gold, marginBottom: 10 },
  offerMeta:           { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  offerMetaText:       { fontSize: 13, color: C.sub },

  escrowNotice:        { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.amberBg, paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 14, borderRadius: 8, marginBottom: 14 },
  escrowText:          { flex: 1, fontSize: 11, color: C.amber, lineHeight: 16 },

  offerActions:        { flexDirection: 'row', gap: 10, padding: 14, paddingTop: 0 },
  declineBtn:          { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: C.red, alignItems: 'center' },
  declineBtnText:      { fontSize: 14, fontWeight: '600', color: C.red },
  acceptBtn:           { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: C.green },
  acceptBtnText:       { fontSize: 14, fontWeight: '700', color: C.surface },

  declinedChip:        { marginHorizontal: 14, marginBottom: 14, alignSelf: 'flex-start', backgroundColor: C.redBg, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  declinedChipText:    { fontSize: 12, fontWeight: '600', color: C.red },

  piiNudge:            { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#fffbeb', borderTopWidth: 1, borderTopColor: '#fde68a', paddingHorizontal: 14, paddingVertical: 10 },
  piiNudgeText:        { flex: 1, fontSize: 12, color: '#b45309', lineHeight: 17 },

  inputBar:            { flexDirection: 'row', alignItems: 'flex-end', gap: 8, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: 12, paddingTop: 10 },
  attachBtn:           { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  input:               { flex: 1, backgroundColor: C.bg, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: C.ink, maxHeight: 100 },
  sendBtn:             { width: 40, height: 40, borderRadius: 20, backgroundColor: C.border, alignItems: 'center', justifyContent: 'center' },
  sendBtnActive:       { backgroundColor: C.gold },
});
