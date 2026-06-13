import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/colors';
import { Badge } from '../../components/ui/Badge';
import { StarRating } from '../../components/ui/StarRating';
import { activeCategories } from '../../data/categories';
import { BetaBanner } from '../../components/ui/BetaBanner';

const CATEGORIES_HANDWERK = activeCategories()
  .filter((c) => c.segment === 'B2B')
  .map((c) => ({ icon: c.icon, label: c.name }));

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
    responseTime: '~30min',
  },
];

const STAMMKUNDEN = [
  { id: '1', name: 'Marcus Berger', trade: 'Elektriker',    lastJob: 'vor 3 Wochen', rating: 4.9, initial: 'M' },
  { id: '2', name: 'Yilmaz GmbH',  trade: 'Sanitär',       lastJob: 'vor 6 Wochen', rating: 4.7, initial: 'Y' },
  { id: '3', name: 'Stefan Koch',  trade: 'Maler',         lastJob: 'vor 2 Monaten', rating: 4.8, initial: 'S' },
  { id: '4', name: 'Lena M.',      trade: 'Nachhilfe',      lastJob: 'letzte Woche',  rating: 4.9, initial: 'L' },
];

const NEU_IN_DER_NAEHE = [
  { id: 'n1', name: 'Rolf Brauer',  trade: 'Renovierung',  rating: 4.6, reviews: 12, price: 'ab €70/h', distance: '1.8 km', verified: true },
  { id: 'n2', name: 'Mia B.',       trade: 'Reinigung',    rating: 4.7, reviews: 8,  price: 'ab €14/h', distance: '0.9 km', verified: false },
  { id: 'n3', name: 'Tom Fischer',  trade: 'Tischler',     rating: 4.5, reviews: 19, price: 'ab €60/h', distance: '2.4 km', verified: true },
];

const TAB_BAR_HEIGHT = 60;

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }}>

        {/* Beta Banner */}
        <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 2 }}>
          <BetaBanner compact />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>WERKR</Text>
            <Text style={styles.subtitle}>Köln & Umgebung</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.bellBtn}
              onPress={() => router.push('/nachrichten')}
            >
              <Ionicons name="chatbubble-outline" size={23} color="#0f172a" />
              <View style={styles.bellDot} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bellBtn}
              onPress={() => router.push('/benachrichtigungen')}
            >
              <Ionicons name="notifications-outline" size={23} color="#0f172a" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.profileBtn}
              onPress={() => router.push('/(tabs)/konto')}
            >
              <Ionicons name="person-circle-outline" size={28} color="#0f172a" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        <TouchableOpacity
          style={styles.searchBar}
          activeOpacity={0.7}
          onPress={() => router.push('/suche')}
        >
          <Ionicons name="search-outline" size={18} color="#94a3b8" />
          <Text style={styles.searchPlaceholder}>Was suchen Sie? Handwerker, Nachhilfe…</Text>
          <View style={styles.searchFilter}>
            <Ionicons name="options-outline" size={16} color="#64748b" />
          </View>
        </TouchableOpacity>

        {/* Post a Job CTA */}
        <TouchableOpacity
          style={styles.postJobBanner}
          onPress={() => router.push('/auftrag-aufgeben')}
          activeOpacity={0.85}
        >
          <View style={styles.postJobIcon}>
            <Ionicons name="add-circle" size={22} color="#ea580c" />
          </View>
          <View style={styles.postJobText}>
            <Text style={styles.postJobTitle}>Auftrag aufgeben</Text>
            <Text style={styles.postJobSub}>Angebote von Profis erhalten</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#ea580c" />
        </TouchableOpacity>

        {/* Bento Tiles */}
        <View style={styles.tilesRow}>
          <TouchableOpacity
            style={styles.tile}
            onPress={() => router.push('/suche')}
            activeOpacity={0.85}
          >
            <View style={styles.tileIconCraft}>
              <Ionicons name="hammer" size={24} color="#ea580c" />
            </View>
            <Text style={styles.tileTitle}>Handwerker</Text>
            <Text style={styles.tileSub}>Verifizierte Profis</Text>
            <View style={styles.tileArrowCraft}>
              <Ionicons name="arrow-forward" size={14} color="#ea580c" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tile}
            onPress={() => router.push('/nachbarschaft')}
            activeOpacity={0.85}
          >
            <View style={styles.tileIconNbhd}>
              <Ionicons name="people" size={24} color="#059669" />
            </View>
            <Text style={styles.tileTitle}>Nachbarschaft</Text>
            <Text style={styles.tileSub}>Studis & Azubis</Text>
            <View style={styles.tileArrowNbhd}>
              <Ionicons name="arrow-forward" size={14} color="#059669" />
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
            <TouchableOpacity
              key={cat.label}
              style={styles.categoryChip}
              onPress={() => router.push('/suche')}
              activeOpacity={0.7}
            >
              <Ionicons name={cat.icon as any} size={16} color="#0f172a" />
              <Text style={styles.categoryLabel}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Stammkunden */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Stammkunden</Text>
          <TouchableOpacity onPress={() => router.push('/meine-anbieter')} activeOpacity={0.7}>
            <Text style={styles.sectionLink}>Alle →</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stammkundenRow}
        >
          {STAMMKUNDEN.map((sk) => (
            <TouchableOpacity
              key={sk.id}
              style={styles.stammkundeCard}
              onPress={() => router.push('/anbieter')}
              activeOpacity={0.8}
            >
              <View style={styles.stammkundeAvatar}>
                <Text style={styles.stammkundeAvatarText}>{sk.initial}</Text>
              </View>
              <Text style={styles.stammkundeName} numberOfLines={1}>{sk.name}</Text>
              <Text style={styles.stammkundeTrade} numberOfLines={1}>{sk.trade}</Text>
              <View style={styles.stammkundeStars}>
                <Ionicons name="star" size={11} color="#ea580c" />
                <Text style={styles.stammkundeRating}>{sk.rating}</Text>
              </View>
              <Text style={styles.stammkundeLastJob}>{sk.lastJob}</Text>
              <TouchableOpacity
                style={styles.wiederBuchenBtn}
                onPress={() => router.push('/anbieter')}
                activeOpacity={0.8}
              >
                <Text style={styles.wiederBuchenText}>Wieder buchen</Text>
              </TouchableOpacity>
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
            onPress={() => router.push('/anbieter')}
            activeOpacity={0.8}
          >
            <View style={styles.workerAvatar}>
              <Text style={styles.avatarText}>{worker.name.charAt(0)}</Text>
            </View>

            <View style={styles.workerInfo}>
              <View style={styles.workerNameRow}>
                <Text style={styles.workerName}>{worker.name}</Text>
                {worker.verified && (
                  <Ionicons name="checkmark-circle" size={15} color="#059669" style={{ marginLeft: 4 }} />
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
              <Ionicons name="chevron-forward" size={16} color="#94a3b8" style={{ marginTop: 8 }} />
            </View>
          </TouchableOpacity>
        ))}

        {/* Neu in deiner Nähe */}
        <View style={[styles.sectionHeader, { marginTop: 8 }]}>
          <Text style={styles.sectionTitle}>Neu in deiner Nähe</Text>
          <Badge label="Neu" variant="amber" />
        </View>

        {NEU_IN_DER_NAEHE.map((worker) => (
          <TouchableOpacity
            key={worker.id}
            style={styles.newWorkerCard}
            onPress={() => router.push('/anbieter')}
            activeOpacity={0.8}
          >
            <View style={[styles.workerAvatar, { backgroundColor: '#f1f5f9' }]}>
              <Text style={[styles.avatarText, { color: '#64748b' }]}>{worker.name.charAt(0)}</Text>
            </View>
            <View style={styles.workerInfo}>
              <View style={styles.workerNameRow}>
                <Text style={styles.workerName}>{worker.name}</Text>
                {worker.verified && (
                  <Ionicons name="checkmark-circle" size={14} color="#059669" style={{ marginLeft: 4 }} />
                )}
              </View>
              <Text style={styles.workerTrade}>{worker.trade}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Ionicons name="star" size={12} color="#ea580c" />
                  <Text style={{ fontSize: 12, color: '#64748b' }}>{worker.rating} ({worker.reviews})</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Ionicons name="location-outline" size={12} color="#94a3b8" />
                  <Text style={{ fontSize: 12, color: '#94a3b8' }}>{worker.distance}</Text>
                </View>
              </View>
            </View>
            <View style={styles.workerRight}>
              <Text style={styles.workerPrice}>{worker.price}</Text>
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>NEU</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#94a3b8" style={{ marginTop: 6 }} />
            </View>
          </TouchableOpacity>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#f8fafc' },
  header:             { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  logo:               { fontSize: 22, fontWeight: '800', color: '#0f172a', letterSpacing: 1.5 },
  subtitle:           { fontSize: 12, color: '#64748b', marginTop: 1 },
  headerRight:        { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bellBtn:            { padding: 4, position: 'relative' },
  bellDot:            { position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: C.red, borderWidth: 1.5, borderColor: '#f8fafc' },
  profileBtn:         { padding: 4 },

  searchBar:          { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginBottom: 16, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  searchPlaceholder:  { flex: 1, color: '#94a3b8', fontSize: 14 },
  searchFilter:       { width: 28, height: 28, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },

  // Bento tiles
  tilesRow:           { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginBottom: 24 },
  tile:               { flex: 1, backgroundColor: '#ffffff', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#0f172a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 20, elevation: 2 },
  tileIconCraft:      { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(234, 88, 12, 0.06)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  tileIconNbhd:       { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(5, 150, 105, 0.06)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  tileTitle:          { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  tileSub:            { fontSize: 12, color: '#64748b', marginBottom: 14 },
  tileArrowCraft:     { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(234, 88, 12, 0.06)', alignItems: 'center', justifyContent: 'center' },
  tileArrowNbhd:      { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(5, 150, 105, 0.06)', alignItems: 'center', justifyContent: 'center' },

  sectionTitle:       { fontSize: 17, fontWeight: '700', color: '#0f172a', paddingHorizontal: 20, marginBottom: 12 },
  sectionHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 },
  sectionLink:        { fontSize: 13, color: '#64748b', fontWeight: '500' },
  categoriesRow:      { paddingLeft: 20, paddingRight: 8, gap: 8, marginBottom: 20 },
  categoryChip:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 9999, paddingHorizontal: 12, paddingVertical: 8 },
  categoryLabel:      { fontSize: 13, color: '#0f172a', fontWeight: '500' },

  // Stammkunden
  stammkundenRow:     { paddingLeft: 20, paddingRight: 8, gap: 12, marginBottom: 24 },
  stammkundeCard:     { width: 130, backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 14, alignItems: 'center', shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 },
  stammkundeAvatar:   { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(234, 88, 12, 0.06)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  stammkundeAvatarText: { fontSize: 19, fontWeight: '700', color: '#ea580c' },
  stammkundeName:     { fontSize: 13, fontWeight: '700', color: '#0f172a', marginBottom: 2, textAlign: 'center' },
  stammkundeTrade:    { fontSize: 11, color: '#64748b', marginBottom: 4, textAlign: 'center' },
  stammkundeStars:    { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 },
  stammkundeRating:   { fontSize: 11, color: '#64748b', fontWeight: '600' },
  stammkundeLastJob:  { fontSize: 10, color: '#94a3b8', marginBottom: 10, textAlign: 'center' },
  wiederBuchenBtn:    { backgroundColor: 'rgba(234, 88, 12, 0.06)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(234, 88, 12, 0.15)' },
  wiederBuchenText:   { fontSize: 11, fontWeight: '700', color: '#ea580c' },

  // Worker cards
  workerCard:         { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, marginHorizontal: 20, marginBottom: 10, padding: 14, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 },
  newWorkerCard:      { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, marginHorizontal: 20, marginBottom: 10, padding: 14, borderLeftWidth: 3, borderLeftColor: C.amber },
  workerAvatar:       { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(234, 88, 12, 0.06)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText:         { fontSize: 18, fontWeight: '700', color: '#ea580c' },
  workerInfo:         { flex: 1 },
  workerNameRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  workerName:         { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  workerTrade:        { fontSize: 12, color: '#64748b', marginBottom: 4 },
  slotsRow:           { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  slotChip:           { backgroundColor: 'rgba(5, 150, 105, 0.06)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(5, 150, 105, 0.12)' },
  slotText:           { fontSize: 11, color: '#059669', fontWeight: '600' },
  workerRight:        { alignItems: 'flex-end' },
  workerPrice:        { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  responseTime:       { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  newBadge:           { backgroundColor: C.amberBg, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3, marginTop: 4 },
  newBadgeText:       { fontSize: 10, fontWeight: '700', color: C.amber, letterSpacing: 0.5 },

  // Post job banner
  postJobBanner:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', marginHorizontal: 20, marginBottom: 20, padding: 14, gap: 12, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 },
  postJobIcon:        { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(234, 88, 12, 0.06)', alignItems: 'center', justifyContent: 'center' },
  postJobText:        { flex: 1 },
  postJobTitle:       { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  postJobSub:         { fontSize: 12, color: '#64748b', marginTop: 1 },
});
