import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/colors';
import { T } from '../../constants/typography';
import { useAuth } from '../../contexts/AuthContext';
import { getConversationList, type ConversationSummary } from '../../lib/messages';

const TAB_BAR_HEIGHT = 60;

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  if (diffDays === 1) return 'Gestern';
  const DAY = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];
  if (diffDays < 7) return DAY[d.getDay()];
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

export default function NachrichtenTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); setRefreshing(false); return; }
    try {
      const data = await getConversationList(user.id);
      setConversations(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const filtered = query.trim()
    ? conversations.filter(
        (c) =>
          c.businessName.toLowerCase().includes(query.toLowerCase()) ||
          c.jobTitle.toLowerCase().includes(query.toLowerCase()),
      )
    : conversations;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Nachrichten</Text>
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
        <View style={styles.centered}>
          <ActivityIndicator color={C.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="chatbubbles-outline" size={40} color={C.border} />
          </View>
          <Text style={styles.emptyTitle}>Keine Nachrichten</Text>
          <Text style={styles.emptyText}>
            Starten Sie eine Anfrage an einen Handwerker — die Konversation erscheint hier.
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => router.push('/(tabs)/')}
            activeOpacity={0.85}
          >
            <Ionicons name="search-outline" size={16} color={C.surface} />
            <Text style={styles.emptyBtnText}>Handwerker finden</Text>
          </TouchableOpacity>

          {/* Beispiel-Konversation: zeigt, wie der Screen im Betrieb aussieht */}
          <View style={styles.demoBlock}>
            <Text style={styles.demoLabel}>SO SIEHT'S SPÄTER AUS</Text>
            <View style={styles.demoRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>M</Text>
              </View>
              <View style={styles.convInfo}>
                <View style={styles.convTopRow}>
                  <Text style={styles.convName} numberOfLines={1}>Marcus Berger</Text>
                  <Text style={styles.convTime}>14:32</Text>
                </View>
                <Text style={styles.convTrade} numberOfLines={1}>Lampe anschließen · Beispiel</Text>
                <Text style={styles.convPreview} numberOfLines={1}>Ich kann Donnerstag ab 16 Uhr — passt das?</Text>
              </View>
              <View style={styles.demoBadge}><Text style={styles.demoBadgeText}>Beispiel</Text></View>
            </View>
            <TouchableOpacity
              style={styles.demoSupportBtn}
              onPress={() => router.push('/support-chat')}
              activeOpacity={0.8}
            >
              <Ionicons name="headset-outline" size={15} color={C.primary} />
              <Text style={styles.demoSupportText}>Chat live ausprobieren (Support)</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={C.primary}
            />
          }
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
                    {conv.isFromMe ? 'Sie: ' : ''}{conv.lastMessage}
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
  header:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 10 },
  headerTitle:      { fontSize: 24, fontWeight: '700', color: C.ink },
  searchWrap:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 8, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput:      { flex: 1, ...T.body, color: C.ink },
  centered:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row:              { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: C.surface },
  rowDivider:       { borderBottomWidth: 1, borderBottomColor: C.border },
  avatarWrap:       { position: 'relative', marginRight: 14 },
  avatar:           { width: 52, height: 52, borderRadius: 26, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center' },
  avatarText:       { fontSize: 20, fontWeight: '700', color: C.gold },
  convInfo:         { flex: 1 },
  convTopRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  convName:         { ...T.bodyMd, color: C.ink, flex: 1, marginRight: 8 },
  convTime:         { ...T.xs, color: C.muted, flexShrink: 0 },
  convTrade:        { ...T.xs, fontSize: 12, color: C.sub, marginBottom: 4 },
  convPreview:      { flex: 1, ...T.sm, color: C.muted },
  emptyState:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon:        { width: 80, height: 80, borderRadius: 40, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle:       { ...T.xl, ...T.bold, color: C.ink, marginBottom: 10 },
  emptyText:        { ...T.body, color: C.sub, textAlign: 'center', marginBottom: 28 },
  emptyBtn:         { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText:     { ...T.body, ...T.bold, color: C.surface },
  demoBlock:        { width: '100%', marginTop: 36 },
  demoLabel:        { ...T.label, color: C.muted, marginBottom: 10, textAlign: 'center' },
  demoRow:          { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, opacity: 0.9 },
  demoBadge:        { backgroundColor: C.goldBg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  demoBadgeText:    { fontSize: 10, fontWeight: '700', color: C.gold },
  demoSupportBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 12, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: C.primaryBd, backgroundColor: C.primaryBg },
  demoSupportText:  { ...T.body, ...T.bold, color: C.primary },
});
