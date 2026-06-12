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
import { categoryById } from '../data/categories';

// Meisterpflicht-Gewerke (§1 HwO Anlage A) — Badge anzeigen wenn nachgewiesen
const MEISTERPFLICHT_IDS = new Set(['elektro', 'heizung-sanitaer']);

const PROVIDER = {
  categoryId:  'heizung-sanitaer',
  name:        'Yilmaz GmbH',
  location:    'Köln',
  bio:         'Professionelle Heizungs- und Sanitärarbeiten seit 2010. Festpreise, keine Überraschungen. Notfallservice 7 Tage die Woche.',
  rating:      4.7,
  reviewCount: 134,
  jobCount:    134,
  responseTime:'~2h',
  memberYears: 3,
  strikes:     0,
  available:   true,
  meisterbrief: true,
  gewerbeschein: true,
  ratingDist:  [2, 4, 8, 28, 92] as [number,number,number,number,number], // 1–5 Sterne
};

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
  const category = categoryById(PROVIDER.categoryId);
  const isMeisterpflicht = MEISTERPFLICHT_IDS.has(PROVIDER.categoryId);

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

          {/* Availability indicator */}
          <View style={[styles.availPill, PROVIDER.available ? styles.availOn : styles.availOff]}>
            <View style={[styles.availDot, { backgroundColor: PROVIDER.available ? C.green : C.muted }]} />
            <Text style={[styles.availText, { color: PROVIDER.available ? C.green : C.muted }]}>
              {PROVIDER.available ? 'Jetzt verfügbar' : 'Aktuell ausgebucht'}
            </Text>
          </View>

          <Text style={styles.name}>{PROVIDER.name}</Text>
          <Text style={styles.trade}>{category?.name ?? 'Handwerk'} · {PROVIDER.location}</Text>

          {/* Bio */}
          <Text style={styles.bio}>{PROVIDER.bio}</Text>

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
            {PROVIDER.gewerbeschein && <Badge label="Gewerbeschein ✓" variant="gold" />}
            {isMeisterpflicht && PROVIDER.meisterbrief && (
              <Badge label="Meisterbrief ✓" variant="green" />
            )}
            {isMeisterpflicht && !PROVIDER.meisterbrief && (
              <Badge label="Meisterbrief ausstehend" variant="amber" />
            )}
            {category?.segment === 'B2B' && <Badge label="Geprüfter Profi" variant="gold" />}
            <View style={{ alignItems: 'center' }}>
              <StrikeIndicator count={PROVIDER.strikes} />
              <Text style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{PROVIDER.strikes} Strikes</Text>
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
                <View style={styles.ratingLeft}>
                  <Text style={styles.ratingBig}>{PROVIDER.rating.toFixed(1)}</Text>
                  <StarRating rating={PROVIDER.rating} count={PROVIDER.reviewCount} />
                  <Text style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                    {PROVIDER.reviewCount} Bewertungen
                  </Text>
                </View>
                <View style={styles.ratingBars}>
                  {([5,4,3,2,1] as const).map((star) => {
                    const count = PROVIDER.ratingDist[star - 1];
                    const pct = PROVIDER.reviewCount > 0 ? count / PROVIDER.reviewCount : 0;
                    return (
                      <View key={star} style={styles.ratingBarRow}>
                        <Text style={styles.ratingBarLabel}>{star}</Text>
                        <Ionicons name="star" size={10} color={C.gold} />
                        <View style={styles.ratingBarTrack}>
                          <View style={[styles.ratingBarFill, { width: `${pct * 100}%` as any }]} />
                        </View>
                        <Text style={styles.ratingBarCount}>{count}</Text>
                      </View>
                    );
                  })}
                </View>
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
        <TouchableOpacity
          style={styles.ctaBtnSecondary}
          onPress={() => router.push('/chat')}
          activeOpacity={0.85}
        >
          <Ionicons name="chatbubble-outline" size={18} color={C.ink} />
          <Text style={styles.ctaBtnSecondaryText}>Anfrage</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.ctaBtn, !PROVIDER.available && styles.ctaBtnDisabled]}
          onPress={() => PROVIDER.available && router.push('/vertrag')}
          activeOpacity={0.85}
          disabled={!PROVIDER.available}
        >
          <Ionicons name="checkmark-circle-outline" size={18} color={PROVIDER.available ? C.surface : C.muted} />
          <Text style={[styles.ctaBtnText, !PROVIDER.available && { color: C.muted }]}>
            {PROVIDER.available ? 'Jetzt buchen' : 'Ausgebucht'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: C.bg },
  availPill:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginBottom: 10 },
  availOn:        { backgroundColor: C.greenBg },
  availOff:       { backgroundColor: '#F0EFEB' },
  availDot:       { width: 7, height: 7, borderRadius: 4 },
  availText:      { fontSize: 12, fontWeight: '600' },
  bio:            { fontSize: 13, color: C.sub, textAlign: 'center', lineHeight: 19, marginBottom: 16, paddingHorizontal: 8 },
  ratingLeft:     { alignItems: 'center', flex: 1 },
  ratingBars:     { flex: 1.6 },
  ratingBarRow:   { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 },
  ratingBarLabel: { fontSize: 11, color: C.sub, width: 10, textAlign: 'right' },
  ratingBarTrack: { flex: 1, height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' },
  ratingBarFill:  { height: 6, backgroundColor: C.gold, borderRadius: 3 },
  ratingBarCount: { fontSize: 10, color: C.muted, width: 20, textAlign: 'right' },
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
  ctaBar:              { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, padding: 16, paddingBottom: 28, flexDirection: 'row', gap: 10 },
  ctaBtn:              { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.ink, borderRadius: 12, paddingVertical: 15 },
  ctaBtnDisabled:      { backgroundColor: '#E8E7E3' },
  ctaBtnText:          { fontSize: 16, fontWeight: '700', color: C.surface },
  ctaBtnSecondary:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border, borderRadius: 12, paddingVertical: 15 },
  ctaBtnSecondaryText: { fontSize: 15, fontWeight: '600', color: C.ink },
});
