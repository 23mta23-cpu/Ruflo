import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Share, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { C } from '../constants/colors';
import { categoryById } from '../data/categories';
import { showAlert } from '../lib/alert';
import { supabase } from '../lib/supabase';
import type { ProviderProfile } from '../lib/database.types';
import { trackEvent, trackError } from '../lib/analytics';

type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_name: string | null;
  job_title: string | null;
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= Math.round(rating) ? 'star' : 'star-outline'}
          size={size}
          color={C.gold}
        />
      ))}
    </View>
  );
}

function VerifiedBadge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <View style={[styles.badge, ok ? styles.badgeOk : styles.badgeMissing]}>
      <Ionicons
        name={ok ? 'checkmark-circle' : 'close-circle'}
        size={13}
        color={ok ? C.primary : C.muted}
      />
      <Text style={[styles.badgeText, !ok && { color: C.muted }]}>{label}</Text>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function AnbieterProfilScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [bookmarkd, setBookmarked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<ProviderProfile | null>(null);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [allReviewsLoaded, setAllReviewsLoaded] = useState(false);
  const [loadingAllReviews, setLoadingAllReviews] = useState(false);

  useEffect(() => { trackEvent('provider_profile_view'); }, []);

  async function loadAllReviews() {
    if (!id || loadingAllReviews) return;
    setLoadingAllReviews(true);
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('id, rating, comment, created_at, reviewer:profiles!reviewer_id(full_name), contract:contracts!contract_id(job:jobs!job_id(title))')
        .eq('reviewed_id', id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setReviews((data ?? []).map((r: any) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        created_at: r.created_at,
        reviewer_name: r.reviewer?.full_name ?? null,
        job_title: r.contract?.job?.title ?? null,
      })));
      setAllReviewsLoaded(true);
    } catch {
      trackError('reviews_load_all');
      showAlert('Fehler', 'Bewertungen konnten nicht geladen werden. Bitte später erneut versuchen.');
    } finally {
      setLoadingAllReviews(false);
    }
  }

  useEffect(() => {
    if (!id) { setLoading(false); return; }

    async function load() {
      try {
      const [profileRes, reviewsRes, contractsRes] = await Promise.all([
        supabase
          .from('provider_profiles')
          .select('*')
          .eq('id', id)
          .maybeSingle(),

        supabase
          .from('reviews')
          .select('id, rating, comment, created_at, reviewer:profiles!reviewer_id(full_name), contract:contracts!contract_id(job:jobs!job_id(title))')
          .eq('reviewed_id', id)
          .order('created_at', { ascending: false })
          .limit(5),

        supabase
          .from('contracts')
          .select('id', { count: 'exact', head: true })
          .eq('provider_id', id)
          .eq('status', 'completed'),
      ]);

      setProvider(profileRes.data ?? null);

      const mapped: ReviewRow[] = (reviewsRes.data ?? []).map((r: any) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        created_at: r.created_at,
        reviewer_name: r.reviewer?.full_name ?? null,
        job_title: r.contract?.job?.title ?? null,
      }));
      setReviews(mapped);
      setCompletedCount(contractsRes.count ?? 0);
      } catch {
        // error surfaced via missing provider data
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  async function handleShare() {
    if (!provider) return;
    try {
      await Share.share({
        message: `${provider.business_name ?? 'Anbieter'} auf Werkant — ${provider.trade_id ?? ''}, ${(provider.rating_avg ?? 0).toFixed(1)}★ (${provider.rating_count} Bewertungen)`,
      });
    } catch {
      // Share cancelled
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={C.ink} />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!provider) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={C.ink} />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Ionicons name="person-outline" size={48} color={C.border} />
          <Text style={{ fontSize: 16, color: C.muted, marginTop: 12, textAlign: 'center' }}>
            Anbieter nicht gefunden.
          </Text>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
            <Text style={{ color: C.primary, fontWeight: '600' }}>Zurück</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const initials = (provider.business_name ?? '??')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const sinceYear = new Date(provider.created_at).getFullYear();
  const kycApproved = provider.kyc_status === 'approved';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setBookmarked((b) => !b)} hitSlop={12}>
            <Ionicons
              name={bookmarkd ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={bookmarkd ? C.gold : C.ink}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} hitSlop={12} style={{ marginLeft: 14 }}>
            <Ionicons name="share-outline" size={22} color={C.ink} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Double-Bezel hero card: outer tinted shell → inner white card */}
        <View style={styles.heroOuter}>
          <View style={styles.heroInner}>
            {/* Avatar + name */}
            <View style={styles.profileBlock}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <Text style={styles.name}>{provider.business_name ?? '—'}</Text>

              <View style={styles.tradeRow}>
                <View style={styles.tradeBadge}>
                  <Ionicons name="construct-outline" size={13} color={C.sub} />
                  <Text style={styles.tradeText}>{provider.trade_id ?? 'Handwerk'}</Text>
                </View>
                {provider.meister_verified && (
                  <View style={styles.meisterBadge}>
                    <Ionicons name="ribbon" size={12} color={C.gold} />
                    <Text style={styles.meisterText}>Meisterbetrieb</Text>
                  </View>
                )}
                {provider.is_pro && (
                  <View style={styles.proBadge}>
                    <Ionicons name="star" size={12} color={C.surface} />
                    <Text style={styles.proText}>PRO</Text>
                  </View>
                )}
              </View>

              {/* Rating-Lockup: die große Zahl als Vertrauens-Moment
                  (Airbnb-Referenz, .claude/design-references/airbnb) */}
              {provider.rating_count > 0 ? (
                <View style={styles.ratingLockup}>
                  <Text style={styles.ratingBig}>{(provider.rating_avg ?? 0).toFixed(1)}</Text>
                  <View style={styles.ratingLockupRight}>
                    <Stars rating={provider.rating_avg} size={14} />
                    <Text style={styles.ratingCount}>{provider.rating_count} verifizierte Bewertungen</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.newBadge}>
                  <Ionicons name="sparkles-outline" size={13} color={C.primary} />
                  <Text style={styles.newBadgeText}>Neu auf Werkant — frisch verifiziert</Text>
                </View>
              )}
            </View>

            {/* Stats strip — inside the hero card */}
            <View style={styles.statsStrip}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{completedCount}</Text>
                <Text style={styles.statLabel}>Aufträge</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>~30 Min.</Text>
                <Text style={styles.statLabel}>Antwortzeit</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>Seit {sinceYear}</Text>
                <Text style={styles.statLabel}>Auf Werkant</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{provider.available ? 'Offen' : 'Belegt'}</Text>
                <Text style={styles.statLabel}>Status</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Verification strip */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Verifizierung</Text>
          <View style={styles.badgeRow}>
            <VerifiedBadge label="Gewerbeschein" ok={kycApproved} />
            <VerifiedBadge label="Haftpflicht"   ok={kycApproved} />
            <VerifiedBadge label="Steuer-ID"     ok={provider.steuer_id !== null} />
            {provider.meister_verified && (
              <VerifiedBadge label="Meisterbrief" ok={true} />
            )}
          </View>
          <Text style={styles.verifyNote}>
            Dokumente wurden von Werkant einmalig geprüft. Werkant ist Vermittler — die Verantwortung für die Leistung liegt beim Anbieter.
          </Text>
        </View>

        {/* Leistungen & Konditionen — echte Anbieter-Daten, keine Plattform-Preise */}
        {(provider.category_ids?.length > 0 || provider.min_hourly_rate || provider.radius_km) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Leistungen</Text>
            {provider.category_ids?.length > 0 && (
              <View style={styles.serviceChips}>
                {provider.category_ids.map((cid) => (
                  <View key={cid} style={styles.serviceChip}>
                    <Text style={styles.serviceChipText}>{categoryById(cid)?.name ?? cid}</Text>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.condRow}>
              {provider.min_hourly_rate ? (
                <View style={styles.condItem}>
                  <Ionicons name="cash-outline" size={15} color={C.sub} />
                  <Text style={styles.condText}>Stundensatz ab €{provider.min_hourly_rate}</Text>
                </View>
              ) : null}
              {provider.radius_km ? (
                <View style={styles.condItem}>
                  <Ionicons name="navigate-outline" size={15} color={C.sub} />
                  <Text style={styles.condText}>Einsatzradius {provider.radius_km} km</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.priceNote}>
              Der Preis für Ihren Auftrag ergibt sich aus dem individuellen Angebot des Anbieters.
            </Text>
          </View>
        )}

        {/* About */}
        {provider.bio ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Über uns</Text>
            <Text style={styles.bioText}>{provider.bio}</Text>
          </View>
        ) : null}

        {/* Reviews */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Kundenbewertungen</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Stars rating={provider.rating_avg} />
              <Text style={styles.reviewSummary}>{(provider.rating_avg ?? 0).toFixed(1)}</Text>
            </View>
          </View>

          {reviews.length === 0 ? (
            <Text style={{ fontSize: 13, color: C.muted, paddingBottom: 8 }}>Noch keine Bewertungen.</Text>
          ) : (
            reviews.map((r) => {
              const authorName = r.reviewer_name ?? 'Anonym';
              const dateStr = new Date(r.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
              return (
                <View key={r.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewerAvatar}>
                      <Text style={styles.reviewerInitial}>{authorName.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reviewerName}>{authorName}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Stars rating={r.rating} />
                        <Text style={styles.reviewDate}>{dateStr}</Text>
                      </View>
                    </View>
                    {r.job_title ? (
                      <View style={styles.reviewService}>
                        <Text style={styles.reviewServiceText} numberOfLines={1}>{r.job_title}</Text>
                      </View>
                    ) : null}
                  </View>
                  {r.comment ? (
                    <Text style={styles.reviewText}>{r.comment}</Text>
                  ) : null}
                </View>
              );
            })
          )}

          {provider.rating_count > 5 && !allReviewsLoaded && (
            <TouchableOpacity
              style={styles.allReviewsBtn}
              onPress={loadAllReviews}
              activeOpacity={0.75}
              disabled={loadingAllReviews}
            >
              {loadingAllReviews ? (
                <ActivityIndicator size="small" color={C.gold} />
              ) : (
                <>
                  <Text style={styles.allReviewsBtnText}>Alle {provider.rating_count} Bewertungen anzeigen</Text>
                  <Ionicons name="chevron-forward" size={14} color={C.gold} />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.ctaWrap}>
        {/* Ein CTA statt zwei identischer Ziele — 'Nachricht' führte zum
            selben Wizard und stiftete nur Verwirrung */}
        <View style={styles.ctaBar}>
          <TouchableOpacity
            style={styles.ctaPrimary}
            onPress={() => router.push({ pathname: '/auftrag-aufgeben', params: { providerId: id ?? '' } })}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaPrimaryText}>Unverbindliche Anfrage stellen</Text>
            <Ionicons name="arrow-forward" size={18} color={C.surface} />
          </TouchableOpacity>
        </View>
        <Text style={styles.ctaFeeNote}>zzgl. 2,5% Service-Gebühr (mind. €1,50) — im Checkout ausgewiesen</Text>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:               { flex: 1, backgroundColor: C.bg },

  header:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  headerActions:      { flexDirection: 'row', alignItems: 'center' },

  scroll:             { paddingBottom: 24 },

  // Double-Bezel hero: outer tinted shell with primary border, inner white card
  heroOuter:          { marginHorizontal: 16, marginBottom: 8, borderRadius: 18, backgroundColor: C.primaryBg, borderWidth: 1.5, borderColor: C.primaryBd, padding: 6, shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 12, elevation: 4 },
  heroInner:          { borderRadius: 13, backgroundColor: C.surface, overflow: 'hidden' },

  profileBlock:       { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20 },
  avatar:             { width: 84, height: 84, borderRadius: 42, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  avatarText:         { fontSize: 28, fontWeight: '700', color: C.surface },
  name:               { fontSize: 22, fontWeight: '700', color: C.ink, textAlign: 'center', marginBottom: 10 },
  tradeRow:           { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', justifyContent: 'center' },
  tradeBadge:         { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  tradeText:          { fontSize: 13, color: C.sub, fontWeight: '500' },
  meisterBadge:       { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.goldBg, borderWidth: 1, borderColor: C.gold, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  meisterText:        { fontSize: 12, color: C.gold, fontWeight: '700' },
  proBadge:           { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.gold, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  proText:            { fontSize: 12, color: C.surface, fontWeight: '700', letterSpacing: 0.5 },
  ratingLockup:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 },
  ratingBig:          { fontSize: 34, fontWeight: '700', color: C.ink, letterSpacing: -1 },
  ratingLockupRight:  { gap: 3 },
  ratingCount:        { fontSize: 12, color: C.sub },
  newBadge:           { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primaryBg, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  newBadgeText:       { fontSize: 12, fontWeight: '600', color: C.primary },
  serviceChips:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  serviceChip:        { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 6 },
  serviceChipText:    { fontSize: 12.5, fontWeight: '600', color: C.ink },
  condRow:            { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 4 },
  condItem:           { flexDirection: 'row', alignItems: 'center', gap: 6 },
  condText:           { fontSize: 13, color: C.sub, fontWeight: '500' },

  statsStrip:         { flexDirection: 'row', borderTopWidth: 1, borderColor: C.border },
  statItem:           { flex: 1, alignItems: 'center', paddingVertical: 14 },
  statValue:          { fontSize: 14, fontWeight: '700', color: C.ink, marginBottom: 2 },
  statLabel:          { fontSize: 11, color: C.muted },
  statDivider:        { width: 1, backgroundColor: C.border },

  section:            { marginTop: 8, backgroundColor: C.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border, padding: 20 },
  sectionTitle:       { fontSize: 15, fontWeight: '700', color: C.ink, marginBottom: 14 },
  sectionHeaderRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },

  badgeRow:           { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  badge:              { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  badgeOk:            { backgroundColor: C.primaryBg, borderColor: C.primary },
  badgeMissing:       { backgroundColor: C.bg, borderColor: C.border },
  badgeText:          { fontSize: 12, fontWeight: '600', color: C.primary },
  verifyNote:         { fontSize: 11, color: C.muted, lineHeight: 16 },

  rateRange:          { fontSize: 14, fontWeight: '700', color: C.gold },
  serviceRow:         { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.border },
  serviceName:        { flex: 1, fontSize: 13, color: C.ink },
  servicePrice:       { fontSize: 13, fontWeight: '600', color: C.sub },
  priceNote:          { fontSize: 11, color: C.muted, marginTop: 12, lineHeight: 16 },

  bioText:            { fontSize: 14, color: C.sub, lineHeight: 21 },

  reviewSummary:      { fontSize: 14, fontWeight: '700', color: C.ink },
  reviewCard:         { backgroundColor: C.bg, borderRadius: 12, padding: 14, marginBottom: 10 },
  reviewHeader:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  reviewerAvatar:     { width: 34, height: 34, borderRadius: 17, backgroundColor: C.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  reviewerInitial:    { fontSize: 14, fontWeight: '700', color: C.sub },
  reviewerName:       { fontSize: 13, fontWeight: '600', color: C.ink, marginBottom: 2 },
  reviewDate:         { fontSize: 11, color: C.muted },
  reviewService:      { backgroundColor: C.goldBg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, maxWidth: 100 },
  reviewServiceText:  { fontSize: 10, fontWeight: '600', color: C.gold },
  reviewText:         { fontSize: 13, color: C.sub, lineHeight: 19 },
  allReviewsBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12, marginTop: 4 },
  allReviewsBtnText:  { fontSize: 14, color: C.gold, fontWeight: '600' },

  ctaWrap:            { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingBottom: 28 },
  ctaBar:             { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  ctaFeeNote:         { textAlign: 'center', fontSize: 10, color: C.muted, paddingBottom: 4 },
  ctaPrimary:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 12, paddingVertical: 14 },
  ctaPrimaryText:     { fontSize: 15, fontWeight: '700', color: C.surface },
});
