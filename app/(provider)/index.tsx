import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/colors';
import { Badge } from '../../components/ui/Badge';

const SUMMARY_CARDS = [
  { icon: 'calendar',       label: 'Heute',           value: '3 Termine',  color: C.green  },
  { icon: 'cash-outline',   label: 'Einnahmen heute', value: '€240',        color: C.ink    },
  { icon: 'mail-outline',   label: 'Anfragen',        value: '2 offen',     color: C.amber  },
  { icon: 'star',           label: 'Bewertung',       value: '4.7 ★',       color: C.gold   },
];

const INCOMING = [
  {
    id: '1',
    customer: 'Familie M.',
    service: 'Rohrreparatur Küche',
    preferred: 'Mo., 09. Jun · ab 10:00',
    distance: '2.1 km',
    note: 'Wasser läuft langsam ab',
  },
  {
    id: '2',
    customer: 'Thomas B.',
    service: 'Thermostat tauschen (2x)',
    preferred: 'Di., 10. Jun · ab 14:00',
    distance: '4.7 km',
    note: '',
  },
];

const TODAY_JOBS = [
  {
    id: '1',
    time: '09:00',
    customer: 'Familie K.',
    service: 'Heizungswartung',
    address: 'Ehrenfeld, Köln',
    status: 'active' as const,
  },
  {
    id: '2',
    time: '14:00',
    customer: 'Herr S.',
    service: 'Heizkörper entlüften',
    address: 'Sülz, Köln',
    status: 'pending' as const,
  },
];

export default function ProviderHome() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Guten Tag,</Text>
            <Text style={styles.name}>Yilmaz GmbH</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.dateText}>{new Date().toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</Text>
            <TouchableOpacity style={styles.profileBtn}>
              <Ionicons name="person-circle-outline" size={28} color={C.ink} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Aktivitäts-Warnung: calendar not updated in 30+ days */}
        <TouchableOpacity
          style={styles.calWarning}
          onPress={() => router.push('/(provider)/kalender')}
          activeOpacity={0.8}
        >
          <Ionicons name="warning-outline" size={16} color={C.amber} />
          <Text style={styles.calWarningText}>
            Kalender aktualisieren — Kunden sehen keine freien Termine
          </Text>
          <Ionicons name="chevron-forward" size={14} color={C.amber} />
        </TouchableOpacity>

        {/* Summary Cards */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.summaryRow}
        >
          {SUMMARY_CARDS.map((card) => (
            <View key={card.label} style={styles.summaryCard}>
              <Ionicons name={card.icon as any} size={20} color={card.color} style={{ marginBottom: 8 }} />
              <Text style={styles.summaryValue}>{card.value}</Text>
              <Text style={styles.summaryLabel}>{card.label}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Offene Anfragen */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Offene Anfragen</Text>
          <Badge label={`${INCOMING.length} neu`} variant="amber" />
        </View>

        {INCOMING.map((req) => (
          <View key={req.id} style={styles.requestCard}>
            <View style={styles.requestTop}>
              <View style={styles.requestAvatar}>
                <Text style={styles.requestAvatarText}>{req.customer.charAt(0)}</Text>
              </View>
              <View style={styles.requestInfo}>
                <Text style={styles.requestCustomer}>{req.customer}</Text>
                <Text style={styles.requestService}>{req.service}</Text>
                <View style={styles.requestMeta}>
                  <Ionicons name="calendar-outline" size={12} color={C.muted} />
                  <Text style={styles.requestMetaText}>{req.preferred}</Text>
                  <Ionicons name="location-outline" size={12} color={C.muted} style={{ marginLeft: 8 }} />
                  <Text style={styles.requestMetaText}>{req.distance}</Text>
                </View>
                {req.note ? (
                  <Text style={styles.requestNote}>"{req.note}"</Text>
                ) : null}
              </View>
            </View>
            <View style={styles.requestActions}>
              <TouchableOpacity style={styles.declineBtn} activeOpacity={0.8}>
                <Text style={styles.declineBtnText}>Ablehnen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.acceptBtn}
                onPress={() => router.push('/chat')}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark" size={16} color={C.surface} />
                <Text style={styles.acceptBtnText}>Annehmen</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Heute geplant */}
        <Text style={styles.sectionTitle}>Heute geplant</Text>

        {TODAY_JOBS.map((job) => (
          <TouchableOpacity
            key={job.id}
            style={styles.jobCard}
            onPress={() => router.push('/vertrag')}
            activeOpacity={0.8}
          >
            <View style={styles.jobTime}>
              <Text style={styles.jobTimeText}>{job.time}</Text>
            </View>
            <View style={styles.jobInfo}>
              <Text style={styles.jobCustomer}>{job.customer}</Text>
              <Text style={styles.jobService}>{job.service}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Ionicons name="location-outline" size={11} color={C.muted} />
                <Text style={styles.jobAddress}>{job.address}</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <Badge
                label={job.status === 'active' ? 'Escrow aktiv' : 'Bestätigt'}
                variant={job.status === 'active' ? 'green' : 'amber'}
              />
              <Ionicons name="chevron-forward" size={16} color={C.muted} />
            </View>
          </TouchableOpacity>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: C.bg },
  header:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  greeting:         { fontSize: 14, color: C.sub },
  name:             { fontSize: 22, fontWeight: '800', color: C.ink },
  headerRight:      { alignItems: 'flex-end', gap: 4 },
  dateText:         { fontSize: 12, color: C.muted },
  profileBtn:       { padding: 4 },
  calWarning:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.amberBg, borderWidth: 1, borderColor: C.amber, marginHorizontal: 20, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 20 },
  calWarningText:   { flex: 1, fontSize: 12, color: C.amber, fontWeight: '500' },
  summaryRow:       { paddingLeft: 20, paddingRight: 8, gap: 10, marginBottom: 24 },
  summaryCard:      { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 16, width: 110, alignItems: 'center' },
  summaryValue:     { fontSize: 16, fontWeight: '800', color: C.ink, marginBottom: 2 },
  summaryLabel:     { fontSize: 11, color: C.muted, textAlign: 'center' },
  sectionHeader:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle:     { fontSize: 17, fontWeight: '700', color: C.ink, paddingHorizontal: 20, marginBottom: 12 },
  requestCard:      { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, marginHorizontal: 20, marginBottom: 10, padding: 14 },
  requestTop:       { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  requestAvatar:    { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0EFEB', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  requestAvatarText:{ fontSize: 16, fontWeight: '700', color: C.sub },
  requestInfo:      { flex: 1 },
  requestCustomer:  { fontSize: 14, fontWeight: '700', color: C.ink, marginBottom: 2 },
  requestService:   { fontSize: 13, color: C.sub, marginBottom: 6 },
  requestMeta:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  requestMetaText:  { fontSize: 11, color: C.muted },
  requestNote:      { fontSize: 12, color: C.sub, fontStyle: 'italic', marginTop: 6 },
  requestActions:   { flexDirection: 'row', gap: 10 },
  declineBtn:       { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, alignItems: 'center' },
  declineBtnText:   { fontSize: 13, fontWeight: '600', color: C.sub },
  acceptBtn:        { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: C.green },
  acceptBtnText:    { fontSize: 13, fontWeight: '700', color: C.surface },
  jobCard:          { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, marginHorizontal: 20, marginBottom: 8, padding: 14, gap: 12 },
  jobTime:          { backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center' },
  jobTimeText:      { fontSize: 14, fontWeight: '700', color: C.ink },
  jobInfo:          { flex: 1 },
  jobCustomer:      { fontSize: 13, fontWeight: '700', color: C.ink },
  jobService:       { fontSize: 12, color: C.sub, marginTop: 1 },
  jobAddress:       { fontSize: 11, color: C.muted },
});
