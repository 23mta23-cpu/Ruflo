import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C, HERO } from '../../constants/colors';
import { showAlert } from '../../lib/alert';
import { Badge } from '../../components/ui/Badge';
import { AnimatedButton } from '../../components/ui/AnimatedButton';
import { BrandMark } from '../../components/ui/BrandMark';
import { Reveal } from '../../components/ui/Reveal';
import { shadow } from '../../constants/theme';
import { StarRating } from '../../components/ui/StarRating';
import { kundenKategorien } from '../../data/categories';
import { getMyOpenJobs, type MyOpenJob } from '../../lib/jobs';
import { Skeleton } from '../../components/ui/Skeleton';
import { Image } from 'react-native';
import { CATEGORY_IMAGES } from '../../assets/categories';
import { FEATURES } from '../../constants/features';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { ProviderProfile } from '../../lib/database.types';
import { trackEvent } from '../../lib/analytics';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Kurznamen fürs Raster — lange Namen („Heizung & Sanitär") passen nicht
// in eine Kachel-Zeile und würden hässlich abgeschnitten.
const GRID_SHORT_NAMES: Record<string, string> = {
  'heizung-sanitaer': 'Sanitär',
  'zimmerer': 'Zimmerer',
  'maurer': 'Maurer',
  'metallbau': 'Metallbau',
  'rollladen': 'Rollladen',
  'gebaeudereinigung': 'Gebäude',
};

// Handwerk + freigegebene Nachbarschafts-Startkategorien (Modell D+).
// Founder-Feedback 07.07.: unbeschriftet im selben Raster war die
// Nachbarschaftshilfe "ineinandergreifend und nicht nachvollziehbar" —
// getrennt in zwei betitelte Gruppen im SELBEN Raster/Funnel (kein
// zweiter sichtbarer Marktplatz, nur klare Beschriftung).
const ALL_GRID_CATS = kundenKategorien(FEATURES.NACHBARSCHAFT)
  .map((c) => ({ id: c.id, icon: c.icon, label: GRID_SHORT_NAMES[c.id] ?? c.name, segment: c.segment }));
const CATEGORIES_HANDWERK_GRID = ALL_GRID_CATS.filter((c) => c.segment === 'B2B');
const CATEGORIES_NACHBARSCHAFT_GRID = ALL_GRID_CATS.filter((c) => c.segment === 'C2C');

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
  const { user, role, accountType, loading: authLoading } = useAuth();

  // Root-Weiche: app/index.tsx wurde entfernt, weil ein Redirect von '/'
  // nach '/(tabs)/' zur identischen URL '/' normalisiert
  // und als No-op verpufft (leerer Screen beim Kaltstart, Befund 14.07.).
  // '/' rendert jetzt direkt dieses Home; Gaeste gehen zur Landing,
  // Anbieter in ihren Bereich.
  React.useEffect(() => {
    if (authLoading) return;
    if (!user) {
      // Gaeste duerfen die Kunden-Home browsen, WENN sie sich im Onboarding
      // bewusst dafuer entschieden haben ("Ich suche Unterstuetzung"). Frische
      // Besucher ohne dieses Flag sehen weiterhin die Marketing-Landing.
      // Ohne diese Unterscheidung landete der Gast-Flow in einer Schleife
      // zurueck zur Homepage (Founder-Report 16.07.).
      AsyncStorage.getItem('werkr_guest_browse').then((v) => {
        if (v !== 'true') router.replace('/landing');
      });
      return;
    }
    if (role === 'provider') {
      // Anbieter-Konto darf bewusst in die Kundenansicht wechseln
      // (ein Konto, zwei Welten). Nur ohne aktives 'customer'-Flag zurueck
      // ins Anbieter-Dashboard (Founder-Report 16.07.: Kunden-Auftrag war
      // aus der Anbieter-Navigation nicht erreichbar).
      AsyncStorage.getItem('werkr_active_view').then((v) => {
        if (v !== 'customer') router.replace('/(provider)/dashboard');
      });
    }
  }, [authLoading, user, role]);
  const [topProviders, setTopProviders] = useState<ProviderCard[]>([]);
  const [newProviders, setNewProviders] = useState<ProviderCard[]>([]);
  const [repeatProviders, setRepeatProviders] = useState<ProviderCard[]>([]);
  // Aktive Aufträge prominent auf Home (Airbnb-„Your Trips"-Pattern) —
  // vorher gab es hier keinerlei Sicht auf laufende eigene Aufträge.
  const [myOpenJobs, setMyOpenJobs] = useState<MyOpenJob[]>([]);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);
  // Progressive Disclosure: pro Gruppe nur 2 Reihen (6 Kacheln), Rest per Tap.
  // So bleibt die Nachbarschaft ohne langes Scrollen sichtbar.
  const [showAllHw, setShowAllHw] = useState(false);
  const [showAllNb, setShowAllNb] = useState(false);
  const [activeSegment, setActiveSegment] = useState<'handwerk' | 'nachbarschaft'>('handwerk');

  const load = useCallback(async () => {
    try {
      // 8s-Timeout wie in suche.tsx — ohne ihn dreht der Spinner endlos,
      // wenn das Backend nicht erreichbar ist (bekannte Bugklasse).
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 8000),
      );
      const [top, neu, repeats, jobs] = await Promise.race([
        Promise.all([
          fetchTopProviders(),
          fetchNewProviders(),
          user ? fetchRepeatProviders(user.id) : Promise.resolve([]),
          // Fehler hier dürfen die Anbieter-Listen nicht mitreißen.
          user ? getMyOpenJobs(user.id).catch(() => [] as MyOpenJob[]) : Promise.resolve([] as MyOpenJob[]),
        ]),
        timeout,
      ]);
      setIsDemoMode(top.length === 0);
      setTopProviders(top.length > 0 ? top : DEMO_TOP_PROVIDERS);
      setNewProviders(neu);
      setRepeatProviders(repeats);
      setMyOpenJobs(jobs);
    } catch {
      // Backend nicht erreichbar → Vorschau-Modus statt Endlos-Spinner
      setIsDemoMode(true);
      setTopProviders(DEMO_TOP_PROVIDERS);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Bei jedem Fokus neu laden (Tabs bleiben gemountet) — sonst zeigt der
  // Screen nach Rueckkehr veraltete Daten (gleiche Klasse wie Auftraege-Tab-Fix).
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { trackEvent('home_view'); }, []);

  // Progressive Disclosure: max. 2 Reihen je Gruppe; „Alle anzeigen" erst ab
  // >1 versteckter Kachel (sonst würde man für 1 Extra-Kachel einen Toggle zeigen).
  const CAT_LIMIT = 6;
  const hwHasMore = CATEGORIES_HANDWERK_GRID.length > CAT_LIMIT + 1;
  const hwVisible = showAllHw || !hwHasMore ? CATEGORIES_HANDWERK_GRID : CATEGORIES_HANDWERK_GRID.slice(0, CAT_LIMIT);
  const nbHasMore = CATEGORIES_NACHBARSCHAFT_GRID.length > CAT_LIMIT + 1;
  const nbVisible = showAllNb || !nbHasMore ? CATEGORIES_NACHBARSCHAFT_GRID : CATEGORIES_NACHBARSCHAFT_GRID.slice(0, CAT_LIMIT);
  // Aktives Segment auf eine Wertemenge abbilden (Airbnb-Umschalter oben)
  const segAll      = activeSegment === 'handwerk' ? CATEGORIES_HANDWERK_GRID : CATEGORIES_NACHBARSCHAFT_GRID;
  const segVisible  = activeSegment === 'handwerk' ? hwVisible : nbVisible;
  const segHasMore  = activeSegment === 'handwerk' ? hwHasMore : nbHasMore;
  const segShowAll  = activeSegment === 'handwerk' ? showAllHw : showAllNb;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>

        {/* ── Marken-Kopf: dunkles Hero-Grün, auftragszentriert.
            Der Kunde will sein Problem loswerden, nicht Profile browsen —
            die dominante Aktion führt direkt in den Auftrags-Flow. ── */}
        <View style={styles.heroBlock}>
          <View style={styles.header}>
            <View>
              <View style={styles.logoRow}>
                <BrandMark size={22} variant="dark" />
                <Text style={styles.logo}>werkant</Text>
              </View>
              <View style={styles.cityBadge}>
                <View style={styles.cityDot} />
                <Text style={styles.citySub}>Deutschlandweit</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.bellBtn}
                onPress={() => router.push('/benachrichtigungen')}
                accessibilityRole="button"
                accessibilityLabel="Benachrichtigungen"
              >
                <Ionicons name="notifications-outline" size={23} color={C.surface} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.profileBtn}
                onPress={() => router.push('/profil')}
                accessibilityRole="button"
                accessibilityLabel="Profil"
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
            <Text style={styles.heroSecondaryText}>Oder Anbieter direkt ansehen</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.body}>

        {/* ── Aktive Aufträge (Airbnb „Your Trips"): laufende Aufträge des
            Kunden direkt unter dem Hero — vorher musste man dafür in den
            Aufträge-Tab wechseln (Founder-/Screenshot-Befund 19.07.). ── */}
        {user && myOpenJobs.length > 0 && (
          <>
            <View style={[styles.sectionHeader, { marginTop: 20 }]}>
              <Text style={styles.sectionTitle}>Deine Aufträge</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/auftraege')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.sectionLink}>Alle</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeOrdersRow}>
              {myOpenJobs.map((job) => {
                const offerCount = job.offers?.[0]?.count ?? 0;
                const statusLabel = job.status === 'matched'
                  ? 'Anbieter beauftragt'
                  : offerCount > 0
                    ? `${offerCount} ${offerCount === 1 ? 'Angebot' : 'Angebote'} erhalten`
                    : 'Wartet auf Angebote';
                return (
                  <TouchableOpacity
                    key={job.id}
                    style={styles.activeOrderCard}
                    onPress={() => router.push({ pathname: '/auftrag-detail', params: { jobId: job.id } })}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`Auftrag ${job.title}, ${statusLabel}`}
                  >
                    <View style={styles.activeOrderIcon}>
                      <Ionicons name={offerCount > 0 ? 'mail-unread-outline' : 'hourglass-outline'} size={17} color={C.primary} />
                    </View>
                    <Text style={styles.activeOrderTitle} numberOfLines={1}>{job.title}</Text>
                    <View style={[styles.activeOrderBadge, offerCount > 0 && { backgroundColor: C.goldBg }]}>
                      <Text style={[styles.activeOrderBadgeText, offerCount > 0 && { color: C.gold }]}>{statusLabel}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* Kategorien — Raster statt Scroll-Chips: alles auf einen Blick,
            jede Kachel startet den Auftrags-Flow. Zwei betitelte Gruppen im
            selben Raster, wenn Nachbarschaft aktiv ist (siehe Konstanten
            oben) — kein zweiter Marktplatz, nur klare Beschriftung. */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Womit können wir helfen?</Text>

        {/* Segment-Umschalter (Airbnb-Referenz, Founder 20.07.): Handwerk /
            Nachbarschaftshilfe als Tabs mit aktiver Unterstreichung statt
            zweier gestapelter Gruppen — kürzerer Scroll, klarere Wahl. */}
        {FEATURES.NACHBARSCHAFT && CATEGORIES_NACHBARSCHAFT_GRID.length > 0 && (
          <View style={styles.segmentRow}>
            {([
              { key: 'handwerk' as const, icon: 'construct-outline' as const, label: 'Handwerk' },
              { key: 'nachbarschaft' as const, icon: 'people-outline' as const, label: 'Nachbarschaftshilfe' },
            ]).map((seg) => {
              const active = activeSegment === seg.key;
              return (
                <TouchableOpacity
                  key={seg.key}
                  style={styles.segmentItem}
                  onPress={() => setActiveSegment(seg.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <Ionicons name={seg.icon} size={20} color={active ? C.ink : C.muted} />
                  <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{seg.label}</Text>
                  <View style={[styles.segmentUnderline, active && styles.segmentUnderlineActive]} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={styles.categoryGrid}>
          {segVisible.map((cat, i) => (
            <Reveal key={cat.label} delay={i * 55} style={styles.categoryTileWrap}>
              <AnimatedButton
                style={styles.categoryTile}
                onPress={() => router.push({ pathname: '/auftrag-aufgeben', params: activeSegment === 'nachbarschaft' ? { category: cat.id, track: 'nachbarschaft' } : { category: cat.id } })}
              >
                {CATEGORY_IMAGES[cat.id]
                  ? <Image source={CATEGORY_IMAGES[cat.id]} style={styles.categoryTileImage} />
                  : (
                    <View style={styles.categoryTileIcon}>
                      <Ionicons name={cat.icon as any} size={19} color={C.primary} />
                    </View>
                  )}
                <Text style={styles.categoryTileLabel} numberOfLines={2}>{cat.label}</Text>
              </AnimatedButton>
            </Reveal>
          ))}
        </View>
        {segHasMore && (
          <TouchableOpacity
            style={styles.showAllRow}
            onPress={() => (activeSegment === 'handwerk' ? setShowAllHw((v) => !v) : setShowAllNb((v) => !v))}
            activeOpacity={0.7}
          >
            <Text style={styles.showAllText}>
              {segShowAll ? 'Weniger anzeigen' : `Alle anzeigen (${segAll.length})`}
            </Text>
            <Ionicons name={segShowAll ? 'chevron-up' : 'chevron-down'} size={15} color={C.primary} />
          </TouchableOpacity>
        )}

        {/* Vertrauens-Strip — die drei Zusagen, die Werkant halten kann */}
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

        {/* ── Top bewertet — unter dem Trust-Strip (Founder-Wunsch 19.07.:
            Original-Position), horizontal scrollbar. ── */}
        <View style={[styles.sectionHeader, { marginTop: 8 }]}>
          <Text style={styles.sectionTitle}>Top bewertet</Text>
          <Badge label="Verfügbar" variant="green" />
        </View>
        {isDemoMode && !loading && (
          <View style={styles.demoBanner}>
            <Ionicons name="information-circle-outline" size={16} color={C.gold} />
            <Text style={styles.demoBannerText}>
              Vorschau — wir prüfen gerade die ersten Anbieter in Ihrer Region.
            </Text>
          </View>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topRow}>
          {loading
            ? [0, 1, 2].map((i) => (
                <View key={i} style={styles.topCard}>
                  <Skeleton width={44} height={44} borderRadius={22} />
                  <Skeleton height={13} borderRadius={7} style={{ marginTop: 10, alignSelf: 'stretch' }} />
                  <Skeleton height={11} width={'70%' as never} borderRadius={6} style={{ marginTop: 6 }} />
                </View>
              ))
            : topProviders.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.topCard}
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
                  <View style={styles.topCardNameRow}>
                    <Text style={styles.topCardName} numberOfLines={1}>{p.business_name ?? '—'}</Text>
                    {p.meister_verified && (
                      <Ionicons name="checkmark-circle" size={14} color={C.gold} />
                    )}
                  </View>
                  <Text style={styles.topCardTrade} numberOfLines={1}>{p.trade_id ?? '—'}</Text>
                  <StarRating rating={p.rating_avg} count={p.rating_count} />
                </TouchableOpacity>
              ))}
        </ScrollView>


        {loading ? (
          <View style={{ paddingHorizontal: 20, paddingTop: 12, gap: 12 }}>
            {[0, 1].map((i) => (
              <View key={i} style={styles.skeletonRow}>
                <Skeleton width={44} height={44} borderRadius={22} />
                <View style={{ flex: 1 }}>
                  <Skeleton height={14} borderRadius={7} style={{ marginBottom: 8 }} />
                  <Skeleton height={11} width={'55%' as never} borderRadius={6} />
                </View>
              </View>
            ))}
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
                        hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                      >
                        <Text style={styles.wiederBuchenText}>Wieder buchen</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Neu in der Nähe */}
            {newProviders.length > 0 && (
              <>
                <View style={[styles.sectionHeader, { marginTop: 8 }]}>
                  <Text style={styles.sectionTitle}>Neu auf Werkant</Text>
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
  logoRow:            { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo:               { fontSize: 20, fontWeight: '700', color: C.surface, letterSpacing: 1 },
  cityBadge:          { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  cityDot:            { width: 6, height: 6, borderRadius: 3, backgroundColor: HERO.mint },
  citySub:            { fontSize: 12, color: HERO.mint, fontWeight: '500' },
  headerRight:        { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // 44pt-Mindestziel (WCAG 2.5.5) — Befund UI/UX-Audit: Icon-Buttons ~31-35pt
  bellBtn:            { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  profileBtn:         { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  heroQuestion:       { fontSize: 26, fontWeight: '700', color: C.surface, marginBottom: 14, letterSpacing: -0.3 },
  heroAction:         { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, shadowColor: C.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 5 },
  heroActionIcon:     { width: 36, height: 36, borderRadius: 10, backgroundColor: C.primaryBg, alignItems: 'center', justifyContent: 'center' },
  heroActionTitle:    { fontSize: 15, fontWeight: '700', color: C.ink, marginBottom: 1 },
  heroActionSub:      { fontSize: 12, color: C.sub },
  heroSecondary:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8, minHeight: 44, paddingVertical: 8 },
  heroSecondaryText:  { fontSize: 13, fontWeight: '600', color: HERO.mint },

  // ── Body-Sektionen ──
  sectionTitle:       { fontSize: 17, fontWeight: '600', color: C.ink, paddingHorizontal: 20, marginBottom: 12 },
  segmentRow:         { flexDirection: 'row', gap: 4, paddingHorizontal: 20, marginBottom: 14 },
  segmentItem:        { flex: 1, alignItems: 'center', gap: 5, paddingVertical: 8, minHeight: 56 },
  segmentLabel:       { fontSize: 13, fontWeight: '600', color: C.muted },
  segmentLabelActive: { color: C.ink, fontWeight: '700' },
  segmentUnderline:   { height: 2, alignSelf: 'stretch', marginHorizontal: 18, borderRadius: 1, backgroundColor: 'transparent', marginTop: 2 },
  segmentUnderlineActive: { backgroundColor: C.ink },
  showAllRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 20, marginTop: -8, marginBottom: 14, paddingVertical: 12, minHeight: 44 },
  showAllText:        { fontSize: 13, fontWeight: '600', color: C.primary },
  sectionHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 },
  sectionLink:        { fontSize: 13, color: C.sub, fontWeight: '500' },
  // 2 Spalten statt 3 (Screenshot-Befund: Kacheln zu klein/eng) —
  // Kachel min. 80px hoch, 16px Gap, größeres Icon = sichere Touch-Targets.
  categoryGrid:       { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 20, marginBottom: 20 },
  categoryTileWrap:   { width: '44%', flexGrow: 1 },
  categoryTile:       { ...shadow.sm, width: '100%', minHeight: 100, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface, borderWidth: 1, borderColor: C.hair, borderRadius: 16, paddingVertical: 18, paddingHorizontal: 14 },
  categoryTileIcon:   { width: 40, height: 40, borderRadius: 12, backgroundColor: C.primaryBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  categoryTileImage:  { width: 56, height: 56, borderRadius: 13, backgroundColor: C.primaryBg },
  categoryTileLabel:  { fontSize: 14, color: C.ink, fontWeight: '600', flexShrink: 1, flex: 1 },
  trustStrip:         { ...shadow.xs, flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 20, marginBottom: 24, backgroundColor: C.surface, borderWidth: 1, borderColor: C.hair, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 14 },
  trustItem:          { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  trustItemText:      { fontSize: 11, color: C.sub, fontWeight: '600' },
  loadingWrap:        { paddingVertical: 40, alignItems: 'center' },
  skeletonRow:        { ...shadow.sm, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.hair, borderRadius: 16, padding: 14 },
  activeOrdersRow:    { paddingLeft: 20, paddingRight: 8, gap: 12, marginBottom: 4 },
  activeOrderCard:    { ...shadow.sm, width: 180, backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.hair, padding: 14, minHeight: 88 },
  activeOrderIcon:    { width: 34, height: 34, borderRadius: 10, backgroundColor: C.primaryBg, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  activeOrderTitle:   { fontSize: 14, fontWeight: '600', color: C.ink, marginBottom: 8 },
  activeOrderBadge:   { alignSelf: 'flex-start', backgroundColor: C.primaryBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  activeOrderBadgeText: { fontSize: 11, fontWeight: '700', color: C.primary },
  topRow:             { paddingLeft: 20, paddingRight: 8, gap: 12, marginBottom: 4 },
  topCard:            { ...shadow.sm, width: 150, backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.hair, padding: 14, alignItems: 'flex-start' },
  topCardNameRow:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, alignSelf: 'stretch' },
  topCardName:        { fontSize: 14, fontWeight: '600', color: C.ink, flexShrink: 1 },
  topCardTrade:       { fontSize: 12, color: C.sub, marginTop: 2, marginBottom: 6 },
  emptySection:       { marginHorizontal: 20, marginBottom: 16, paddingVertical: 16, alignItems: 'center' },
  demoBanner:         { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginHorizontal: 20, marginBottom: 12, backgroundColor: C.goldBg, borderRadius: 10, padding: 12 },
  demoBannerText:     { flex: 1, fontSize: 12, color: C.sub, lineHeight: 17 },
  emptySectionText:   { fontSize: 13, color: C.muted },
  stammkundenRow:     { paddingLeft: 20, paddingRight: 8, gap: 12, marginBottom: 24 },
  stammkundeCard:     { ...shadow.sm, width: 130, backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.hair, padding: 14, alignItems: 'center' },
  stammkundeAvatar:   { width: 50, height: 50, borderRadius: 25, backgroundColor: C.primaryBg, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  stammkundeAvatarText: { fontSize: 20, fontWeight: '700', color: C.primary },
  stammkundeName:     { fontSize: 13, fontWeight: '700', color: C.ink, marginBottom: 2, textAlign: 'center' },
  stammkundeTrade:    { fontSize: 11, color: C.sub, marginBottom: 4, textAlign: 'center' },
  stammkundeStars:    { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 10 },
  stammkundeRating:   { fontSize: 11, color: C.sub, fontWeight: '600' },
  wiederBuchenBtn:    { backgroundColor: C.goldBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: C.goldBd },
  wiederBuchenText:   { fontSize: 11, fontWeight: '700', color: C.gold },
  workerCard:         { ...shadow.sm, flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.surface, borderWidth: 1, borderColor: C.hair, borderRadius: 16, marginHorizontal: 20, marginBottom: 10, padding: 16 },
  newWorkerCard:      { ...shadow.sm, flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.surface, borderWidth: 1, borderColor: C.hair, borderRadius: 16, marginHorizontal: 20, marginBottom: 10, padding: 16, borderLeftWidth: 3, borderLeftColor: C.amber },
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
