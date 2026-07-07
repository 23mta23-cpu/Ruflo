import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { C } from '../constants/colors';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const REJECTION_REASONS = [
  { icon: 'document-outline',  text: 'Gewerbeschein war nicht lesbar, unvollständig oder abgelaufen.' },
  { icon: 'shield-outline',    text: 'Meisterbrief bzw. Ausnahmegenehmigung fehlte bei einem Meisterpflicht-Gewerk.' },
  { icon: 'warning-outline',   text: 'Profilangaben stimmten nicht mit den eingereichten Dokumenten überein.' },
] as const;

const CORRECTION_STEPS = [
  'Prüfen Sie, ob alle Dokumente vollständig und gültig sind.',
  'Gleichen Sie Ihre Profilangaben mit den Dokumenten ab.',
  'Reichen Sie Ihre Bewerbung erneut ein — wir prüfen sie sofort.',
];

export default function BewerbungAbgelehnt() {
  const router = useRouter();
  const { user } = useAuth();
  const [reason, setReason] = useState<string | null>(null);

  // Konkreten Ablehnungsgrund aus dem Review laden (Migration 037) —
  // generische Gründe bleiben als Fallback, wenn keiner hinterlegt ist.
  useEffect(() => {
    if (!user) return;
    supabase
      .from('provider_profiles')
      .select('kyc_rejected_reason')
      .eq('id', user.id)
      .maybeSingle<{ kyc_rejected_reason: string | null }>()
      .then(({ data }) => setReason(data?.kyc_rejected_reason ?? null));
  }, [user]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* X icon */}
        <View style={styles.iconOuter}>
          <View style={styles.iconInner}>
            <Ionicons name="close" size={32} color={C.red} />
          </View>
        </View>

        <Text style={styles.title}>Bewerbung abgelehnt</Text>
        <Text style={styles.sub}>
          Leider konnten wir Ihre Bewerbung in diesem Durchgang nicht genehmigen.
        </Text>

        {/* Konkreter Grund aus dem Review — wenn hinterlegt */}
        {reason ? (
          <View style={[styles.card, styles.reasonCard]}>
            <Text style={[styles.cardLabel, { color: C.clay }]}>IHR ABLEHNUNGSGRUND</Text>
            <Text style={styles.reasonText}>{reason}</Text>
          </View>
        ) : null}

        {/* Rejection reasons */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>HÄUFIGE ABLEHNUNGSGRÜNDE</Text>
          {REJECTION_REASONS.map(({ icon, text }) => (
            <View key={text} style={styles.reasonRow}>
              <Ionicons name={icon as any} size={16} color={C.clay} style={styles.reasonIcon} />
              <Text style={styles.reasonText}>{text}</Text>
            </View>
          ))}
        </View>

        {/* Correction steps */}
        <View style={[styles.card, styles.amberCard]}>
          <Text style={[styles.cardLabel, { color: C.amber }]}>SO KÖNNEN SIE ES KORRIGIEREN</Text>
          {CORRECTION_STEPS.map((text, i) => (
            <View key={i} style={styles.stepRow}>
              <Text style={styles.stepNum}>{i + 1}.</Text>
              <Text style={styles.stepText}>{text}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.replace('/onboarding-kyc')}
          activeOpacity={0.85}
        >
          <Ionicons name="refresh-outline" size={18} color={C.surface} />
          <Text style={styles.primaryBtnText}>Erneut bewerben</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.ghostBtn}
          onPress={() => router.push('/support-chat')}
          activeOpacity={0.85}
        >
          <Ionicons name="chatbubble-outline" size={16} color={C.ink} />
          <Text style={styles.ghostBtnText}>Support kontaktieren</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: C.bg },
  scroll:        { padding: 24, paddingTop: 40, alignItems: 'center' },
  iconOuter:     { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: C.red, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  iconInner:     { width: 60, height: 60, borderRadius: 30, backgroundColor: C.redBg, alignItems: 'center', justifyContent: 'center' },
  title:         { fontSize: 22, fontWeight: '700', color: C.ink, textAlign: 'center', marginBottom: 8, letterSpacing: -0.3 },
  sub:           { fontSize: 14, color: C.sub, textAlign: 'center', lineHeight: 22, marginBottom: 24, maxWidth: 300 },
  card:          { width: '100%', backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 12 },
  reasonCard:    { backgroundColor: C.clayBg, borderColor: C.clayBd },
  amberCard:     { backgroundColor: C.amberBg, borderColor: C.goldBd },
  cardLabel:     { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 14 },
  reasonRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  reasonIcon:    { marginTop: 2, flexShrink: 0 },
  reasonText:    { fontSize: 13, color: C.ink, lineHeight: 20, flex: 1 },
  stepRow:       { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 8 },
  stepNum:       { fontSize: 13, fontWeight: '700', color: C.amber, flexShrink: 0, width: 18 },
  stepText:      { fontSize: 13, color: C.ink, lineHeight: 20, flex: 1 },
  primaryBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', backgroundColor: C.primary, borderRadius: 12, paddingVertical: 15, marginTop: 8, marginBottom: 10 },
  primaryBtnText:{ fontSize: 15, fontWeight: '700', color: C.surface },
  ghostBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', backgroundColor: C.surface, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, paddingVertical: 14 },
  ghostBtnText:  { fontSize: 14, fontWeight: '600', color: C.ink },
});
