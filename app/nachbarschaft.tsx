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
import { activeCategories } from '../data/categories';

const C2C_CATEGORIES = activeCategories().filter((c) => c.segment === 'C2C');
const CATEGORY_CHIPS = [
  { id: 'alle', name: 'Alle' },
  ...C2C_CATEGORIES.map((c) => ({ id: c.id, name: c.name })),
];

// Alle Preise ≥ €13/h (§1 MiLoG); category-IDs aus data/categories.ts
const HELPERS = [
  { id: '1', name: 'Lena M.',   age: 23, status: 'Studentin (Uni Köln)', categoryId: 'nachhilfe',   skills: ['Mathe', 'Physik', 'Chemie'],            rating: 4.9, reviews: 28, hourlyRate: 15, available: true  },
  { id: '2', name: 'Tim K.',    age: 21, status: 'Azubi Gartenbau',      categoryId: 'garten',      skills: ['Rasenmähen', 'Hecke schneiden', 'Bepflanzung'], rating: 4.7, reviews: 14, hourlyRate: 13, available: true  },
  { id: '3', name: 'Sara H.',   age: 24, status: 'Studentin (TH Köln)',  categoryId: 'it-support',  skills: ['PC-Setup', 'WLAN', 'Drucker', 'Smartphone'], rating: 4.8, reviews: 31, hourlyRate: 18, available: false },
  { id: '4', name: 'Jan R.',    age: 22, status: 'Student',              categoryId: 'reinigung',   skills: ['Wohnung', 'Büro', 'Fenster'],           rating: 5.0, reviews: 9,  hourlyRate: 13, available: true  },
  { id: '5', name: 'Mia B.',    age: 20, status: 'Azubi Hauswirtschaft', categoryId: 'reinigung',   skills: ['Wohnung', 'Büro', 'Fenster'],           rating: 4.6, reviews: 19, hourlyRate: 14, available: true  },
  { id: '6', name: 'Felix S.',  age: 25, status: 'Student (Lehramt)',    categoryId: 'nachhilfe',   skills: ['Deutsch', 'Geschichte', 'Englisch'],    rating: 4.9, reviews: 42, hourlyRate: 16, available: true  },
];

export default function NachbarschaftScreen() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState('alle');

  const filtered = activeCategory === 'alle'
    ? HELPERS
    : HELPERS.filter((h) => h.categoryId === activeCategory);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Nachbarschaftshilfe</Text>
          <Text style={styles.subtitle}>Kölner Studierende & Azubis</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Compliance Notice */}
      <View style={styles.complianceBanner}>
        <Ionicons name="shield-checkmark" size={16} color={C.green} />
        <Text style={styles.complianceText}>
          Alle Anbieter 18+ · Vollständig verifiziert · PStTG-konform
        </Text>
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {CATEGORY_CHIPS.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.filterChip, activeCategory === cat.id && styles.filterChipActive]}
            onPress={() => setActiveCategory(cat.id)}
          >
            <Text style={[styles.filterText, activeCategory === cat.id && styles.filterTextActive]}>
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Grid */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.grid}>
        {filtered.map((h) => (
          <TouchableOpacity
            key={h.id}
            style={styles.card}
            onPress={() => router.push('/profil')}
            activeOpacity={0.8}
          >
            {/* Avatar */}
            <View style={styles.avatarRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{h.name.charAt(0)}</Text>
              </View>
              <View style={[
                styles.availDot,
                { backgroundColor: h.available ? C.green : C.muted },
              ]} />
            </View>

            <Text style={styles.helperName}>{h.name}</Text>
            <Text style={styles.helperStatus} numberOfLines={1}>{h.status}</Text>
            <StarRating rating={h.rating} count={h.reviews} />

            <View style={styles.skillsWrap}>
              {h.skills.slice(0, 2).map((s) => (
                <View key={s} style={styles.skillChip}>
                  <Text style={styles.skillText}>{s}</Text>
                </View>
              ))}
              {h.skills.length > 2 && (
                <View style={styles.skillChip}>
                  <Text style={styles.skillText}>+{h.skills.length - 2}</Text>
                </View>
              )}
            </View>

            <View style={styles.cardFooter}>
              <Text style={styles.price}>€{h.hourlyRate}/h</Text>
              <Badge label={h.available ? 'Verfügbar' : 'Belegt'} variant={h.available ? 'green' : 'muted'} />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: C.bg },
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  backBtn:          { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:            { fontSize: 18, fontWeight: '800', color: C.ink, textAlign: 'center', letterSpacing: 0.3 },
  subtitle:         { fontSize: 12, color: C.sub, textAlign: 'center', marginTop: 1 },
  complianceBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.greenBg, marginHorizontal: 20, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 16 },
  complianceText:   { fontSize: 12, color: C.green, fontWeight: '500', flex: 1 },
  filterRow:        { paddingLeft: 20, paddingRight: 8, gap: 8, marginBottom: 16 },
  filterChip:       { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  filterChipActive: { backgroundColor: C.ink, borderColor: C.ink },
  filterText:       { fontSize: 13, color: C.sub, fontWeight: '500' },
  filterTextActive: { color: C.surface },
  grid:             { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 12, paddingBottom: 32 },
  card:             { width: '46%', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, marginLeft: 8 },
  avatarRow:        { position: 'relative', marginBottom: 10, alignSelf: 'flex-start' },
  avatar:           { width: 48, height: 48, borderRadius: 24, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center' },
  avatarText:       { fontSize: 20, fontWeight: '700', color: C.gold },
  availDot:         { position: 'absolute', bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: C.surface },
  helperName:       { fontSize: 14, fontWeight: '700', color: C.ink, marginBottom: 2 },
  helperStatus:     { fontSize: 11, color: C.sub, marginBottom: 6 },
  skillsWrap:       { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8, marginBottom: 10 },
  skillChip:        { backgroundColor: '#F0EFEB', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  skillText:        { fontSize: 10, color: C.sub },
  cardFooter:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  price:            { fontSize: 13, fontWeight: '700', color: C.ink },
});
