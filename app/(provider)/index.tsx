import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/colors';
import { Badge } from '../../components/ui/Badge';
import { getPStTGStats, getPStTGWarningMessage, submitTaxId, type PStTGStats } from '../../lib/pstTg';
import { toast } from '../../components/ui/Toast';
import { AnimatedButton } from '../../components/ui/AnimatedButton';
import { T, shadow } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { getMyContractsAsProvider, type ContractWithJobAndCustomer } from '../../lib/contracts';
import { getOpenJobs } from '../../lib/jobs';
import { supabase } from '../../lib/supabase';
import type { Job } from '../../lib/database.types';

// Netto-Einnahmen der letzten 7 Tage (Mockdaten — echte Daten folgen im Analytics-Release)
const WEEK_EARNINGS = [
  { day: 'Mo', net: 0 },
  { day: 'Di', net: 0 },
  { day: 'Mi', net: 0 },
  { day: 'Do', net: 0 },
  { day: 'Fr', net: 0 },
  { day: 'Sa', net: 0 },
  { day: 'So', net: 0 },
];
const WEEK_MAX = 1;

export default function ProviderHome() {
  const router = useRouter();
  const { user } = useAuth();
  const [pstTg, setPstTg] = useState<PStTGStats | null>(null);
  const [taxIdModal, setTaxIdModal] = useState(false);
  const [taxIdInput, setTaxIdInput] = useState('');
  const [taxIdSaving, setTaxIdSaving] = useState(false);
  const [businessName, setBusinessName] = useState<string>('');
  const [ratingAvg, setRatingAvg] = useState<number | null>(null);
  const [contracts, setContracts] = useState<ContractWithJobAndCustomer[]>([]);
  const [openJobs, setOpenJobs] = useState<Job[]>([]);
  const [calStale, setCalStale] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    const [contractData, jobData, profileData] = await Promise.all([
      getMyContractsAsProvider(user.id).catch(() => []),
      getOpenJobs().catch(() => []),
      supabase
        .from('provider_profiles')
        .select('business_name, rating_avg')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => data),
    ]);
    setContracts(contractData);
    setOpenJobs(jobData.slice(0, 3));
    setBusinessName(profileData?.business_name ?? user.email ?? 'Anbieter');
    setRatingAvg(profileData?.rating_avg ?? null);
  }, [user]);

  useEffect(() => {
    getPStTGStats().then(setPstTg);
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('provider_profiles')
      .select('updated_at')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data?.updated_at) { setCalStale(true); return; }
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        setCalStale(new Date(data.updated_at).getTime() < sevenDaysAgo);
      });
  }, [user]);

  const pstTgWarning = pstTg ? getPStTGWarningMessage(pstTg) : null;

  const activeContracts   = contracts.filter((c) => c.status === 'active');
  const escrowTotal       = activeContracts.reduce((s, c) => s + (c.customer_total ?? 0), 0);

  const summaryCards = [
    { icon: 'calendar',     label: 'Aktive Aufträge', value: `${activeContracts.length}`,                   color: C.primary },
    { icon: 'lock-closed',  label: 'Escrow',          value: `€${escrowTotal.toFixed(0)}`,                  color: C.amber },
    { icon: 'mail-outline', label: 'Anfragen',        value: `${openJobs.length} offen`,                    color: C.ink   },
    { icon: 'star',         label: 'Bewertung',       value: ratingAvg ? `${ratingAvg.toFixed(1)} ★` : '—', color: C.gold  },
  ];

  async function handleSubmitTaxId() {
    setTaxIdSaving(true);
    try {
      await submitTaxId(taxIdInput);
      const updated = await getPStTGStats();
      setPstTg(updated);
      setTaxIdModal(false);
      setTaxIdInput('');
      toast.success('Steuer-ID hinterlegt — Konto entsperrt');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Ungültige Eingabe');
    } finally {
      setTaxIdSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Guten Tag,</Text>
            <Text style={styles.name}>{businessName}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.dateText}>{new Date().toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</Text>
            <TouchableOpacity style={styles.profileBtn}>
              <Ionicons name="person-circle-outline" size={28} color={C.ink} />
            </TouchableOpacity>
          </View>
        </View>

        {/* PStTG FREEZE GATE */}
        {pstTg?.frozen && (
          <TouchableOpacity
            style={styles.pstTgFreezeBar}
            onPress={() => setTaxIdModal(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="alert-circle" size={18} color={C.surface} />
            <View style={{ flex: 1 }}>
              <Text style={styles.pstTgFreezeTitle}>Konto eingefroren — PStTG §3</Text>
              <Text style={styles.pstTgFreezeSub}>
                {pstTg.jobCount} Aufträge / €{pstTg.totalRevenue.toFixed(0)} Umsatz in {pstTg.year} erreicht.
                Steuer-ID hinterlegen zum Entsperren.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.surface} />
          </TouchableOpacity>
        )}

        {/* PStTG WARNING (near threshold) */}
        {!pstTg?.frozen && pstTgWarning && (
          <TouchableOpacity
            style={styles.pstTgWarnBar}
            onPress={() => setTaxIdModal(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="information-circle-outline" size={16} color={C.amber} />
            <Text style={styles.pstTgWarnText}>{pstTgWarning}</Text>
          </TouchableOpacity>
        )}

        {/* Aktivitäts-Warnung: calendar not updated in the last 7 days */}
        {calStale && <TouchableOpacity
          style={styles.calWarning}
          onPress={() => router.push('/(provider)/kalender')}
          activeOpacity={0.8}
        >
          <Ionicons name="warning-outline" size={16} color={C.amber} />
          <Text style={styles.calWarningText}>
            Kalender aktualisieren — Kunden sehen keine freien Termine
          </Text>
          <Ionicons name="chevron-forward" size={14} color={C.amber} />
        </TouchableOpacity>}

        {/* Summary Cards */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.summaryRow}
        >
          {summaryCards.map((card) => (
            <View key={card.label} style={styles.summaryCard}>
              <Ionicons name={card.icon as any} size={20} color={card.color} style={{ marginBottom: 8 }} />
              <Text style={styles.summaryValue}>{card.value}</Text>
              <Text style={styles.summaryLabel}>{card.label}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Pro Upgrade Banner */}
        <TouchableOpacity
          style={styles.proBanner}
          onPress={() => router.push('/(provider)/pro')}
          activeOpacity={0.85}
        >
          <View style={styles.proBannerLeft}>
            <Ionicons name="star" size={18} color={C.gold} />
            <View>
              <Text style={styles.proBannerTitle}>WERKR Pro — €29/Monat</Text>
              <Text style={styles.proBannerSub}>Bevorzugte Platzierung, erweiterte Statistiken & mehr</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={C.gold} />
        </TouchableOpacity>

        {/* Wocheneinnahmen */}
        <View style={styles.chartSection}>
          <View style={styles.chartHeader}>
            <Text style={styles.sectionTitle}>Einnahmen diese Woche</Text>
            <Text style={styles.chartTotal}>—</Text>
          </View>
          <View style={styles.chart}>
            {WEEK_EARNINGS.map((d) => {
              const heightPct = d.net / WEEK_MAX;
              const isToday = d.day === new Date().toLocaleDateString('de-DE', { weekday: 'short' }).slice(0, 2);
              return (
                <View key={d.day} style={styles.barCol}>
                  <Text style={styles.barValue}>{d.net > 0 ? `€${d.net}` : ''}</Text>
                  <View style={styles.barTrack}>
                    <View style={[
                      styles.barFill,
                      { height: `${Math.max(heightPct * 100, d.net > 0 ? 4 : 0)}%` as any },
                      isToday && styles.barFillToday,
                    ]} />
                  </View>
                  <Text style={[styles.barLabel, isToday && styles.barLabelToday]}>{d.day}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.chartNote}>
            <Ionicons name="information-circle-outline" size={12} color={C.muted} />
            <Text style={styles.chartNoteText}>Netto nach 8% Plattformgebühr</Text>
          </View>
        </View>

        {/* Offene Anfragen */}
        {openJobs.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Offene Anfragen</Text>
              <Badge label={`${openJobs.length} neu`} variant="amber" />
            </View>

            {openJobs.map((job) => (
              <View key={job.id} style={styles.requestCard}>
                <View style={styles.requestTop}>
                  <View style={styles.requestAvatar}>
                    <Text style={styles.requestAvatarText}>{(job.title ?? '?').charAt(0)}</Text>
                  </View>
                  <View style={styles.requestInfo}>
                    <Text style={styles.requestCustomer}>{job.title}</Text>
                    <Text style={styles.requestService}>{job.category ?? '—'}</Text>
                    <View style={styles.requestMeta}>
                      <Ionicons name="location-outline" size={12} color={C.muted} />
                      <Text style={styles.requestMetaText}>{job.address_city ?? '—'}</Text>
                    </View>
                    {job.description ? (
                      <Text style={styles.requestNote} numberOfLines={2}>"{job.description}"</Text>
                    ) : null}
                  </View>
                </View>
                <View style={styles.requestActions}>
                  <AnimatedButton
                    style={styles.acceptBtn}
                    onPress={() => router.push({ pathname: '/chat', params: { jobId: job.id } })}
                  >
                    <Ionicons name="chatbubble-outline" size={16} color={C.surface} />
                    <Text style={styles.acceptBtnText}>Anfrage öffnen</Text>
                  </AnimatedButton>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Aktive Aufträge */}
        {activeContracts.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Aktive Aufträge</Text>

            {activeContracts.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={styles.jobCard}
                onPress={() => router.push({ pathname: '/vertrag', params: { contractId: c.id } })}
                activeOpacity={0.8}
              >
                <View style={styles.jobTime}>
                  <Text style={styles.jobTimeText}>
                    {new Date(c.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                  </Text>
                </View>
                <View style={styles.jobInfo}>
                  <Text style={styles.jobCustomer}>{c.customer?.full_name ?? 'Kunde'}</Text>
                  <Text style={styles.jobService}>{c.job?.title ?? '—'}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Ionicons name="location-outline" size={11} color={C.muted} />
                    <Text style={styles.jobAddress}>{c.job?.address_city ?? '—'}</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Badge label="Escrow aktiv" variant="green" />
                  <Ionicons name="chevron-forward" size={16} color={C.muted} />
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

      </ScrollView>

      {/* ── PStTG TaxID Modal ── */}
      <Modal visible={taxIdModal} transparent animationType="slide" onRequestClose={() => setTaxIdModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>Steuer-ID hinterlegen</Text>
                <Text style={styles.modalSub}>Pflicht nach §3 PStTG ab 30 Aufträgen / €2.000</Text>
              </View>
              <TouchableOpacity onPress={() => setTaxIdModal(false)}>
                <Ionicons name="close" size={22} color={C.ink} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalHint}>
              <Ionicons name="document-text-outline" size={20} color={C.muted} />
              <Text style={styles.modalHintText}>
                Die 11-stellige Steuer-ID finden Sie auf Ihrem letzten Steuerbescheid oben rechts.
              </Text>
            </View>

            <TextInput
              style={styles.modalInput}
              value={taxIdInput}
              onChangeText={(v) => setTaxIdInput(v.replace(/\D/g, '').slice(0, 11))}
              placeholder="12345678901"
              placeholderTextColor={C.muted}
              keyboardType="numeric"
              maxLength={11}
            />
            {taxIdInput.length > 0 && taxIdInput.length < 11 && (
              <Text style={styles.modalHintSmall}>{11 - taxIdInput.length} Zeichen fehlen noch</Text>
            )}

            <TouchableOpacity
              style={[styles.modalBtn, (taxIdInput.length !== 11 || taxIdSaving) && styles.modalBtnDisabled]}
              onPress={handleSubmitTaxId}
              disabled={taxIdInput.length !== 11 || taxIdSaving}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark" size={18} color={C.surface} />
              <Text style={styles.modalBtnText}>Steuer-ID speichern & Konto entsperren</Text>
            </TouchableOpacity>

            <Text style={styles.modalLegal}>
              Ihre Steuer-ID wird gemäß §12 PStTG verschlüsselt an das Bundeszentralamt für Steuern gemeldet.
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: C.bg },
  header:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  greeting:         { fontSize: 14, color: C.sub },
  name:             { ...T.h2, color: C.ink },
  headerRight:      { alignItems: 'flex-end', gap: 4 },
  dateText:         { fontSize: 12, color: C.muted },
  profileBtn:       { padding: 4 },
  // PStTG banners
  pstTgFreezeBar:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.red, marginHorizontal: 20, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 12 },
  pstTgFreezeTitle: { fontSize: 13, fontWeight: '700', color: C.surface },
  pstTgFreezeSub:   { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2, lineHeight: 16 },
  pstTgWarnBar:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.amberBg, borderWidth: 1, borderColor: C.amber, marginHorizontal: 20, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },
  pstTgWarnText:    { flex: 1, fontSize: 12, color: C.amber, lineHeight: 17 },
  calWarning:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.amberBg, borderWidth: 1, borderColor: C.amber, marginHorizontal: 20, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 20 },
  calWarningText:   { flex: 1, fontSize: 12, color: C.amber, fontWeight: '500' },

  // PStTG Modal
  modalOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:       { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalHeaderRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  modalTitle:       { fontSize: 18, fontWeight: '800', color: C.ink },
  modalSub:         { fontSize: 12, color: C.muted, marginTop: 3 },
  modalHint:        { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: C.bg, borderRadius: 10, padding: 12, marginBottom: 16 },
  modalHintText:    { flex: 1, fontSize: 12, color: C.sub, lineHeight: 17 },
  modalInput:       { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontSize: 18, fontWeight: '600', color: C.ink, letterSpacing: 2, textAlign: 'center', marginBottom: 6 },
  modalHintSmall:   { fontSize: 11, color: C.amber, textAlign: 'center', marginBottom: 16 },
  modalBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.ink, borderRadius: 12, paddingVertical: 15, marginTop: 8 },
  modalBtnDisabled: { opacity: 0.4 },
  modalBtnText:     { fontSize: 14, fontWeight: '700', color: C.surface },
  modalLegal:       { fontSize: 10, color: C.muted, textAlign: 'center', marginTop: 12, lineHeight: 15 },
  summaryRow:       { paddingLeft: 20, paddingRight: 8, gap: 10, marginBottom: 16 },
  proBanner:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 20, marginBottom: 20, backgroundColor: C.goldBg, borderWidth: 1, borderColor: C.gold, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  proBannerLeft:    { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  proBannerTitle:   { fontSize: 14, fontWeight: '700', color: C.gold },
  proBannerSub:     { fontSize: 11, color: C.amber, marginTop: 1 },
  summaryCard:      { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 16, width: 110, alignItems: 'center' },
  summaryValue:     { fontSize: 16, fontWeight: '800', color: C.ink, marginBottom: 2 },
  summaryLabel:     { fontSize: 11, color: C.muted, textAlign: 'center' },
  sectionHeader:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle:     { ...T.h3, color: C.ink, paddingHorizontal: 20, marginBottom: 12 },
  chartSection:     { marginHorizontal: 20, marginBottom: 24, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 16 },
  chartHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  chartTotal:       { fontSize: 20, fontWeight: '800', color: C.primary },
  chart:            { flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 6 },
  barCol:           { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barValue:         { fontSize: 8, color: C.sub, marginBottom: 3, textAlign: 'center' },
  barTrack:         { width: '100%', flex: 1, justifyContent: 'flex-end', backgroundColor: C.bg, borderRadius: 4, overflow: 'hidden' },
  barFill:          { width: '100%', backgroundColor: C.border, borderRadius: 4 },
  barFillToday:     { backgroundColor: C.ink },
  barLabel:         { fontSize: 10, color: C.muted, marginTop: 5, fontWeight: '500' },
  barLabelToday:    { color: C.ink, fontWeight: '800' },
  chartNote:        { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  chartNoteText:    { fontSize: 10, color: C.muted },
  requestCard:      { ...shadow.xs, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, marginHorizontal: 20, marginBottom: 10, padding: 14 },
  requestTop:       { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  requestAvatar:    { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0EFEB', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  requestAvatarText:{ fontSize: 16, fontWeight: '700', color: C.sub },
  requestInfo:      { flex: 1 },
  requestCustomer:  { ...T.body, fontWeight: '700', color: C.ink, marginBottom: 2 },
  requestService:   { ...T.bodySmall, color: C.sub, marginBottom: 6 },
  requestMeta:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  requestMetaText:  { ...T.caption, color: C.muted },
  requestNote:      { fontSize: 12, color: C.sub, fontStyle: 'italic', marginTop: 6 },
  requestActions:   { flexDirection: 'row', gap: 10 },
  declineBtn:       { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, alignItems: 'center' },
  declineBtnText:   { fontSize: 13, fontWeight: '600', color: C.sub },
  acceptBtn:        { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: C.primary },
  acceptBtnText:    { fontSize: 13, fontWeight: '700', color: C.surface },
  jobCard:          { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, marginHorizontal: 20, marginBottom: 8, padding: 14, gap: 12 },
  jobTime:          { backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center' },
  jobTimeText:      { fontSize: 14, fontWeight: '700', color: C.ink },
  jobInfo:          { flex: 1 },
  jobCustomer:      { ...T.bodySmall, fontWeight: '700', color: C.ink },
  jobService:       { ...T.caption, fontSize: 12, color: C.sub, marginTop: 1 },
  jobAddress:       { ...T.caption, color: C.muted },
});
