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
import { sendPushToUser } from '../../lib/notifications';
import { toast } from '../../components/ui/Toast';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

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
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

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
        const { error } = await supabase
          .from('jobs')
          .update({ status: 'completed' })
          .eq('id', contract.job_id);
        if (error) throw error;
      }
      // Prompt the customer to release escrow (fire-and-forget).
      if (contract?.customer_id) {
        sendPushToUser(
          contract.customer_id,
          'Auftrag erledigt – Zahlung freigeben',
          `Ihr Handwerker hat die Arbeit für „${contract.job?.title ?? 'Ihren Auftrag'}" als erledigt markiert. Bitte geben Sie die Zahlung frei.`,
          { screen: '/auftrag-abschliessen', contractId },
        );
      }
      setConfirmId(null);
      await load();
      toast.success('Auftrag als erledigt markiert — Kunde gibt die Zahlung frei');
    } catch {
      toast.error('Fehler — bitte erneut versuchen');
    } finally {
      setCompleting(false);
    }
  }

  async function handleProviderCancel(contractId: string) {
    setCancelling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Nicht eingeloggt');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/cancel-contract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ contract_id: contractId, reason: 'Anbieter hat storniert' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error ?? 'Stornierung fehlgeschlagen');
      }
      setCancelId(null);
      await load();
      toast.success('Auftrag storniert — Kunde wird vollständig erstattet');
    } catch (e: unknown) {
      toast.error((e as Error).message ?? 'Fehler beim Stornieren');
    } finally {
      setCancelling(false);
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
          <View style={[styles.earningsIconWrap, { backgroundColor: C.amberBg }]}>
            <Ionicons name="lock-closed-outline" size={13} color={C.amber} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.earningsLabel}>Escrow (aktiv)</Text>
            <Text style={[styles.earningsValue, { color: C.amber }]}>
              €{escrowTotal.toFixed(2)}
            </Text>
          </View>
        </View>
        <View style={styles.earningsSep} />
        <View style={styles.earningsItem}>
          <View style={[styles.earningsIconWrap, { backgroundColor: C.primaryBg }]}>
            <Ionicons name="cash-outline" size={13} color={C.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.earningsLabel}>Ausgezahlt gesamt</Text>
            <Text style={[styles.earningsValue, { color: C.primary }]}>€{payoutTotal.toFixed(2)}</Text>
          </View>
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
              <View style={styles.emptyIconWrap}>
                <Ionicons name="clipboard-outline" size={28} color={C.muted} />
              </View>
              <Text style={styles.emptyTitle}>Keine Aufträge</Text>
              <Text style={styles.emptyText}>
                {tab === 'aktiv' ? 'Sobald ein Kunde Ihr Angebot annimmt, erscheint der Auftrag hier.' :
                 tab === 'ausstehend' ? 'Ausstehende Zahlungsbestätigungen erscheinen hier.' :
                 'Abgeschlossene Aufträge werden hier archiviert.'}
              </Text>
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
                    style={styles.actionCancel}
                    onPress={() => setCancelId(c.id)}
                  >
                    <Ionicons name="close-circle-outline" size={14} color={C.clay} />
                    <Text style={styles.actionCancelText}>Stornieren</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionPrimary}
                    activeOpacity={0.8}
                    onPress={() => setConfirmId(c.id)}
                  >
                    <Ionicons name="checkmark-circle-outline" size={14} color={C.surface} />
                    <Text style={styles.actionPrimaryText}>Fertig</Text>
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
                      <Ionicons name="checkmark-circle-outline" size={14} color={C.primary} />
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
                <Ionicons name="checkmark-circle" size={28} color={C.primary} />
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

      {/* Provider cancellation modal */}
      <Modal
        visible={cancelId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelId(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setCancelId(null)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalIconRow}>
              <View style={[styles.modalIconBg, { backgroundColor: C.clayBg, borderColor: C.clayBd }]}>
                <Ionicons name="close-circle" size={28} color={C.clay} />
              </View>
            </View>
            <Text style={styles.modalTitle}>Auftrag stornieren?</Text>
            <Text style={styles.modalBody}>
              Der Auftrag wird storniert und der Kunde erhält eine vollständige Rückerstattung. Diese Aktion kann nicht rückgängig gemacht werden.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setCancelId(null)}>
                <Text style={styles.modalCancelText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalCancelConfirm, cancelling && { opacity: 0.6 }]}
                onPress={() => cancelId && handleProviderCancel(cancelId)}
                disabled={cancelling}
              >
                {cancelling
                  ? <ActivityIndicator color={C.surface} size="small" />
                  : <Text style={styles.modalConfirmText}>Stornieren</Text>
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
  title:              { fontSize: 24, fontWeight: '700', color: C.ink },
  centered:           { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Earnings banner — Double-Bezel depth, branded tint
  earningsBanner:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, marginHorizontal: 20, marginBottom: 14, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, paddingVertical: 12, shadowColor: C.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  earningsItem:       { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  earningsIconWrap:   { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  earningsLabel:      { fontSize: 11, color: C.muted, fontWeight: '500', marginBottom: 2 },
  earningsValue:      { fontSize: 16, fontWeight: '700', color: C.ink },
  earningsSep:        { width: 1, height: 36, backgroundColor: C.border, marginHorizontal: 14 },

  // Tab bar — on-brand active state
  tabBar:             { flexDirection: 'row', marginHorizontal: 20, marginBottom: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 3 },
  tabBtn:             { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tabBtnActive:       { backgroundColor: C.primary },
  tabText:            { fontSize: 12, fontWeight: '500', color: C.sub },
  tabTextActive:      { color: C.surface, fontWeight: '700' },

  scrollContent:      { paddingHorizontal: 20, paddingBottom: 36 },

  // Empty state — composed with context text
  emptyWrap:          { alignItems: 'center', paddingTop: 56, paddingHorizontal: 24, gap: 10 },
  emptyIconWrap:      { width: 64, height: 64, borderRadius: 16, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle:         { fontSize: 15, fontWeight: '700', color: C.ink },
  emptyText:          { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 19 },

  // Job cards — tinted shadow, stronger hierarchy
  jobCard:            { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginBottom: 12, overflow: 'hidden', shadowColor: C.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  timePill:           { backgroundColor: C.primary, paddingHorizontal: 14, paddingVertical: 7, alignSelf: 'flex-start', borderBottomRightRadius: 9 },
  timePillText:       { fontSize: 11, fontWeight: '700', color: C.surface, letterSpacing: 0.4 },
  jobBody:            { padding: 16 },
  jobRow:             { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  jobTitleRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  jobDate:            { fontSize: 11, color: C.muted, fontWeight: '600', letterSpacing: 0.3, marginBottom: 3 },
  jobCustomer:        { fontSize: 15, fontWeight: '700', color: C.ink, marginBottom: 2 },
  jobService:         { fontSize: 12, color: C.sub, lineHeight: 17, marginBottom: 5 },
  jobAddressRow:      { flexDirection: 'row', alignItems: 'center', gap: 3 },
  jobAddress:         { fontSize: 11, color: C.muted },
  jobPrice:           { fontSize: 20, fontWeight: '700', color: C.ink, letterSpacing: -0.5 },

  // Action buttons
  jobActions:         { flexDirection: 'row', gap: 8, marginTop: 14 },
  actionSecondary:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 9, paddingHorizontal: 14, paddingVertical: 9 },
  actionSecondaryText:{ fontSize: 12, color: C.sub, fontWeight: '500' },
  actionCancel:       { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.clayBg, borderWidth: 1, borderColor: C.clayBd, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9 },
  actionCancelText:   { fontSize: 12, color: C.clay, fontWeight: '600' },
  actionPrimary:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: C.primary, borderRadius: 9, paddingVertical: 9 },
  actionPrimaryText:  { fontSize: 13, color: C.surface, fontWeight: '700' },

  countdownChip:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.goldBg, paddingHorizontal: 14, paddingVertical: 7, alignSelf: 'flex-start', borderBottomRightRadius: 9 },
  countdownText:      { fontSize: 11, fontWeight: '700', color: C.amber, letterSpacing: 0.3 },

  // Summary card — dark ink, strong payout emphasis
  summaryCard:        { backgroundColor: C.ink, borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: C.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 },
  summaryRow:         { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  summaryTitle:       { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: 3 },
  summaryNote:        { fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  summaryAmount:      { fontSize: 30, fontWeight: '700', color: C.surface, letterSpacing: -1 },
  summaryMetaRow:     { flexDirection: 'row', gap: 16 },
  summaryMeta:        { flexDirection: 'row', alignItems: 'center', gap: 5 },
  summaryMetaText:    { fontSize: 12, color: 'rgba(255,255,255,0.6)' },

  // Done cards
  doneCard:           { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
  doneCardRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  doneDate:           { fontSize: 11, color: C.muted, fontWeight: '600', letterSpacing: 0.3, marginBottom: 3 },
  doneRight:          { alignItems: 'flex-end', gap: 6 },
  doneAmount:         { fontSize: 18, fontWeight: '700', color: C.ink },

  // Confirmation modal
  modalOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet:         { backgroundColor: C.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 28, paddingBottom: 40 },
  modalIconRow:       { alignItems: 'center', marginBottom: 16 },
  modalIconBg:        { width: 60, height: 60, borderRadius: 18, backgroundColor: C.primaryBg, borderWidth: 1, borderColor: C.primaryBd, alignItems: 'center', justifyContent: 'center' },
  modalTitle:         { fontSize: 20, fontWeight: '700', color: C.ink, textAlign: 'center', marginBottom: 10 },
  modalBody:          { fontSize: 14, color: C.sub, textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  modalActions:       { flexDirection: 'row', gap: 12 },
  modalCancel:        { flex: 1, paddingVertical: 14, borderRadius: 11, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  modalCancelText:    { fontSize: 15, fontWeight: '600', color: C.sub },
  modalConfirm:       { flex: 1, paddingVertical: 14, borderRadius: 11, backgroundColor: C.primary, alignItems: 'center' },
  modalCancelConfirm: { flex: 1, paddingVertical: 14, borderRadius: 11, backgroundColor: C.clay, alignItems: 'center' },
  modalConfirmText:   { fontSize: 15, fontWeight: '700', color: C.surface },
});
