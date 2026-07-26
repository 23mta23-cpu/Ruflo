// Anbieter-Posteingang.
//
// Bisher gab es nur die Kunden-Inbox ((tabs)/nachrichten.tsx). Ein Anbieter, der
// eine Rückfrage zu einem Auftrag gestellt hatte, kam nach der Vergabe an einen
// anderen Anbieter nicht mehr in seinen eigenen Thread zurück — der Auftrag
// verschwand aus jeder Liste (Review-Befund 26.07.). Migration 0590 hält die
// Auftragszeile für Thread-Teilnehmer lesbar, dieser Screen macht sie erreichbar.
//
// Der Kundenname erscheint bewusst erst mit Vertrag (profiles ist erst für
// Vertragsparteien lesbar, 0030) — davor steht „Kunde".

import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/colors';
import { T } from '../../constants/typography';
import { safeBack } from '../../lib/nav';
import { toast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { withOneRetry } from '../../lib/retry';
import { getProviderConversationList, type ConversationSummary } from '../../lib/messages';

function formatTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

export default function ProviderNachrichten() {
  const router = useRouter();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); setRefreshing(false); return; }
    try {
      const data = await withOneRetry(() => getProviderConversationList(user.id));
      setConversations(data);
      setLoadError(false);
    } catch {
      // Netzfehler nicht als „keine Nachrichten" tarnen.
      if (conversations.length === 0) setLoadError(true);
      else toast.error('Nachrichten konnten nicht aktualisiert werden');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // conversations bewusst nicht in den Deps: sonst neuer load() pro Ergebnis.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Zurück"
          onPress={() => safeBack(router)}
          style={s.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={s.title}>Nachrichten</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={s.centered}><ActivityIndicator color={C.primary} /></View>
      ) : loadError ? (
        <View style={s.centered}>
          <Ionicons name="cloud-offline-outline" size={28} color={C.sub} />
          <Text style={s.emptyTitle}>Nachrichten konnten nicht geladen werden</Text>
          <TouchableOpacity
            style={s.btn}
            onPress={() => { setLoading(true); setLoadError(false); load(); }}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Ionicons name="refresh-outline" size={16} color={C.surface} />
            <Text style={s.btnText}>Erneut versuchen</Text>
          </TouchableOpacity>
        </View>
      ) : conversations.length === 0 ? (
        <View style={s.centered}>
          <Ionicons name="chatbubbles-outline" size={30} color={C.muted} />
          <Text style={s.emptyTitle}>Noch keine Konversationen</Text>
          <Text style={s.emptyText}>
            Stelle bei einer unklaren Anfrage direkt eine Rückfrage — die
            Unterhaltung erscheint dann hier.
          </Text>
          <TouchableOpacity
            style={s.btn}
            onPress={() => router.push('/(provider)/auftraege')}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Ionicons name="search-outline" size={16} color={C.surface} />
            <Text style={s.btnText}>Aufträge ansehen</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={C.primary}
            />
          }
        >
          {conversations.map((conv, i) => (
            <TouchableOpacity
              key={conv.jobId}
              style={[s.row, i < conversations.length - 1 && s.rowDivider]}
              // Kein providerId-Param: der Anbieter chattet immer im eigenen
              // Thread, chat.tsx leitet das aus der Auftragszugehörigkeit ab.
              onPress={() => router.push({ pathname: '/chat', params: { jobId: conv.jobId } })}
              activeOpacity={0.7}
            >
              <View style={s.avatar}>
                <Ionicons name="person-outline" size={18} color={C.sub} />
              </View>
              <View style={s.info}>
                <View style={s.topRow}>
                  <Text style={s.name} numberOfLines={1}>{conv.businessName}</Text>
                  <Text style={s.time}>{formatTime(conv.lastMessageAt)}</Text>
                </View>
                <Text style={s.job} numberOfLines={1}>{conv.jobTitle}</Text>
                <Text
                  style={[s.preview, conv.unreadCount > 0 && s.previewUnread]}
                  numberOfLines={1}
                >
                  {conv.isFromMe ? 'Du: ' : ''}{conv.lastMessage}
                </Text>
              </View>
              {conv.unreadCount > 0 ? (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{conv.unreadCount > 9 ? '9+' : conv.unreadCount}</Text>
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={16} color={C.muted} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.bg },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:       { fontSize: 17, fontWeight: '700', color: C.ink },
  centered:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 10 },
  emptyTitle:  { ...T.h3, color: C.ink, textAlign: 'center', marginTop: 6 },
  emptyText:   { ...T.body, color: C.sub, textAlign: 'center', lineHeight: 21 },
  btn:         { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.primary, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10, marginTop: 8 },
  btnText:     { ...T.btn, color: C.surface },
  row:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: C.surface },
  rowDivider:  { borderBottomWidth: 1, borderBottomColor: C.border },
  avatar:      { width: 44, height: 44, borderRadius: 22, backgroundColor: C.bgWarm, alignItems: 'center', justifyContent: 'center' },
  info:        { flex: 1, gap: 2 },
  topRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name:        { ...T.body, fontWeight: '700', color: C.ink, flex: 1 },
  time:        { ...T.caption, color: C.muted },
  job:         { ...T.caption, color: C.sub },
  preview:     { ...T.body, color: C.muted },
  previewUnread: { color: C.ink, fontWeight: '600' },
  badge:       { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText:   { fontSize: 11, fontWeight: '700', color: C.surface },
});
