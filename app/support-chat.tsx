import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, KeyboardAvoidingView,
  Platform, ActivityIndicator, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { safeBack } from '../lib/nav';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { T } from '../constants/typography';
import { useAuth } from '../contexts/AuthContext';
import { antwort, rueckfall, schnellthemen, supportMailUrl, type Aktion } from '../lib/supportBot';

type Message = {
  id: string;
  role: 'user' | 'bot';
  text: string;
  ts: Date;
  /** Knoepfe unter einer Bot-Antwort: fuehren direkt an die richtige Stelle. */
  aktionen?: Aktion[];
};

// Ehrlich ueber das, was er kann: er sieht keine Auftraege und keine Daten
// (vorher: „ich helfe Ihnen weiter, nennen Sie mir die Auftragsnummer").
const WELCOME: Message = {
  id: 'welcome',
  role: 'bot',
  text: 'Hallo! Ich bin Willi, der automatische Assistent von Werkant.\n\n'
    + 'Ich beantworte häufige Fragen und bringe Sie direkt an die richtige Stelle '
    + 'in der App. Ihre Aufträge sehe ich nicht. Für Ihren Einzelfall schreibt '
    + 'Ihnen ein Mensch per E-Mail.\n\nWorum geht es?',
  ts: new Date(),
};

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export default function SupportChatScreen() {
  const router = useRouter();
  const { role } = useAuth();
  const themen = schnellthemen(role);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [missCount, setMissCount] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages, typing]);

  function sendMessage(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', text: trimmed, ts: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setTyping(true);
    const treffer = antwort(trimmed, role);
    // Verstandene Frage setzt den Eskalations-Zähler zurück.
    const miss = treffer ? 0 : missCount + 1;
    setMissCount(miss);
    const a = treffer ?? rueckfall(miss);
    // Kurze Pause statt 1-1,7 s: ein Assistent, der als solcher benannt ist,
    // braucht kein gespieltes Tippen.
    setTimeout(() => {
      const botMsg: Message = {
        id: `b-${Date.now()}`,
        role: 'bot',
        text: a.text,
        aktionen: a.aktionen,
        ts: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
      setTyping(false);
    }, 350);
  }

  function aktionAusfuehren(a: Aktion): void {
    if (a.art === 'mail') { Linking.openURL(supportMailUrl()).catch(() => {}); return; }
    router.push(a.route as never);
  }

  // Themen nach dem Start UND nach einer unverstandenen Frage: vorher
  // verschwanden sie nach der ersten Nachricht fuer immer.
  const showQuickActions = !typing && (messages.length <= 2 || missCount > 0);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zurück" onPress={() => safeBack(router)} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.botAvatar}>
            <Ionicons name="headset" size={18} color={C.gold} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle} numberOfLines={1}>Werkant Support</Text>
            <View style={styles.onlineRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText} numberOfLines={1}>Automatischer Assistent · rund um die Uhr</Text>
            </View>
          </View>
        </View>
        {/* Hier stand bis zum 03.10.2026 ein Stern mit „4.9". Diese Bewertung
            gab es nie -- eine erfundene Zahl ist irrefuehrend (§ 5 UWG). */}
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Date separator */}
          <View style={styles.dateSep}>
            <View style={styles.dateLine} />
            <Text style={styles.dateText}>Heute</Text>
            <View style={styles.dateLine} />
          </View>

          {messages.map((msg) => (
            <View
              key={msg.id}
              style={[styles.msgRow, msg.role === 'user' ? styles.msgRowUser : styles.msgRowBot]}
            >
              {msg.role === 'bot' && (
                <View style={styles.botAvatarSmall}>
                  <Ionicons name="headset" size={13} color={C.gold} />
                </View>
              )}
              <View style={[styles.bubble, msg.role === 'user' ? styles.bubbleUser : styles.bubbleBot]}>
                <Text style={[styles.bubbleText, msg.role === 'user' && styles.bubbleTextUser]}>
                  {msg.text}
                </Text>
                {msg.aktionen && msg.aktionen.length > 0 ? (
                  <View style={styles.aktionen}>
                    {msg.aktionen.map((a) => (
                      <TouchableOpacity
                        key={a.label}
                        accessibilityRole="button"
                        style={styles.aktion}
                        onPress={() => aktionAusfuehren(a)}
                        activeOpacity={0.75}
                      >
                        <Ionicons name={a.art === 'mail' ? 'mail-outline' : 'arrow-forward-circle-outline'} size={16} color={C.primary} />
                        <Text style={styles.aktionText}>{a.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
                <Text style={[styles.bubbleTime, msg.role === 'user' && styles.bubbleTimeUser]}>
                  {fmtTime(msg.ts)}
                </Text>
              </View>
            </View>
          ))}

          {/* Typing indicator */}
          {typing && (
            <View style={[styles.msgRow, styles.msgRowBot]}>
              <View style={styles.botAvatarSmall}>
                <Ionicons name="headset" size={13} color={C.gold} />
              </View>
              <View style={[styles.bubble, styles.bubbleBot, styles.typingBubble]}>
                <View style={styles.typingDots}>
                  <View style={[styles.typingDot, { opacity: 0.9 }]} />
                  <View style={[styles.typingDot, { opacity: 0.5 }]} />
                  <View style={[styles.typingDot, { opacity: 0.2 }]} />
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Quick action chips */}
        {showQuickActions && (
          <View style={styles.quickSection}>
            <Text style={styles.quickLabel}>Häufige Themen</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickRow}
            >
              {themen.map((a) => (
                <TouchableOpacity
                  accessibilityRole="button"
                  key={a.label}
                  style={styles.quickChip}
                  onPress={() => sendMessage(a.frage)}
                  activeOpacity={0.75}
                >
                  <Ionicons name={a.icon as React.ComponentProps<typeof Ionicons>['name']} size={14} color={C.gold} />
                  <Text style={styles.quickChipText}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Input */}
        <View style={styles.inputArea}>
          <View style={styles.inputBar}>
            <TextInput
              style={styles.textInput}
              value={input}
              onChangeText={setInput}
              placeholder="Schreiben Sie uns …"
              placeholderTextColor={C.muted}
              multiline
              maxLength={500}
              returnKeyType="send"
              blurOnSubmit={false}
              onSubmitEditing={() => { if (input.trim()) sendMessage(input); }}
            />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Senden"
              style={[styles.sendBtn, (!input.trim() || typing) && styles.sendBtnDisabled]}
              onPress={() => sendMessage(input)}
              disabled={!input.trim() || typing}
              activeOpacity={0.8}
            >
              {typing
                ? <ActivityIndicator size="small" color={C.surface} />
                : <Ionicons name="arrow-up" size={18} color={C.surface} />
              }
            </TouchableOpacity>
          </View>
          <Text style={styles.disclaimer}>
            Automatischer Assistent · sieht keine Auftragsdaten · Mensch per E-Mail
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex:              { flex: 1 },
  container:         { flex: 1, backgroundColor: C.bg },

  // Header
  header:            { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border, gap: 10 },
  backBtn:           { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCenter:      { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  botAvatar:         { width: 42, height: 42, borderRadius: 21, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.gold + '80' },
  headerText:        { flex: 1, minWidth: 0 },
  headerTitle:       { ...T.base, ...T.bold, color: C.ink },
  onlineRow:         { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  onlineDot:         { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.primary },
  onlineText:        { ...T.xs, ...T.medium, color: C.primary },

  // Messages
  messages:          { flex: 1 },
  messagesContent:   { paddingHorizontal: 16, paddingVertical: 16, gap: 12, paddingBottom: 8 },
  dateSep:           { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  dateLine:          { flex: 1, height: 1, backgroundColor: C.border },
  dateText:          { ...T.xs, ...T.medium, color: C.muted },

  msgRow:            { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowUser:        { justifyContent: 'flex-end' },
  msgRowBot:         { justifyContent: 'flex-start' },

  botAvatarSmall:    { width: 28, height: 28, borderRadius: 14, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.gold + '80', flexShrink: 0, marginBottom: 2 },

  bubble:            { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 11 },
  bubbleBot:         { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderBottomLeftRadius: 4, shadowColor: C.ink, shadowOpacity: 0.04, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  bubbleUser:        { backgroundColor: C.ink, borderBottomRightRadius: 4 },
  bubbleText:        { ...T.body, color: C.ink, lineHeight: 22 },
  bubbleTextUser:    { color: C.surface },
  bubbleTime:        { fontSize: 10, color: C.muted, marginTop: 5, textAlign: 'right' },
  aktionen:          { marginTop: 10, gap: 6 },
  aktion:            { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 12, borderRadius: 12, backgroundColor: C.primaryBg, borderWidth: 1, borderColor: C.primary + '33' },
  aktionText:        { ...T.sm, ...T.bold, color: C.primary, flexShrink: 1 },
  bubbleTimeUser:    { color: 'rgba(255,255,255,0.45)' },

  typingBubble:      { paddingVertical: 16, paddingHorizontal: 18 },
  typingDots:        { flexDirection: 'row', gap: 6, alignItems: 'center' },
  typingDot:         { width: 9, height: 9, borderRadius: 4.5, backgroundColor: C.muted },

  // Quick actions
  quickSection:      { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10, backgroundColor: C.surface },
  quickLabel:        { ...T.label, color: C.muted, paddingHorizontal: 16, marginBottom: 8, letterSpacing: 0.5 },
  quickRow:          { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  quickChip:         { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.goldBg, borderWidth: 1, borderColor: C.gold + '80', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  quickChipText:     { ...T.sm, ...T.semibold, color: C.gold },

  // Input
  inputArea:         { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface, gap: 7 },
  inputBar:          { flexDirection: 'row', alignItems: 'flex-end', gap: 10, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 24, paddingLeft: 16, paddingRight: 6, paddingVertical: 6 },
  textInput:         { flex: 1, ...T.base, color: C.ink, maxHeight: 100, paddingVertical: 7 },
  sendBtn:           { width: 38, height: 38, borderRadius: 19, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 1 },
  sendBtnDisabled:   { backgroundColor: C.border },
  disclaimer:        { ...T.xs, color: C.muted, textAlign: 'center' },
});
