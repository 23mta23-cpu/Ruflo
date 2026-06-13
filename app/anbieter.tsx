import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { C } from '../constants/colors';
import { showAlert } from '../lib/alert';

// ── Mock data ─────────────────────────────────────────────────────────────────

const PROVIDER = {
  id: 'yilmaz-gmbh',
  name: 'Yilmaz GmbH',
  trade: 'Heizung & Sanitär',
  initials: 'YG',
  since: 2021,
  rating: 4.8,
  ratingCount: 127,
  completedJobs: 214,
  responseTimeMin: 22,
  radiusKm: 25,
  minRate: 45,
  maxRate: 70,
  meisterpflicht: true,
  verified: {
    gewerbeschein: true,
    haftpflicht: true,
    steuerId: true,
    meisterbrief: true,
  },
  bio: 'Familiengeführter Meisterbetrieb mit über 20 Jahren Erfahrung in Heizungs- und Sanitärtechnik. Wir arbeiten ausschließlich mit zertifizierten Materialien und bieten 5 Jahre Garantie auf alle Installationsarbeiten.',
  services: [
    { name: 'Heizungsanlage warten / reparieren', price: '€55–70/h' },
    { name: 'Heizkörper einbauen / tauschen', price: '€120–250 Festpreis' },
    { name: 'Thermostat / Regler tauschen', price: '€80–120 Festpreis' },
    { name: 'Rohrreparatur & Leckortung', price: '€65/h' },
    { name: 'Sanitäranlage installieren', price: 'Auf Anfrage' },
  ],
};

const REVIEWS = [
  {
    id: 'r1',
    author: 'Familie M.',
    date: '02. Jun 2026',
    rating: 5,
    text: 'Super schnell und sauber gearbeitet. Der Techniker hat das Problem sofort erkannt und in einer Stunde behoben. Sehr zu empfehlen!',
    service: 'Rohrreparatur',
  },
  {
    id: 'r2',
    author: 'Thomas B.',
    date: '24. Mai 2026',
    rating: 5,
    text: 'Pünktlich, professionell, faire Preise. Habe bereits zum dritten Mal gebucht.',
    service: 'Heizungswartung',
  },
  {
    id: 'r3',
    author: 'Sabine K.',
    date: '11. Mai 2026',
    rating: 4,
    text: 'Gute Arbeit, nur die Terminabstimmung hat etwas länger gedauert. Das Ergebnis ist aber einwandfrei.',
    service: 'Thermostat tauschen',
  },
  {
    id: 'r4',
    author: 'Mehmet A.',
    date: '28. Apr 2026',
    rating: 5,
    text: 'Notfallreparatur am Wochenende — war innerhalb von 2 Stunden da. Absolut zuverlässig.',
    service: 'Rohrreparatur',
  },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= Math.round(rating) ? 'star' : 'star-outline'}
          size={size}
          color={C.gold}
        />
      ))}
    </View>
  );
}

function VerifiedBadge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <View style={[styles.badge, ok ? styles.badgeOk : styles.badgeMissing]}>
      <Ionicons
        name={ok ? 'checkmark-circle' : 'close-circle'}
        size={13}
        color={ok ? C.green : C.muted}
      />
      <Text style={[styles.badgeText, !ok && { color: C.muted }]}>{label}</Text>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function AnbieterProfilScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [bookmarkd, setBookmarked] = useState(false);

  const p = PROVIDER;

  async function handleShare() {
    try {
      await Share.share({
        message: `${p.name} auf WERKR — ${p.trade}, ${p.rating}★ (${p.ratingCount} Bewertungen)`,
      });
    } catch {
      // Share cancelled
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setBookmarked((b) => !b)} hitSlop={12}>
            <Ionicons
              name={bookmarkd ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={bookmarkd ? C.gold : C.ink}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} hitSlop={12} style={{ marginLeft: 14 }}>
            <Ionicons name="share-outline" size={22} color={C.ink} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Avatar + name */}
        <View style={styles.profileBlock}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{p.initials}</Text>
          </View>
          <Text style={styles.name}>{p.name}</Text>

          <View style={styles.tradeRow}>
            <View style={styles.tradeBadge}>
              <Ionicons name="construct-outline" size={13} color={C.sub} />
              <Text style={styles.tradeText}>{p.trade}</Text>
            </View>
            {p.meisterpflicht && (
              <View style={styles.meisterBadge}>
                <Ionicons name="ribbon" size={12} color={C.gold} />
                <Text style={styles.meisterText}>Meisterbetrieb</Text>
              </View>
            )}
          </View>

          <View style={styles.ratingRow}>
            <Stars rating={p.rating} size={16} />
            <Text style={styles.ratingValue}>{p.rating.toFixed(1)}</Text>
            <Text style={styles.ratingCount}>({p.ratingCount} Bewertungen)</Text>
          </View>
        </View>

        {/* Stats strip */}
        <View style={styles.statsStrip}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{p.completedJobs}</Text>
            <Text style={styles.statLabel}>Aufträge</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{p.responseTimeMin} Min.</Text>
            <Text style={styles.statLabel}>Antwortzeit</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>Seit {p.since}</Text>
            <Text style={styles.statLabel}>Auf WERKR</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{p.radiusKm} km</Text>
            <Text style={styles.statLabel}>Umkreis</Text>
          </View>
        </View>

        {/* Verification strip */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Verifizierung</Text>
          <View style={styles.badgeRow}>
            <VerifiedBadge label="Gewerbeschein" ok={p.verified.gewerbeschein} />
            <VerifiedBadge label="Haftpflicht" ok={p.verified.haftpflicht} />
            <VerifiedBadge label="Steuer-ID" ok={p.verified.steuerId} />
            {p.meisterpflicht && (
              <VerifiedBadge label="Meisterbrief" ok={p.verified.meisterbrief} />
            )}
          </View>
          <Text style={styles.verifyNote}>
            Dokumente wurden von WERKR einmalig geprüft. WERKR ist Vermittler — die Verantwortung für die Leistung liegt beim Anbieter.
          </Text>
        </View>

        {/* Services & pricing */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Leistungen & Preise</Text>
            <Text style={styles.rateRange}>€{p.minRate}–{p.maxRate}/h</Text>
          </View>
          {p.services.map((s, i) => (
            <View key={i} style={[styles.serviceRow, i === p.services.length - 1 && { borderBottomWidth: 0 }]}>
              <Ionicons name="chevron-forward" size={14} color={C.muted} style={{ marginTop: 1 }} />
              <Text style={styles.serviceName}>{s.name}</Text>
              <Text style={styles.servicePrice}>{s.price}</Text>
            </View>
          ))}
          <Text style={styles.priceNote}>Endpreise sind Festpreise aus dem WERKR-Vertrag. Kein Nachschlag nach Beginn.</Text>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Über uns</Text>
          <Text style={styles.bioText}>{p.bio}</Text>
        </View>

        {/* Reviews */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Kundenbewertungen</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Stars rating={p.rating} />
              <Text style={styles.reviewSummary}>{p.rating.toFixed(1)}</Text>
            </View>
          </View>
          {REVIEWS.map((r) => (
            <View key={r.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <View style={styles.reviewerAvatar}>
                  <Text style={styles.reviewerInitial}>{r.author[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewerName}>{r.author}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Stars rating={r.rating} />
                    <Text style={styles.reviewDate}>{r.date}</Text>
                  </View>
                </View>
                <View style={styles.reviewService}>
                  <Text style={styles.reviewServiceText}>{r.service}</Text>
                </View>
              </View>
              <Text style={styles.reviewText}>{r.text}</Text>
            </View>
          ))}
          <TouchableOpacity
            style={styles.allReviewsBtn}
            onPress={() => showAlert('Alle Bewertungen', 'Vollständige Bewertungsliste folgt im nächsten Release.')}
            activeOpacity={0.75}
          >
            <Text style={styles.allReviewsBtnText}>Alle {p.ratingCount} Bewertungen anzeigen</Text>
            <Ionicons name="chevron-forward" size={14} color={C.gold} />
          </TouchableOpacity>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.ctaBar}>
        <TouchableOpacity
          style={styles.ctaMsg}
          onPress={() => router.push('/chat')}
          activeOpacity={0.85}
        >
          <Ionicons name="chatbubble-outline" size={18} color={C.ink} />
          <Text style={styles.ctaMsgText}>Nachricht</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.ctaPrimary}
          onPress={() => router.push('/auftrag-aufgeben')}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaPrimaryText}>Anfrage stellen</Text>
          <Ionicons name="arrow-forward" size={18} color={C.surface} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:               { flex: 1, backgroundColor: C.bg },

  header:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  headerActions:      { flexDirection: 'row', alignItems: 'center' },

  scroll:             { paddingBottom: 24 },

  // Profile block
  profileBlock:       { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20 },
  avatar:             { width: 84, height: 84, borderRadius: 42, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  avatarText:         { fontSize: 28, fontWeight: '700', color: C.surface },
  name:               { fontSize: 22, fontWeight: '800', color: C.ink, textAlign: 'center', marginBottom: 10 },
  tradeRow:           { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 10 },
  tradeBadge:         { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  tradeText:          { fontSize: 13, color: C.sub, fontWeight: '500' },
  meisterBadge:       { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.goldBg, borderWidth: 1, borderColor: C.gold, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  meisterText:        { fontSize: 12, color: C.gold, fontWeight: '700' },
  ratingRow:          { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingValue:        { fontSize: 16, fontWeight: '700', color: C.ink },
  ratingCount:        { fontSize: 13, color: C.sub },

  // Stats strip
  statsStrip:         { flexDirection: 'row', backgroundColor: C.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border, marginBottom: 8 },
  statItem:           { flex: 1, alignItems: 'center', paddingVertical: 14 },
  statValue:          { fontSize: 14, fontWeight: '700', color: C.ink, marginBottom: 2 },
  statLabel:          { fontSize: 11, color: C.muted },
  statDivider:        { width: 1, backgroundColor: C.border },

  // Sections
  section:            { marginTop: 8, backgroundColor: C.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border, padding: 20 },
  sectionTitle:       { fontSize: 15, fontWeight: '700', color: C.ink, marginBottom: 14 },
  sectionHeaderRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },

  // Verification badges
  badgeRow:           { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  badge:              { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  badgeOk:            { backgroundColor: C.greenBg, borderColor: C.green },
  badgeMissing:       { backgroundColor: C.bg, borderColor: C.border },
  badgeText:          { fontSize: 12, fontWeight: '600', color: C.green },
  verifyNote:         { fontSize: 11, color: C.muted, lineHeight: 16 },

  // Services
  rateRange:          { fontSize: 14, fontWeight: '700', color: C.gold },
  serviceRow:         { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.border },
  serviceName:        { flex: 1, fontSize: 13, color: C.ink },
  servicePrice:       { fontSize: 13, fontWeight: '600', color: C.sub },
  priceNote:          { fontSize: 11, color: C.muted, marginTop: 12, lineHeight: 16 },

  // About
  bioText:            { fontSize: 14, color: C.sub, lineHeight: 21 },

  // Reviews
  reviewSummary:      { fontSize: 14, fontWeight: '700', color: C.ink },
  reviewCard:         { backgroundColor: C.bg, borderRadius: 12, padding: 14, marginBottom: 10 },
  reviewHeader:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  reviewerAvatar:     { width: 34, height: 34, borderRadius: 17, backgroundColor: C.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  reviewerInitial:    { fontSize: 14, fontWeight: '700', color: C.sub },
  reviewerName:       { fontSize: 13, fontWeight: '600', color: C.ink, marginBottom: 2 },
  reviewDate:         { fontSize: 11, color: C.muted },
  reviewService:      { backgroundColor: C.goldBg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  reviewServiceText:  { fontSize: 10, fontWeight: '600', color: C.gold },
  reviewText:         { fontSize: 13, color: C.sub, lineHeight: 19 },
  allReviewsBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12, marginTop: 4 },
  allReviewsBtnText:  { fontSize: 14, color: C.gold, fontWeight: '600' },

  // CTA footer
  ctaBar:             { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 10, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 },
  ctaMsg:             { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1.5, borderColor: C.border, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 13 },
  ctaMsgText:         { fontSize: 14, fontWeight: '600', color: C.ink },
  ctaPrimary:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.ink, borderRadius: 12, paddingVertical: 14 },
  ctaPrimaryText:     { fontSize: 15, fontWeight: '700', color: C.surface },
});
