import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/colors';
import { Badge } from '../../components/ui/Badge';
import { StarRating } from '../../components/ui/StarRating';

const CATEGORIES_HANDWERK = [
  { icon: 'hammer-outline',       label: 'Renovierung'   },
  { icon: 'water-outline',        label: 'Sanitär'       },
  { icon: 'flash-outline',        label: 'Elektro'       },
  { icon: 'color-palette-outline',label: 'Maler'         },
  { icon: 'construct-outline',    label: 'Tischler'      },
  { icon: 'grid-outline',         label: 'Fliesen'       },
];

const AVAILABLE_TODAY = [
  {
    id: '1',
    name: 'Marcus Berger',
    trade: 'Elektriker',
    rating: 4.9,
    reviews: 87,
    price: 'ab €65/h',
    slots: ['09:00', '14:00', '16:30'],
    verified: true,
    strikes: 0,
    responseTime: '~1h',
  },
  {
    id: '2',
    name: 'Yilmaz GmbH',
    trade: 'Sanitär & Heizung',
    rating: 4.7,
    reviews: 134,
    price: 'ab €80/h',
    slots: ['10:00', '15:00'],
    verified: true,
    strikes: 0,
    responseTime: '~2h',
  },
  {
    id: '3',
    name: 'Stefan Koch',
    trade: 'Maler & Lackierer',
    rating: 4.8,
    reviews: 52,
    price: 'ab €45/h',
    slots: ['08:00', '13:00'],
    verified: true,
    strikes: 0,
    responseTime: '~30min',
  },
];

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>WERKR</Text>
            <Text style={styles.subtitle}>Köln & Umgebung</Text>
          </View>
          <TouchableOpacity style={styles.profileBtn}>
            <Ionicons name="person-circle-outline" size={28} color={C.ink} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <TouchableOpacity style={styles.searchBar} activeOpacity={0.7}>
          <Ionicons name="search-outline" size={18} color={C.muted} />
          <Text style={styles.searchPlaceholder}>Was suchen Sie?</Text>
        </TouchableOpacity>

        {/* Main Tiles */}
        <View style={styles.tilesRow}>
          <TouchableOpacity
            style={[styles.tile, styles.tileHandwerk]}
            onPress={() => router.push('/profil')}
            activeOpacity={0.85}
          >
            <View style={styles.tileIcon}>
              <Ionicons name="hammer" size={26} color={C.gold} />
            </View>
            <Text style={styles.tileTitle}>Handwerker</Text>
            <Text style={styles.tileSub}>Verifizierte Profis</Text>
            <View style={styles.tileArrow}>
              <Ionicons name="arrow-forward" size={16} color={C.gold} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tile, styles.tileNachbar]}
            onPress={() => router.push('/nachbarschaft')}
            activeOpacity={0.85}
          >
            <View style={[styles.tileIcon, { backgroundColor: C.greenBg }]}>
              <Ionicons name="people" size={26} color={C.green} />
            </View>
            <Text style={styles.tileTitle}>Nachbarschaft</Text>
            <Text style={styles.tileSub}>Studis & Azubis</Text>
            <View style={[styles.tileArrow, { backgroundColor: C.greenBg }]}>
              <Ionicons name="arrow-forward" size={16} color={C.green} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Categories */}
        <Text style={styles.sectionTitle}>Kategorien</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesRow}
        >
          {CATEGORIES_HANDWERK.map((cat) => (
            <TouchableOpacity key={cat.label} style={styles.categoryChip} activeOpacity={0.7}>
              <Ionicons name={cat.icon as any} size={18} color={C.ink} />
              <Text style={styles.categoryLabel}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Today Available */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Heute verfügbar</Text>
          <Badge label="Live" variant="green" />
        </View>

        {AVAILABLE_TODAY.map((worker) => (
          <TouchableOpacity
            key={worker.id}
            style={styles.workerCard}
            onPress={() => router.push('/profil')}
            activeOpacity={0.8}
          >
            <View style={styles.workerAvatar}>
              <Text style={styles.avatarText}>{worker.name.charAt(0)}</Text>
            </View>

            <View style={styles.workerInfo}>
              <View style={styles.workerNameRow}>
                <Text style={styles.workerName}>{worker.name}</Text>
                {worker.verified && (
                  <Ionicons name="checkmark-circle" size={15} color={C.gold} style={{ marginLeft: 4 }} />
                )}
              </View>
              <Text style={styles.workerTrade}>{worker.trade}</Text>
              <StarRating rating={worker.rating} count={worker.reviews} />

              <View style={styles.slotsRow}>
                {worker.slots.map((slot) => (
                  <View key={slot} style={styles.slotChip}>
                    <Text style={styles.slotText}>{slot}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.workerRight}>
              <Text style={styles.workerPrice}>{worker.price}</Text>
              <Text style={styles.responseTime}>{worker.responseTime}</Text>
              <Ionicons name="chevron-forward" size={16} color={C.muted} style={{ marginTop: 8 }} />
            </View>
          </TouchableOpacity>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: C.bg },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  logo:            { fontSize: 22, fontWeight: '800', color: C.ink, letterSpacing: 1.5 },
  subtitle:        { fontSize: 12, color: C.sub, marginTop: 1 },
  profileBtn:      { padding: 4 },
  searchBar:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginBottom: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  searchPlaceholder: { color: C.muted, fontSize: 15 },
  tilesRow:        { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginBottom: 24 },
  tile:            { flex: 1, backgroundColor: C.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border },
  tileHandwerk:    { borderTopColor: C.gold, borderTopWidth: 2 },
  tileNachbar:     { borderTopColor: C.green, borderTopWidth: 2 },
  tileIcon:        { width: 44, height: 44, borderRadius: 10, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  tileTitle:       { fontSize: 15, fontWeight: '700', color: C.ink, marginBottom: 2 },
  tileSub:         { fontSize: 12, color: C.sub, marginBottom: 12 },
  tileArrow:       { width: 28, height: 28, borderRadius: 8, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center' },
  sectionTitle:    { fontSize: 17, fontWeight: '700', color: C.ink, paddingHorizontal: 20, marginBottom: 12 },
  sectionHeader:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, marginBottom: 12 },
  categoriesRow:   { paddingLeft: 20, paddingRight: 8, gap: 8 },
  categoryChip:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 20, marginRight: 4 },
  categoryLabel:   { fontSize: 13, color: C.ink, fontWeight: '500' },
  workerCard:      { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, marginHorizontal: 20, marginBottom: 10, padding: 14 },
  workerAvatar:    { width: 44, height: 44, borderRadius: 22, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText:      { fontSize: 18, fontWeight: '700', color: C.gold },
  workerInfo:      { flex: 1 },
  workerNameRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  workerName:      { fontSize: 14, fontWeight: '700', color: C.ink },
  workerTrade:     { fontSize: 12, color: C.sub, marginBottom: 4 },
  slotsRow:        { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  slotChip:        { backgroundColor: C.greenBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  slotText:        { fontSize: 11, color: C.green, fontWeight: '600' },
  workerRight:     { alignItems: 'flex-end' },
  workerPrice:     { fontSize: 13, fontWeight: '700', color: C.ink },
  responseTime:    { fontSize: 11, color: C.muted, marginTop: 2 },
});
