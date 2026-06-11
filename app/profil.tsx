import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { Badge } from '../components/ui/Badge';
import { StarRating } from '../components/ui/StarRating';
import { StrikeIndicator } from '../components/ui/StrikeIndicator';
import { Divider } from '../components/ui/Divider';

type Tab = 'leistungen' | 'kalender' | 'bewertungen';

const SERVICES = [
  { label: 'Rohrreparatur',      price: 'ab €80',  duration: '1–2h' },
  { label: 'Thermostat tauschen',price: 'ab €120', duration: '2–3h' },
  { label: 'Heizungswartung',   price: 'ab €150', duration: '2–4h' },
  { label: 'Notfallservice',    price: 'ab €180', duration: 'sofort' },
];

const CALENDAR = {
  Mo: ['09:00', '11:00', '—',    '16:00'],
  Di: ['—',    '—',    '13:00', '15:00'],
  Mi: ['09:00', '—',    '—',    '—'   ],
  Do: ['—',    '11:00', '14:00', '—'  ],
  Fr: ['09:00', '11:00', '13:00', '—' ],
};
const TIME_SLOTS = ['09:00', '11:00', '13:00', '15:00'];

const REVIEWS = [
  { author: 'Familie Maier',   rating: 5, text: 'Absolut zuverlässig, pünktlich und sauber. Sehr empfehlenswert!', date: 'vor 3 Tagen'  },
  { author: 'Thomas B.',       rating: 4, text: 'Gute Arbeit, klare Kommunikation. Preis-Leistung stimmt.',        date: 'vor 1 Woche'  },
  { author: 'Sandra K.',       rating: 5, text: 'Hat sogar abends noch Zeit gefunden. Perfekter Service.',         date: 'vor 2 Wochen' },
];

export default function ProfilScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('leistungen');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'leistungen',  label: 'Leistungen' },
    { key: 'kalender',   label: 'Kalender'   },
    { key: 'bewertungen', label: 'Bewertungen' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* Header */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={C.ink} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareBtn}>
            <Ionicons name="share-outline" size={20} color={C.ink} />
          </TouchableOpacity>
        </View>

        {/* Profile Hero */}
        <View style={styles.hero}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>Y</Text>
            </View>
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark" size={12} color={C.surface} />
            </View>
          </View>

          <Text style={styles.name}>Yilmaz GmbH</Text>
          <Text style={styles.trade}>Sanitär & Heizung · Köln</Text>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>134</Text>
              <Text style={styles.statLabel}>Aufträge</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>4.7</Text>
              <Text style={styles.statLabel}>Bewertung</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>~2h</Text>
              <Text style={styles.statLabel}>Reaktion</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>3 J.</Text>
              <Text style={styles.statLabel}>Dabei</Text>
            </View>
          </View>

          <View style={styles.badgesRow}>
            <Badge label="Gewerbeschein ✓" variant="gold" />
            <Badge label="Gründungsmitglied" variant="gold" />
            <View style={{ alignItems: 'center' }}>
              <StrikeIndicator count={0} />
              <Text style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>0 Strikes</Text>
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          {tabs.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, activeTab === t.key && styles.tabActive]}
              onPress={() => setActiveTab(t.key)}
            >
              <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>

          {activeTab === 'leistungen' && (
            <View>
              {SERVICES.map((s) => (
                <View key={s.label} style={styles.serviceRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.serviceLabel}>{s.label}</Text>
                    <Text style={styles.serviceDuration}>{s.duration}</Text>
                  </View>
                  <Text style={styles.servicePrice}>{s.price}</Text>
                </View>
              ))}
            </View>
          )}

          {activeTab === 'kalender' && (
            <View>
              <Text style={styles.calenderHint}>Freie Slots diese Woche</Text>
              <View style={styles.calGrid}>
                {/* Header row */}
                <View style={styles.calRow}>
                  <View style={styles.calDayLabel} />
                  {TIME_SLOTS.map((t) => (
                    <Text key={t} style={styles.calTimeHeader}>{t}</Text>
                  ))}
                </View>
                {/* Day rows */}
                {Object.entries(CALENDAR).map(([day, slots]) => (
                  <View key={day} style={styles.calRow}>
                    <Text style={styles.calDayLabel}>{day}</Text>
                    {slots.map((slot, i) => (
                      <View
                        key={i}
                        style={[
                          styles.calCell,
                          slot !== '—' ? styles.calFree : styles.calBusy,
                        ]}
                      >
                        <Text style={[styles.calCellText, slot !== '—' && { color: C.green }]}>
                          {slot !== '—' ? '✓' : '—'}
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </View>
          )}

          {activeTab === 'bewertungen' && (
            <View>
              <View style={styles.ratingOverview}>
                <Text style={styles.ratingBig}>4.7</Text>
                <StarRating rating={4.7} count={134} />
                <Text style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Durchschnitt aus 134 Bewertungen</Text>
              </View>
              <Divider margin={12} />
              {REVIEWS.map((r, i) => (
                <View key={i} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <Text style={styles.reviewAuthor}>{r.author}</Text>
                    <Text style={styles.reviewDate}>{r.date}</Text>
                  </View>
                  <StarRating rating={r.rating} />
                  <Text style={styles.reviewText}>{r.text}</Text>
                </View>
              ))}
            </View>
          )}

        </View>
      </ScrollView>

      {/* CTA */}
      <View style={styles.ctaBar}>
        <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push('/chat')} activeOpacity={0.85}>
          <Ionicons name="chatbubble-ellipses" size={18} color={C.surface} />
          <Text style={styles.ctaBtnText}>Anfrage stellen</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: C.bg },
  topBar:         { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  backBtn:        { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  shareBtn:       { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  hero:           { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20 },
  avatarWrap:     { position: 'relative', marginBottom: 12 },
  avatar:         { width: 80, height: 80, borderRadius: 40, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: C.gold },
  avatarText:     { fontSize: 32, fontWeight: '800', color: C.gold },
  verifiedBadge:  { position: 'absolute', bottom: 2, right: 2, width: 22, height: 22, borderRadius: 11, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.surface },
  name:           { fontSize: 22, fontWeight: '800', color: C.ink, marginBottom: 4 },
  trade:          { fontSize: 14, color: C.sub, marginBottom: 16 },
  statsRow:       { flexDirection: 'row', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 8, marginBottom: 14, width: '100%' },
  stat:           { flex: 1, alignItems: 'center' },
  statValue:      { fontSize: 17, fontWeight: '800', color: C.ink },
  statLabel:      { fontSize: 11, color: C.muted, marginTop: 2 },
  statDivider:    { width: 1, backgroundColor: C.border },
  badgesRow:      { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' },
  tabBar:         { flexDirection: 'row', backgroundColor: C.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border },
  tab:            { flex: 1, paddingVertical: 13, alignItems: 'center' },
  tabActive:      { borderBottomWidth: 2, borderBottomColor: C.ink },
  tabText:        { fontSize: 13, color: C.muted, fontWeight: '500' },
  tabTextActive:  { color: C.ink, fontWeight: '700' },
  tabContent:     { paddingHorizontal: 20, paddingTop: 16 },
  serviceRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 14, marginBottom: 8 },
  serviceLabel:   { fontSize: 14, fontWeight: '600', color: C.ink },
  serviceDuration:{ fontSize: 12, color: C.muted, marginTop: 2 },
  servicePrice:   { fontSize: 15, fontWeight: '700', color: C.ink },
  calenderHint:   { fontSize: 12, color: C.sub, marginBottom: 12 },
  calGrid:        { backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 12 },
  calRow:         { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  calDayLabel:    { width: 30, fontSize: 12, fontWeight: '700', color: C.sub },
  calTimeHeader:  { flex: 1, fontSize: 10, color: C.muted, textAlign: 'center' },
  calCell:        { flex: 1, marginHorizontal: 2, borderRadius: 6, paddingVertical: 6, alignItems: 'center' },
  calFree:        { backgroundColor: C.greenBg },
  calBusy:        { backgroundColor: '#F0EFEB' },
  calCellText:    { fontSize: 12, color: C.muted },
  ratingOverview: { alignItems: 'center', paddingVertical: 8 },
  ratingBig:      { fontSize: 48, fontWeight: '800', color: C.ink },
  reviewCard:     { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 14, marginBottom: 10 },
  reviewHeader:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  reviewAuthor:   { fontSize: 13, fontWeight: '700', color: C.ink },
  reviewDate:     { fontSize: 12, color: C.muted },
  reviewText:     { fontSize: 13, color: C.sub, marginTop: 6, lineHeight: 19 },
  ctaBar:         { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, padding: 16, paddingBottom: 28 },
  ctaBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.ink, borderRadius: 12, paddingVertical: 15 },
  ctaBtnText:     { fontSize: 16, fontWeight: '700', color: C.surface },
});
