import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { StarRow } from '../components/ui/StarRow';
import { loadAccount, isPStTGThresholdReached } from '../lib/account';
import { showAlert } from '../lib/alert';

type Category = {
  id: string;
  label: string;
  emoji: string;
};

const CATEGORIES: Category[] = [
  { id: 'alle',           label: 'Alle',           emoji: '✨' },
  { id: 'einkaufen',      label: 'Einkaufen',      emoji: '🛒' },
  { id: 'tierbetreuung',  label: 'Tierbetreuung',  emoji: '🐕' },
  { id: 'umzug',          label: 'Umzug',          emoji: '📦' },
  { id: 'garten',         label: 'Garten',         emoji: '🌿' },
  { id: 'kinderbetreuung',label: 'Kinderbetreuung',emoji: '👶' },
  { id: 'haushalt',       label: 'Haushalt',       emoji: '🧹' },
  { id: 'fahrdienst',     label: 'Fahrdienst',     emoji: '🚗' },
  { id: 'buerohelfer',    label: 'Bürohelfer',     emoji: '📝' },
];

const DISTANCES = ['< 1 km', '< 3 km', '< 5 km'] as const;
type DistanceOption = typeof DISTANCES[number];

type AvatarColor = {
  bg: string;
  text: string;
};

const AVATAR_COLORS: AvatarColor[] = [
  { bg: '#FBF5E4', text: '#B8930A' },
  { bg: '#E8F5EE', text: '#1A7A48' },
  { bg: '#EEF0FB', text: '#3A4AAA' },
  { bg: '#FDE8F0', text: '#AA3A6A' },
];

type Helper = {
  id: string;
  name: string;
  initials: string;
  distance: string;
  rating: number;
  reviews: number;
  skills: string[];
  rate: string;
  avatarIndex: number;
  verified: boolean;
};

const HELPERS: Helper[] = [
  {
    id: '1',
    name: 'Sarah B.',
    initials: 'SB',
    distance: '0,8 km',
    rating: 4.9,
    reviews: 23,
    skills: ['Einkaufen', 'Haushalt', 'Tierbetreuung'],
    rate: 'ab €10/Std.',
    avatarIndex: 0,
    verified: true,
  },
  {
    id: '2',
    name: 'Lukas M.',
    initials: 'LM',
    distance: '1,2 km',
    rating: 4.7,
    reviews: 11,
    skills: ['Umzug', 'Gartenarbeit', 'Bürohelfer'],
    rate: 'ab €13/Std.',
    avatarIndex: 1,
    verified: false,
  },
  {
    id: '3',
    name: 'Emma W.',
    initials: 'EW',
    distance: '1,5 km',
    rating: 5.0,
    reviews: 8,
    skills: ['Kinderbetreuung', 'Haushalt'],
    rate: 'ab €15/Std.',
    avatarIndex: 2,
    verified: true,
  },
  {
    id: '4',
    name: 'Ben K.',
    initials: 'BK',
    distance: '2,1 km',
    rating: 4.6,
    reviews: 31,
    skills: ['Fahrdienst', 'Einkaufen', 'Umzug'],
    rate: 'ab €11/Std.',
    avatarIndex: 3,
    verified: false,
  },
];

export default function NachbarschaftScreen() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState('alle');
  const [activeDistance, setActiveDistance] = useState<DistanceOption>('< 3 km');
  const [query, setQuery] = useState('');
  const [pstgBlocked, setPstgBlocked] = useState(false);
  const [pstgHasSteuerId, setPstgHasSteuerId] = useState(true);

  useEffect(() => {
    loadAccount()
      .then((acc) => {
        if (isPStTGThresholdReached(acc)) {
          setPstgBlocked(!acc.steuernummerProvided);
          setPstgHasSteuerId(acc.steuernummerProvided);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Nachbarschaft</Text>
          <Text style={styles.subtitle}>Einfache Alltagsaufgaben von Nachbarn erledigen lassen</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {pstgBlocked && (
          <View style={styles.pstgBanner}>
            <Ionicons name="warning" size={16} color={C.amber} />
            <Text style={styles.pstgBannerText}>
              <Text style={{ fontWeight: '800' }}>Steuer-ID erforderlich</Text>
              {' — '}Sie haben die PStTG-Meldeschwelle (30 Aufträge / €2.000/Jahr) erreicht. Neue Anfragen sind gesperrt, bis Sie Ihre Steuer-ID hinterlegt haben.
            </Text>
          </View>
        )}
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color={C.muted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Aufgabe suchen…"
            placeholderTextColor={C.muted}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={18} color={C.muted} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                onPress={() => setActiveCategory(cat.id)}
                activeOpacity={0.75}
              >
                <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                <Text style={[styles.categoryLabel, isActive && styles.categoryLabelActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.distanceRow}>
          <Ionicons name="location-outline" size={13} color={C.sub} />
          <Text style={styles.distanceLabel}>Umkreis:</Text>
          {DISTANCES.map((d) => {
            const isActive = activeDistance === d;
            return (
              <TouchableOpacity
                key={d}
                style={[styles.distanceChip, isActive && styles.distanceChipActive]}
                onPress={() => setActiveDistance(d)}
                activeOpacity={0.75}
              >
                <Text style={[styles.distanceText, isActive && styles.distanceTextActive]}>{d}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.helperSection}>
          <Text style={styles.sectionHeading}>Helfer in deiner Nähe</Text>
          {HELPERS.map((helper) => {
            const color = AVATAR_COLORS[helper.avatarIndex];
            return (
              <View key={helper.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={[styles.avatar, { backgroundColor: color.bg }]}>
                    <Text style={[styles.avatarInitials, { color: color.text }]}>{helper.initials}</Text>
                  </View>

                  <View style={styles.cardMeta}>
                    <View style={styles.nameRow}>
                      <Text style={styles.helperName}>{helper.name}</Text>
                      {helper.verified && (
                        <View style={styles.verifiedBadge}>
                          <Ionicons name="checkmark" size={9} color={C.primary} />
                          <Text style={styles.verifiedText}>E-Mail bestätigt</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.ratingRow}>
                      <StarRow rating={helper.rating} />
                      <Text style={styles.ratingValue}>{helper.rating.toFixed(1)}</Text>
                      <Text style={styles.ratingCount}>({helper.reviews})</Text>
                    </View>
                    <Text style={styles.rateText}>{helper.rate}</Text>
                  </View>

                  <View style={styles.distanceBadge}>
                    <Ionicons name="location" size={10} color={C.sub} />
                    <Text style={styles.distanceBadgeText}>{helper.distance}</Text>
                  </View>
                </View>

                <View style={styles.skillsRow}>
                  {helper.skills.map((skill) => (
                    <View key={skill} style={styles.skillTag}>
                      <Text style={styles.skillTagText}>{skill}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.schutzRow}>
                  <Ionicons name="shield-checkmark-outline" size={13} color={C.sub} />
                  <Text style={styles.schutzText}>€1,99 WERKR-Schutz (Escrow) · Helfer erhält 100%</Text>
                </View>

                <TouchableOpacity
                  style={[styles.anfragenBtn, pstgBlocked && styles.anfragenBtnBlocked]}
                  onPress={() => {
                    if (pstgBlocked) {
                      showAlert(
                        'Steuer-ID erforderlich',
                        'Sie haben den PStTG-Schwellenwert (≥30 Aufträge oder ≥€2.000/Jahr) erreicht.\n\nBitte hinterlegen Sie Ihre Steuer-ID unter Konto → Einstellungen, um neue Aufträge anzunehmen.',
                        [{ text: 'Verstanden', style: 'cancel' }],
                      );
                      return;
                    }
                    router.push('/chat');
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.anfragenText}>{pstgBlocked ? 'Gesperrt' : 'Anfragen'}</Text>
                  <Ionicons name={pstgBlocked ? 'lock-closed' : 'arrow-forward'} size={14} color={C.surface} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        <View style={styles.ctaBanner}>
          <View style={styles.ctaInner}>
            <View style={styles.ctaIconWrap}>
              <Ionicons name="people" size={22} color={C.primary} />
            </View>
            <View style={styles.ctaText}>
              <Text style={styles.ctaTitle}>Werden Sie Nachbarschaftshelfer</Text>
              <Text style={styles.ctaBody}>Private Gefälligkeit & Nebentätigkeit nach §22 Nr. 3 EStG.</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={() => router.push('/onboarding-kyc')}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaBtnText}>Jetzt bewerben</Text>
            <Ionicons name="chevron-forward" size={14} color={C.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.legalNote}>
          <Ionicons name="information-circle-outline" size={13} color={C.muted} style={styles.legalIcon} />
          <Text style={styles.legalText}>
            Beta-Testbetrieb — Nutzung auf eigene Gefahr. WERKR ist reiner Vermittler; Vertrag entsteht nur zwischen den Parteien. Nebeneinkünfte nach §22 Nr. 3 EStG können steuerpflichtig sein (Freigrenze €256/Jahr). Zahlung gesichert über Escrow — keine Partnerversicherung in diesem Beta.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: C.bg },
  scrollContent:      { paddingBottom: 48 },

  header:             { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 18, gap: 12 },
  backBtn:            { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  headerText:         { flex: 1 },
  headerSpacer:       { width: 36 },
  title:              { fontSize: 20, fontWeight: '800', color: C.ink, letterSpacing: 0.2, marginBottom: 3 },
  subtitle:           { fontSize: 12, color: C.sub, lineHeight: 17 },

  searchWrap:         { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginBottom: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  searchInput:        { flex: 1, fontSize: 15, color: C.ink },

  categoryRow:        { paddingLeft: 20, paddingRight: 8, gap: 8, marginBottom: 14 },
  categoryChip:       { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 24, paddingHorizontal: 13, paddingVertical: 8 },
  categoryChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  categoryEmoji:      { fontSize: 14 },
  categoryLabel:      { fontSize: 13, color: C.sub, fontWeight: '600' },
  categoryLabelActive:{ color: C.surface },

  distanceRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, marginBottom: 24 },
  distanceLabel:      { fontSize: 12, color: C.sub, fontWeight: '500', marginRight: 2 },
  distanceChip:       { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingHorizontal: 11, paddingVertical: 5 },
  distanceChipActive: { backgroundColor: C.primaryBg, borderColor: C.primary },
  distanceText:       { fontSize: 12, color: C.sub, fontWeight: '600' },
  distanceTextActive: { color: C.primary },

  helperSection:      { paddingHorizontal: 20, gap: 14, marginBottom: 24 },
  sectionHeading:     { fontSize: 14, fontWeight: '700', color: C.ink, letterSpacing: 0.2, marginBottom: 4 },

  card:               { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardTop:            { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 12 },
  avatar:             { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarInitials:     { fontSize: 16, fontWeight: '800' },
  cardMeta:           { flex: 1, gap: 4 },
  nameRow:            { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  helperName:         { fontSize: 15, fontWeight: '800', color: C.ink },
  verifiedBadge:      { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.primaryBg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  verifiedText:       { fontSize: 10, color: C.primary, fontWeight: '700' },
  ratingRow:          { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ratingValue:        { fontSize: 12, fontWeight: '700', color: C.ink },
  ratingCount:        { fontSize: 11, color: C.muted },
  rateText:           { fontSize: 13, fontWeight: '700', color: C.primary },
  distanceBadge:      { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4, flexShrink: 0 },
  distanceBadgeText:  { fontSize: 11, color: C.sub, fontWeight: '600' },

  skillsRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  skillTag:           { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  skillTagText:       { fontSize: 11, color: C.sub, fontWeight: '600' },

  schutzRow:          { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  schutzText:         { fontSize: 11, color: C.sub, fontWeight: '500' },

  anfragenBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.primary, borderRadius: 12, paddingVertical: 12 },
  anfragenBtnBlocked: { backgroundColor: C.muted },
  anfragenText:       { fontSize: 14, fontWeight: '700', color: C.surface },
  pstgBanner:         { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: C.amberBg, borderWidth: 1, borderColor: C.amber, borderRadius: 12, padding: 13, marginBottom: 12 },
  pstgBannerText:     { flex: 1, fontSize: 12, color: C.amber, lineHeight: 18 },

  ctaBanner:          { marginHorizontal: 20, marginBottom: 20, backgroundColor: C.primaryBg, borderWidth: 1, borderColor: '#B8D9C8', borderRadius: 16, padding: 18, gap: 14 },
  ctaInner:           { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  ctaIconWrap:        { width: 40, height: 40, borderRadius: 20, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  ctaText:            { flex: 1, gap: 3 },
  ctaTitle:           { fontSize: 14, fontWeight: '800', color: C.ink },
  ctaBody:            { fontSize: 12, color: C.sub, lineHeight: 17 },
  ctaBtn:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.primary, borderRadius: 10, paddingVertical: 10 },
  ctaBtnText:         { fontSize: 13, fontWeight: '700', color: C.primary },

  legalNote:          { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginHorizontal: 20, marginBottom: 8 },
  legalIcon:          { marginTop: 1 },
  legalText:          { flex: 1, fontSize: 11, color: C.muted, lineHeight: 16 },
});
