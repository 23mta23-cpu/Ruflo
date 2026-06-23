import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/colors';
import { Badge } from '../../components/ui/Badge';
import { AnimatedButton } from '../../components/ui/AnimatedButton';
import { shadow } from '../../constants/theme';
import { StarRating } from '../../components/ui/StarRating';
import { activeCategories } from '../../data/categories';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { ProviderProfile } from '../../lib/database.types';

const CATEGORIES_HANDWERK = activeCategories()
  .filter((c) => c.segment === 'B2B')
  .map((c) => ({ icon: c.icon, label: c.name }));

type ProviderCard = Pick<ProviderProfile, 'id' | 'business_name' | 'trade_id' | 'rating_avg' | 'rating_count' | 'meister_verified' | 'is_nachbarschaft' | 'created_at'>;

async function fetchTopProviders(): Promise<ProviderCard[]> {
  const { data } = await supabase
    .from('provider_profiles')
    .select('id, business_name, trade_id, rating_avg, rating_count, meister_verified, is_nachbarschaft, created_at')
    .eq('stripe_onboarded', true)
    .eq('available', true)
    .order('rating_avg', { ascending: false })
    .order('rating_count', { ascending: false })
    .limit(5);
  return (data ?? []) as ProviderCard[];
}

async function fetchNewProviders(): Promise<ProviderCard[]> {
  const { data } = await supabase
    .from('provider_profiles')
    .select('id, business_name, trade_id, rating_avg, rating_count, meister_verified, is_nachbarschaft, created_at')
    .eq('stripe_onboarded', true)
    .order('created_at', { ascending: false })
    .limit(5);
  return (data ?? []) as ProviderCard[];
}

async function fetchRepeatProviders(customerId: string): Promise<ProviderCard[]> {
  const { data: contracts } = await supabase
    .from('contracts')
    .select('provider_id, provider:provider_profiles!provider_id(id, business_name, trade_id, rating_avg, rating_count, meister_verified, is_nachbarschaft, created_at)')
    .eq('customer_id', customerId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(10);

  if (!contracts?.length) return [];

  // Deduplicate by provider_id
  const seen = new Set<string>();
  const providers: ProviderCard[] = [];
  for (const c of contracts) {
    if (c.provider_id && !seen.has(c.provider_id) && c.provider) {
      seen.add(c.provider_id);
      providers.push(c.provider as unknown as ProviderCard);
    }
  }
  return providers.slice(0, 4);
}

export default function HomeScreen() {
  const router = useRouter();
  const { user, accountType } = useAuth();
  const [topProviders, setTopProviders] = useState<ProviderCard[]>([]);
  const [newProviders, setNewProviders] = useState<ProviderCard[]>([]);
  const [repeatProviders, setRepeatProviders] = useState<ProviderCard[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [top, neu, repeats] = await Promise.all([
        fetchTopProviders(),
        fetchNewProviders(),
        user ? fetchRepeatProviders(user.id) : Promise.resolve([]),
      ]);
      setTopProviders(top);
      setNewProviders(neu);
      setRepeatProviders(repeats);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

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
              onPress={() => router.push('/benachrichtigungen')}
            >
              <Ionicons name="notifications-outline" size={24} color={C.ink} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.profileBtn}
              onPress={() => router.push('/profil')}
            >
              <Ionicons name="person-circle-outline" size={28} color={C.ink} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
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

        {/* Main Tiles — Asymmetric Bento: primary hero + compact secondary */}
        <View style={styles.tilesColumn}>
          {/* Hero tile: Handwerker — dark premium, primary action */}
          <AnimatedButton style={styles.heroTile} onPress={() => router.push('/suche')}>
            <View style={styles.heroTileTop}>
              <View style={styles.heroTileIconWrap}>
                <Ionicons name="hammer" size={20} color={C.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroTileTitle}>Handwerker finden</Text>
                <Text style={styles.heroTileSub}>Geprüfte Profis in Ihrer Nähe</Text>
              </View>
              <View style={styles.heroTileArrow}>
                <Ionicons name="arrow-forward" size={14} color={C.gold} />
              </View>
            </View>
            <Text style={styles.heroTileCategories}>Sanitär · Elektro · Maurer · Maler · und mehr</Text>
          </AnimatedButton>

          {/* Compact secondary strip: Nachbarschaft */}
          {accountType !== 'business' && (
            <AnimatedButton style={styles.nachbarStrip} onPress={() => router.push('/nachbarschaft')}>
              <View style={styles.nachbarStripIcon}>
                <Ionicons name="people" size={18} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nachbarStripTitle}>Nachbarschaft</Text>
                <Text style={styles.nachbarStripSub}>Studis & Azubis ab €10/h</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.primary} />
            </AnimatedButton>
          )}
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

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={C.primary} />
          </View>
        ) : (
          <>
            {/* Stammkunden — only shown if customer has past providers */}
            {repeatProviders.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Zuletzt gebucht</Text>
                  <Text style={styles.sectionLink}>Alle</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.stammkundenRow}
                >
                  {repeatProviders.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={styles.stammkundeCard}
                      onPress={() => router.push({ pathname: '/anbieter', params: { id: p.id } })}
                      activeOpacity={0.8}
                    >
                      <View style={styles.stammkundeAvatar}>
                        <Text style={styles.stammkundeAvatarText}>
                          {(p.business_name ?? '?').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.stammkundeName} numberOfLines={1}>{p.business_name ?? '—'}</Text>
                      <Text style={styles.stammkundeTrade} numberOfLines={1}>{p.trade_id ?? '—'}</Text>
                      <View style={styles.stammkundeStars}>
                        <Ionicons name="star" size={11} color={C.gold} />
                        <Text style={styles.stammkundeRating}>{(p.rating_avg ?? 0).toFixed(1)}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.wiederBuchenBtn}
                        onPress={() => router.push({ pathname: '/anbieter', params: { id: p.id } })}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.wiederBuchenText}>Wieder buchen</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Top rated — "Heute verfügbar" */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Top bewertet</Text>
              <Badge label="Verfügbar" variant="green" />
            </View>

            {topProviders.length === 0 ? (
              <View style={styles.emptySection}>
                <Text style={styles.emptySectionText}>Noch keine Anbieter in Ihrer Nähe</Text>
              </View>
            ) : (
              topProviders.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.workerCard}
                  onPress={() => router.push({ pathname: '/anbieter', params: { id: p.id } })}
                  activeOpacity={0.8}
                >
                  <View style={styles.workerAvatar}>
                    <Text style={styles.avatarText}>{(p.business_name ?? '?').charAt(0).toUpperCase()}</Text>
                  </View>

                  <View style={styles.workerInfo}>
                    <View style={styles.workerNameRow}>
                      <Text style={styles.workerName}>{p.business_name ?? '—'}</Text>
                      {p.meister_verified && (
                        <Ionicons name="checkmark-circle" size={15} color={C.gold} style={{ marginLeft: 4 }} />
                      )}
                    </View>
                    <Text style={styles.workerTrade}>{p.trade_id ?? '—'}</Text>
                    <StarRating rating={p.rating_avg} count={p.rating_count} />
                  </View>

                  <View style={styles.workerRight}>
                    <Ionicons name="chevron-forward" size={16} color={C.muted} />
                  </View>
                </TouchableOpacity>
              ))
            )}

            {/* Neu in der Nähe */}
            {newProviders.length > 0 && (
              <>
                <View style={[styles.sectionHeader, { marginTop: 8 }]}>
                  <Text style={styles.sectionTitle}>Neu auf WERKR</Text>
                  <Badge label="Neu" variant="amber" />
                </View>

                {newProviders.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.newWorkerCard}
                    onPress={() => router.push({ pathname: '/anbieter', params: { id: p.id } })}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.workerAvatar, { backgroundColor: C.bgWarm }]}>
                      <Text style={[styles.avatarText, { color: C.sub }]}>{(p.business_name ?? '?').charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.workerInfo}>
                      <View style={styles.workerNameRow}>
                        <Text style={styles.workerName}>{p.business_name ?? '—'}</Text>
                        {p.meister_verified && (
                          <Ionicons name="checkmark-circle" size={14} color={C.gold} style={{ marginLeft: 4 }} />
                        )}
                      </View>
                      <Text style={styles.workerTrade}>{p.trade_id ?? '—'}</Text>
                      {p.rating_count > 0 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 }}>
                          <Ionicons name="star" size={12} color={C.gold} />
                          <Text style={{ fontSize: 12, color: C.sub }}>{p.rating_avg.toFixed(1)} ({p.rating_count})</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.workerRight}>
                      <View style={styles.newBadge}>
                        <Text style={styles.newBadgeText}>NEU</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={C.muted} style={{ marginTop: 6 }} />
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: C.bg },
  header:             { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  logo:               { fontSize: 20, fontWeight: '700', color: C.ink, letterSpacing: 2.5, borderBottomWidth: 2, borderBottomColor: C.primary, paddingBottom: 1 },
  subtitle:           { fontSize: 12, color: C.sub, marginTop: 1 },
  headerRight:        { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bellBtn:            { padding: 4, position: 'relative' },
  profileBtn:         { padding: 4 },
  searchBar:          { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginBottom: 20, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13 },
  searchPlaceholder:  { flex: 1, color: C.muted, fontSize: 14 },
  searchFilter:       { width: 28, height: 28, borderRadius: 7, backgroundColor: C.primaryBg, borderWidth: 1, borderColor: C.primaryBd, alignItems: 'center', justifyContent: 'center' },
  // Asymmetric Bento tile system
  tilesColumn:        { paddingHorizontal: 20, marginBottom: 20, gap: 10 },
  heroTile:           {
    backgroundColor: C.primary, borderRadius: 16, padding: 20,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.20, shadowRadius: 14, elevation: 8,
  },
  heroTileTop:        { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  heroTileIconWrap:   { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  heroTileTitle:      { fontSize: 16, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.3, marginBottom: 2 },
  heroTileSub:        { fontSize: 12, color: 'rgba(255,255,255,0.60)' },
  heroTileArrow:      { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  heroTileCategories: { fontSize: 11, color: 'rgba(255,255,255,0.40)', letterSpacing: 0.3 },
  // Compact secondary strip
  nachbarStrip:       {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.primaryBg, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: C.primaryBd,
  },
  nachbarStripIcon:   { width: 34, height: 34, borderRadius: 9, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.primaryBd },
  nachbarStripTitle:  { fontSize: 14, fontWeight: '700', color: C.ink, marginBottom: 1 },
  nachbarStripSub:    { fontSize: 12, color: C.primary },
  sectionTitle:       { fontSize: 17, fontWeight: '600', color: C.ink, paddingHorizontal: 20, marginBottom: 12 },
  sectionHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 },
  sectionLink:        { fontSize: 13, color: C.sub, fontWeight: '500' },
  categoriesRow:      { paddingLeft: 20, paddingRight: 8, gap: 8, marginBottom: 20 },
  categoryChip:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginRight: 4 },
  categoryLabel:      { fontSize: 13, color: C.ink, fontWeight: '500' },
  loadingWrap:        { paddingVertical: 40, alignItems: 'center' },
  emptySection:       { marginHorizontal: 20, marginBottom: 16, paddingVertical: 16, alignItems: 'center' },
  emptySectionText:   { fontSize: 13, color: C.muted },
  stammkundenRow:     { paddingLeft: 20, paddingRight: 8, gap: 12, marginBottom: 24 },
  stammkundeCard:     { width: 130, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, alignItems: 'center' },
  stammkundeAvatar:   { width: 50, height: 50, borderRadius: 25, backgroundColor: C.primaryBg, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  stammkundeAvatarText: { fontSize: 20, fontWeight: '700', color: C.primary },
  stammkundeName:     { fontSize: 13, fontWeight: '700', color: C.ink, marginBottom: 2, textAlign: 'center' },
  stammkundeTrade:    { fontSize: 11, color: C.sub, marginBottom: 4, textAlign: 'center' },
  stammkundeStars:    { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 10 },
  stammkundeRating:   { fontSize: 11, color: C.sub, fontWeight: '600' },
  wiederBuchenBtn:    { backgroundColor: C.goldBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: C.goldBd },
  wiederBuchenText:   { fontSize: 11, fontWeight: '700', color: C.gold },
  workerCard:         { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, marginHorizontal: 20, marginBottom: 10, padding: 14, shadowColor: C.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  newWorkerCard:      { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, marginHorizontal: 20, marginBottom: 10, padding: 14, borderLeftWidth: 3, borderLeftColor: C.amber },
  workerAvatar:       { width: 44, height: 44, borderRadius: 22, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText:         { fontSize: 18, fontWeight: '700', color: C.gold },
  workerInfo:         { flex: 1 },
  workerNameRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  workerName:         { fontSize: 14, fontWeight: '700', color: C.ink },
  workerTrade:        { fontSize: 12, color: C.sub, marginBottom: 4 },
  workerRight:        { alignItems: 'flex-end' },
  newBadge:           { backgroundColor: C.amberBg, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3, marginTop: 4 },
  newBadgeText:       { fontSize: 10, fontWeight: '700', color: C.amber, letterSpacing: 0.5 },
});
