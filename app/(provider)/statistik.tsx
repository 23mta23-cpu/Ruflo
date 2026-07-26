// Anbieter-Statistik: der Founder fragte, wo ein Anbieter seine Zahlen sieht
// (Feedback 26.07.). Das Dashboard zeigt nur „heute" — hier liegen die
// Kennzahlen über 30/90 Tage: Umsatz, Angebots-Annahmequote, abgeschlossene
// Aufträge, Bewertungsschnitt.
//
// Bewusst read-only und ohne neue Tabellen: alles aus contracts/offers/
// provider_profiles, RLS scoped den Anbieter ohnehin auf seine eigenen Zeilen.

import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/colors';
import { T } from '../../constants/typography';
import { safeBack } from '../../lib/nav';
import { Reveal } from '../../components/ui/Reveal';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

type Stats = {
  revenue30: number;
  revenue90: number;
  completed30: number;
  completedTotal: number;
  offersSent: number;
  offersAccepted: number;
  rating: number;
  ratingCount: number;
  avgTicket: number;
};

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

async function loadStats(userId: string): Promise<Stats> {
  const since90 = daysAgoIso(90);
  const since30 = daysAgoIso(30);

  const [contractsRes, offersRes, profileRes] = await Promise.all([
    supabase
      .from('contracts')
      .select('status, provider_commission, completed_at')
      .eq('provider_id', userId),
    supabase
      .from('offers')
      .select('status, created_at')
      .eq('provider_id', userId)
      .gte('created_at', since90),
    supabase
      .from('provider_profiles')
      .select('rating_avg, rating_count')
      .eq('id', userId)
      .maybeSingle(),
  ]);

  const contracts = (contractsRes.data ?? []) as any[];
  let revenue30 = 0, revenue90 = 0, completed30 = 0, completedTotal = 0;

  for (const c of contracts) {
    if (c.status !== 'completed' || !c.completed_at) continue;
    const net = c.provider_commission ?? 0;
    completedTotal++;
    if (c.completed_at >= since90) revenue90 += net;
    if (c.completed_at >= since30) { revenue30 += net; completed30++; }
  }

  const offers = (offersRes.data ?? []) as any[];
  const offersSent = offers.length;
  const offersAccepted = offers.filter((o) => o.status === 'accepted').length;

  return {
    revenue30: Math.round(revenue30),
    revenue90: Math.round(revenue90),
    completed30,
    completedTotal,
    offersSent,
    offersAccepted,
    rating: profileRes.data?.rating_avg ?? 0,
    ratingCount: profileRes.data?.rating_count ?? 0,
    avgTicket: completedTotal > 0 ? Math.round(revenue90 / Math.max(1, completedTotal)) : 0,
  };
}

export default function StatistikScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!user) { setLoading(false); return; }
      loadStats(user.id)
        .then((s) => { if (active) { setStats(s); setLoading(false); } })
        .catch(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, [user]),
  );

  const quote = stats && stats.offersSent > 0
    ? Math.round((stats.offersAccepted / stats.offersSent) * 100)
    : null;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Zurück"
          onPress={() => safeBack(router)}
          style={s.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={s.title}>Statistik</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.ink} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <Reveal delay={30}>
            <Text style={s.groupTitle}>Umsatz (dein Anteil nach Gebühren)</Text>
            <View style={s.cardRow}>
              <View style={s.kpiCard}>
                <Text style={s.kpiValue}>€{stats?.revenue30 ?? 0}</Text>
                <Text style={s.kpiLabel}>Letzte 30 Tage</Text>
              </View>
              <View style={s.kpiCard}>
                <Text style={s.kpiValue}>€{stats?.revenue90 ?? 0}</Text>
                <Text style={s.kpiLabel}>Letzte 90 Tage</Text>
              </View>
            </View>
          </Reveal>

          <Reveal delay={80}>
            <Text style={s.groupTitle}>Aufträge</Text>
            <View style={s.card}>
              <Row label="Abgeschlossen (30 Tage)" value={`${stats?.completed30 ?? 0}`} />
              <View style={s.sep} />
              <Row label="Abgeschlossen (gesamt)" value={`${stats?.completedTotal ?? 0}`} />
              <View style={s.sep} />
              <Row label="Ø Auftragswert" value={`€${stats?.avgTicket ?? 0}`} />
            </View>
          </Reveal>

          <Reveal delay={130}>
            <Text style={s.groupTitle}>Angebote (90 Tage)</Text>
            <View style={s.card}>
              <Row label="Abgegeben" value={`${stats?.offersSent ?? 0}`} />
              <View style={s.sep} />
              <Row label="Angenommen" value={`${stats?.offersAccepted ?? 0}`} />
              <View style={s.sep} />
              <Row
                label="Annahmequote"
                value={quote === null ? '—' : `${quote} %`}
                highlight={quote !== null && quote >= 30}
              />
            </View>
            {quote !== null && quote < 20 ? (
              <Text style={s.hint}>
                Tipp: Unter 20 % Annahmequote hilft meist eine konkretere
                Leistungsbeschreibung im Angebot — Kunden vergleichen vor allem Klarheit.
              </Text>
            ) : null}
          </Reveal>

          <Reveal delay={180}>
            <Text style={s.groupTitle}>Bewertung</Text>
            <View style={s.card}>
              <Row
                label="Durchschnitt"
                value={stats && stats.ratingCount > 0 ? `${stats.rating.toFixed(1)} / 5` : 'Noch keine'}
              />
              <View style={s.sep} />
              <Row label="Anzahl Bewertungen" value={`${stats?.ratingCount ?? 0}`} />
            </View>
          </Reveal>

          <Text style={s.footnote}>
            Umsatz zählt nur abgeschlossene Aufträge und ist dein Auszahlungsbetrag
            nach Werkant-Gebühr. Steuerliche Auswertungen findest du unter
            PStTG/DAC7 in den Einstellungen.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, highlight && { color: C.primary }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: C.bg },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  backBtn:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:      { fontSize: 17, fontWeight: '700', color: C.ink },
  groupTitle: { ...T.label, color: C.sub, marginHorizontal: 20, marginTop: 18, marginBottom: 8 },
  cardRow:    { flexDirection: 'row', gap: 12, marginHorizontal: 20 },
  kpiCard:    { flex: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 16, alignItems: 'center', gap: 4 },
  kpiValue:   { fontSize: 24, fontWeight: '700', color: C.ink },
  kpiLabel:   { ...T.caption, color: C.muted, textAlign: 'center' },
  card:       { marginHorizontal: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, overflow: 'hidden' },
  row:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 13 },
  rowLabel:   { ...T.body, color: C.sub, flex: 1, paddingRight: 12 },
  rowValue:   { ...T.body, color: C.ink, fontWeight: '700' },
  sep:        { height: 1, backgroundColor: C.border },
  hint:       { ...T.caption, color: C.sub, marginHorizontal: 20, marginTop: 8, lineHeight: 16 },
  footnote:   { ...T.caption, color: C.muted, marginHorizontal: 20, marginTop: 20, lineHeight: 16 },
});
