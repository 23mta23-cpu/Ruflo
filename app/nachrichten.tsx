import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { T } from '../constants/typography';
import { useAuth } from '../contexts/AuthContext';
import { getConversationList, type ConversationSummary } from '../lib/messages';

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Gestern';
  if (diffDays < 7) return d.toLocaleDateString('de-DE', { weekday: 'short' });
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
}

export default function NachrichtenScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      const data = await getConversationList(user.id);
      setConversations(data);
    } catch {
      // keep previous list
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const filtered = query.trim()
    ? conversations.filter((c) => c.businessName.toLowerCase().includes(query.toLowerCase()) || c.jobTitle.toLowerCase().includes(query.toLowerCase()))
    : conversations;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Nachrichten</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

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

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="chatbubbles-outline" size={40} color={C.border} />
          </View>
          <Text style={styles.emptyTitle}>Keine Konversationen</Text>
          <Text style={styles.emptyText}>
            Starten Sie eine Anfrage an einen Handwerker — die Konversation erscheint hier.
          </Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/suche')} activeOpacity={0.85}>
            <Ionicons name="search-outline" size={16} color={C.surface} />
            <Text style={styles.emptyBtnText}>Handwerker finden</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.primary} />}
        >
          {filtered.map((conv, i) => {
            const initial = conv.businessName.charAt(0).toUpperCase();
            return (
              <TouchableOpacity
                key={conv.jobId}
                style={[styles.row, i < filtered.length - 1 && styles.rowDivider]}
                onPress={() => router.push({ pathname: '/chat', params: { jobId: conv.jobId, providerId: conv.providerId } })}
                activeOpacity={0.7}
              >
                <View style={styles.avatarWrap}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initial}</Text>
                  </View>
                </View>
                <View style={styles.convInfo}>
                  <View style={styles.convTopRow}>
                    <Text style={styles.convName} numberOfLines={1}>{conv.businessName}</Text>
                    <Text style={styles.convTime}>{formatTime(conv.lastMessageAt)}</Text>
                  </View>
                  <Text style={styles.convTrade} numberOfLines={1}>{conv.jobTitle}</Text>
                  <Text style={styles.convPreview} numberOfLines={1}>
                    {conv.isFromMe ? 'Du: ' : ''}{conv.lastMessage}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={C.border} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            );
          })}
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
  headerTitle:      { ...T.h3, fontWeight: '700', color: C.ink },
  unreadBubble:     { backgroundColor: C.red, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadBubbleText: { ...T.xs, fontWeight: '700', color: C.surface },
  searchWrap:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 4, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput:      { flex: 1, ...T.body, color: C.ink },
  row:              { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: C.surface },
  rowDivider:       { borderBottomWidth: 1, borderBottomColor: C.border },
  avatarWrap:       { position: 'relative', marginRight: 14 },
  avatar:           { width: 52, height: 52, borderRadius: 26, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center' },
  avatarText:       { fontSize: 20, fontWeight: '700', color: C.gold },
  unreadDot:        { position: 'absolute', top: 0, right: 0, width: 13, height: 13, borderRadius: 6.5, backgroundColor: C.red, borderWidth: 2, borderColor: C.bg },
  convInfo:         { flex: 1 },
  convTopRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  convNameRow:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  convName:         { ...T.bodyMd, color: C.ink },
  convNameBold:     { fontWeight: '700' },
  convTime:         { ...T.xs, color: C.muted },
  convTrade:        { ...T.xs, fontSize: 12, color: C.sub, marginBottom: 4 },
  convMsgRow:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  offerPill:        { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.goldBg, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, flexShrink: 0 },
  offerPillText:    { fontSize: 9, fontWeight: '700', color: C.gold },
  convPreview:      { flex: 1, ...T.sm, color: C.muted },
  convPreviewBold:  { color: C.ink, fontWeight: '600' },
  unreadCount:      { marginLeft: 8, backgroundColor: C.primary, borderRadius: 10, minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadCountText:  { fontSize: 11, fontWeight: '700', color: C.surface },
  emptyState:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon:        { width: 80, height: 80, borderRadius: 40, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle:       { ...T.xl, ...T.bold, color: C.ink, marginBottom: 10 },
  emptyText:        { ...T.body, color: C.sub, textAlign: 'center', marginBottom: 28 },
  emptyBtn:         { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText:     { ...T.body, ...T.bold, color: C.surface },
});
