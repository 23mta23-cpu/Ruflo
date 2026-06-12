import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/colors';
import { Badge } from '../../components/ui/Badge';
import { Divider } from '../../components/ui/Divider';

type Filter = 'aktiv' | 'abgeschlossen';

const ACTIVE_ORDERS = [
  {
    id: 'WRK-2406-0047',
    provider: 'Yilmaz GmbH',
    service: 'Heizkörper-Diagnose & Thermostat',
    date: 'Mo., 09. Jun · 14:00',
    price: 120,
    status: 'active' as const,
    escrow: true,
    hasReclamation: false,
  },
  {
    id: 'WRK-2406-0039',
    provider: 'Lena M.',
    service: 'Nachhilfe Mathe (2h)',
    date: 'Di., 10. Jun · 16:00',
    price: 30,
    status: 'pending' as const,
    escrow: false,
    hasReclamation: false,
  },
];

const DONE_ORDERS = [
  {
    id: 'WRK-2405-0021',
    provider: 'Marcus Berger',
    service: 'Steckdose erneuern (3x)',
    date: 'Fr., 31. Mai · 10:00',
    price: 95,
    status: 'done' as const,
    rating: 5,
    hasReclamation: false,
  },
  {
    id: 'WRK-2405-0014',
    provider: 'Stefan Koch',
    service: 'Wohnzimmer streichen',
    date: 'Sa., 25. Mai · 09:00',
    price: 380,
    status: 'done' as const,
    rating: 4,
    hasReclamation: false,
  },
  {
    id: 'WRK-2405-0008',
    provider: 'Tim K.',
    service: 'Rasen mähen & Hecke',
    date: 'Di., 20. Mai · 11:00',
    price: 48,
    status: 'reclamation' as const,
    rating: null,
    hasReclamation: true,
  },
];

const STATUS_MAP = {
  active:       { label: 'Aktiv',        variant: 'green' as const },
  pending:      { label: 'Ausstehend',   variant: 'amber' as const },
  done:         { label: 'Abgeschlossen',variant: 'muted' as const },
  reclamation:  { label: 'Reklamation',  variant: 'red'   as const },
};

export default function AuftraegeScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('aktiv');

  const orders = filter === 'aktiv' ? ACTIVE_ORDERS : DONE_ORDERS;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Meine Aufträge</Text>
      </View>

      {/* Filter */}
      <View style={styles.filterBar}>
        {(['aktiv', 'abgeschlossen'] as Filter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'aktiv' ? `Aktiv (${ACTIVE_ORDERS.length})` : `Abgeschlossen (${DONE_ORDERS.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Escrow Warning */}
        {filter === 'aktiv' && (
          <View style={styles.escrowBanner}>
            <Ionicons name="lock-closed" size={14} color={C.amber} />
            <Text style={styles.escrowBannerText}>
              €120 eingefroren in Escrow · Freigabe nach Job-Abschluss
            </Text>
          </View>
        )}

        {orders.map((order, i) => (
          <React.Fragment key={order.id}>
            <TouchableOpacity
              style={styles.orderCard}
              onPress={() => router.push(order.status === 'reclamation' ? '/reklamation' : '/vertrag')}
              activeOpacity={0.8}
            >
              <View style={styles.orderTop}>
                <View style={styles.orderAvatar}>
                  <Text style={styles.orderAvatarText}>{order.provider.charAt(0)}</Text>
                </View>
                <View style={styles.orderInfo}>
                  <Text style={styles.orderProvider}>{order.provider}</Text>
                  <Text style={styles.orderService} numberOfLines={1}>{order.service}</Text>
                  <Text style={styles.orderDate}>{order.date}</Text>
                </View>
                <View style={styles.orderRight}>
                  <Text style={styles.orderPrice}>€{order.price}</Text>
                  <Badge label={STATUS_MAP[order.status].label} variant={STATUS_MAP[order.status].variant} />
                </View>
              </View>

              {'escrow' in order && order.escrow && (
                <View style={styles.escrowRow}>
                  <Ionicons name="lock-closed-outline" size={12} color={C.amber} />
                  <Text style={styles.escrowRowText}>Escrow aktiv – Geld gesperrt</Text>
                </View>
              )}

              {'rating' in order && order.rating && (
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={13} color={C.gold} />
                  <Text style={styles.ratingText}>Bewertet: {order.rating}/5</Text>
                </View>
              )}

              {order.hasReclamation && (
                <View style={styles.reclamationRow}>
                  <Ionicons name="alert-circle-outline" size={13} color={C.red} />
                  <Text style={styles.reclamationText}>Offene Reklamation · 72h Reaktionszeit läuft</Text>
                </View>
              )}

              <View style={styles.orderActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/chat')}>
                  <Ionicons name="chatbubble-outline" size={15} color={C.sub} />
                  <Text style={styles.actionBtnText}>Chat</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/vertrag')}>
                  <Ionicons name="document-text-outline" size={15} color={C.sub} />
                  <Text style={styles.actionBtnText}>Vertrag</Text>
                </TouchableOpacity>
                {order.status === 'done' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnBeleg]}
                    onPress={() => router.push(`/rechnung?gross=${order.price}`)}
                  >
                    <Ionicons name="receipt-outline" size={15} color={C.green} />
                    <Text style={[styles.actionBtnText, { color: C.green }]}>Beleg</Text>
                  </TouchableOpacity>
                )}
                {order.status === 'active' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnPrimary]}
                    onPress={() => router.push('/reklamation')}
                  >
                    <Ionicons name="flag-outline" size={15} color={C.red} />
                    <Text style={[styles.actionBtnText, { color: C.red }]}>Reklamieren</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
            {i < orders.length - 1 && <View style={{ height: 1, backgroundColor: C.border, marginHorizontal: 20 }} />}
          </React.Fragment>
        ))}

        {orders.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="briefcase-outline" size={40} color={C.border} />
            <Text style={styles.emptyText}>Noch keine Aufträge</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: C.bg },
  header:             { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title:              { fontSize: 24, fontWeight: '800', color: C.ink },
  filterBar:          { flexDirection: 'row', marginHorizontal: 20, marginBottom: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 3 },
  filterBtn:          { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  filterBtnActive:    { backgroundColor: C.ink },
  filterText:         { fontSize: 13, fontWeight: '500', color: C.sub },
  filterTextActive:   { color: C.surface, fontWeight: '700' },
  escrowBanner:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.amberBg, marginHorizontal: 20, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12 },
  escrowBannerText:   { fontSize: 12, color: C.amber, fontWeight: '500' },
  orderCard:          { backgroundColor: C.surface, paddingHorizontal: 20, paddingVertical: 16 },
  orderTop:           { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  orderAvatar:        { width: 40, height: 40, borderRadius: 20, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  orderAvatarText:    { fontSize: 16, fontWeight: '700', color: C.gold },
  orderInfo:          { flex: 1 },
  orderProvider:      { fontSize: 14, fontWeight: '700', color: C.ink, marginBottom: 2 },
  orderService:       { fontSize: 13, color: C.sub, marginBottom: 2 },
  orderDate:          { fontSize: 12, color: C.muted },
  orderRight:         { alignItems: 'flex-end', gap: 4 },
  orderPrice:         { fontSize: 16, fontWeight: '800', color: C.ink },
  escrowRow:          { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.amberBg, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 8, alignSelf: 'flex-start' },
  escrowRowText:      { fontSize: 11, color: C.amber, fontWeight: '500' },
  ratingRow:          { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  ratingText:         { fontSize: 12, color: C.sub },
  reclamationRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.redBg, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 8, alignSelf: 'flex-start' },
  reclamationText:    { fontSize: 11, color: C.red, fontWeight: '500' },
  orderActions:       { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn:          { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  actionBtnPrimary:   { backgroundColor: C.redBg, borderColor: C.red },
  actionBtnBeleg:     { backgroundColor: C.greenBg, borderColor: C.green },
  actionBtnText:      { fontSize: 12, color: C.sub, fontWeight: '500' },
  empty:              { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText:          { fontSize: 15, color: C.muted },
});
