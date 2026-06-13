import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { showAlert } from '../lib/alert';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';

type StepStatus = 'done' | 'current' | 'pending';

interface TimelineStep {
  id: number;
  label: string;
  sub: string;
  status: StepStatus;
}

const STEPS: TimelineStep[] = [
  { id: 1, label: 'Auftrag erstellt',      sub: '13.06.2026, 09:15',                            status: 'done'    },
  { id: 2, label: 'Angebot erhalten',      sub: '13.06.2026, 10:30 · €320,00 Festpreis',        status: 'done'    },
  { id: 3, label: 'Angebot angenommen',    sub: '13.06.2026, 11:05 · Vertrag digital signiert', status: 'done'    },
  { id: 4, label: 'Zahlung hinterlegt',    sub: '13.06.2026, 11:06 · €320,00 via Stripe Escrow',status: 'done'    },
  { id: 5, label: 'Termin',                sub: 'Mo., 16.06.2026 · 14:00 Uhr · ausstehend',     status: 'current' },
  { id: 6, label: 'Zahlung freigeben',     sub: 'Nach Auftragsabschluss',                        status: 'pending' },
];

function StepDot({ status }: { status: StepStatus }) {
  if (status === 'done') {
    return (
      <View style={[styles.dot, { backgroundColor: C.green }]}>
        <Ionicons name="checkmark" size={12} color="#fff" />
      </View>
    );
  }
  if (status === 'current') {
    return (
      <View style={[styles.dot, { backgroundColor: C.amber }]}>
        <Ionicons name="time-outline" size={12} color="#fff" />
      </View>
    );
  }
  return <View style={[styles.dot, { backgroundColor: C.bg, borderWidth: 2, borderColor: C.border }]} />;
}

export default function AuftragDetailScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Auftragsdetails</Text>
        <TouchableOpacity
          onPress={() => showAlert('Link kopiert', 'Auftragslink wurde in die Zwischenablage kopiert.')}
          style={styles.backBtn}
        >
          <Ionicons name="share-outline" size={22} color={C.ink} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Status Hero */}
        <View style={[styles.card, styles.heroCard]}>
          <Text style={styles.ref}>#AUF-2406-1234</Text>
          <Text style={styles.serviceName}>Badezimmer fließen</Text>
          <View style={styles.providerRow}>
            <Text style={styles.providerName}>Yilmaz GmbH</Text>
            <View style={styles.verifiedChip}>
              <Ionicons name="checkmark-circle" size={12} color={C.green} />
              <Text style={styles.verifiedText}>Verifiziert</Text>
            </View>
          </View>
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>In Bearbeitung</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={15} color={C.sub} />
            <Text style={styles.infoText}>Mo., 16.06.2026 · 14:00 Uhr</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={15} color={C.sub} />
            <Text style={styles.infoText}>Kölner Str. 22, 50667 Köln</Text>
          </View>
        </View>

        {/* Timeline */}
        <Text style={styles.sectionTitle}>Auftragsverlauf</Text>
        <View style={styles.card}>
          {STEPS.map((step, idx) => (
            <View key={step.id} style={styles.stepRow}>
              <View style={styles.stepLeft}>
                <StepDot status={step.status} />
                {idx < STEPS.length - 1 && (
                  <View style={[
                    styles.connector,
                    step.status === 'done' ? { backgroundColor: C.green } : { backgroundColor: C.border },
                  ]} />
                )}
              </View>
              <View style={[styles.stepContent, idx < STEPS.length - 1 && { paddingBottom: 20 }]}>
                <Text style={[
                  styles.stepLabel,
                  step.status === 'pending' && { color: C.muted },
                ]}>
                  {step.label}
                </Text>
                <Text style={[
                  styles.stepSub,
                  step.status === 'current' && { color: C.amber },
                ]}>
                  {step.sub}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Escrow Status */}
        <View style={[styles.card, { backgroundColor: C.greenBg, borderColor: C.green }]}>
          <View style={styles.escrowHeader}>
            <Ionicons name="lock-closed" size={18} color={C.green} />
            <Text style={styles.escrowTitle}>Zahlung gesichert</Text>
          </View>
          <Text style={styles.escrowBody}>
            €320,00 werden nach Ihrer Freigabe an Yilmaz GmbH ausgezahlt.
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(4 / 6) * 100}%` as any }]} />
          </View>
          <Text style={styles.escrowNote}>Stripe Escrow · Nie direkt an den Handwerker zahlen.</Text>
        </View>

        {/* Provider Card */}
        <Text style={styles.sectionTitle}>Anbieter</Text>
        <View style={styles.card}>
          <View style={styles.providerCardRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>YG</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.providerCardName}>Yilmaz GmbH</Text>
              <Text style={styles.providerCardTrade}>Sanitär & Heizung</Text>
              <Text style={styles.providerCardRating}>4.7 ★ · 134 Bewertungen</Text>
            </View>
          </View>
          <View style={styles.providerActions}>
            <TouchableOpacity style={styles.providerActionBtn} onPress={() => router.push('/chat')}>
              <Ionicons name="chatbubble-outline" size={15} color={C.ink} />
              <Text style={styles.providerActionText}>Chat öffnen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.providerActionBtn} onPress={() => router.push('/anbieter')}>
              <Ionicons name="person-outline" size={15} color={C.ink} />
              <Text style={styles.providerActionText}>Profil ansehen</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Price Breakdown */}
        <Text style={styles.sectionTitle}>Preisübersicht</Text>
        <View style={styles.card}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Serviceleistung</Text>
            <Text style={styles.priceValue}>€320,00</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>WERKR-Gebühr (Auftraggeber)</Text>
            <Text style={[styles.priceValue, { color: C.green }]}>€0,00</Text>
          </View>
          <View style={[styles.priceRow, styles.priceTotalRow]}>
            <Text style={styles.priceTotalLabel}>Hinterlegt</Text>
            <Text style={styles.priceTotalValue}>€320,00</Text>
          </View>
          <Text style={styles.priceNote}>Als Auftraggeber zahlen Sie keine Plattformgebühr.</Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Quick Actions Bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.actionBarBtn} onPress={() => router.push('/vertrag')}>
          <Ionicons name="document-text-outline" size={18} color={C.sub} />
          <Text style={styles.actionBarBtnText}>Vertrag</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBarBtn} onPress={() => router.push('/reklamation')}>
          <Ionicons name="alert-circle-outline" size={18} color={C.red} />
          <Text style={[styles.actionBarBtnText, { color: C.red }]}>Problem</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBarBtn, styles.actionBarBtnPrimary]}
          onPress={() => router.push('/auftrag-abschliessen')}
        >
          <Ionicons name="checkmark-circle-outline" size={18} color={C.surface} />
          <Text style={[styles.actionBarBtnText, { color: C.surface }]}>Abschließen</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  backBtn:      { padding: 4, width: 36 },
  headerTitle:  { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: C.ink },
  scroll:       { paddingHorizontal: 16, paddingTop: 4 },

  card:         { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16, marginBottom: 12 },
  heroCard:     { borderLeftWidth: 4, borderLeftColor: C.green },

  ref:          { fontSize: 12, color: C.muted, fontWeight: '600', letterSpacing: 0.5, marginBottom: 4 },
  serviceName:  { fontSize: 20, fontWeight: '800', color: C.ink, marginBottom: 8 },
  providerRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  providerName: { fontSize: 14, fontWeight: '600', color: C.ink },
  verifiedChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.greenBg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  verifiedText: { fontSize: 11, color: C.green, fontWeight: '600' },
  statusPill:   { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: C.greenBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 12 },
  statusDot:    { width: 7, height: 7, borderRadius: 4, backgroundColor: C.green },
  statusText:   { fontSize: 12, fontWeight: '700', color: C.green },
  infoRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  infoText:     { fontSize: 13, color: C.sub },

  sectionTitle: { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 4 },

  stepRow:      { flexDirection: 'row', gap: 12 },
  stepLeft:     { alignItems: 'center', width: 24 },
  dot:          { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  connector:    { width: 2, flex: 1, minHeight: 16, marginTop: 4 },
  stepContent:  { flex: 1, paddingBottom: 0 },
  stepLabel:    { fontSize: 14, fontWeight: '600', color: C.ink, marginBottom: 2 },
  stepSub:      { fontSize: 12, color: C.sub, lineHeight: 17 },

  escrowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  escrowTitle:  { fontSize: 14, fontWeight: '700', color: C.ink },
  escrowBody:   { fontSize: 13, color: C.sub, marginBottom: 10 },
  progressTrack:{ height: 6, backgroundColor: C.border, borderRadius: 3, marginBottom: 8 },
  progressFill: { height: 6, backgroundColor: C.green, borderRadius: 3 },
  escrowNote:   { fontSize: 11, color: C.sub },

  avatar:             { width: 48, height: 48, borderRadius: 24, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText:         { fontSize: 18, fontWeight: '700', color: C.gold },
  providerCardRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  providerCardName:   { fontSize: 15, fontWeight: '700', color: C.ink },
  providerCardTrade:  { fontSize: 12, color: C.sub, marginTop: 1 },
  providerCardRating: { fontSize: 12, color: C.muted, marginTop: 3 },
  providerActions:    { flexDirection: 'row', gap: 10 },
  providerActionBtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 9 },
  providerActionText: { fontSize: 13, fontWeight: '600', color: C.ink },

  priceRow:       { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  priceLabel:     { fontSize: 13, color: C.sub },
  priceValue:     { fontSize: 13, fontWeight: '600', color: C.ink },
  priceTotalRow:  { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10, marginTop: 4 },
  priceTotalLabel:{ fontSize: 14, fontWeight: '700', color: C.ink },
  priceTotalValue:{ fontSize: 14, fontWeight: '800', color: C.ink },
  priceNote:      { fontSize: 11, color: C.muted, marginTop: 8 },

  actionBar:         { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface, paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  actionBarBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 10 },
  actionBarBtnPrimary: { flex: 2, backgroundColor: C.green, borderColor: C.green },
  actionBarBtnText:  { fontSize: 13, fontWeight: '600', color: C.ink },
});
