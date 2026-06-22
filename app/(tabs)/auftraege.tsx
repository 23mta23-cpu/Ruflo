import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/colors';
import { T } from '../../constants/theme';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../contexts/AuthContext';
import { getMyContractsAsCustomerFull, type ContractWithJobAndProvider } from '../../lib/contracts';

type Filter = 'aktiv' | 'abgeschlossen';

function contractStatus(c: ContractWithJobAndProvider): 'active' | 'pending' | 'done' | 'cancelled' {
  if (c.status === 'completed') return 'done';
  if (c.status === 'cancelled') return 'cancelled';
  if (c.escrow_captured_at) return 'active';
  return 'pending';
}

const STATUS_MAP = {
  active:    { label: 'Aktiv',          variant: 'green'  as const },
  pending:   { label: 'Ausstehend',     variant: 'amber'  as const },
  done:      { label: 'Abgeschlossen',  variant: 'muted'  as const },
  cancelled: { label: 'Storniert',      variant: 'red'    as const },
};

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' });
}

export default function AuftraegeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [filter,      setFilter]      = useState<Filter>('aktiv');
  const [contracts,   setContracts]   = useState<ContractWithJobAndProvider[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      const data = await getMyContractsAsCustomerFull(user.id);
      setContracts(data);
    } catch {
      // silently keep previous list on error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const activeContracts   = contracts.filter((c) => c.status !== 'completed' && c.status !== 'cancelled');
  const doneContracts     = contracts.filter((c) => c.status === 'completed' || c.status === 'cancelled');
  const escrowTotal       = activeContracts.reduce((s, c) => s + (c.escrow_captured_at ? (c.customer_total ?? 0) : 0), 0);
  const orders = filter === 'aktiv' ? activeContracts : doneContracts;

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
              {f === 'aktiv'
                ? `Aktiv (${activeContracts.length})`
                : `Abgeschlossen (${doneContracts.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.primary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.primary} />}
        >
          {filter === 'aktiv' && escrowTotal > 0 && (
            <View style={styles.escrowBanner}>
              <Ionicons name="lock-closed" size={14} color={C.amber} />
              <Text style={styles.escrowBannerText}>
                €{escrowTotal.toFixed(2)} eingefroren in Escrow · Freigabe nach Job-Abschluss
              </Text>
            </View>
          )}

          {orders.map((contract, i) => {
            const disp = contractStatus(contract);
            const providerName = contract.provider?.business_name ?? 'Anbieter';
            return (
              <React.Fragment key={contract.id}>
                <TouchableOpacity
                  style={styles.orderCard}
                  onPress={() => router.push({ pathname: '/auftrag-detail', params: { jobId: contract.job_id } })}
                  activeOpacity={0.8}
                >
                  <View style={styles.orderTop}>
                    <View style={styles.orderAvatar}>
                      <Text style={styles.orderAvatarText}>{providerName.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.orderInfo}>
                      <Text style={styles.orderProvider}>{providerName}</Text>
                      <Text style={styles.orderService} numberOfLines={1}>{contract.job?.title ?? '—'}</Text>
                      <Text style={styles.orderDate}>{formatDate(contract.created_at ?? null)}</Text>
                    </View>
                    <View style={styles.orderRight}>
                      <Text style={styles.orderPrice}>€{(contract.customer_total ?? 0).toFixed(0)}</Text>
                      <Badge label={STATUS_MAP[disp].label} variant={STATUS_MAP[disp].variant} />
                    </View>
                  </View>

                  {contract.escrow_captured_at && disp === 'active' && (
                    <View style={styles.escrowRow}>
                      <Ionicons name="lock-closed-outline" size={12} color={C.amber} />
                      <Text style={styles.escrowRowText}>Escrow aktiv – Geld gesperrt</Text>
                    </View>
                  )}

                  <View style={styles.orderActions}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => router.push({ pathname: '/chat', params: { jobId: contract.job_id, providerId: contract.provider_id } })}>
                      <Ionicons name="chatbubble-outline" size={15} color={C.sub} />
                      <Text style={styles.actionBtnText}>Chat</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => router.push(`/vertrag?contractId=${contract.id}`)}>
                      <Ionicons name="document-text-outline" size={15} color={C.sub} />
                      <Text style={styles.actionBtnText}>Vertrag</Text>
                    </TouchableOpacity>
                    {disp === 'done' && (
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnBeleg]}
                        onPress={() => router.push({ pathname: '/rechnung', params: { contractId: contract.id, track: contract.track ?? '' } })}
                      >
                        <Ionicons name="receipt-outline" size={15} color={C.primary} />
                        <Text style={[styles.actionBtnText, { color: C.primary }]}>Beleg</Text>
                      </TouchableOpacity>
                    )}
                    {disp === 'active' && (
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnAbschluss]}
                        onPress={() => router.push(`/auftrag-abschliessen?contractId=${contract.id}`)}
                      >
                        <Ionicons name="checkmark-circle-outline" size={15} color={C.primary} />
                        <Text style={[styles.actionBtnText, { color: C.primary }]}>Abschließen</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
                {i < orders.length - 1 && <View style={{ height: 1, backgroundColor: C.border, marginHorizontal: 20 }} />}
              </React.Fragment>
            );
          })}

          {orders.length === 0 && !loading && (
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="briefcase-outline" size={28} color={C.muted} />
              </View>
              <Text style={styles.emptyTitle}>
                {filter === 'aktiv' ? 'Keine aktiven Aufträge' : 'Keine abgeschlossenen Aufträge'}
              </Text>
              <Text style={styles.emptyText}>
                {filter === 'aktiv'
                  ? 'Sobald Sie einen Auftrag vergeben, erscheint er hier.'
                  : 'Abgeschlossene Aufträge und Belege finden Sie hier.'}
              </Text>
              {filter === 'aktiv' && (
                <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/suche')}>
                  <Text style={styles.emptyBtnText}>Handwerker suchen</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: C.bg },
  header:            { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title:             { ...T.h1, fontSize: 24, color: C.ink },
  filterBar:         { flexDirection: 'row', marginHorizontal: 20, marginBottom: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 3 },
  filterBtn:         { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  filterBtnActive:   { backgroundColor: C.primary },
  filterText:        { ...T.bodySmall, fontWeight: '500', color: C.sub },
  filterTextActive:  { color: C.surface, fontWeight: '700' },
  center:            { flex: 1, alignItems: 'center', justifyContent: 'center' },
  escrowBanner:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.amberBg, marginHorizontal: 20, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12 },
  escrowBannerText:  { ...T.caption, color: C.amber, fontWeight: '500' },
  orderCard:         { backgroundColor: C.surface, paddingHorizontal: 20, paddingVertical: 16 },
  orderTop:          { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  orderAvatar:       { width: 40, height: 40, borderRadius: 20, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  orderAvatarText:   { ...T.h4, color: C.gold },
  orderInfo:         { flex: 1 },
  orderProvider:     { ...T.bodySmall, fontWeight: '700', color: C.ink, marginBottom: 2 },
  orderService:      { ...T.bodySmall, color: C.sub, marginBottom: 2 },
  orderDate:         { ...T.caption, color: C.muted },
  orderRight:        { alignItems: 'flex-end', gap: 4 },
  orderPrice:        { ...T.h4, fontWeight: '800', color: C.ink },
  escrowRow:         { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.amberBg, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 8, alignSelf: 'flex-start' },
  escrowRowText:     { ...T.caption, color: C.amber, fontWeight: '500' },
  orderActions:      { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  actionBtn:         { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  actionBtnBeleg:    { backgroundColor: C.primaryBg, borderColor: C.primary },
  actionBtnAbschluss:{ backgroundColor: C.primaryBg, borderColor: C.primary },
  actionBtnText:     { ...T.caption, color: C.sub, fontWeight: '500' },
  empty:             { alignItems: 'center', justifyContent: 'center', paddingTop: 72, paddingHorizontal: 32, gap: 8 },
  emptyIconWrap:     { width: 64, height: 64, borderRadius: 16, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle:        { fontSize: 15, fontWeight: '700', color: C.ink },
  emptyText:         { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 19 },
  emptyBtn:          { backgroundColor: C.primary, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 24, marginTop: 10 },
  emptyBtnText:      { fontSize: 14, fontWeight: '700', color: '#fff' },
});
