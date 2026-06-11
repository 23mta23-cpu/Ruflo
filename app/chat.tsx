import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';

type Message = {
  id: string;
  from: 'customer' | 'provider';
  text?: string;
  type?: 'offer';
  offer?: { service: string; price: number; date: string; duration: string };
  time: string;
};

const MESSAGES: Message[] = [
  { id: '1', from: 'customer', text: 'Guten Tag! Ich habe ein Problem mit meinem Heizkörper im Wohnzimmer. Er wird nicht mehr warm.', time: '10:12' },
  { id: '2', from: 'provider', text: 'Hallo! Das klingt nach einem Thermostatventil oder einem Entlüftungsproblem. Wann passt Ihnen ein Termin?', time: '10:15' },
  { id: '3', from: 'customer', text: 'Morgen ab 14 Uhr wäre ideal.', time: '10:17' },
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
  const [input, setInput] = useState('');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.miniAvatar}>
            <Text style={styles.miniAvatarText}>Y</Text>
          </View>
          <View>
            <Text style={styles.headerName}>Yilmaz GmbH</Text>
            <Text style={styles.headerSub}>Sanitär & Heizung · Antwortet ~2h</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.push('/profil')}>
          <Ionicons name="information-circle-outline" size={24} color={C.ink} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.messages}
          contentContainerStyle={{ padding: 16, paddingBottom: 12 }}
          showsVerticalScrollIndicator={false}
        >
          {MESSAGES.map((msg) => {
            const isCustomer = msg.from === 'customer';

            if (msg.type === 'offer' && msg.offer) {
              return (
                <View key={msg.id} style={styles.offerCard}>
                  <View style={styles.offerHeader}>
                    <Ionicons name="document-text" size={16} color={C.gold} />
                    <Text style={styles.offerHeaderText}>Verbindliches Angebot</Text>
                    <Text style={styles.offerTime}>{msg.time}</Text>
                  </View>

                  <View style={styles.offerBody}>
                    <Row label="Leistung"  value={msg.offer.service}   />
                    <Row label="Preis"     value={`€${msg.offer.price} (Festpreis)`} bold />
                    <Row label="Termin"    value={msg.offer.date}      />
                    <Row label="Dauer"     value={msg.offer.duration}  />
                  </View>

                  <View style={styles.escrowNotice}>
                    <Ionicons name="lock-closed" size={13} color={C.amber} />
                    <Text style={styles.escrowText}>
                      Zahlung wird erst nach Auftragsabschluss freigegeben (Escrow)
                    </Text>
                  </View>

                  <View style={styles.offerActions}>
                    <TouchableOpacity
                      style={styles.declineBtn}
                      activeOpacity={0.8}
                    >
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

            return (
              <View
                key={msg.id}
                style={[styles.bubble, isCustomer ? styles.bubbleCustomer : null]}
              >
                <Text style={[styles.bubbleText, isCustomer && styles.bubbleTextCustomer]}>
                  {msg.text}
                </Text>
                <Text style={[styles.bubbleTime, isCustomer && { color: 'rgba(255,255,255,0.6)' }]}>
                  {msg.time}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        {/* Input */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Nachricht schreiben …"
            placeholderTextColor={C.muted}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, input.length > 0 && styles.sendBtnActive]}
            activeOpacity={0.8}
          >
            <Ionicons name="send" size={18} color={input.length > 0 ? C.surface : C.muted} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
      <Text style={{ fontSize: 12, color: C.sub }}>{label}</Text>
      <Text style={{ fontSize: 13, color: C.ink, fontWeight: bold ? '700' : '500' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: C.bg },
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn:          { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerInfo:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  miniAvatar:       { width: 36, height: 36, borderRadius: 18, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center' },
  miniAvatarText:   { fontSize: 15, fontWeight: '700', color: C.gold },
  headerName:       { fontSize: 14, fontWeight: '700', color: C.ink },
  headerSub:        { fontSize: 11, color: C.sub },
  messages:         { flex: 1, backgroundColor: C.bg },
  bubble:           { maxWidth: '80%', borderRadius: 14, padding: 12, marginBottom: 8, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignSelf: 'flex-start' },
  bubbleCustomer:   { backgroundColor: C.ink, alignSelf: 'flex-end', borderColor: C.ink },
  bubbleText:       { fontSize: 14, color: C.ink, lineHeight: 20 },
  bubbleTextCustomer: { color: C.surface },
  bubbleTime:       { fontSize: 10, color: C.muted, marginTop: 4, alignSelf: 'flex-end' },
  offerCard:        { backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.gold, borderRadius: 14, overflow: 'hidden', marginVertical: 8 },
  offerHeader:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.goldBg, paddingHorizontal: 14, paddingVertical: 10 },
  offerHeaderText:  { flex: 1, fontSize: 13, fontWeight: '700', color: C.gold },
  offerTime:        { fontSize: 11, color: C.amber },
  offerBody:        { padding: 14 },
  escrowNotice:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.amberBg, paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 14, borderRadius: 8, marginBottom: 14 },
  escrowText:       { flex: 1, fontSize: 11, color: C.amber, lineHeight: 16 },
  offerActions:     { flexDirection: 'row', gap: 10, padding: 14, paddingTop: 0 },
  declineBtn:       { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, alignItems: 'center' },
  declineBtnText:   { fontSize: 14, fontWeight: '600', color: C.sub },
  acceptBtn:        { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: C.ink },
  acceptBtnText:    { fontSize: 14, fontWeight: '700', color: C.surface },
  inputBar:         { flexDirection: 'row', alignItems: 'flex-end', gap: 10, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: 16, paddingVertical: 10, paddingBottom: 16 },
  input:            { flex: 1, backgroundColor: C.bg, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: C.ink, maxHeight: 100 },
  sendBtn:          { width: 40, height: 40, borderRadius: 20, backgroundColor: C.border, alignItems: 'center', justifyContent: 'center' },
  sendBtnActive:    { backgroundColor: C.ink },
});
