import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { Badge } from '../components/ui/Badge';
import { StarRating } from '../components/ui/StarRating';

type SavedProvider = {
  id: string;
  name: string;
  trade: string;
  rating: number;
  reviews: number;
  price: string;
  distance: string;
  available: boolean;
  verified: boolean;
  lastBooked?: string;
  initial: string;
  totalJobs: number;
};

const SAVED: SavedProvider[] = [
  {
    id: '1',
    name: 'Yilmaz GmbH',
    trade: 'Sanitär & Heizung',
    rating: 4.7,
    reviews: 134,
    price: 'ab €80/h',
    distance: '2.4 km',
    available: true,
    verified: true,
    lastBooked: 'vor 3 Wochen',
    initial: 'Y',
    totalJobs: 3,
  },
  {
    id: '2',
    name: 'Marcus Berger',
    trade: 'Elektriker',
    rating: 4.9,
    reviews: 87,
    price: 'ab €65/h',
    distance: '1.2 km',
    available: true,
    verified: true,
    lastBooked: 'vor 2 Monaten',
    initial: 'M',
    totalJobs: 5,
  },
  {
    id: '3',
    name: 'Lena M.',
    trade: 'Nachhilfe · Mathe & Physik',
    rating: 4.9,
    reviews: 28,
    price: 'ab €15/h',
    distance: '0.8 km',
    available: false,
    verified: true,
    lastBooked: 'letzte Woche',
    initial: 'L',
    totalJobs: 8,
  },
  {
    id: '4',
    name: 'Stefan Koch',
    trade: 'Maler & Lackierer',
    rating: 4.8,
    reviews: 52,
    price: 'ab €45/h',
    distance: '3.1 km',
    available: true,
    verified: true,
    lastBooked: 'vor 1 Monat',
    initial: 'S',
    totalJobs: 2,
  },
];

export default function MeineAnbieterScreen() {
  const router = useRouter();
  const [saved, setSaved] = useState(SAVED);

  function removeProvider(id: string) {
    setSaved((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Meine Anbieter</Text>
          <Text style={styles.headerSub}>{saved.length} gespeicherte Profis</Text>
        </View>
        <TouchableOpacity
          style={styles.searchBtn}
          onPress={() => router.push('/suche')}
          activeOpacity={0.8}
        >
          <Ionicons name="search-outline" size={20} color={C.ink} />
        </TouchableOpacity>
      </View>

      {saved.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="heart-outline" size={40} color={C.border} />
          </View>
          <Text style={styles.emptyTitle}>Noch keine Anbieter gespeichert</Text>
          <Text style={styles.emptyText}>
            Speichern Sie Ihre Lieblingshandwerker für schnellen Zugriff und Wiederbuchung.
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => router.push('/suche')}
            activeOpacity={0.85}
          >
            <Ionicons name="search-outline" size={16} color={C.surface} />
            <Text style={styles.emptyBtnText}>Handwerker finden</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Sort hint */}
          <Text style={styles.sortHint}>Sortiert nach letzter Buchung</Text>

          {saved.map((p) => (
            <View key={p.id} style={styles.card}>
              {/* Top row */}
              <View style={styles.cardTop}>
                <View style={styles.avatarWrap}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{p.initial}</Text>
                  </View>
                  <View style={[styles.availDot, { backgroundColor: p.available ? C.green : C.muted }]} />
                </View>

                <View style={styles.cardInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.provName}>{p.name}</Text>
                    {p.verified && (
                      <Ionicons name="checkmark-circle" size={14} color={C.gold} />
                    )}
                  </View>
                  <Text style={styles.provTrade}>{p.trade}</Text>
                  <StarRating rating={p.rating} count={p.reviews} />
                </View>

                <TouchableOpacity
                  style={styles.heartBtn}
                  onPress={() => removeProvider(p.id)}
                  hitSlop={10}
                  activeOpacity={0.7}
                >
                  <Ionicons name="heart" size={20} color={C.red} />
                </TouchableOpacity>
              </View>

              {/* Meta row */}
              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Ionicons name="cash-outline" size={13} color={C.muted} />
                  <Text style={styles.metaText}>{p.price}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="location-outline" size={13} color={C.muted} />
                  <Text style={styles.metaText}>{p.distance}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="briefcase-outline" size={13} color={C.muted} />
                  <Text style={styles.metaText}>{p.totalJobs}× gebucht</Text>
                </View>
              </View>

              {/* Last booked */}
              {p.lastBooked && (
                <View style={styles.lastBookedRow}>
                  <Ionicons name="time-outline" size={12} color={C.muted} />
                  <Text style={styles.lastBookedText}>Zuletzt gebucht: {p.lastBooked}</Text>
                </View>
              )}

              {/* Actions */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.actionChat}
                  onPress={() => router.push('/chat')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chatbubble-outline" size={15} color={C.sub} />
                  <Text style={styles.actionChatText}>Anfrage</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.actionBook,
                    !p.available && styles.actionBookDisabled,
                  ]}
                  onPress={() => p.available && router.push('/profil')}
                  activeOpacity={p.available ? 0.85 : 1}
                  disabled={!p.available}
                >
                  {p.available ? (
                    <>
                      <Ionicons name="refresh" size={15} color={C.surface} />
                      <Text style={styles.actionBookText}>Wieder buchen</Text>
                    </>
                  ) : (
                    <Text style={styles.actionBookDisabledText}>Aktuell ausgebucht</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* Discover more */}
          <TouchableOpacity
            style={styles.discoverBtn}
            onPress={() => router.push('/suche')}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={20} color={C.ink} />
            <Text style={styles.discoverBtnText}>Mehr Anbieter entdecken</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: C.bg },
  header:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  backBtn:            { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:        { fontSize: 18, fontWeight: '800', color: C.ink },
  headerSub:          { fontSize: 12, color: C.sub, marginTop: 1 },
  searchBtn:          { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  scroll:             { paddingHorizontal: 16, paddingBottom: 48 },
  sortHint:           { fontSize: 11, color: C.muted, marginBottom: 12, marginTop: 4 },
  card:               { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 12 },
  cardTop:            { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  avatarWrap:         { position: 'relative', marginRight: 12 },
  avatar:             { width: 50, height: 50, borderRadius: 25, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center' },
  avatarText:         { fontSize: 20, fontWeight: '700', color: C.gold },
  availDot:           { position: 'absolute', bottom: 0, right: 0, width: 13, height: 13, borderRadius: 6.5, borderWidth: 2, borderColor: C.surface },
  cardInfo:           { flex: 1 },
  nameRow:            { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  provName:           { fontSize: 14, fontWeight: '700', color: C.ink },
  provTrade:          { fontSize: 12, color: C.sub, marginBottom: 5 },
  heartBtn:           { padding: 4 },
  metaRow:            { flexDirection: 'row', gap: 16, marginBottom: 8, flexWrap: 'wrap' },
  metaItem:           { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:           { fontSize: 12, color: C.sub },
  lastBookedRow:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 10, alignSelf: 'flex-start' },
  lastBookedText:     { fontSize: 11, color: C.muted },
  actions:            { flexDirection: 'row', gap: 10 },
  actionChat:         { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 9, paddingHorizontal: 14, paddingVertical: 9 },
  actionChatText:     { fontSize: 13, color: C.sub, fontWeight: '500' },
  actionBook:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.ink, borderRadius: 9, paddingVertical: 9 },
  actionBookDisabled: { backgroundColor: '#E8E7E3' },
  actionBookText:     { fontSize: 13, fontWeight: '700', color: C.surface },
  actionBookDisabledText: { fontSize: 13, color: C.muted },
  discoverBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border, borderStyle: 'dashed', borderRadius: 12, padding: 16, marginTop: 4 },
  discoverBtnText:    { fontSize: 14, fontWeight: '600', color: C.ink },
  emptyState:         { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon:          { width: 80, height: 80, borderRadius: 40, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle:         { fontSize: 20, fontWeight: '700', color: C.ink, marginBottom: 10 },
  emptyText:          { fontSize: 14, color: C.sub, textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  emptyBtn:           { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.ink, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText:       { fontSize: 14, fontWeight: '700', color: C.surface },
});
