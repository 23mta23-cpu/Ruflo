import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, KeyboardAvoidingView,
  Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { T } from '../constants/typography';

type Message = {
  id: string;
  role: 'user' | 'bot';
  text: string;
  ts: Date;
};

const QUICK_ACTIONS: { id: string; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { id: 'order',     label: 'Auftragsstatus',  icon: 'document-text-outline'   },
  { id: 'payment',   label: 'Zahlung & Escrow', icon: 'card-outline'             },
  { id: 'cancel',    label: 'Stornierung',      icon: 'close-circle-outline'     },
  { id: 'complaint', label: 'Reklamation',      icon: 'alert-circle-outline'     },
  { id: 'verify',    label: 'Verifizierung',    icon: 'shield-checkmark-outline' },
  { id: 'fee',       label: 'Gebühren',         icon: 'cash-outline'             },
];

const QUICK_TEXT: Record<string, string> = {
  order:     'Wo finde ich meinen Auftragsstatus?',
  payment:   'Wie funktioniert die Escrow-Zahlung?',
  cancel:    'Wie kann ich einen Auftrag stornieren?',
  complaint: 'Ich möchte eine Reklamation einreichen.',
  verify:    'Warum ist meine Verifizierung noch ausstehend?',
  fee:       'Welche Gebühren fallen an?',
};

const BOT_REPLIES: Record<string, string> = {
  order: 'Ihren Auftragsstatus finden Sie unter „Aufträge" im Tab-Menü. Dort sehen Sie alle aktiven, abgeschlossenen und stornierten Aufträge mit dem aktuellen Status in Echtzeit.\n\nBenötigen Sie Hilfe zu einem bestimmten Auftrag? Dann teilen Sie mir bitte die Auftragsnummer mit.',
  payment: 'WERKR verwendet ein Escrow-System: Ihr Geld wird sicher eingefroren, sobald ein Angebot angenommen wird. Erst nach Ihrer ausdrücklichen Freigabe (oder automatisch nach 7 Tagen ohne Einwand) wird der Betrag an den Anbieter ausgezahlt.\n\nAlle Zahlungen laufen über Stripe — sicher, PCI-DSS-konform und vollständig DSGVO-konform.',
  cancel: 'Eine Stornierung ist möglich, solange der Auftrag noch nicht begonnen hat. So gehen Sie vor:\n\n1. Auftrag öffnen\n2. „Problem melden" antippen\n3. „Stornierung beantragen" wählen\n\nBitte beachten: Je nach Zeitpunkt können Stornogebühren anfallen. Nennen Sie mir Ihre Auftragsnummer und ich helfe Ihnen weiter.',
  complaint: 'Für Reklamationen öffnen Sie den betroffenen Auftrag und tippen auf „Problem melden". Unser Team prüft jeden Fall innerhalb von 24 Stunden und kontaktiert beide Parteien.\n\nSchildern Sie mir bitte kurz das Problem — ich kann die Dringlichkeit einschätzen und die richtigen Schritte für Sie einleiten.',
  verify: 'Die Verifizierung dauert in der Regel 24–48 Stunden. Unser Team prüft Gewerbeschein, Personalausweis und Steuernummer manuell.\n\nSie erhalten eine E-Mail, sobald Ihr Konto freigeschaltet ist. Falls es länger als 48 Stunden dauert, schreiben Sie mir bitte Ihre registrierte E-Mail-Adresse.',
  fee: 'WERKR berechnet je nach Track unterschiedliche Gebühren:\n\n🔧 Handwerker (professionell)\n• Anbieter: 8% Provision, mind. €3,00\n• Kunde: 2,5% Service-Gebühr, mind. €1,50\n\n🏘 Nachbarschaft (privat / C2C)\n• Einmalig €1,99 WERKR-Schutz (Escrow + Käuferschutz)\n• Helfer erhalten 100% des vereinbarten Betrags\n\nEine detaillierte Aufschlüsselung sehen Sie vor jeder Zahlung in der Rechnung.\n\nPro-Anbieter (€29/Monat) erhalten Featured-Platzierung, detaillierte Analytics und Prioritätssupport.',
};

function getBotReply(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('auftrag') || lower.includes('job') || lower.includes('status') || lower.includes('bestellung')) {
    return BOT_REPLIES.order;
  }
  if (lower.includes('zahl') || lower.includes('escrow') || lower.includes('geld') || lower.includes('stripe') || lower.includes('überweis')) {
    return BOT_REPLIES.payment;
  }
  if (lower.includes('storni') || lower.includes('storno') || lower.includes('abbrechen') || lower.includes('absagen') || lower.includes('cancel')) {
    return BOT_REPLIES.cancel;
  }
  if (lower.includes('reklamation') || lower.includes('problem') || lower.includes('beschwerde') || lower.includes('streit') || lower.includes('schaden') || lower.includes('falsch')) {
    return BOT_REPLIES.complaint;
  }
  if (lower.includes('verifiz') || lower.includes('prüf') || lower.includes('freischal') || lower.includes('gewerbeschein') || lower.includes('ausweis')) {
    return BOT_REPLIES.verify;
  }
  if (lower.includes('gebühr') || lower.includes('provision') || lower.includes('kosten') || lower.includes('preis') || lower.includes('8%') || lower.includes('provision')) {
    return BOT_REPLIES.fee;
  }
  if (lower.includes('bewertung') || lower.includes('stern') || lower.includes('rating') || lower.includes('rezension')) {
    return 'Bewertungen können Sie nach Abschluss eines Auftrags abgeben. Sie haben 14 Tage Zeit, um den Anbieter zu bewerten.\n\nAnbieter können ebenfalls eine Gegenbewertung abgeben. Alle Bewertungen werden verifiziert — Fake-Bewertungen führen zu einer Kontosperrung.';
  }
  if (lower.includes('konto') || lower.includes('profil') || lower.includes('einstellung') || lower.includes('passwort')) {
    return 'Ihre Kontoeinstellungen finden Sie unter dem Profil-Tab. Dort können Sie Ihr Profil bearbeiten, Zahlungsmethoden verwalten und Sicherheitseinstellungen ändern.\n\nBei konkreten Problemen (Passwort vergessen, gesperrtes Konto) senden Sie mir bitte Ihre E-Mail-Adresse.';
  }
  if (lower.includes('hallo') || lower.includes('hi ') || lower.includes('hey') || lower.includes('guten') || lower.includes('moin')) {
    return 'Hallo! Schön, dass Sie sich melden. Wie kann ich Ihnen heute helfen?\n\nSie können mir direkt Ihre Frage stellen oder eine der Schnelloptionen unten nutzen.';
  }
  if (lower.includes('danke') || lower.includes('super') || lower.includes('toll') || lower.includes('prima')) {
    return 'Gern geschehen! Gibt es noch etwas, womit ich helfen kann?\n\nFür komplexe Fälle, die ich nicht lösen kann, verbinde ich Sie jederzeit mit einem unserer Support-Mitarbeiter.';
  }
  if (lower.includes('mensch') || lower.includes('mitarbeiter') || lower.includes('agent') || lower.includes('person') || lower.includes('echt')) {
    return 'Natürlich — ich leite Sie gerne an einen unserer Support-Mitarbeiter weiter.\n\n⏱ Durchschnittliche Wartezeit: ~4 Minuten\n🕐 Verfügbar: Mo–Fr 8–20 Uhr\n\nMöchten Sie jetzt verbunden werden? Antworten Sie einfach mit „Ja".';
  }
  if (lower === 'ja' || lower === 'ja.' || lower === 'ja!') {
    return 'Einen Moment — ich stelle Ihnen einen Support-Mitarbeiter bereit.\n\n✅ Sie stehen jetzt auf der Warteliste (Position #1)\n\nSie erhalten eine Benachrichtigung, sobald ein Mitarbeiter für Sie verfügbar ist. Typische Wartezeit: 3–5 Minuten.';
  }
  return 'Danke für Ihre Nachricht! Ich verstehe Ihr Anliegen und helfe Ihnen gerne weiter.\n\nKönnen Sie mir mehr Details nennen? Zum Beispiel:\n• Auftragsnummer (falls vorhanden)\n• Was genau ist passiert?\n• Seit wann besteht das Problem?\n\nOder nutzen Sie eine der Schnelloptionen unten — dann kann ich sofort helfen.';
}

const WELCOME: Message = {
  id: 'welcome',
  role: 'bot',
  text: 'Hallo! Ich bin Willi, Ihr WERKR Support-Assistent.\n\nIch helfe bei Fragen zu Aufträgen, Zahlungen, Verifizierungen und mehr — rund um die Uhr, sofort.\n\nWie kann ich Ihnen heute helfen?',
  ts: new Date(),
};

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export default function SupportChatScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
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
    setTimeout(() => {
      const botMsg: Message = {
        id: `b-${Date.now()}`,
        role: 'bot',
        text: getBotReply(trimmed),
        ts: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
      setTyping(false);
    }, 1000 + Math.random() * 700);
  }

  const showQuickActions = messages.length <= 2 && !typing;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.botAvatar}>
            <Ionicons name="headset" size={18} color={C.gold} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>WERKR Support</Text>
            <View style={styles.onlineRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>KI-Assistent · 24/7 verfügbar</Text>
            </View>
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.ratingChip}>
            <Ionicons name="star" size={11} color={C.gold} />
            <Text style={styles.ratingText}>4.9</Text>
          </View>
        </View>
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
            <Text style={styles.quickLabel}>Schnellhilfe</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickRow}
            >
              {QUICK_ACTIONS.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={styles.quickChip}
                  onPress={() => sendMessage(QUICK_TEXT[a.id])}
                  activeOpacity={0.75}
                >
                  <Ionicons name={a.icon} size={14} color={C.gold} />
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
            KI-Assistent — für komplexe Fälle schreiben Sie „Mitarbeiter"
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
  backBtn:           { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerCenter:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  botAvatar:         { width: 42, height: 42, borderRadius: 21, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.gold + '80' },
  headerText:        { flex: 1 },
  headerTitle:       { ...T.base, ...T.bold, color: C.ink },
  onlineRow:         { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  onlineDot:         { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.primary },
  onlineText:        { ...T.xs, ...T.medium, color: C.primary },
  headerRight:       { alignItems: 'flex-end' },
  ratingChip:        { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.goldBg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: C.gold + '80' },
  ratingText:        { ...T.caption, fontSize: 12, ...T.bold, color: C.gold },

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
  bubbleBot:         { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderBottomLeftRadius: 4, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  bubbleUser:        { backgroundColor: C.ink, borderBottomRightRadius: 4 },
  bubbleText:        { ...T.body, color: C.ink, lineHeight: 22 },
  bubbleTextUser:    { color: C.surface },
  bubbleTime:        { fontSize: 10, color: C.muted, marginTop: 5, textAlign: 'right' },
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
  inputArea:         { paddingHorizontal: 14, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 20 : 12, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface, gap: 7 },
  inputBar:          { flexDirection: 'row', alignItems: 'flex-end', gap: 10, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 24, paddingLeft: 16, paddingRight: 6, paddingVertical: 6 },
  textInput:         { flex: 1, ...T.base, color: C.ink, maxHeight: 100, paddingVertical: 7 },
  sendBtn:           { width: 38, height: 38, borderRadius: 19, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', marginBottom: 1 },
  sendBtnDisabled:   { backgroundColor: C.border },
  disclaimer:        { ...T.xs, color: C.muted, textAlign: 'center' },
});
