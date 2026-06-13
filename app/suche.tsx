import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, Modal, Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { showAlert } from '../lib/alert';
import { activeCategories, CATEGORIES, MEISTERPFLICHT_IDS } from '../data/categories';
import { StarRow } from '../components/ui/StarRow';

const CATEGORY_CHIPS = [
  { id: 'alle', name: 'Alle' },
  ...activeCategories().map((c) => ({ id: c.id, name: c.name })),
];

type Worker = {
  id: string;
  name: string;
  trade: string;
  rating: number;
  reviews: number;
  distance: number;
  hourlyRate: number;
  verified: boolean;
  available: boolean;
  category: string;
  slots?: string[];
};

const ALL_WORKERS: Worker[] = [
  { id: '1', name: 'Marcus Berger',  trade: 'Elektriker',         rating: 4.9, reviews: 87,  distance: 1.2, hourlyRate: 65, verified: true,  available: true,  category: 'elektro',          slots: ['09:00', '14:00'] },
  { id: '2', name: 'Yilmaz GmbH',   trade: 'Sanitär & Heizung',  rating: 4.7, reviews: 134, distance: 2.4, hourlyRate: 80, verified: true,  available: true,  category: 'heizung-sanitaer', slots: ['10:00', '15:00'] },
  { id: '3', name: 'Stefan Koch',   trade: 'Maler & Lackierer',   rating: 4.8, reviews: 52,  distance: 3.1, hourlyRate: 45, verified: true,  available: true,  category: 'maler',            slots: ['08:00', '13:00'] },
  { id: '4', name: 'Peter Hahn',    trade: 'Fliesenleger',        rating: 4.5, reviews: 29,  distance: 4.8, hourlyRate: 55, verified: true,  available: false, category: 'fliesen' },
  { id: '5', name: 'Lena M.',       trade: 'Nachhilfe',           rating: 4.9, reviews: 28,  distance: 0.8, hourlyRate: 15, verified: true,  available: true,  category: 'nachhilfe',        slots: ['11:00', '16:00'] },
  { id: '6', name: 'Sara H.',       trade: 'IT-Support',          rating: 4.8, reviews: 31,  distance: 1.5, hourlyRate: 18, verified: false, available: false, category: 'it-support' },
  { id: '7', name: 'Rolf Brauer',   trade: 'Renovierung',         rating: 4.6, reviews: 64,  distance: 5.2, hourlyRate: 70, verified: true,  available: true,  category: 'renovierung',      slots: ['09:00', '14:00'] },
  { id: '8', name: 'Tim K.',        trade: 'Gartenpflege',        rating: 4.7, reviews: 14,  distance: 2.2, hourlyRate: 13, verified: false, available: true,  category: 'garten',           slots: ['10:00'] },
];

type Filters = {
  category: string;
  maxDistance: number;
  minRating: number;
  maxRate: string;
  verifiedOnly: boolean;
};

const DEFAULT_FILTERS: Filters = {
  category: 'alle',
  maxDistance: 25,
  minRating: 0,
  maxRate: '',
  verifiedOnly: false,
};

export default function SucheScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<Filters>(DEFAULT_FILTERS);

  const results = ALL_WORKERS.filter((w) => {
    if (filters.category !== 'alle' && w.category !== filters.category) return false;
    if (w.distance > filters.maxDistance) return false;
    if (w.rating < filters.minRating) return false;
    if (filters.maxRate && w.hourlyRate > Number(filters.maxRate)) return false;
    if (filters.verifiedOnly && !w.verified) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      if (!w.name.toLowerCase().includes(q) && !w.trade.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  function openDrawer() {
    setDraftFilters({ ...filters });
    setDrawerOpen(true);
  }

  function applyFilters() {
    setFilters({ ...draftFilters });
    setDrawerOpen(false);
  }

  function resetFilters() {
    setDraftFilters({ ...DEFAULT_FILTERS });
  }

  function handleSort() {
    showAlert(
      'Sortieren',
      'Handwerker sortieren nach:',
      [
        { text: 'Entfernung', onPress: () => {} },
        { text: 'Bewertung', onPress: () => {} },
        { text: 'Preis', onPress: () => {} },
        { text: 'Abbrechen', style: 'cancel' },
      ]
    );
  }

  const hasActiveFilters =
    filters.category !== 'alle' ||
    filters.maxDistance < 25 ||
    filters.minRating > 0 ||
    filters.maxRate !== '' ||
    filters.verifiedOnly;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={C.muted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Handwerker, Tätigkeit …"
            placeholderTextColor={C.muted}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={C.muted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, hasActiveFilters && styles.filterBtnActive]}
          onPress={openDrawer}
          activeOpacity={0.8}
        >
          <Ionicons name="options-outline" size={20} color={hasActiveFilters ? C.surface : C.ink} />
          {hasActiveFilters && <View style={styles.filterDot} />}
        </TouchableOpacity>
      </View>

      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {CATEGORY_CHIPS.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.chip, filters.category === cat.id && styles.chipActive]}
            onPress={() => setFilters((f) => ({ ...f, category: cat.id }))}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, filters.category === cat.id && styles.chipTextActive]}>
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Map hint + results bar */}
      <View style={styles.mapBar}>
        <View style={styles.mapBarLeft}>
          <Ionicons name="location-outline" size={14} color={C.sub} />
          <Text style={styles.mapBarLocation}>Köln & Umgebung</Text>
        </View>
        <TouchableOpacity
          style={styles.mapBarBtn}
          onPress={() => showAlert('Karte', 'Kartenansicht kommt in der nächsten Version.')}
          activeOpacity={0.8}
        >
          <Ionicons name="map-outline" size={14} color={C.sub} />
          <Text style={styles.mapBarBtnText}>Karte</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.resultsBar}>
        <Text style={styles.resultsText}>
          {results.length} {results.length === 1 ? 'Handwerker' : 'Handwerker'} gefunden
          {query.trim() ? ` für „${query}"` : ''}
        </Text>
        <TouchableOpacity style={styles.sortBtn} onPress={handleSort} activeOpacity={0.8}>
          <Ionicons name="swap-vertical-outline" size={14} color={C.sub} />
          <Text style={styles.sortBtnText}>Sortieren</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
        {results.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="search-outline" size={40} color={C.border} />
            </View>
            <Text style={styles.emptyTitle}>Keine Ergebnisse</Text>
            <Text style={styles.emptyText}>
              Versuchen Sie einen anderen Suchbegriff oder passen Sie die Filter an.
            </Text>
            <TouchableOpacity
              style={styles.emptyResetBtn}
              onPress={() => { setQuery(''); setFilters(DEFAULT_FILTERS); }}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyResetText}>Filter zurücksetzen</Text>
            </TouchableOpacity>
          </View>
        ) : (
          results.map((worker) => (
            <TouchableOpacity
              key={worker.id}
              style={[styles.workerCard, !worker.available && styles.workerCardUnavailable]}
              onPress={() => router.push({ pathname: '/anbieter', params: { id: worker.id } })}
              activeOpacity={0.8}
            >
              {/* Top row */}
              <View style={styles.cardTop}>
                <View style={styles.avatarWrap}>
                  <View style={[styles.avatar, !worker.verified && styles.avatarGray]}>
                    <Text style={[styles.avatarText, !worker.verified && styles.avatarTextGray]}>
                      {worker.name.charAt(0)}
                    </Text>
                  </View>
                  <View style={[styles.availDot, { backgroundColor: worker.available ? C.green : C.muted }]} />
                </View>

                <View style={styles.workerInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.workerName}>{worker.name}</Text>
                    {worker.verified && (
                      <Ionicons name="checkmark-circle" size={15} color={C.gold} />
                    )}
                    {MEISTERPFLICHT_IDS.has(worker.category) && worker.verified && (
                      <View style={styles.meisterBadge}>
                        <Text style={styles.meisterBadgeText}>Meister</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.workerTrade}>{worker.trade}</Text>
                  <View style={styles.metaRow}>
                    <StarRow rating={worker.rating} size={12} gap={2} useHalfStars={false} />
                    <Text style={styles.metaText}>{worker.rating} ({worker.reviews})</Text>
                    <View style={styles.metaDot} />
                    <Ionicons name="location-outline" size={11} color={C.muted} />
                    <Text style={styles.metaText}>{worker.distance} km</Text>
                  </View>
                </View>
              </View>

              {/* Bottom row */}
              <View style={styles.cardBottom}>
                <View style={styles.cardBottomLeft}>
                  <Text style={styles.workerRate}>ab €{worker.hourlyRate}/h</Text>
                  {worker.available && worker.slots && worker.slots.length > 0 ? (
                    <View style={styles.slotsRow}>
                      <View style={styles.availIndicator}>
                        <View style={styles.availDotSmall} />
                        <Text style={styles.availText}>Heute verfügbar</Text>
                      </View>
                      {worker.slots.slice(0, 2).map((slot) => (
                        <View key={slot} style={styles.slotChip}>
                          <Text style={styles.slotText}>{slot}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.availIndicator}>
                      <View style={[styles.availDotSmall, { backgroundColor: C.muted }]} />
                      <Text style={[styles.availText, { color: C.muted }]}>Derzeit nicht verfügbar</Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.anfragenBtn, !worker.available && styles.anfragenBtnDisabled]}
                  onPress={(e) => { e.stopPropagation(); router.push('/chat'); }}
                  activeOpacity={0.8}
                  disabled={!worker.available}
                >
                  <Text style={[styles.anfragenBtnText, !worker.available && styles.anfragenBtnTextDisabled]}>
                    Anfragen
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={13}
                    color={worker.available ? C.surface : C.muted}
                  />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Filter Drawer */}
      <Modal
        visible={drawerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDrawerOpen(false)}
      >
        <Pressable style={styles.drawerOverlay} onPress={() => setDrawerOpen(false)}>
          <Pressable style={styles.drawerSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.drawerHandle} />
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>Filter</Text>
              <TouchableOpacity onPress={resetFilters}>
                <Text style={styles.drawerReset}>Zurücksetzen</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.drawerSectionLabel}>Kategorie</Text>
              <View style={styles.drawerChips}>
                {CATEGORY_CHIPS.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.drawerChip, draftFilters.category === cat.id && styles.drawerChipActive]}
                    onPress={() => setDraftFilters((f) => ({ ...f, category: cat.id }))}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.drawerChipText, draftFilters.category === cat.id && styles.drawerChipTextActive]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.drawerSectionLabel}>Max. Entfernung: {draftFilters.maxDistance} km</Text>
              <View style={styles.sliderRow}>
                {[1, 2, 5, 10, 15, 25].map((km) => (
                  <TouchableOpacity
                    key={km}
                    style={[styles.sliderBtn, draftFilters.maxDistance === km && styles.sliderBtnActive]}
                    onPress={() => setDraftFilters((f) => ({ ...f, maxDistance: km }))}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.sliderBtnText, draftFilters.maxDistance === km && styles.sliderBtnTextActive]}>
                      {km} km
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.drawerSectionLabel}>Mindestbewertung</Text>
              <View style={styles.sliderRow}>
                {[0, 3, 4, 4.5, 4.8].map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.sliderBtn, draftFilters.minRating === r && styles.sliderBtnActive]}
                    onPress={() => setDraftFilters((f) => ({ ...f, minRating: r }))}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.sliderBtnText, draftFilters.minRating === r && styles.sliderBtnTextActive]}>
                      {r === 0 ? 'Alle' : `${r}★`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.drawerSectionLabel}>Max. Stundensatz (€)</Text>
              <View style={styles.rateInputWrap}>
                <Ionicons name="cash-outline" size={18} color={C.muted} />
                <TextInput
                  style={styles.rateInput}
                  value={draftFilters.maxRate}
                  onChangeText={(v) => setDraftFilters((f) => ({ ...f, maxRate: v.replace(/\D/g, '') }))}
                  placeholder="z.B. 80"
                  placeholderTextColor={C.muted}
                  keyboardType="numeric"
                />
                {draftFilters.maxRate.length > 0 && (
                  <Text style={styles.rateUnit}>/h</Text>
                )}
              </View>

              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setDraftFilters((f) => ({ ...f, verifiedOnly: !f.verifiedOnly }))}
                activeOpacity={0.8}
              >
                <View>
                  <Text style={styles.toggleLabel}>Nur verifizierte Anbieter</Text>
                  <Text style={styles.toggleSub}>Mit Gewerbeschein & ID-Prüfung</Text>
                </View>
                <View style={[styles.toggle, draftFilters.verifiedOnly && styles.toggleActive]}>
                  <View style={[styles.toggleThumb, draftFilters.verifiedOnly && styles.toggleThumbActive]} />
                </View>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.drawerCta}>
              <TouchableOpacity style={styles.drawerApplyBtn} onPress={applyFilters} activeOpacity={0.85}>
                <Text style={styles.drawerApplyText}>Filter anwenden</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:             { flex: 1, backgroundColor: C.bg },
  header:                { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  backBtn:               { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  searchBar:             { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput:           { flex: 1, fontSize: 15, color: C.ink },
  filterBtn:             { width: 40, height: 40, borderRadius: 10, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  filterBtnActive:       { backgroundColor: C.ink, borderColor: C.ink },
  filterDot:             { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: C.gold },
  chipsRow:              { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  chip:                  { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  chipActive:            { backgroundColor: C.goldBg, borderColor: C.gold, borderWidth: 1.5 },
  chipText:              { fontSize: 13, color: C.sub, fontWeight: '500' },
  chipTextActive:        { color: C.gold, fontWeight: '700' },
  mapBar:                { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginBottom: 8, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  mapBarLeft:            { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mapBarLocation:        { fontSize: 13, color: C.sub, fontWeight: '500' },
  mapBarBtn:             { flexDirection: 'row', alignItems: 'center', gap: 4 },
  mapBarBtnText:         { fontSize: 13, color: C.sub, fontWeight: '600' },
  resultsBar:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  resultsText:           { fontSize: 12, color: C.muted, fontWeight: '500' },
  sortBtn:               { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sortBtnText:           { fontSize: 12, color: C.sub, fontWeight: '600' },
  listContent:           { paddingHorizontal: 16, paddingBottom: 32, gap: 10 },
  workerCard:            { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  workerCardUnavailable: { opacity: 0.65 },
  cardTop:               { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  avatarWrap:            { position: 'relative', marginRight: 12 },
  avatar:                { width: 50, height: 50, borderRadius: 25, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center' },
  avatarGray:            { backgroundColor: '#EBEBEB' },
  avatarText:            { fontSize: 20, fontWeight: '700', color: C.gold },
  avatarTextGray:        { color: C.muted },
  availDot:              { position: 'absolute', bottom: 1, right: 1, width: 13, height: 13, borderRadius: 6.5, borderWidth: 2, borderColor: C.surface },
  workerInfo:            { flex: 1 },
  nameRow:               { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2, flexWrap: 'wrap' },
  workerName:            { fontSize: 15, fontWeight: '700', color: C.ink },
  meisterBadge:          { backgroundColor: C.goldBg, borderWidth: 1, borderColor: '#E0C96A', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  meisterBadgeText:      { fontSize: 10, fontWeight: '700', color: C.gold, letterSpacing: 0.3 },
  workerTrade:           { fontSize: 12, color: C.sub, marginBottom: 6 },
  metaRow:               { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaDot:               { width: 3, height: 3, borderRadius: 1.5, backgroundColor: C.border },
  metaText:              { fontSize: 11, color: C.muted },
  cardBottom:            { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 },
  cardBottomLeft:        { flex: 1, gap: 6 },
  workerRate:            { fontSize: 14, fontWeight: '800', color: C.ink },
  slotsRow:              { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  availIndicator:        { flexDirection: 'row', alignItems: 'center', gap: 5 },
  availDotSmall:         { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.green },
  availText:             { fontSize: 11, color: C.green, fontWeight: '500' },
  slotChip:              { backgroundColor: C.greenBg, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
  slotText:              { fontSize: 11, color: C.green, fontWeight: '600' },
  anfragenBtn:           { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.ink, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  anfragenBtnDisabled:   { backgroundColor: C.border },
  anfragenBtnText:       { fontSize: 13, fontWeight: '700', color: C.surface },
  anfragenBtnTextDisabled: { color: C.muted },
  emptyState:            { alignItems: 'center', paddingTop: 72, paddingHorizontal: 40 },
  emptyIcon:             { width: 80, height: 80, borderRadius: 40, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle:            { fontSize: 20, fontWeight: '700', color: C.ink, marginBottom: 10 },
  emptyText:             { fontSize: 14, color: C.sub, textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  emptyResetBtn:         { backgroundColor: C.ink, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  emptyResetText:        { fontSize: 14, fontWeight: '700', color: C.surface },
  drawerOverlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  drawerSheet:           { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, maxHeight: '85%' },
  drawerHandle:          { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 16 },
  drawerHeader:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  drawerTitle:           { fontSize: 18, fontWeight: '800', color: C.ink },
  drawerReset:           { fontSize: 14, color: C.muted, fontWeight: '500' },
  drawerSectionLabel:    { fontSize: 12, fontWeight: '700', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 20, marginTop: 20, marginBottom: 10 },
  drawerChips:           { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 },
  drawerChip:            { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  drawerChipActive:      { backgroundColor: C.ink, borderColor: C.ink },
  drawerChipText:        { fontSize: 13, color: C.sub, fontWeight: '500' },
  drawerChipTextActive:  { color: C.surface, fontWeight: '700' },
  sliderRow:             { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 },
  sliderBtn:             { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  sliderBtnActive:       { backgroundColor: C.ink, borderColor: C.ink },
  sliderBtnText:         { fontSize: 13, color: C.sub, fontWeight: '500' },
  sliderBtnTextActive:   { color: C.surface, fontWeight: '700' },
  rateInputWrap:         { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  rateInput:             { flex: 1, fontSize: 16, color: C.ink, fontWeight: '600' },
  rateUnit:              { fontSize: 14, color: C.muted },
  toggleRow:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 20, marginTop: 20, marginBottom: 8, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 16 },
  toggleLabel:           { fontSize: 14, fontWeight: '700', color: C.ink, marginBottom: 2 },
  toggleSub:             { fontSize: 12, color: C.muted },
  toggle:                { width: 48, height: 28, borderRadius: 14, backgroundColor: C.border, justifyContent: 'center', paddingHorizontal: 2 },
  toggleActive:          { backgroundColor: C.green },
  toggleThumb:           { width: 24, height: 24, borderRadius: 12, backgroundColor: C.surface },
  toggleThumbActive:     { transform: [{ translateX: 20 }] },
  drawerCta:             { padding: 20, borderTopWidth: 1, borderTopColor: C.border },
  drawerApplyBtn:        { backgroundColor: C.ink, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  drawerApplyText:       { fontSize: 16, fontWeight: '700', color: C.surface },
});
