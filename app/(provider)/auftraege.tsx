import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { C } from '../../constants/colors';
import { Badge } from '../../components/ui/Badge';
import { Divider } from '../../components/ui/Divider';

type Tab = 'heute' | 'offen' | 'abgeschlossen';

// ── Mock data ────────────────────────────────────────────────────────────────

const TODAY_JOBS = [
  {
    id: 'WRK-2406-0051',
    time: '09:00',
    customer: 'Familie M.',
    service: 'Heizung · Thermostat-Tausch',
    address: 'Gartenstr. 12, Köln',
    status: 'active' as const,
    price: 95,
  },
  {
    id: 'WRK-2406-0055',
    time: '14:00',
    customer: 'Herr S.',
    service: 'Sanitär · Dichtung erneuern',
    address: 'Bachgasse 3, Köln',
    status: 'pending' as const,
    price: 80,
  },
  {
    id: 'WRK-2406-0057',
    time: '16:30',
    customer: 'Familie B.',
    service: 'Elektro · Steckdosen (3x)',
    address: 'Hauptstr. 47, Bonn',
    status: 'pending' as const,
    price: 65,
  },
];

const OPEN_JOBS = [
  {
    id: 'WRK-2406-0062',
    date: 'Do., 13. Jun',
    daysAway: 2,
    customer: 'Frau K.',
    service: 'Badezimmer · Fliesen nachfugen',
    address: 'Ringweg 8, Köln',
    price: 110,
    canExtend: true,
  },
  {
    id: 'WRK-2406-0068',
    date: 'Sa., 15. Jun',
    daysAway: 4,
    customer: 'Familie R.',
    service: 'Garten · Hecke & Rasen',
    address: 'Parkstr. 5, Leverkusen',
    price: 55,
    canExtend: false,
  },
];

const DONE_JOBS = [
  {
    id: 'WRK-2406-0040',
    date: 'Mo., 09. Jun',
    customer: 'Frau L.',
    service: 'Malerarbeiten Wohnzimmer',
    rating: 5,
    payout: 320,
  },
  {
    id: 'WRK-2405-0031',
    date: 'Fr., 06. Jun',
    customer: 'Herr T.',
    service: 'Sanitär · WC-Montage',
    rating: 4,
    payout: 145,
  },
  {
    id: 'WRK-2405-0018',
    date: 'Di., 03. Jun',
    customer: 'Familie M.',
    service: 'Elektro · Verteilerdose',
    rating: 5,
    payout: 520,
  },
  {
    id: 'WRK-2405-0009',
    date: 'Sa., 31. Mai',
    customer: 'Herr N.',
    service: 'Heizkörper-Diagnose',
    rating: 4,
    payout: 255,
  },
];

const TOTAL_THIS_MONTH = DONE_JOBS.reduce((s, j) => s + j.payout, 0); // €1240

const STATUS_CONFIG = {
  active:  { label: 'Läuft',      variant: 'green' as const },
  pending: { label: 'Ausstehend', variant: 'amber' as const },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function EarningsBanner() {
  return (
    <View style={styles.earningsBanner}>
      <View style={styles.earningsItem}>
        <Ionicons name="cash-outline" size={14} color={C.green} />
        <Text style={styles.earningsLabel}>Heute erwartet</Text>
        <Text style={styles.earningsValue}>€240</Text>
      </View>
      <View style={styles.earningsSep} />
      <View style={styles.earningsItem}>
        <Ionicons name="lock-closed-outline" size={14} color={C.amber} />
        <Text style={styles.earningsLabel}>Eingefroren (Escrow)</Text>
        <Text style={[styles.earningsValue, { color: C.amber }]}>€120</Text>
      </View>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProviderAuftraegeScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('heute');
  const [confirmJobId, setConfirmJobId] = useState<string | null>(null);
  const [completedIds, setCompletedIds] = useState<string[]>([]);

  function handleAbschliessen(id: string) {
    setConfirmJobId(id);
  }

  function confirmAbschliessen() {
    if (confirmJobId) {
      setCompletedIds((prev) => [...prev, confirmJobId]);
    }
    setConfirmJobId(null);
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'heute',         label: 'Heute' },
    { key: 'offen',         label: 'Offen' },
    { key: 'abgeschlossen', label: 'Abgeschlossen' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Aufträge</Text>
        <TouchableOpacity style={styles.headerAction}>
          <Ionicons name="notifications-outline" size={22} color={C.ink} />
        </TouchableOpacity>
      </View>

      {/* Earnings banner — always visible */}
      <EarningsBanner />

      {/* Filter tabs */}
      <View style={styles.tabBar}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* ── HEUTE ── */}
        {tab === 'heute' && (
          <>
            <Text style={styles.sectionNote}>
              {TODAY_JOBS.length} Termine heute · {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>

            {TODAY_JOBS.map((job, i) => {
              const isDone = completedIds.includes(job.id);
              return (
                <View key={job.id} style={[styles.jobCard, isDone && styles.jobCardDone]}>
                  {/* Time pill */}
                  <View style={styles.timePill}>
                    <Text style={styles.timePillText}>{job.time}</Text>
                  </View>

                  <View style={styles.jobBody}>
                    <View style={styles.jobRow}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.jobTitleRow}>
                          <Text style={styles.jobCustomer}>{job.customer}</Text>
                          {isDone
                            ? <Badge label="Abgeschlossen" variant="muted" />
                            : <Badge label={STATUS_CONFIG[job.status].label} variant={STATUS_CONFIG[job.status].variant} />
                          }
                        </View>
                        <Text style={styles.jobService}>{job.service}</Text>
                        <View style={styles.jobAddressRow}>
                          <Ionicons name="location-outline" size={12} color={C.muted} />
                          <Text style={styles.jobAddress}>{job.address}</Text>
                        </View>
                      </View>
                      <Text style={styles.jobPrice}>€{job.price}</Text>
                    </View>

                    {!isDone && (
                      <View style={styles.jobActions}>
                        <TouchableOpacity
                          style={styles.actionSecondary}
                          onPress={() => router.push('/chat' as any)}
                        >
                          <Ionicons name="chatbubble-outline" size={14} color={C.sub} />
                          <Text style={styles.actionSecondaryText}>Chat</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.actionPrimary}
                          onPress={() => handleAbschliessen(job.id)}
                        >
                          <Ionicons name="checkmark-circle-outline" size={14} color={C.surface} />
                          <Text style={styles.actionPrimaryText}>Abschließen</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {isDone && (
                      <View style={styles.doneRow}>
                        <Ionicons name="lock-closed-outline" size={13} color={C.amber} />
                        <Text style={styles.doneRowText}>Escrow wird nach Kundenbewertung freigegeben</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* ── OFFEN ── */}
        {tab === 'offen' && (
          <>
            <Text style={styles.sectionNote}>{OPEN_JOBS.length} bevorstehende Aufträge</Text>

            {OPEN_JOBS.map((job) => (
              <View key={job.id} style={styles.jobCard}>
                {/* Countdown chip */}
                <View style={styles.countdownChip}>
                  <Ionicons name="time-outline" size={13} color={C.gold} />
                  <Text style={styles.countdownText}>In {job.daysAway} {job.daysAway === 1 ? 'Tag' : 'Tagen'}</Text>
                </View>

                <View style={styles.jobBody}>
                  <View style={styles.jobRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.jobDate}>{job.date}</Text>
                      <Text style={styles.jobCustomer}>{job.customer}</Text>
                      <Text style={styles.jobService}>{job.service}</Text>
                      <View style={styles.jobAddressRow}>
                        <Ionicons name="location-outline" size={12} color={C.muted} />
                        <Text style={styles.jobAddress}>{job.address}</Text>
                      </View>
                    </View>
                    <Text style={styles.jobPrice}>€{job.price}</Text>
                  </View>

                  <View style={styles.jobActions}>
                    <TouchableOpacity
                      style={styles.actionSecondary}
                      onPress={() => router.push('/chat' as any)}
                    >
                      <Ionicons name="chatbubble-outline" size={14} color={C.sub} />
                      <Text style={styles.actionSecondaryText}>Chat</Text>
                    </TouchableOpacity>
                    {job.canExtend && (
                      <TouchableOpacity style={styles.actionExtend}>
                        <Ionicons name="calendar-outline" size={14} color={C.gold} />
                        <Text style={styles.actionExtendText}>Verlängerungsantrag</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </>
        )}

        {/* ── ABGESCHLOSSEN ── */}
        {tab === 'abgeschlossen' && (
          <>
            {/* Monthly earnings summary */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View>
                  <Text style={styles.summaryTitle}>Gesamteinnahmen Juni</Text>
                  <Text style={styles.summaryNote}>Ausgezahlte Beträge (netto)</Text>
                </View>
                <Text style={styles.summaryAmount}>€{TOTAL_THIS_MONTH.toLocaleString('de-DE')}</Text>
              </View>
              <Divider margin={12} />
              <View style={styles.summaryMetaRow}>
                <View style={styles.summaryMeta}>
                  <Ionicons name="checkmark-circle-outline" size={14} color={C.green} />
                  <Text style={styles.summaryMetaText}>{DONE_JOBS.length} Jobs abgeschlossen</Text>
                </View>
                <View style={styles.summaryMeta}>
                  <Ionicons name="star-outline" size={14} color={C.gold} />
                  <Text style={styles.summaryMetaText}>Ø 4,5 Bewertung</Text>
                </View>
              </View>
            </View>

            {DONE_JOBS.map((job, i) => (
              <View key={job.id} style={styles.doneCard}>
                <View style={styles.doneCardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.doneDate}>{job.date}</Text>
                    <Text style={styles.jobCustomer}>{job.customer}</Text>
                    <Text style={styles.jobService}>{job.service}</Text>
                    <View style={{ flexDirection: 'row', gap: 3, marginTop: 5 }}>
                      {Array.from({ length: 5 }).map((_, idx) => (
                        <Ionicons
                          key={idx}
                          name={idx < job.rating ? 'star' : 'star-outline'}
                          size={13}
                          color={C.gold}
                        />
                      ))}
                    </View>
                  </View>
                  <View style={styles.doneRight}>
                    <Text style={styles.doneAmount}>€{job.payout}</Text>
                    <Badge label="Ausgezahlt" variant="green" />
                  </View>
                </View>
              </View>
            ))}
          </>
        )}

      </ScrollView>

      {/* ── Confirmation Modal ── */}
      <Modal
        visible={confirmJobId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmJobId(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setConfirmJobId(null)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalIconRow}>
              <View style={styles.modalIconBg}>
                <Ionicons name="checkmark-circle" size={28} color={C.green} />
              </View>
            </View>
            <Text style={styles.modalTitle}>Job abschließen?</Text>
            <Text style={styles.modalBody}>
              Escrow wird nach Kundenbewertung freigegeben. Der Betrag erscheint danach in Ihrem Guthaben.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setConfirmJobId(null)}>
                <Text style={styles.modalCancelText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={confirmAbschliessen}>
                <Text style={styles.modalConfirmText}>Bestätigen</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: C.bg },

  // Header
  header:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title:              { fontSize: 24, fontWeight: '800', color: C.ink },
  headerAction:       { padding: 4 },

  // Earnings banner
  earningsBanner:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, marginHorizontal: 20, marginBottom: 14, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, paddingVertical: 11 },
  earningsItem:       { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  earningsLabel:      { fontSize: 11, color: C.sub, flex: 1 },
  earningsValue:      { fontSize: 15, fontWeight: '800', color: C.green },
  earningsSep:        { width: 1, height: 28, backgroundColor: C.border, marginHorizontal: 12 },

  // Tabs
  tabBar:             { flexDirection: 'row', marginHorizontal: 20, marginBottom: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 3 },
  tabBtn:             { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tabBtnActive:       { backgroundColor: C.ink },
  tabText:            { fontSize: 13, fontWeight: '500', color: C.sub },
  tabTextActive:      { color: C.surface, fontWeight: '700' },

  scrollContent:      { paddingHorizontal: 20, paddingBottom: 36 },
  sectionNote:        { fontSize: 12, color: C.muted, marginBottom: 12 },

  // Job cards (heute + offen)
  jobCard:            { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, marginBottom: 12, overflow: 'hidden' },
  jobCardDone:        { opacity: 0.7 },
  timePill:           { backgroundColor: C.ink, paddingHorizontal: 14, paddingVertical: 7, alignSelf: 'flex-start', borderBottomRightRadius: 8 },
  timePillText:       { fontSize: 13, fontWeight: '800', color: C.surface, letterSpacing: 0.5 },
  jobBody:            { padding: 14 },
  jobRow:             { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  jobTitleRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  jobDate:            { fontSize: 11, color: C.muted, fontWeight: '600', letterSpacing: 0.3, marginBottom: 3 },
  jobCustomer:        { fontSize: 14, fontWeight: '700', color: C.ink, marginBottom: 2 },
  jobService:         { fontSize: 12, color: C.sub, marginBottom: 4 },
  jobAddressRow:      { flexDirection: 'row', alignItems: 'center', gap: 3 },
  jobAddress:         { fontSize: 11, color: C.muted },
  jobPrice:           { fontSize: 18, fontWeight: '800', color: C.ink },

  // Job actions
  jobActions:         { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionSecondary:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  actionSecondaryText:{ fontSize: 12, color: C.sub, fontWeight: '500' },
  actionPrimary:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: C.green, borderRadius: 8, paddingVertical: 8 },
  actionPrimaryText:  { fontSize: 13, color: C.surface, fontWeight: '700' },
  actionExtend:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: C.goldBg, borderWidth: 1, borderColor: C.gold, borderRadius: 8, paddingVertical: 8 },
  actionExtendText:   { fontSize: 12, color: C.gold, fontWeight: '600' },

  doneRow:            { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.amberBg, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, marginTop: 10, alignSelf: 'flex-start' },
  doneRowText:        { fontSize: 11, color: C.amber, fontWeight: '500' },

  // Countdown chip
  countdownChip:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.goldBg, paddingHorizontal: 14, paddingVertical: 7, alignSelf: 'flex-start', borderBottomRightRadius: 8 },
  countdownText:      { fontSize: 12, fontWeight: '700', color: C.gold },

  // Summary card
  summaryCard:        { backgroundColor: C.ink, borderRadius: 14, padding: 18, marginBottom: 16 },
  summaryRow:         { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  summaryTitle:       { fontSize: 14, fontWeight: '700', color: C.surface, marginBottom: 2 },
  summaryNote:        { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  summaryAmount:      { fontSize: 28, fontWeight: '900', color: C.surface },
  summaryMetaRow:     { flexDirection: 'row', gap: 16 },
  summaryMeta:        { flexDirection: 'row', alignItems: 'center', gap: 5 },
  summaryMetaText:    { fontSize: 12, color: 'rgba(255,255,255,0.7)' },

  // Done cards
  doneCard:           { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
  doneCardRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  doneDate:           { fontSize: 11, color: C.muted, fontWeight: '600', letterSpacing: 0.3, marginBottom: 3 },
  doneRight:          { alignItems: 'flex-end', gap: 6 },
  doneAmount:         { fontSize: 18, fontWeight: '800', color: C.ink },

  // Modal
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
