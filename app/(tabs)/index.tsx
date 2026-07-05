import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C, HERO } from '../../constants/colors';
import { showAlert } from '../../lib/alert';
import { Badge } from '../../components/ui/Badge';
import { AnimatedButton } from '../../components/ui/AnimatedButton';
import { shadow } from '../../constants/theme';
import { StarRating } from '../../components/ui/StarRating';
import { activeCategories } from '../../data/categories';
import { FEATURES } from '../../constants/features';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { ProviderProfile } from '../../lib/database.types';
import { trackEvent } from '../../lib/analytics';

// Kurznamen fürs Raster — lange Namen („Heizung & Sanitär") passen nicht
// in eine Kachel-Zeile und würden hässlich abgeschnitten.
const GRID_SHORT_NAMES: Record<string, string> = { 'heizung-sanitaer': 'Sanitär' };

const CATEGORIES_HANDWERK = activeCategories()
  .filter((c) => c.segment === 'B2B')
  .map((c) => ({ icon: c.icon, label: GRID_SHORT_NAMES[c.id] ?? c.name }));

type ProviderCard = Pick<ProviderProfile, 'id' | 'business_name' | 'trade_id' | 'rating_avg' | 'rating_count' | 'meister_verified' | 'is_nachbarschaft' | 'created_at'>;

// Shown when Supabase returns 0 onboarded providers (beta / demo) —
// same preview pattern as suche.tsx: cards are visible but tapping
// explains that this is a preview.
const DEMO_TOP_PROVIDERS: ProviderCard[] = [
  { id: 'demo-1', business_name: 'Marcus Berger',       trade_id: 'Elektriker',         rating_avg: 4.9, rating_count: 87,  meister_verified: true,  is_nachbarschaft: false, created_at: '' },
  { id: 'demo-2', business_name: 'Yilmaz GmbH',         trade_id: 'Sanitär & Heizung',  rating_avg: 4.7, rating_count: 134, meister_verified: true,  is_nachbarschaft: false, created_at: '' },
  { id: 'demo-3', business_name: 'Blitzblank Service',  trade_id: 'Reinigung',          rating_avg: 4.7, rating_count: 96,  meister_verified: false, is_nachbarschaft: false, created_at: '' },
  { id: 'demo-4', business_name: 'Lena M. (Studentin)', trade_id: 'Umzugshilfe',        rating_avg: 4.9, rating_count: 23,  meister_verified: false, is_nachbarschaft: true,  created_at: '' },
].filter((p) => FEATURES.NACHBARSCHAFT || !p.is_nachbarschaft);

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
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      // 8s-Timeout wie in suche.tsx — ohne ihn dreht der Spinner endlos,
      // wenn das Backend nicht erreichbar ist (bekannte Bugklasse).
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 8000),
      );
      const [top, neu, repeats] = await Promise.race([
        Promise.all([
          fetchTopProviders(),
          fetchNewProviders(),
          user ? fetchRepeatProviders(user.id) : Promise.resolve([]),
        ]),
        timeout,
      ]);
      setIsDemoMode(top.length === 0);
      setTopProviders(top.length > 0 ? top : DEMO_TOP_PROVIDERS);
      setNewProviders(neu);
      setRepeatProviders(repeats);
    } catch {
      // Backend nicht erreichbar → Vorschau-Modus statt Endlos-Spinner
      setIsDemoMode(true);
      setTopProviders(DEMO_TOP_PROVIDERS);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { trackEvent('home_view'); }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>

        {/* ── Marken-Kopf: dunkles Hero-Grün, auftragszentriert.
            Der Kunde will sein Problem loswerden, nicht Profile browsen —
            die dominante Aktion führt direkt in den Auftrags-Flow. ── */}
        <View style={styles.heroBlock}>
          <View style={styles.header}>
            <View>
              <Text style={styles.logo}>WERKR</Text>
              <View style={styles.cityBadge}>
                <View style={styles.cityDot} />
                <Text style={styles.citySub}>Köln & Umgebung</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.bellBtn}
                onPress={() => router.push('/benachrichtigungen')}
              >
                <Ionicons name="notifications-outline" size={23} color={C.surface} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.profileBtn}
                onPress={() => router.push('/profil')}
              >
                <Ionicons name="person-circle-outline" size={27} color={C.surface} />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.heroQuestion}>Was brauchen Sie?</Text>

          <AnimatedButton style={styles.heroAction} onPress={() => router.push('/auftrag-aufgeben')}>
            <View style={styles.heroActionIcon}>
              <Ionicons name="create-outline" size={18} color={C.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.heroActionTitle}>Auftrag beschreiben</Text>
              <Text style={styles.heroActionSub} numberOfLines={1}>Kostenlos & unverbindlich Angebote erhalten</Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={C.primary} />
          </AnimatedButton>

          <TouchableOpacity
            style={styles.heroSecondary}
            onPress={() => router.push('/suche')}
            activeOpacity={0.7}
          >
            <Ionicons name="search-outline" size={14} color={HERO.mint} />
            <Text style={styles.heroSecondaryText}>Oder Handwerker direkt ansehen</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.body}>

        {/* Kategorien — Raster statt Scroll-Chips: alles auf einen Blick,
            jede Kachel startet den Auftrags-Flow */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Womit können wir helfen?</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES_HANDWERK.map((cat) => (
            <TouchableOpacity
              key={cat.label}
              style={styles.categoryTile}
              onPress={() => router.push('/auftrag-aufgeben')}
              activeOpacity={0.7}
            >
              <View style={styles.categoryTileIcon}>
                <Ionicons name={cat.icon as any} size={19} color={C.primary} />
              </View>
              <Text style={styles.categoryTileLabel} numberOfLines={1}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Vertrauens-Strip — die drei Zusagen, die WERKR halten kann */}
        <View style={styles.trustStrip}>
          {[
            { icon: 'shield-checkmark-outline' as const, label: 'Geprüfte Betriebe' },
            { icon: 'document-text-outline' as const,    label: 'Verbindliche Angebote' },
            { icon: 'star-outline' as const,             label: 'Echte Bewertungen' },
          ].map((t) => (
            <View key={t.label} style={styles.trustItem}>
              <Ionicons name={t.icon} size={15} color={C.primary} />
              <Text style={styles.trustItemText}>{t.label}</Text>
            </View>
          ))}
        </View>

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

            {isDemoMode && (
              <View style={styles.demoBanner}>
                <Ionicons name="information-circle-outline" size={16} color={C.gold} />
                <Text style={styles.demoBannerText}>
                  Vorschau — wir prüfen gerade die ersten Anbieter in Ihrer Region.
                </Text>
              </View>
            )}
            {topProviders.length === 0 ? (
              <View style={styles.emptySection}>
                <Text style={styles.emptySectionText}>Noch keine Anbieter in Ihrer Nähe</Text>
              </View>
            ) : (
              topProviders.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.workerCard}
                  onPress={() =>
                    isDemoMode
                      ? showAlert('Noch nicht verfügbar', 'Dies ist eine Vorschau. Wir suchen gerade Anbieter in Ihrer Region und benachrichtigen Sie, sobald jemand verfügbar ist.', [{ text: 'OK' }])
                      : router.push({ pathname: '/anbieter', params: { id: p.id } })
                  }
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
                          <Text style={{ fontSize: 12, color: C.sub }}>{(p.rating_avg ?? 0).toFixed(1)} ({p.rating_count})</Text>
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

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Container trägt das Hero-Grün — die Statusleiste verschmilzt mit dem
  // Marken-Kopf (gleiche Logik wie Landing). Der Body darunter ist Bone.
  container:          { flex: 1, backgroundColor: HERO.bg },
  body:               { flex: 1, backgroundColor: C.bg, paddingBottom: 32 },

  // ── Marken-Kopf ──
  heroBlock:          { backgroundColor: HERO.bg, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  header:             { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 18 },
  logo:               { fontSize: 20, fontWeight: '700', color: C.surface, letterSpacing: 2.5 },
  cityBadge:          { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  cityDot:            { width: 6, height: 6, borderRadius: 3, backgroundColor: HERO.mint },
  citySub:            { fontSize: 12, color: HERO.mint, fontWeight: '500' },
  headerRight:        { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bellBtn:            { padding: 4, position: 'relative' },
  profileBtn:         { padding: 4 },
  heroQuestion:       { fontSize: 26, fontWeight: '700', color: C.surface, marginBottom: 14, letterSpacing: -0.3 },
  heroAction:         { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, shadowColor: C.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 5 },
  heroActionIcon:     { width: 36, height: 36, borderRadius: 10, backgroundColor: C.primaryBg, alignItems: 'center', justifyContent: 'center' },
  heroActionTitle:    { fontSize: 15, fontWeight: '700', color: C.ink, marginBottom: 1 },
  heroActionSub:      { fontSize: 12, color: C.sub },
  heroSecondary:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14 },
  heroSecondaryText:  { fontSize: 13, fontWeight: '600', color: HERO.mint },

  // ── Body-Sektionen ──
  sectionTitle:       { fontSize: 17, fontWeight: '600', color: C.ink, paddingHorizontal: 20, marginBottom: 12 },
  sectionHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 },
  sectionLink:        { fontSize: 13, color: C.sub, fontWeight: '500' },
  categoryGrid:       { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 10, marginBottom: 20 },
  categoryTile:       { width: '30.5%', flexGrow: 1, alignItems: 'center', gap: 8, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 6 },
  categoryTileIcon:   { width: 38, height: 38, borderRadius: 11, backgroundColor: C.primaryBg, alignItems: 'center', justifyContent: 'center' },
  categoryTileLabel:  { fontSize: 12, color: C.ink, fontWeight: '600' },
  trustStrip:         { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 20, marginBottom: 24, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  trustItem:          { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  trustItemText:      { fontSize: 11, color: C.sub, fontWeight: '600' },
  loadingWrap:        { paddingVertical: 40, alignItems: 'center' },
  emptySection:       { marginHorizontal: 20, marginBottom: 16, paddingVertical: 16, alignItems: 'center' },
  demoBanner:         { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginHorizontal: 20, marginBottom: 12, backgroundColor: C.goldBg, borderRadius: 10, padding: 12 },
  demoBannerText:     { flex: 1, fontSize: 12, color: C.sub, lineHeight: 17 },
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
