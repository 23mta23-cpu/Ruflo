import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Modal, Pressable, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { C } from '../../constants/colors';
import { Badge } from '../../components/ui/Badge';
import { Divider } from '../../components/ui/Divider';
import { useAuth } from '../../contexts/AuthContext';
import { getMyContractsAsProvider, type ContractWithJobAndCustomer } from '../../lib/contracts';
import { supabase } from '../../lib/supabase';
import { toast } from '../../components/ui/Toast';

type Tab = 'aktiv' | 'ausstehend' | 'abgeschlossen';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
}

function customerInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  return parts.length >= 2 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0].slice(0, 2);
}

export default function ProviderAuftraegeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('aktiv');
  const [contracts, setContracts] = useState<ContractWithJobAndCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getMyContractsAsProvider(user.id);
      setContracts(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function handleComplete(contractId: string) {
    setCompleting(true);
    try {
      const contract = contracts.find((c) => c.id === contractId);
      if (contract?.job_id) {
        await supabase.from('jobs').update({ status: 'in_progress' }).eq('id', contract.job_id);
      }
      setConfirmId(null);
      toast.success('Auftrag als erledigt markiert — Kunde gibt die Zahlung frei');
    } catch {
      toast.error('Fehler — bitte erneut versuchen');
    } finally {
      setCompleting(false);
    }
  }

  const active    = contracts.filter((c) => c.status === 'active');
  const pending   = contracts.filter((c) => c.status === 'pending');
  const completed = contracts.filter((c) => c.status === 'completed');

  const escrowTotal = active.reduce((s, c) => s + (c.customer_total ?? 0), 0);
  const payoutTotal = completed.reduce((s, c) => s + (c.provider_payout ?? 0), 0);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'aktiv',         label: 'Aktiv',         count: active.length    },
    { key: 'ausstehend',    label: 'Ausstehend',    count: pending.length   },
    { key: 'abgeschlossen', label: 'Abgeschlossen', count: completed.length },
  ];

  const displayList = tab === 'aktiv' ? active : tab === 'ausstehend' ? pending : completed;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Aufträge</Text>
      </View>

      {/* Earnings banner */}
      <View style={styles.earningsBanner}>
        <View style={styles.earningsItem}>
          <Ionicons name="lock-closed-outline" size={14} color={C.amber} />
          <Text style={styles.earningsLabel}>Escrow (aktiv)</Text>
          <Text style={[styles.earningsValue, { color: C.amber }]}>
            €{escrowTotal.toFixed(2)}
          </Text>
        </View>
        <View style={styles.earningsSep} />
        <View style={styles.earningsItem}>
          <Ionicons name="cash-outline" size={14} color={C.green} />
          <Text style={styles.earningsLabel}>Ausgezahlt gesamt</Text>
          <Text style={styles.earningsValue}>€{payoutTotal.toFixed(2)}</Text>
        </View>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
              {t.label}{t.count > 0 ? ` (${t.count})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={C.primary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={C.primary}
            />
          }
        >
          {displayList.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="clipboard-outline" size={36} color={C.border} />
              <Text style={styles.emptyText}>Keine Aufträge</Text>
            </View>
          ) : null}

          {/* ── AKTIV ── */}
          {tab === 'aktiv' && active.map((c) => (
            <View key={c.id} style={styles.jobCard}>
              <View style={styles.timePill}>
                <Text style={styles.timePillText}>{formatDate(c.created_at)}</Text>
              </View>
              <View style={styles.jobBody}>
                <View style={styles.jobRow}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.jobTitleRow}>
                      <Text style={styles.jobCustomer}>{c.customer?.full_name ?? 'Kunde'}</Text>
                      <Badge label="Aktiv" variant="green" />
                    </View>
                    <Text style={styles.jobService}>{c.job?.title ?? '—'}</Text>
                    <View style={styles.jobAddressRow}>
                      <Ionicons name="location-outline" size={12} color={C.muted} />
                      <Text style={styles.jobAddress}>{c.job?.address_city ?? '—'}</Text>
                    </View>
                  </View>
                  <Text style={styles.jobPrice}>€{(c.provider_payout ?? 0).toFixed(0)}</Text>
                </View>
                <View style={styles.jobActions}>
                  <TouchableOpacity
                    style={styles.actionSecondary}
                    onPress={() => router.push({ pathname: '/chat', params: { jobId: c.job_id } })}
                  >
                    <Ionicons name="chatbubble-outline" size={14} color={C.sub} />
                    <Text style={styles.actionSecondaryText}>Chat</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionPrimary}
                    onPress={() => setConfirmId(c.id)}
                  >
                    <Ionicons name="checkmark-circle-outline" size={14} color={C.surface} />
                    <Text style={styles.actionPrimaryText}>Abschließen</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}

          {/* ── AUSSTEHEND ── */}
          {tab === 'ausstehend' && pending.map((c) => (
            <View key={c.id} style={styles.jobCard}>
              <View style={styles.countdownChip}>
                <Ionicons name="time-outline" size={13} color={C.gold} />
                <Text style={styles.countdownText}>Ausstehend</Text>
              </View>
              <View style={styles.jobBody}>
                <View style={styles.jobRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.jobDate}>{formatDate(c.created_at)}</Text>
                    <Text style={styles.jobCustomer}>{c.customer?.full_name ?? 'Kunde'}</Text>
                    <Text style={styles.jobService}>{c.job?.title ?? '—'}</Text>
                    <View style={styles.jobAddressRow}>
                      <Ionicons name="location-outline" size={12} color={C.muted} />
                      <Text style={styles.jobAddress}>{c.job?.address_city ?? '—'}</Text>
                    </View>
                  </View>
                  <Text style={styles.jobPrice}>€{(c.provider_payout ?? 0).toFixed(0)}</Text>
                </View>
                <View style={styles.jobActions}>
                  <TouchableOpacity
                    style={styles.actionSecondary}
                    onPress={() => router.push({ pathname: '/chat', params: { jobId: c.job_id } })}
                  >
                    <Ionicons name="chatbubble-outline" size={14} color={C.sub} />
                    <Text style={styles.actionSecondaryText}>Chat</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}

          {/* ── ABGESCHLOSSEN ── */}
          {tab === 'abgeschlossen' && (
            <>
              {completed.length > 0 && (
                <View style={styles.summaryCard}>
                  <View style={styles.summaryRow}>
                    <View>
                      <Text style={styles.summaryTitle}>Ausgezahlt gesamt</Text>
                      <Text style={styles.summaryNote}>{completed.length} Aufträge</Text>
                    </View>
                    <Text style={styles.summaryAmount}>
                      €{payoutTotal.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                  <Divider margin={12} />
                  <View style={styles.summaryMetaRow}>
                    <View style={styles.summaryMeta}>
                      <Ionicons name="checkmark-circle-outline" size={14} color={C.green} />
                      <Text style={styles.summaryMetaText}>{completed.length} Jobs abgeschlossen</Text>
                    </View>
                  </View>
                </View>
              )}

              {completed.map((c) => (
                <View key={c.id} style={styles.doneCard}>
                  <View style={styles.doneCardRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.doneDate}>{formatDate(c.created_at)}</Text>
                      <Text style={styles.jobCustomer}>{c.customer?.full_name ?? 'Kunde'}</Text>
                      <Text style={styles.jobService}>{c.job?.title ?? '—'}</Text>
                    </View>
                    <View style={styles.doneRight}>
                      <Text style={styles.doneAmount}>€{(c.provider_payout ?? 0).toFixed(0)}</Text>
                      <Badge label="Ausgezahlt" variant="green" />
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}

      {/* Confirmation modal */}
      <Modal
        visible={confirmId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmId(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setConfirmId(null)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalIconRow}>
              <View style={styles.modalIconBg}>
                <Ionicons name="checkmark-circle" size={28} color={C.green} />
              </View>
            </View>
            <Text style={styles.modalTitle}>Job abschließen?</Text>
            <Text style={styles.modalBody}>
              Der Auftrag wird als erledigt markiert. Der Kunde erhält eine Benachrichtigung und gibt die Zahlung frei — danach erscheint der Betrag in Ihrem Guthaben.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setConfirmId(null)}>
                <Text style={styles.modalCancelText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, completing && { opacity: 0.6 }]}
                onPress={() => confirmId && handleComplete(confirmId)}
                disabled={completing}
              >
                {completing
                  ? <ActivityIndicator color={C.surface} size="small" />
                  : <Text style={styles.modalConfirmText}>Bestätigen</Text>
                }
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: C.bg },
  header:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title:              { fontSize: 24, fontWeight: '800', color: C.ink },
  centered:           { flex: 1, alignItems: 'center', justifyContent: 'center' },

  earningsBanner:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, marginHorizontal: 20, marginBottom: 14, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, paddingVertical: 11 },
  earningsItem:       { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  earningsLabel:      { fontSize: 11, color: C.sub, flex: 1 },
  earningsValue:      { fontSize: 15, fontWeight: '800', color: C.green },
  earningsSep:        { width: 1, height: 28, backgroundColor: C.border, marginHorizontal: 12 },

  tabBar:             { flexDirection: 'row', marginHorizontal: 20, marginBottom: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 3 },
  tabBtn:             { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tabBtnActive:       { backgroundColor: C.ink },
  tabText:            { fontSize: 12, fontWeight: '500', color: C.sub },
  tabTextActive:      { color: C.surface, fontWeight: '700' },

  scrollContent:      { paddingHorizontal: 20, paddingBottom: 36 },

  emptyWrap:          { alignItems: 'center', paddingTop: 48, gap: 12 },
  emptyText:          { fontSize: 14, color: C.muted },

  jobCard:            { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, marginBottom: 12, overflow: 'hidden' },
  timePill:           { backgroundColor: C.ink, paddingHorizontal: 14, paddingVertical: 7, alignSelf: 'flex-start', borderBottomRightRadius: 8 },
  timePillText:       { fontSize: 12, fontWeight: '700', color: C.surface, letterSpacing: 0.3 },
  jobBody:            { padding: 14 },
  jobRow:             { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  jobTitleRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  jobDate:            { fontSize: 11, color: C.muted, fontWeight: '600', letterSpacing: 0.3, marginBottom: 3 },
  jobCustomer:        { fontSize: 14, fontWeight: '700', color: C.ink, marginBottom: 2 },
  jobService:         { fontSize: 12, color: C.sub, marginBottom: 4 },
  jobAddressRow:      { flexDirection: 'row', alignItems: 'center', gap: 3 },
  jobAddress:         { fontSize: 11, color: C.muted },
  jobPrice:           { fontSize: 18, fontWeight: '800', color: C.ink },

  jobActions:         { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionSecondary:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  actionSecondaryText:{ fontSize: 12, color: C.sub, fontWeight: '500' },
  actionPrimary:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: C.green, borderRadius: 8, paddingVertical: 8 },
  actionPrimaryText:  { fontSize: 13, color: C.surface, fontWeight: '700' },

  countdownChip:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.goldBg, paddingHorizontal: 14, paddingVertical: 7, alignSelf: 'flex-start', borderBottomRightRadius: 8 },
  countdownText:      { fontSize: 12, fontWeight: '700', color: C.gold },

  summaryCard:        { backgroundColor: C.ink, borderRadius: 14, padding: 18, marginBottom: 16 },
  summaryRow:         { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  summaryTitle:       { fontSize: 14, fontWeight: '700', color: C.surface, marginBottom: 2 },
  summaryNote:        { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  summaryAmount:      { fontSize: 28, fontWeight: '900', color: C.surface },
  summaryMetaRow:     { flexDirection: 'row', gap: 16 },
  summaryMeta:        { flexDirection: 'row', alignItems: 'center', gap: 5 },
  summaryMetaText:    { fontSize: 12, color: 'rgba(255,255,255,0.7)' },

  doneCard:           { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
  doneCardRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  doneDate:           { fontSize: 11, color: C.muted, fontWeight: '600', letterSpacing: 0.3, marginBottom: 3 },
  doneRight:          { alignItems: 'flex-end', gap: 6 },
  doneAmount:         { fontSize: 18, fontWeight: '800', color: C.ink },

  modalOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet:         { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 28, paddingBottom: 40 },
  modalIconRow:       { alignItems: 'center', marginBottom: 14 },
  modalIconBg:        { width: 56, height: 56, borderRadius: 28, backgroundColor: C.greenBg, alignItems: 'center', justifyContent: 'center' },
  modalTitle:         { fontSize: 20, fontWeight: '800', color: C.ink, textAlign: 'center', marginBottom: 10 },
  modalBody:          { fontSize: 14, color: C.sub, textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  modalActions:       { flexDirection: 'row', gap: 12 },
  modalCancel:        { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  modalCancelText:    { fontSize: 15, fontWeight: '600', color: C.sub },
  modalConfirm:       { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: C.green, alignItems: 'center' },
  modalConfirmText:   { fontSize: 15, fontWeight: '700', color: C.surface },
});
