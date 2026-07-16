import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { AnimatedButton } from '../../components/ui/AnimatedButton';

// Pro-Subscription UI-Skeleton.
// Backend-Integration ausstehend:
//   POST /api/pro/subscribe  → Stripe Billing subscription creation
//   POST /api/pro/cancel     → cancel_at_period_end = true
//   GET  /api/pro/status     → { active, currentPeriodEnd, cancelAtPeriodEnd }
// AGB §6 Abs. 3: Kündigung 1 Monat zum Monatsende.

const PRO_FEATURES = [
  {
    icon: 'star' as const,
    title: 'Bevorzugte Platzierung',
    desc: 'Dein Profil erscheint weiter oben in der Handwerkersuche.',
  },
  {
    icon: 'bar-chart' as const,
    title: 'Erweiterte Statistiken',
    desc: 'Detaillierte Auftragsdaten, Conversion-Rate und Umsatztrends.',
  },
  {
    icon: 'flash' as const,
    title: 'Sofort-Anfragen',
    desc: 'Neue Anfragen in deiner Region erreichen dich zuerst.',
  },
  {
    icon: 'headset' as const,
    title: 'Prioritäts-Support',
    desc: 'Direkter Kontakt zum Werkant-Team — Antwort in unter 4 Stunden.',
  },
  {
    icon: 'shield-checkmark' as const,
    title: 'Pro-Badge',
    desc: 'Sichtbares Vertrauenssignal auf deinem Profil und in Suchergebnissen.',
  },
  {
    icon: 'calendar' as const,
    title: 'Kalender-Sync',
    desc: 'Google Kalender & iCal-Integration für automatische Verfügbarkeit.',
  },
];

type ProStatus = 'loading' | 'inactive' | 'active' | 'trialing' | 'cancel_scheduled';

export default function ProScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<ProStatus>('loading');
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);
  const [trialUsed, setTrialUsed] = useState(false);
  const [working] = useState(false); // placeholder until Stripe Billing cancel endpoint is live

  useEffect(() => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) setStatus((cur) => (cur === 'loading' ? 'inactive' : cur));
    }, 6000);
    loadStatus().finally(() => { settled = true; clearTimeout(timer); });
    return () => clearTimeout(timer);
  }, []);

  async function loadStatus() {
    try {
      // Supabase-first: if webhook has set a real subscription, trust it
      const { data: { user } } = await Promise.race([
        supabase.auth.getUser(),
        new Promise<{ data: { user: null } }>((resolve) => setTimeout(() => resolve({ data: { user: null } }), 5000)),
      ]) as { data: { user: { id: string } | null } };
      if (user) {
        const { data: sub } = await supabase
          .from('pro_subscriptions')
          .select('status, period_end, trial_used')
          .eq('provider_id', user.id)
          .maybeSingle<{ status: string; period_end: string | null; trial_used: boolean }>();
        if (sub && sub.status !== 'inactive') {
          setStatus(sub.status as ProStatus);
          setPeriodEnd(
            sub.period_end
              ? new Date(sub.period_end).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
              : null,
          );
          setTrialUsed(sub.trial_used ?? false);
          return;
        }
      }
    } catch {
      // Fehler beim Laden -> nicht ewig im Skeleton haengen bleiben.
    }
    // Default (auch bei Fehler): normaler Angebots-Screen statt Endlos-Skeleton.
    setStatus('inactive');
  }

  async function handleSubscribe() {
    Alert.alert(
      'Bald verfügbar',
      'Werkant Pro wird in Kürze freigeschaltet. Wir benachrichtigen dich, sobald du dich anmelden kannst.',
      [{ text: 'OK' }],
    );
  }

  async function handleCancel() {
    Alert.alert(
      'Pro kündigen',
      'Kündige per E-Mail an support@werkant.de — Betreff: "Pro kündigen". Dein Zugang bleibt bis Monatsende aktiv (AGB §6 Abs. 3).',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'E-Mail öffnen',
          onPress: () => Linking.openURL('mailto:support@werkant.de?subject=Pro%20k%C3%BCndigen'),
        },
      ],
    );
  }

  if (status === 'loading') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={{ padding: 20, gap: 12 }}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </View>
      </SafeAreaView>
    );
  }

  const isActive = status === 'active' || status === 'trialing' || status === 'cancel_scheduled';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={22} color={C.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Werkant Pro</Text>
          <View style={{ width: 34 }} />
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <Ionicons name="star" size={18} color={C.gold} />
            <Text style={styles.heroBadgeText}>PRO</Text>
          </View>
          <Text style={styles.heroTitle}>Mehr Aufträge.{'\n'}Mehr Einnahmen.</Text>
          <Text style={styles.heroSub}>
            Alle Premium-Funktionen für professionelle Handwerker auf einer Plattform.
          </Text>
        </View>

        {/* Status Banner (wenn aktiv) */}
        {isActive && (
          <View style={[styles.statusBanner, status === 'cancel_scheduled' ? styles.statusAmber : styles.statusGreen]}>
            <Ionicons
              name={status === 'cancel_scheduled' ? 'warning-outline' : 'checkmark-circle'}
              size={18}
              color={status === 'cancel_scheduled' ? C.amber : C.primary}
            />
            <Text style={[styles.statusText, { color: status === 'cancel_scheduled' ? C.amber : C.primary }]}>
              {status === 'cancel_scheduled'
                ? `Pro läuft bis ${periodEnd ?? 'Monatsende'} — dann beendet`
                : status === 'trialing'
                  ? `Kostenlose Testphase aktiv bis ${periodEnd ?? 'Monatsende'}`
                  : 'Pro ist aktiv'}
            </Text>
          </View>
        )}

        {/* Pricing Card */}
        {!isActive && (
          <View style={styles.pricingCard}>
            <View style={styles.pricingRow}>
              <Text style={styles.price}>€29</Text>
              <Text style={styles.pricePer}>/Monat</Text>
            </View>
            <Text style={styles.pricingNote}>
              Jederzeit kündbar — 1 Monat zum Monatsende (AGB §6 Abs. 3)
            </Text>
            <AnimatedButton
              style={[styles.ctaBtn, working && styles.ctaBtnDisabled]}
              onPress={handleSubscribe}
              disabled={working}
            >
              {working
                ? <ActivityIndicator color={C.surface} size="small" />
                : <>
                  <Ionicons name="star" size={18} color={C.surface} />
                  <Text style={styles.ctaBtnText}>Pro aktivieren</Text>
                </>
              }
            </AnimatedButton>
          </View>
        )}

        {/* Features List */}
        <Text style={styles.sectionTitle}>Was du bekommst</Text>

        {PRO_FEATURES.map((f) => (
          <View key={f.title} style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Ionicons name={f.icon} size={20} color={C.gold} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
            {isActive && (
              <Ionicons name="checkmark-circle" size={20} color={C.primary} />
            )}
          </View>
        ))}

        {/* FAQ */}
        <Text style={styles.sectionTitle}>Wichtiges</Text>

        <View style={styles.faqCard}>
          <Text style={styles.faqQ}>Wann werde ich belastet?</Text>
          <Text style={styles.faqA}>
            Monatlich im Voraus ab Aktivierung. Keine Mindestlaufzeit.
          </Text>
        </View>
        <View style={styles.faqCard}>
          <Text style={styles.faqQ}>Wie kündige ich?</Text>
          <Text style={styles.faqA}>
            Hier in der App jederzeit. Die Kündigung gilt zum Ende des laufenden Monats. Bereits bezahlte Beträge werden nicht erstattet.
          </Text>
        </View>
        <View style={styles.faqCard}>
          <Text style={styles.faqQ}>Gibt es eine Testphase?</Text>
          <Text style={styles.faqA}>
            Neue Anbieter erhalten die ersten 30 Tage kostenlos — danach monatlich €29.
          </Text>
        </View>

        {/* Cancel CTA (wenn aktiv und nicht schon gekündigt) */}
        {(status === 'active' || status === 'trialing') && (
          <AnimatedButton
            style={styles.cancelBtn}
            onPress={handleCancel}
            disabled={working}
          >
            <Text style={styles.cancelBtnText}>
              {status === 'trialing' ? 'Testphase beenden' : 'Pro kündigen'}
            </Text>
          </AnimatedButton>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: C.bg },
  center:          { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  backBtn:         { padding: 4 },
  headerTitle:     { fontSize: 17, fontWeight: '700', color: C.ink },
  hero:            { alignItems: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 28 },
  heroBadge:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.goldBg, borderWidth: 1, borderColor: C.gold, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 16 },
  heroBadgeText:   { fontSize: 13, fontWeight: '700', color: C.gold, letterSpacing: 1 },
  heroTitle:       { fontSize: 28, fontWeight: '700', color: C.ink, textAlign: 'center', lineHeight: 34, marginBottom: 10 },
  heroSub:         { fontSize: 15, color: C.sub, textAlign: 'center', lineHeight: 22 },
  statusBanner:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginBottom: 20, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1 },
  statusGreen:     { backgroundColor: C.primaryBg, borderColor: C.primary },
  statusAmber:     { backgroundColor: C.amberBg, borderColor: C.amber },
  statusText:      { fontSize: 14, fontWeight: '600', flex: 1 },
  pricingCard:     { marginHorizontal: 20, marginBottom: 28, backgroundColor: C.surface, borderRadius: 16, borderWidth: 1.5, borderColor: C.gold, padding: 24, alignItems: 'center' },
  pricingRow:      { flexDirection: 'row', alignItems: 'baseline', gap: 2, marginBottom: 6 },
  price:           { fontSize: 48, fontWeight: '700', color: C.ink },
  pricePer:        { fontSize: 18, color: C.sub, fontWeight: '500' },
  pricingNote:     { fontSize: 12, color: C.muted, textAlign: 'center', marginBottom: 20, lineHeight: 18 },
  ctaBtn:          { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 14, width: '100%', justifyContent: 'center' },
  ctaBtnDisabled:  { opacity: 0.5 },
  ctaBtnText:      { fontSize: 16, fontWeight: '700', color: C.surface },
  sectionTitle:    { fontSize: 17, fontWeight: '700', color: C.ink, paddingHorizontal: 20, marginBottom: 12, marginTop: 4 },
  featureRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  featureIcon:     { width: 40, height: 40, borderRadius: 10, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center' },
  featureText:     { flex: 1 },
  featureTitle:    { fontSize: 15, fontWeight: '600', color: C.ink, marginBottom: 2 },
  featureDesc:     { fontSize: 13, color: C.sub, lineHeight: 18 },
  faqCard:         { marginHorizontal: 20, marginBottom: 10, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 16 },
  faqQ:            { fontSize: 14, fontWeight: '600', color: C.ink, marginBottom: 4 },
  faqA:            { fontSize: 13, color: C.sub, lineHeight: 19 },
  cancelBtn:       { marginHorizontal: 20, marginTop: 24, borderWidth: 1, borderColor: C.red, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  cancelBtnText:   { fontSize: 15, fontWeight: '600', color: C.red },
});
