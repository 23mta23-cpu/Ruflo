import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { safeBack } from '../lib/nav';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { C } from '../constants/colors';
import { StarRow } from '../components/ui/StarRow';
import { categoryById } from '../data/categories';
import { trackEvent } from '../lib/analytics';

type ReviewItem = { initials: string; name: string; text: string; rating: number };
const MOCK_REVIEWS: ReviewItem[] = [
  { initials: 'FM', name: 'Florian M.', text: 'Super zuverlässig, alles sehr sauber. Gerne wieder!', rating: 5 },
  { initials: 'LK', name: 'Laura K.',   text: 'Sehr pünktlich und kompetent. Empfehle sie weiter.', rating: 5 },
];

export default function NachbarschaftProfilScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    helperId?: string;
    name?: string;
    initials?: string;
    bio?: string;
    rating?: string;
    reviews?: string;
    distance?: string;
    price?: string;
    skills?: string;
    verified?: string;
    online?: string;
  }>();

  const name     = params.name     ?? 'Helfer';
  const initials = params.initials ?? name.slice(0, 2).toUpperCase();
  const bio      = params.bio      ?? 'Zuverlässige Nachbarschaftshilfe in Ihrer Nähe.';
  const rating   = parseFloat(params.rating  ?? '5');
  const reviews  = parseInt(params.reviews   ?? '12', 10);
  const distance = params.distance ?? '< 2 km';
  const price    = params.price    ?? '€14/h';
  const skills   = params.skills ? params.skills.split(',') : ['garten', 'einkaufshilfe'];
  const verified = params.verified === 'true';
  const online   = params.online   !== 'false';

  useEffect(() => { trackEvent('helper_profile_view'); }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header card */}
        <View style={styles.headerCard}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zurück" style={styles.backBtn} onPress={() => safeBack(router)}>
            <Ionicons name="arrow-back" size={20} color={C.ink} />
          </TouchableOpacity>

          <View style={styles.profileRow}>
            {/* Avatar */}
            <View style={styles.avatarWrap}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={[styles.onlineDot, { backgroundColor: online ? C.primary : C.muted }]} />
            </View>

            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{name}</Text>
                {verified && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="shield-checkmark" size={10} color={C.primary} />
                    <Text style={styles.verifiedText}>Verifiziert</Text>
                  </View>
                )}
              </View>
              <StarRow rating={rating} size={12} />
              <Text style={styles.reviewCount}>({reviews} Bewertungen)</Text>
              <View style={styles.statsRow}>
                {[
                  [price,    'Stundensatz'],
                  [distance, 'Entfernung'],
                  [String(reviews), 'Aufträge'],
                ].map(([v, l]) => (
                  <View key={l} style={styles.stat}>
                    <Text style={styles.statValue}>{v}</Text>
                    <Text style={styles.statLabel}>{l}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {/* Werkant-Schutz info */}
          <View style={styles.schutzBanner}>
            <Ionicons name="shield-checkmark-outline" size={16} color={C.primary} style={{ flexShrink: 0 }} />
            <Text style={styles.schutzText}>
              <Text style={{ fontWeight: '600' }}>Werkant-Schutz:</Text> Pauschale €1,99 pro Auftrag — Zahlung gesichert, 18+ verifiziert, Mindestlohn eingehalten.
            </Text>
          </View>

          {/* Bio */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>ÜBER {name.split(' ')[0].toUpperCase()}</Text>
            <Text style={styles.bioText}>{bio}</Text>
            <View style={styles.skillsWrap}>
              {skills.map((sk) => (
                <View key={sk} style={styles.skillChip}>
                  <Text style={styles.skillChipText}>{categoryById(sk)?.name ?? sk}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Availability slots */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>VERFÜGBARE ZEITEN</Text>
            <View style={styles.slotsWrap}>
              {['Mo 10–16', 'Di 09–15', 'Do 10–18', 'Fr 09–13'].map((s) => (
                <View key={s} style={styles.slot}>
                  <Text style={styles.slotText}>{s}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Reviews */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>BEWERTUNGEN</Text>
            {MOCK_REVIEWS.map((r) => (
              <View key={r.initials} style={styles.reviewRow}>
                <View style={styles.reviewAvatar}>
                  <Text style={styles.reviewAvatarText}>{r.initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewName}>{r.name}</Text>
                  <StarRow rating={r.rating} size={10} />
                  <Text style={styles.reviewText}>{r.text}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* CTAs */}
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push({ pathname: '/auftrag-aufgeben', params: { track: 'nachbarschaft' } })}
            activeOpacity={0.85}
          >
            <Ionicons name="calendar-outline" size={18} color={C.surface} />
            <Text style={styles.primaryBtnText}>Jetzt buchen — {price} + €1,99 Schutz</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.ghostBtn}
            onPress={() => router.push({ pathname: '/auftrag-aufgeben', params: { track: 'nachbarschaft' } })}
            activeOpacity={0.85}
          >
            <Ionicons name="chatbubble-outline" size={16} color={C.ink} />
            <Text style={styles.ghostBtnText}>Nachricht senden</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: C.bg },
  headerCard:        { backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border, padding: 20, paddingBottom: 22 },
  backBtn:           { width: 44, height: 44, borderRadius: 12, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  profileRow:        { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  avatarWrap:        { position: 'relative', flexShrink: 0 },
  avatar:            { width: 62, height: 62, borderRadius: 31, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center' },
  avatarText:        { fontSize: 22, fontWeight: '700', color: C.gold },
  onlineDot:         { position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: 7, borderWidth: 2.5, borderColor: C.surface },
  nameRow:           { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  name:              { fontSize: 18, fontWeight: '600', color: C.ink },
  verifiedBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.primaryBg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: C.primaryBd },
  verifiedText:      { fontSize: 9, fontWeight: '700', color: C.primary },
  reviewCount:       { fontSize: 11, color: C.muted, marginTop: 2, marginBottom: 8 },
  statsRow:          { flexDirection: 'row', gap: 20, marginTop: 4 },
  stat:              { gap: 1 },
  statValue:         { fontSize: 12.5, fontWeight: '600', color: C.ink },
  statLabel:         { fontSize: 9.5, color: C.muted },
  body:              { padding: 16, gap: 12 },
  schutzBanner:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: C.primaryBg, borderRadius: 12, borderWidth: 1, borderColor: C.primaryBd, padding: 12 },
  schutzText:        { fontSize: 12, color: C.primary, lineHeight: 18, flex: 1 },
  card:              { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 16 },
  cardLabel:         { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 0.6, marginBottom: 10 },
  bioText:           { fontSize: 13.5, color: C.ink, lineHeight: 20 },
  skillsWrap:        { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  skillChip:         { backgroundColor: C.primaryBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: C.primaryBd },
  skillChipText:     { fontSize: 12, fontWeight: '600', color: C.primary },
  slotsWrap:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot:              { backgroundColor: C.primaryBg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  slotText:          { fontSize: 12, fontWeight: '600', color: C.primary },
  reviewRow:         { flexDirection: 'row', gap: 12, marginBottom: 14 },
  reviewAvatar:      { width: 32, height: 32, borderRadius: 16, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  reviewAvatarText:  { fontSize: 12, fontWeight: '700', color: C.gold },
  reviewName:        { fontSize: 12.5, fontWeight: '700', color: C.ink, marginBottom: 2 },
  reviewText:        { fontSize: 12, color: C.sub, lineHeight: 17, marginTop: 4 },
  primaryBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 12, paddingVertical: 15, shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 4 },
  primaryBtnText:    { fontSize: 14.5, fontWeight: '700', color: C.surface },
  ghostBtn:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, paddingVertical: 14 },
  ghostBtnText:      { fontSize: 14, fontWeight: '600', color: C.ink },
});
