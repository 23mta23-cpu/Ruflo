import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { safeBack } from '../lib/nav';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { shadow } from '../constants/theme';
import { T } from '../constants/typography';
import { StarRating } from '../components/ui/StarRating';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { fetchPublicProviders } from '../lib/providerPublic';
import { toast } from '../components/ui/Toast';
import { activeCategories } from '../data/categories';

type ProviderEntry = {
  providerId: string;
  businessName: string | null;
  tradeId: string | null;
  ratingAvg: number;
  ratingCount: number;
  kyc: string | null;
  available: boolean;
  lastJobId: string;
  lastBookedAt: string;
  totalJobs: number;
};

function tradeName(tradeId: string | null | undefined): string {
  if (!tradeId) return '';
  return activeCategories().find((c) => c.id === tradeId)?.name ?? tradeId;
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days < 1) return 'heute';
  if (days === 1) return 'gestern';
  if (days < 7) return `vor ${days} Tagen`;
  if (days < 30) return `vor ${Math.floor(days / 7)} Woche${Math.floor(days / 7) > 1 ? 'n' : ''}`;
  if (days < 365) return `vor ${Math.floor(days / 30)} Monat${Math.floor(days / 30) > 1 ? 'en' : ''}`;
  return `vor ${Math.floor(days / 365)} Jahr${Math.floor(days / 365) > 1 ? 'en' : ''}`;
}

export default function MeineAnbieterScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [providers, setProviders] = useState<ProviderEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let active = true;

    supabase
      .from('contracts')
      .select('job_id, provider_id, created_at')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })
      .then(async ({ data }) => {
        if (!active || !data) { setLoading(false); return; }
        const provMap = await fetchPublicProviders(
          data.map((r: any) => r.provider_id),
          'business_name, trade_id, rating_avg, rating_count, kyc_status, available',
        );
        if (!active) { setLoading(false); return; }

        // Deduplicate by provider_id, keep first occurrence (= most recent)
        const seen = new Set<string>();
        const countMap: Record<string, number> = {};
        for (const row of data) {
          countMap[row.provider_id] = (countMap[row.provider_id] ?? 0) + 1;
        }
        const list: ProviderEntry[] = [];
        for (const row of data) {
          if (seen.has(row.provider_id)) continue;
          seen.add(row.provider_id);
          const p = provMap[row.provider_id];
          list.push({
            providerId: row.provider_id,
            businessName: p?.business_name ?? null,
            tradeId: p?.trade_id ?? null,
            ratingAvg: p?.rating_avg ?? 0,
            ratingCount: p?.rating_count ?? 0,
            kyc: p?.kyc_status ?? null,
            available: p?.available ?? false,
            lastJobId: row.job_id,
            lastBookedAt: row.created_at,
            totalJobs: countMap[row.provider_id] ?? 1,
          });
        }
        setProviders(list);
        setLoading(false);
      }, () => {
        // Fehler nicht als leeren Zustand tarnen — sonst denkt der Nutzer, er
        // habe keine Anbieter, obwohl nur das Laden scheiterte.
        if (active) { toast.error('Anbieter konnten nicht geladen werden'); setLoading(false); }
      });

    return () => { active = false; };
  }, [user]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zurück" onPress={() => safeBack(router)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={C.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Meine Anbieter</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={C.ink} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zurück" onPress={() => safeBack(router)} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Meine Anbieter</Text>
          <Text style={styles.headerSub}>{providers.length} gebuchte Profis</Text>
        </View>
        <TouchableOpacity
          style={styles.searchBtn}
          onPress={() => router.push('/suche')}
          activeOpacity={0.8}
        >
          <Ionicons name="search-outline" size={20} color={C.ink} />
        </TouchableOpacity>
      </View>

      {providers.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="people-outline" size={40} color={C.border} />
          </View>
          <Text style={styles.emptyTitle}>Noch keine Anbieter</Text>
          <Text style={styles.emptyText}>
            Hier erscheinen Handwerker, sobald Sie Ihren ersten Auftrag vergeben haben.
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
          <Text style={styles.sortHint}>Sortiert nach letzter Buchung</Text>

          {providers.map((p) => {
            const initials = (p.businessName ?? '?').charAt(0).toUpperCase();
            const isVerified = p.kyc === 'approved';
            return (
              <View key={p.providerId} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.avatarWrap}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                    <View style={[styles.availDot, { backgroundColor: p.available ? C.primary : C.muted }]} />
                  </View>

                  <View style={styles.cardInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.provName}>{p.businessName ?? '—'}</Text>
                      {isVerified && <Ionicons name="checkmark-circle" size={14} color={C.gold} />}
                    </View>
                    <Text style={styles.provTrade}>{tradeName(p.tradeId)}</Text>
                    <StarRating rating={p.ratingAvg} count={p.ratingCount} />
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Ionicons name="briefcase-outline" size={13} color={C.muted} />
                    <Text style={styles.metaText}>{p.totalJobs}× gebucht</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="time-outline" size={13} color={C.muted} />
                    <Text style={styles.metaText}>Zuletzt {relativeDate(p.lastBookedAt)}</Text>
                  </View>
                </View>

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.actionChat}
                    onPress={() => router.push({ pathname: '/chat', params: { jobId: p.lastJobId, providerId: p.providerId } })}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="chatbubble-outline" size={15} color={C.sub} />
                    <Text style={styles.actionChatText}>Anfrage</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBook, !p.available && styles.actionBookDisabled]}
                    onPress={() => p.available && router.push({ pathname: '/anbieter', params: { id: p.providerId } })}
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
            );
          })}

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
  headerTitle:        { ...T.h3, fontWeight: '700', color: C.ink },
  headerSub:          { ...T.xs, fontSize: 12, color: C.sub, marginTop: 1 },
  searchBtn:          { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  scroll:             { paddingHorizontal: 16, paddingBottom: 48 },
  sortHint:           { ...T.xs, color: C.muted, marginBottom: 12, marginTop: 4 },
  card:               { ...shadow.sm,  backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.hair, padding: 14, marginBottom: 12 },
  cardTop:            { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  avatarWrap:         { position: 'relative', marginRight: 12 },
  avatar:             { width: 50, height: 50, borderRadius: 25, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center' },
  avatarText:         { fontSize: 20, fontWeight: '700', color: C.gold },
  availDot:           { position: 'absolute', bottom: 0, right: 0, width: 13, height: 13, borderRadius: 6.5, borderWidth: 2, borderColor: C.surface },
  cardInfo:           { flex: 1 },
  nameRow:            { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  provName:           { ...T.body, ...T.bold, color: C.ink },
  provTrade:          { ...T.xs, fontSize: 12, color: C.sub, marginBottom: 5 },
  metaRow:            { flexDirection: 'row', gap: 16, marginBottom: 10, flexWrap: 'wrap' },
  metaItem:           { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:           { ...T.xs, fontSize: 12, color: C.sub },
  actions:            { flexDirection: 'row', gap: 10 },
  actionChat:         { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 9, paddingHorizontal: 14, paddingVertical: 9 },
  actionChatText:     { ...T.sm, ...T.medium, color: C.sub },
  actionBook:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.primary, borderRadius: 9, paddingVertical: 9 },
  actionBookDisabled: { backgroundColor: C.border },
  actionBookText:     { ...T.sm, ...T.bold, color: C.surface },
  actionBookDisabledText: { ...T.sm, color: C.muted },
  discoverBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border, borderStyle: 'dashed', borderRadius: 12, padding: 16, marginTop: 4 },
  discoverBtnText:    { ...T.body, ...T.semibold, color: C.ink },
  emptyState:         { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon:          { width: 80, height: 80, borderRadius: 40, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle:         { ...T.xl, ...T.bold, color: C.ink, marginBottom: 10 },
  emptyText:          { ...T.body, color: C.sub, textAlign: 'center', marginBottom: 28 },
  emptyBtn:           { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText:       { fontSize: 14, fontWeight: '700', color: C.surface },
});
