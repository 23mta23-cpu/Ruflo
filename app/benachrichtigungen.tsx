import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';

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

const NOTIFS: Notif[] = [
  {
    id: '1',
    type: 'offer',
    title: 'Neues Angebot von Yilmaz GmbH',
    body: 'Heizkörper-Diagnose & Thermostat · €120 Festpreis · Mo 09. Jun 14:00',
    time: 'Heute, 10:21',
    read: false,
    route: '/chat',
  },
  {
    id: '2',
    type: 'escrow',
    title: 'Zahlung eingefroren',
    body: '€120 sind in Escrow gesperrt. Werden nach Job-Abschluss freigegeben.',
    time: 'Heute, 10:24',
    read: false,
    route: '/vertrag',
  },
  {
    id: '3',
    type: 'message',
    title: 'Neue Nachricht: Yilmaz GmbH',
    body: 'Ich bin morgen um 14:00 Uhr bei Ihnen.',
    time: 'Heute, 09:55',
    read: true,
    route: '/chat',
  },
  {
    id: '4',
    type: 'review',
    title: 'Bewertung ausstehend',
    body: 'Stefan Koch hat Ihr Wohnzimmer gestrichen. Wie war die Erfahrung?',
    time: 'Gestern',
    read: true,
    route: '/bewertung',
  },
  {
    id: '5',
    type: 'pstg',
    title: 'PStTG-Hinweis: Meldepflicht nähert sich',
    body: 'Sie haben 23 von 30 meldepflichtigen Transaktionen erreicht. Ab 30 Transaktionen oder €2.000 Jahresumsatz erfolgt eine BZSt-Meldung.',
    time: 'Vor 3 Tagen',
    read: true,
    route: '/(provider)/steuer',
  },
  {
    id: '6',
    type: 'system',
    title: 'AGB-Änderung (Frist: 6 Wochen)',
    body: 'Wir haben unsere AGB aktualisiert. Änderungen treten am 24. Juli 2025 in Kraft. Bitte lesen und ggf. Widerspruch erklären.',
    time: 'Vor 5 Tagen',
    read: true,
    route: '/agb',
  },
];

const TYPE_CONFIG: Record<NotifType, { icon: string; color: string; bg: string }> = {
  offer:   { icon: 'document-text',        color: C.gold,  bg: C.goldBg  },
  escrow:  { icon: 'lock-closed',          color: C.amber, bg: C.amberBg },
  message: { icon: 'chatbubble',           color: C.ink,   bg: '#F0EFEB' },
  review:  { icon: 'star',                 color: C.gold,  bg: C.goldBg  },
  pstg:    { icon: 'shield',               color: C.amber, bg: C.amberBg },
  system:  { icon: 'information-circle',   color: C.sub,   bg: C.surface },
};

export default function BenachrichtigungenScreen() {
  const router = useRouter();
  const [notifs, setNotifs] = useState(NOTIFS);

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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {notifs.length === 0 ? (
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: C.bg },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  headerCenter:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title:           { fontSize: 17, fontWeight: '700', color: C.ink },
  badge:           { backgroundColor: C.red, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText:       { fontSize: 11, fontWeight: '700', color: C.surface },
  markRead:        { fontSize: 13, color: C.sub, fontWeight: '500' },
  scroll:          { paddingHorizontal: 20, paddingTop: 4 },
  item:            { flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
  itemUnread:      { borderColor: C.ink, backgroundColor: '#FAFAF8' },
  iconWrap:        { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  itemContent:     { flex: 1 },
  itemTop:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  itemTitle:       { fontSize: 13, fontWeight: '600', color: C.ink, flex: 1, marginRight: 8 },
  itemTitleUnread: { fontWeight: '800' },
  unreadDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: C.ink, flexShrink: 0 },
  itemBody:        { fontSize: 12, color: C.sub, lineHeight: 17, marginBottom: 5 },
  itemTime:        { fontSize: 11, color: C.muted },
  empty:           { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText:       { fontSize: 15, color: C.muted },
  footer:          { fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 8 },
});
