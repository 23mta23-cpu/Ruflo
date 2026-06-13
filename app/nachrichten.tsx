import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';

type Conversation = {
  id: string;
  name: string;
  trade: string;
  lastMessage: string;
  time: string;
  unread: number;
  initial: string;
  verified: boolean;
  hasOffer?: boolean;
};

const CONVERSATIONS: Conversation[] = [
  {
    id: '1',
    name: 'Yilmaz GmbH',
    trade: 'Sanitär & Heizung',
    lastMessage: 'Verbindliches Angebot: Heizkörper-Diagnose €120',
    time: '10:21',
    unread: 1,
    initial: 'Y',
    verified: true,
    hasOffer: true,
  },
  {
    id: '2',
    name: 'Marcus Berger',
    trade: 'Elektriker',
    lastMessage: 'Ich bin morgen Früh ab 9 Uhr verfügbar.',
    time: 'Gestern',
    unread: 0,
    initial: 'M',
    verified: true,
  },
  {
    id: '3',
    name: 'Stefan Koch',
    trade: 'Maler & Lackierer',
    lastMessage: 'Können wir einen Besichtigungstermin ausmachen?',
    time: 'Di.',
    unread: 2,
    initial: 'S',
    verified: true,
  },
  {
    id: '4',
    name: 'Lena M.',
    trade: 'Nachhilfe · Mathe & Physik',
    lastMessage: 'Ja, Montag 16 Uhr passt mir gut!',
    time: 'Mo.',
    unread: 0,
    initial: 'L',
    verified: false,
  },
  {
    id: '5',
    name: 'Tim K.',
    trade: 'Gartenpflege',
    lastMessage: 'Gerne, bis dann!',
    time: 'Sa.',
    unread: 0,
    initial: 'T',
    verified: false,
  },
];

export default function NachrichtenScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? CONVERSATIONS.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.trade.toLowerCase().includes(query.toLowerCase()),
      )
    : CONVERSATIONS;

  const totalUnread = CONVERSATIONS.reduce((s, c) => s + c.unread, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Nachrichten</Text>
          {totalUnread > 0 && (
            <View style={styles.unreadBubble}>
              <Text style={styles.unreadBubbleText}>{totalUnread}</Text>
            </View>
          )}
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={17} color={C.muted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Konversation suchen …"
          placeholderTextColor={C.muted}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={17} color={C.muted} />
          </TouchableOpacity>
        )}
      </View>

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="chatbubbles-outline" size={40} color={C.border} />
          </View>
          <Text style={styles.emptyTitle}>Keine Konversationen</Text>
          <Text style={styles.emptyText}>
            Starten Sie eine Anfrage an einen Handwerker — die Konversation erscheint hier.
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => router.push('/suche')}
            activeOpacity={0.85}
          >
            <Ionicons name="search-outline" size={16} color={C.surface} />
            <Text style={styles.emptyBtnText}>Handwerker finden</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {filtered.map((conv, i) => (
            <TouchableOpacity
              key={conv.id}
              style={[styles.row, i < filtered.length - 1 && styles.rowDivider]}
              onPress={() => router.push('/chat')}
              activeOpacity={0.7}
            >
              {/* Avatar */}
              <View style={styles.avatarWrap}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{conv.initial}</Text>
                </View>
                {conv.unread > 0 && <View style={styles.unreadDot} />}
              </View>

              {/* Info */}
              <View style={styles.convInfo}>
                <View style={styles.convTopRow}>
                  <View style={styles.convNameRow}>
                    <Text style={[styles.convName, conv.unread > 0 && styles.convNameBold]}>
                      {conv.name}
                    </Text>
                    {conv.verified && (
                      <Ionicons name="checkmark-circle" size={13} color={C.gold} />
                    )}
                  </View>
                  <Text style={styles.convTime}>{conv.time}</Text>
                </View>
                <Text style={styles.convTrade}>{conv.trade}</Text>
                <View style={styles.convMsgRow}>
                  {conv.hasOffer && (
                    <View style={styles.offerPill}>
                      <Ionicons name="document-text-outline" size={10} color={C.gold} />
                      <Text style={styles.offerPillText}>Angebot</Text>
                    </View>
                  )}
                  <Text
                    style={[styles.convPreview, conv.unread > 0 && styles.convPreviewBold]}
                    numberOfLines={1}
                  >
                    {conv.lastMessage}
                  </Text>
                </View>
              </View>

              {/* Unread badge */}
              {conv.unread > 0 && (
                <View style={styles.unreadCount}>
                  <Text style={styles.unreadCountText}>{conv.unread}</Text>
                </View>
              )}

              {/* Chevron */}
              {conv.unread === 0 && (
                <Ionicons name="chevron-forward" size={16} color={C.border} style={{ marginLeft: 6 }} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: C.bg },
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  backBtn:          { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerCenter:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle:      { fontSize: 18, fontWeight: '800', color: C.ink },
  unreadBubble:     { backgroundColor: C.red, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadBubbleText: { fontSize: 11, fontWeight: '800', color: C.surface },
  searchWrap:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 4, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput:      { flex: 1, fontSize: 14, color: C.ink },
  row:              { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: C.surface },
  rowDivider:       { borderBottomWidth: 1, borderBottomColor: C.border },
  avatarWrap:       { position: 'relative', marginRight: 14 },
  avatar:           { width: 52, height: 52, borderRadius: 26, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center' },
  avatarText:       { fontSize: 20, fontWeight: '700', color: C.gold },
  unreadDot:        { position: 'absolute', top: 0, right: 0, width: 13, height: 13, borderRadius: 6.5, backgroundColor: C.red, borderWidth: 2, borderColor: C.bg },
  convInfo:         { flex: 1 },
  convTopRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  convNameRow:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  convName:         { fontSize: 14, fontWeight: '500', color: C.ink },
  convNameBold:     { fontWeight: '700' },
  convTime:         { fontSize: 11, color: C.muted },
  convTrade:        { fontSize: 12, color: C.sub, marginBottom: 4 },
  convMsgRow:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  offerPill:        { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.goldBg, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, flexShrink: 0 },
  offerPillText:    { fontSize: 9, fontWeight: '700', color: C.gold },
  convPreview:      { flex: 1, fontSize: 13, color: C.muted, fontWeight: '400' },
  convPreviewBold:  { color: C.ink, fontWeight: '600' },
  unreadCount:      { marginLeft: 8, backgroundColor: C.ink, borderRadius: 10, minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadCountText:  { fontSize: 11, fontWeight: '800', color: C.surface },
  emptyState:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon:        { width: 80, height: 80, borderRadius: 40, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle:       { fontSize: 20, fontWeight: '700', color: C.ink, marginBottom: 10 },
  emptyText:        { fontSize: 14, color: C.sub, textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  emptyBtn:         { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.ink, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText:     { fontSize: 14, fontWeight: '700', color: C.surface },
});
