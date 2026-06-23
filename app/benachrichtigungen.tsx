import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { T } from '../constants/typography';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

type NotifType = 'offer' | 'escrow' | 'message' | 'review' | 'system' | 'pstg';

interface Notif {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  time: string;
  read: boolean;
  route?: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `vor ${mins} Min.`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24) return `Heute, ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  const days = Math.floor(diff / 86_400_000);
  if (days === 1) return 'Gestern';
  if (days < 7) return `vor ${days} Tagen`;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
}

const TYPE_CONFIG: Record<NotifType, { icon: string; color: string; bg: string }> = {
  offer:   { icon: 'document-text',        color: C.gold,  bg: C.goldBg  },
  escrow:  { icon: 'lock-closed',          color: C.amber, bg: C.amberBg },
  message: { icon: 'chatbubble',           color: C.ink,   bg: C.bg     },
  review:  { icon: 'star',                 color: C.gold,  bg: C.goldBg  },
  pstg:    { icon: 'shield',               color: C.amber, bg: C.amberBg },
  system:  { icon: 'information-circle',   color: C.sub,   bg: C.surface },
};

export default function BenachrichtigungenScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    if (!user) { setLoading(false); return; }

    const items: Array<Notif & { _iso: string }> = [];

    // Recent messages from providers to this customer
    const { data: contracts } = await supabase
      .from('contracts')
      .select('job_id, provider_id, provider:provider_profiles!provider_id(business_name)')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    const jobIds = (contracts ?? []).map((c) => c.job_id);

    if (jobIds.length) {
      const { data: msgs } = await supabase
        .from('messages')
        .select('id, body, created_at, job_id, sender_id')
        .in('job_id', jobIds)
        .neq('sender_id', user.id)
        .order('created_at', { ascending: false })
        .limit(15);

      for (const m of msgs ?? []) {
        const contract = contracts!.find((c) => c.job_id === m.job_id);
        const biz = (contract?.provider as any)?.business_name ?? 'Anbieter';
        items.push({
          id: `msg-${m.id}`,
          type: 'message',
          title: `Neue Nachricht: ${biz}`,
          body: m.body,
          time: formatTime(m.created_at),
          read: false,
          route: `/chat?jobId=${m.job_id}&providerId=${contract?.provider_id ?? ''}`,
          _iso: m.created_at,
        });
      }
    }

    // Pending offers on the current customer's jobs only
    if (jobIds.length) {
      const { data: offers } = await supabase
        .from('offers')
        .select('id, price, created_at, job_id, provider:provider_profiles!provider_id(business_name), job:jobs!job_id(title)')
        .eq('status', 'pending')
        .in('job_id', jobIds)
        .order('created_at', { ascending: false })
        .limit(10);

      for (const o of offers ?? []) {
        const biz = (o.provider as any)?.business_name ?? 'Anbieter';
        const title = (o.job as any)?.title ?? 'Auftrag';
        const price = o.price != null ? ` · €${o.price.toFixed(0)}` : '';
        items.push({
          id: `offer-${o.id}`,
          type: 'offer',
          title: `Neues Angebot von ${biz}`,
          body: `${title}${price}`,
          time: formatTime(o.created_at),
          read: false,
          route: `/chat?jobId=${o.job_id}`,
          _iso: o.created_at,
        });
      }
    }

    // Sort newest-first by raw ISO timestamp
    items.sort((a, b) => b._iso.localeCompare(a._iso));

    setNotifs(items.map(({ _iso: _unused, ...n }) => n));
    setLoading(false);
  }, [user]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  const unreadCount = notifs.filter((n) => !n.read).length;

  function markAllRead() {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function handlePress(n: Notif) {
    setNotifs((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x));
    if (n.route) router.push(n.route as any);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Benachrichtigungen</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllRead} hitSlop={12}>
            <Text style={styles.markRead}>Alle lesen</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={C.ink} />
        </View>
      ) : (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {!loading && notifs.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={48} color={C.border} />
            <Text style={styles.emptyText}>Keine Benachrichtigungen</Text>
          </View>
        ) : (
          notifs.map((n, i) => {
            const cfg = TYPE_CONFIG[n.type];
            return (
              <TouchableOpacity
                key={n.id}
                style={[styles.item, !n.read && styles.itemUnread]}
                onPress={() => handlePress(n)}
                activeOpacity={0.75}
              >
                <View style={[styles.iconWrap, { backgroundColor: cfg.bg }]}>
                  <Ionicons name={cfg.icon as any} size={20} color={cfg.color} />
                </View>

                <View style={styles.itemContent}>
                  <View style={styles.itemTop}>
                    <Text style={[styles.itemTitle, !n.read && styles.itemTitleUnread]} numberOfLines={1}>
                      {n.title}
                    </Text>
                    {!n.read && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.itemBody} numberOfLines={2}>{n.body}</Text>
                  <Text style={styles.itemTime}>{n.time}</Text>
                </View>

                <Ionicons name="chevron-forward" size={15} color={C.muted} />
              </TouchableOpacity>
            );
          })
        )}

        <Text style={styles.footer}>
          Push-Benachrichtigungen können in Einstellungen verwaltet werden.
        </Text>
        <View style={{ height: 32 }} />
      </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: C.bg },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  headerCenter:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title:           { ...T.lg, ...T.bold, color: C.ink },
  badge:           { backgroundColor: C.red, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText:       { ...T.xs, ...T.bold, color: C.surface },
  markRead:        { ...T.sm, ...T.medium, color: C.sub },
  scroll:          { paddingHorizontal: 20, paddingTop: 4 },
  item:            { flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
  itemUnread:      { borderColor: C.ink, backgroundColor: C.bg },
  iconWrap:        { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  itemContent:     { flex: 1 },
  itemTop:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  itemTitle:       { ...T.sm, ...T.semibold, color: C.ink, flex: 1, marginRight: 8 },
  itemTitleUnread: { fontWeight: '700' },
  unreadDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary, flexShrink: 0 },
  itemBody:        { ...T.caption, color: C.sub, marginBottom: 5 },
  itemTime:        { ...T.xs, color: C.muted },
  empty:           { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText:       { ...T.base, color: C.muted },
  footer:          { ...T.xs, color: C.muted, textAlign: 'center', marginTop: 8 },
});
