import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, Modal, Pressable, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { T } from '../constants/typography';
import { activeCategories, categoryById } from '../data/categories';
import { supabase } from '../lib/supabase';
import { showAlert } from '../lib/alert';

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
  distance: number | null;
  hourlyRate: number;
  verified: boolean;
  available: boolean;
  category: string;
};

// Shown when Supabase returns 0 approved providers (beta / demo)
const DEMO_WORKERS: Worker[] = [
  { id: 'd1', name: 'Marcus Berger',  trade: 'Elektriker',         rating: 4.9, reviews: 87,  distance: 1.2, hourlyRate: 65, verified: true,  available: true,  category: 'elektro'          },
  { id: 'd2', name: 'Yilmaz GmbH',   trade: 'Sanitär & Heizung',  rating: 4.7, reviews: 134, distance: 2.4, hourlyRate: 80, verified: true,  available: true,  category: 'heizung-sanitaer' },
  { id: 'd3', name: 'Stefan Koch',   trade: 'Maler & Lackierer',   rating: 4.8, reviews: 52,  distance: 3.1, hourlyRate: 45, verified: true,  available: true,  category: 'maler'            },
  { id: 'd4', name: 'Peter Hahn',    trade: 'Fliesenleger',        rating: 4.5, reviews: 29,  distance: 4.8, hourlyRate: 55, verified: true,  available: false, category: 'fliesen'          },
  { id: 'd5', name: 'Rolf Brauer',   trade: 'Renovierung',         rating: 4.6, reviews: 64,  distance: 5.2, hourlyRate: 70, verified: true,  available: true,  category: 'renovierung'      },
];

type Filters = {
  category: string;  // category id or 'alle'
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

function StarRow({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Ionicons
          key={s}
          name={s <= Math.round(rating) ? 'star' : 'star-outline'}
          size={12}
          color={C.gold}
        />
      ))}
    </View>
  );
}

async function fetchProviders(): Promise<Worker[]> {
  const { data, error } = await supabase
    .from('provider_profiles')
    .select('id, bio, business_name, min_hourly_rate, category_ids, available, rating_avg, rating_count, stripe_onboarded, profiles!inner(display_name)')
    .eq('kyc_status', 'approved');

  if (error || !data || data.length === 0) return [];

  return data.map((row: any, i: number) => {
    const catIds: string[] = row.category_ids ?? [];
    const primaryCat = catIds[0] ?? '';
    const tradeParts = catIds.slice(0, 2).map((id) => categoryById(id)?.name).filter(Boolean);
    return {
      id: row.id,
      name: row.business_name || row.profiles?.display_name || 'Anbieter',
      trade: tradeParts.join(' & ') || row.bio?.slice(0, 40) || 'Dienstleistung',
      rating: row.rating_avg ?? 5.0,
      reviews: row.rating_count ?? 0,
      distance: null,
      hourlyRate: row.min_hourly_rate ?? 13,
      verified: row.stripe_onboarded === true,
      available: row.available ?? true,
      category: primaryCat,
    } satisfies Worker;
  });
}

export default function SucheScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [workers, setWorkers] = useState<Worker[]>(DEMO_WORKERS);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(true);

  const load = useCallback(async () => {
    setLoadingProviders(true);
    try {
      const live = await fetchProviders();
      if (live.length > 0) {
        setWorkers(live);
        setIsDemoMode(false);
      } else {
        setWorkers(DEMO_WORKERS);
        setIsDemoMode(true);
      }
    } catch {
      setWorkers(DEMO_WORKERS);
      setIsDemoMode(true);
    } finally {
      setLoadingProviders(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const results = workers.filter((w) => {
    if (filters.category !== 'alle' && w.category !== filters.category) return false;
    if (w.distance !== null && w.distance > filters.maxDistance) return false;
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

      {/* Results count */}
      <View style={styles.resultsBar}>
        <Text style={styles.resultsText}>
          {results.length} {results.length === 1 ? 'Ergebnis' : 'Ergebnisse'}
          {query.trim() ? ` für „${query}"` : ''}
        </Text>
      </View>

      {isDemoMode && !loadingProviders && (
        <View style={styles.demoBanner}>
          <Ionicons name="information-circle-outline" size={16} color={C.gold} />
          <Text style={styles.demoBannerText}>
            Vorschau — noch keine Anbieter in Ihrer Region. Wir benachrichtigen Sie, sobald Handwerker verfügbar sind.
          </Text>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {loadingProviders ? (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <ActivityIndicator color={C.primary} />
          </View>
        ) : results.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="search-outline" size={40} color={C.border} />
            </View>
            <Text style={styles.emptyTitle}>Keine Ergebnisse</Text>
            <Text style={styles.emptyText}>
              Versuchen Sie einen anderen Suchbegriff oder passen Sie die Filter an.
            </Text>
            <Text style={styles.emptySubText}>
              Erweitern Sie den Suchradius oder wählen Sie eine andere Kategorie
            </Text>
            <TouchableOpacity
              style={styles.emptyResetBtn}
              onPress={() => { setQuery(''); setFilters(DEFAULT_FILTERS); }}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyResetText}>Filter zurücksetzen</Text>
            </TouchableOpacity>
          </View>
        ) : results.map((worker) => (
            <TouchableOpacity
              key={worker.id}
              style={styles.workerCard}
              onPress={() => {
                if (isDemoMode) {
                  showAlert('Noch nicht verfügbar', 'Dies ist eine Vorschau. Wir suchen gerade Anbieter in Ihrer Region und benachrichtigen Sie, sobald jemand verfügbar ist.', [{ text: 'OK' }]);
                  return;
                }
                router.push({ pathname: '/anbieter', params: { id: worker.id } });
              }}
              activeOpacity={0.8}
            >
              <View style={styles.avatarWrap}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{worker.name.charAt(0)}</Text>
                </View>
                <View style={[styles.availDot, { backgroundColor: worker.available ? C.primary : C.muted }]} />
              </View>

              <View style={styles.workerInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.workerName}>{worker.name}</Text>
                  {worker.verified && (
                    <Ionicons name="checkmark-circle" size={15} color={C.gold} />
                  )}
                </View>
                <Text style={styles.workerTrade}>{worker.trade}</Text>
                <View style={styles.metaRow}>
                  <StarRow rating={worker.rating} />
                  <Text style={styles.metaText}>{worker.rating} ({worker.reviews})</Text>
                </View>
                {worker.distance !== null && (
                  <View style={styles.metaRow}>
                    <Ionicons name="location-outline" size={12} color={C.muted} />
                    <Text style={styles.metaText}>{worker.distance} km entfernt</Text>
                  </View>
                )}
              </View>

              <View style={styles.workerRight}>
                <Text style={styles.workerRate}>ab €{worker.hourlyRate}/h</Text>
                <View style={[styles.statusBadge, { backgroundColor: worker.available ? C.primaryBg : C.bgWarm }]}>
                  <Text style={[styles.statusBadgeText, { color: worker.available ? C.primary : C.muted }]}>
                    {worker.available ? 'Verfügbar' : 'Belegt'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={C.muted} style={{ marginTop: 6 }} />
              </View>
            </TouchableOpacity>
          ))
        }
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
              {/* Category */}
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

              {/* Distance slider (visual only — tap buttons) */}
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

              {/* Min rating */}
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
                      {r === 0 ? 'Alle' : `ab ${r}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Max hourly rate */}
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

              {/* Verified only toggle */}
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
  container:          { flex: 1, backgroundColor: C.bg },
  demoBanner:         { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginHorizontal: 16, marginBottom: 12, backgroundColor: C.goldBg, borderRadius: 10, padding: 12 },
  demoBannerText:     { flex: 1, fontSize: 12, color: C.sub, lineHeight: 17 },
  header:             { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  backBtn:            { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  searchBar:          { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput:        { flex: 1, fontSize: 15, color: C.ink },
  filterBtn:          { width: 40, height: 40, borderRadius: 10, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  filterBtnActive:    { backgroundColor: C.primary, borderColor: C.primary },
  filterDot:          { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: C.gold },
  chipsRow:           { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  chip:               { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  chipActive:         { backgroundColor: C.primary, borderColor: C.primary },
  chipText:           { fontSize: 13, color: C.sub, fontWeight: '500' },
  chipTextActive:     { color: C.surface, fontWeight: '700' },
  resultsBar:         { paddingHorizontal: 20, paddingBottom: 8 },
  resultsText:        { fontSize: 12, color: C.muted, fontWeight: '500' },
  workerCard:         { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, marginHorizontal: 16, marginBottom: 10, padding: 14, shadowColor: C.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  avatarWrap:         { position: 'relative', marginRight: 12 },
  avatar:             { width: 48, height: 48, borderRadius: 24, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center' },
  avatarText:         { fontSize: 20, fontWeight: '700', color: C.gold },
  availDot:           { position: 'absolute', bottom: 0, right: 0, width: 13, height: 13, borderRadius: 6.5, borderWidth: 2, borderColor: C.surface },
  workerInfo:         { flex: 1 },
  nameRow:            { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  workerName:         { ...T.body, fontWeight: '700', color: C.ink },
  workerTrade:        { ...T.caption, fontSize: 12, color: C.sub, marginBottom: 6 },
  metaRow:            { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  metaText:           { ...T.caption, color: C.muted },
  workerRight:        { alignItems: 'flex-end' },
  workerRate:         { fontSize: 13, fontWeight: '700', color: C.ink, marginBottom: 6 },
  statusBadge:        { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeText:    { fontSize: 11, fontWeight: '600' },
  emptyState:         { alignItems: 'center', paddingTop: 72, paddingHorizontal: 40 },
  emptyIcon:          { width: 80, height: 80, borderRadius: 40, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle:         { fontSize: 20, fontWeight: '700', color: C.ink, marginBottom: 10 },
  emptyText:          { fontSize: 14, color: C.sub, textAlign: 'center', lineHeight: 21, marginBottom: 8 },
  emptySubText:       { fontSize: 12, color: C.muted, textAlign: 'center', lineHeight: 18, marginBottom: 24 },
  emptyResetBtn:      { backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  emptyResetText:     { fontSize: 14, fontWeight: '700', color: C.surface },
  // Drawer
  drawerOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  drawerSheet:        { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, maxHeight: '85%' },
  drawerHandle:       { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 16 },
  drawerHeader:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  drawerTitle:        { fontSize: 18, fontWeight: '700', color: C.ink },
  drawerReset:        { fontSize: 14, color: C.muted, fontWeight: '500' },
  drawerSectionLabel: { ...T.label, color: C.sub, paddingHorizontal: 20, marginTop: 20, marginBottom: 10 },
  drawerChips:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 },
  drawerChip:         { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  drawerChipActive:   { backgroundColor: C.primary, borderColor: C.primary },
  drawerChipText:     { fontSize: 13, color: C.sub, fontWeight: '500' },
  drawerChipTextActive: { color: C.surface, fontWeight: '700' },
  sliderRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 },
  sliderBtn:          { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  sliderBtnActive:    { backgroundColor: C.primary, borderColor: C.primary },
  sliderBtnText:      { fontSize: 13, color: C.sub, fontWeight: '500' },
  sliderBtnTextActive:{ color: C.surface, fontWeight: '700' },
  rateInputWrap:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  rateInput:          { flex: 1, fontSize: 16, color: C.ink, fontWeight: '600' },
  rateUnit:           { fontSize: 14, color: C.muted },
  toggleRow:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 20, marginTop: 20, marginBottom: 8, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 16 },
  toggleLabel:        { fontSize: 14, fontWeight: '700', color: C.ink, marginBottom: 2 },
  toggleSub:          { fontSize: 12, color: C.muted },
  toggle:             { width: 48, height: 28, borderRadius: 14, backgroundColor: C.border, justifyContent: 'center', paddingHorizontal: 2 },
  toggleActive:       { backgroundColor: C.primary },
  toggleThumb:        { width: 24, height: 24, borderRadius: 12, backgroundColor: C.surface },
  toggleThumbActive:  { transform: [{ translateX: 20 }] },
  drawerCta:          { padding: 20, borderTopWidth: 1, borderTopColor: C.border },
  drawerApplyBtn:     { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  drawerApplyText:    { fontSize: 16, fontWeight: '700', color: C.surface },
});
