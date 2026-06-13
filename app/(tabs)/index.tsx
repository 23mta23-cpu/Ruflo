import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/colors';
import { Badge } from '../../components/ui/Badge';
import { StarRating } from '../../components/ui/StarRating';
import { activeCategories } from '../../data/categories';

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

// Stammkunden — repeat providers
const STAMMKUNDEN = [
  { id: '1', name: 'Marcus Berger', trade: 'Elektriker',    lastJob: 'vor 3 Wochen', rating: 4.9, initial: 'M' },
  { id: '2', name: 'Yilmaz GmbH',  trade: 'Sanitär',       lastJob: 'vor 6 Wochen', rating: 4.7, initial: 'Y' },
  { id: '3', name: 'Stefan Koch',  trade: 'Maler',         lastJob: 'vor 2 Monaten', rating: 4.8, initial: 'S' },
  { id: '4', name: 'Lena M.',      trade: 'Nachhilfe',      lastJob: 'letzte Woche',  rating: 4.9, initial: 'L' },
];

// New providers nearby
const NEU_IN_DER_NAEHE = [
  { id: 'n1', name: 'Rolf Brauer',  trade: 'Renovierung',  rating: 4.6, reviews: 12, price: 'ab €70/h', distance: '1.8 km', verified: true },
  { id: 'n2', name: 'Mia B.',       trade: 'Reinigung',    rating: 4.7, reviews: 8,  price: 'ab €14/h', distance: '0.9 km', verified: false },
  { id: 'n3', name: 'Tom Fischer',  trade: 'Tischler',     rating: 4.5, reviews: 19, price: 'ab €60/h', distance: '2.4 km', verified: true },
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
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.bellBtn}
              onPress={() => router.push('/nachrichten')}
            >
              <Ionicons name="chatbubble-outline" size={23} color={C.ink} />
              <View style={styles.bellDot} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bellBtn}
              onPress={() => router.push('/benachrichtigungen')}
            >
              <Ionicons name="notifications-outline" size={23} color={C.ink} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.profileBtn}
              onPress={() => router.push('/(tabs)/konto')}
            >
              <Ionicons name="person-circle-outline" size={28} color={C.ink} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar — routes to /suche */}
        <TouchableOpacity
          style={styles.searchBar}
          activeOpacity={0.7}
          onPress={() => router.push('/suche')}
        >
          <Ionicons name="search-outline" size={18} color={C.muted} />
          <Text style={styles.searchPlaceholder}>Was suchen Sie? Handwerker, Nachhilfe…</Text>
          <View style={styles.searchFilter}>
            <Ionicons name="options-outline" size={16} color={C.sub} />
          </View>
        </TouchableOpacity>

        {/* Post a Job CTA */}
        <TouchableOpacity
          style={styles.postJobBanner}
          onPress={() => router.push('/auftrag-aufgeben')}
          activeOpacity={0.85}
        >
          <View style={styles.postJobIcon}>
            <Ionicons name="add-circle" size={22} color={C.gold} />
          </View>
          <View style={styles.postJobText}>
            <Text style={styles.postJobTitle}>Auftrag aufgeben</Text>
            <Text style={styles.postJobSub}>Angebote von Profis erhalten</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.gold} />
        </TouchableOpacity>

        {/* Main Tiles */}
        <View style={styles.tilesRow}>
          <TouchableOpacity
            style={[styles.tile, styles.tileHandwerk]}
            onPress={() => router.push('/suche')}
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
            <TouchableOpacity
              key={cat.label}
              style={styles.categoryChip}
              onPress={() => router.push('/suche')}
              activeOpacity={0.7}
            >
              <Ionicons name={cat.icon as any} size={18} color={C.ink} />
              <Text style={styles.categoryLabel}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Stammkunden — Horizontal scroll */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Stammkunden</Text>
          <Text style={styles.sectionLink}>Alle</Text>
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
              onPress={() => router.push('/profil')}
              activeOpacity={0.8}
            >
              <View style={styles.stammkundeAvatar}>
                <Text style={styles.stammkundeAvatarText}>{sk.initial}</Text>
              </View>
              <Text style={styles.stammkundeName} numberOfLines={1}>{sk.name}</Text>
              <Text style={styles.stammkundeTrade} numberOfLines={1}>{sk.trade}</Text>
              <View style={styles.stammkundeStars}>
                <Ionicons name="star" size={11} color={C.gold} />
                <Text style={styles.stammkundeRating}>{sk.rating}</Text>
              </View>
              <Text style={styles.stammkundeLastJob}>{sk.lastJob}</Text>
              <TouchableOpacity
                style={styles.wiederBuchenBtn}
                onPress={() => router.push('/profil')}
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

        {/* Neu in deiner Nähe */}
        <View style={[styles.sectionHeader, { marginTop: 8 }]}>
          <Text style={styles.sectionTitle}>Neu in deiner Nähe</Text>
          <Badge label="Neu" variant="amber" />
        </View>

        {NEU_IN_DER_NAEHE.map((worker) => (
          <TouchableOpacity
            key={worker.id}
            style={styles.newWorkerCard}
            onPress={() => router.push('/profil')}
            activeOpacity={0.8}
          >
            <View style={[styles.workerAvatar, { backgroundColor: '#F0EFEB' }]}>
              <Text style={[styles.avatarText, { color: C.sub }]}>{worker.name.charAt(0)}</Text>
            </View>
            <View style={styles.workerInfo}>
              <View style={styles.workerNameRow}>
                <Text style={styles.workerName}>{worker.name}</Text>
                {worker.verified && (
                  <Ionicons name="checkmark-circle" size={14} color={C.gold} style={{ marginLeft: 4 }} />
                )}
              </View>
              <Text style={styles.workerTrade}>{worker.trade}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Ionicons name="star" size={12} color={C.gold} />
                  <Text style={{ fontSize: 12, color: C.sub }}>{worker.rating} ({worker.reviews})</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Ionicons name="location-outline" size={12} color={C.muted} />
                  <Text style={{ fontSize: 12, color: C.muted }}>{worker.distance}</Text>
                </View>
              </View>
            </View>
            <View style={styles.workerRight}>
              <Text style={styles.workerPrice}>{worker.price}</Text>
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>NEU</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.muted} style={{ marginTop: 6 }} />
            </View>
          </TouchableOpacity>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: C.bg },
  header:             { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  logo:               { fontSize: 22, fontWeight: '800', color: C.ink, letterSpacing: 1.5 },
  subtitle:           { fontSize: 12, color: C.sub, marginTop: 1 },
  headerRight:        { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bellBtn:            { padding: 4, position: 'relative' },
  bellDot:            { position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: C.red, borderWidth: 1.5, borderColor: C.bg },
  profileBtn:         { padding: 4 },
  searchBar:          { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginBottom: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13 },
  searchPlaceholder:  { flex: 1, color: C.muted, fontSize: 14 },
  searchFilter:       { width: 28, height: 28, borderRadius: 7, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  tilesRow:           { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginBottom: 24 },
  tile:               { flex: 1, backgroundColor: C.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border },
  tileHandwerk:       { borderTopColor: C.gold, borderTopWidth: 2 },
  tileNachbar:        { borderTopColor: C.green, borderTopWidth: 2 },
  tileIcon:           { width: 44, height: 44, borderRadius: 10, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  tileTitle:          { fontSize: 15, fontWeight: '700', color: C.ink, marginBottom: 2 },
  tileSub:            { fontSize: 12, color: C.sub, marginBottom: 12 },
  tileArrow:          { width: 28, height: 28, borderRadius: 8, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center' },
  sectionTitle:       { fontSize: 17, fontWeight: '700', color: C.ink, paddingHorizontal: 20, marginBottom: 12 },
  sectionHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 },
  sectionLink:        { fontSize: 13, color: C.sub, fontWeight: '500' },
  categoriesRow:      { paddingLeft: 20, paddingRight: 8, gap: 8, marginBottom: 20 },
  categoryChip:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, marginRight: 4 },
  categoryLabel:      { fontSize: 13, color: C.ink, fontWeight: '500' },
  // Stammkunden
  stammkundenRow:     { paddingLeft: 20, paddingRight: 8, gap: 12, marginBottom: 24 },
  stammkundeCard:     { width: 130, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, alignItems: 'center' },
  stammkundeAvatar:   { width: 50, height: 50, borderRadius: 25, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  stammkundeAvatarText: { fontSize: 20, fontWeight: '700', color: C.gold },
  stammkundeName:     { fontSize: 13, fontWeight: '700', color: C.ink, marginBottom: 2, textAlign: 'center' },
  stammkundeTrade:    { fontSize: 11, color: C.sub, marginBottom: 4, textAlign: 'center' },
  stammkundeStars:    { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 },
  stammkundeRating:   { fontSize: 11, color: C.sub, fontWeight: '600' },
  stammkundeLastJob:  { fontSize: 10, color: C.muted, marginBottom: 10, textAlign: 'center' },
  wiederBuchenBtn:    { backgroundColor: C.goldBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#E8D69A' },
  wiederBuchenText:   { fontSize: 11, fontWeight: '700', color: C.gold },
  // Worker cards
  workerCard:         { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, marginHorizontal: 20, marginBottom: 10, padding: 14 },
  newWorkerCard:      { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, marginHorizontal: 20, marginBottom: 10, padding: 14, borderLeftWidth: 3, borderLeftColor: C.amber },
  workerAvatar:       { width: 44, height: 44, borderRadius: 22, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText:         { fontSize: 18, fontWeight: '700', color: C.gold },
  workerInfo:         { flex: 1 },
  workerNameRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  workerName:         { fontSize: 14, fontWeight: '700', color: C.ink },
  workerTrade:        { fontSize: 12, color: C.sub, marginBottom: 4 },
  slotsRow:           { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  slotChip:           { backgroundColor: C.greenBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  slotText:           { fontSize: 11, color: C.green, fontWeight: '600' },
  workerRight:        { alignItems: 'flex-end' },
  workerPrice:        { fontSize: 13, fontWeight: '700', color: C.ink },
  responseTime:       { fontSize: 11, color: C.muted, marginTop: 2 },
  newBadge:           { backgroundColor: C.amberBg, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3, marginTop: 4 },
  newBadgeText:       { fontSize: 10, fontWeight: '700', color: C.amber, letterSpacing: 0.5 },
  // Post job banner
  postJobBanner:      { flexDirection: 'row', alignItems: 'center', backgroundColor: C.goldBg, borderRadius: 14, borderWidth: 1.5, borderColor: C.gold, marginHorizontal: 20, marginBottom: 16, padding: 14, gap: 12 },
  postJobIcon:        { width: 40, height: 40, borderRadius: 10, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  postJobText:        { flex: 1 },
  postJobTitle:       { fontSize: 14, fontWeight: '800', color: C.ink },
  postJobSub:         { fontSize: 12, color: C.sub, marginTop: 1 },
});
