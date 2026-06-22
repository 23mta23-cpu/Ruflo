import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { T } from '../constants/typography';
import { showAlert } from '../lib/alert';
import { supabase } from '../lib/supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

type Step = 'confirm' | 'cancelled';

const REASONS = [
  'Termin passt nicht mehr',
  'Habe einen anderen Anbieter gefunden',
  'Auftrag wird nicht mehr benötigt',
  'Preis zu hoch',
  'Sonstiges',
] as const;

export default function StornierungScreen() {
  const router = useRouter();
  const { jobTitle, hoursUntil, contractId } = useLocalSearchParams<{
    jobTitle?: string;
    hoursUntil?: string;
    contractId?: string;
  }>();

  const title     = jobTitle ?? 'Heizungswartung';
  const hours     = parseInt(hoursUntil ?? '72', 10);
  const refundPct = hours > 48 ? 100 : hours > 24 ? 50 : 0;

  const [step,          setStep]          = useState<Step>('confirm');
  const [reason,        setReason]        = useState<string | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [refundAmountEur, setRefundAmountEur] = useState<string>('0.00');

  async function handleCancel() {
    if (!reason) {
      showAlert('Grund erforderlich', 'Bitte wähle einen Stornierungsgrund.', [{ text: 'OK' }]);
      return;
    }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Nicht eingeloggt');

      const res = await fetch(`${SUPABASE_URL}/functions/v1/cancel-contract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ contract_id: contractId ?? 'preview', reason }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setRefundAmountEur(data.refund_amount_eur ?? '0.00');
      setStep('cancelled');
    } catch (err: any) {
      showAlert('Stornierung fehlgeschlagen', err?.message ?? 'Bitte erneut versuchen.', [{ text: 'OK' }]);
    } finally {
      setLoading(false);
    }
  }

  if (step === 'cancelled') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.successBox}>
          <View style={[styles.iconCircle, { backgroundColor: refundPct > 0 ? C.primaryBg : C.amberBg }]}>
            <Ionicons
              name={refundPct > 0 ? 'checkmark-circle' : 'alert-circle'}
              size={40}
              color={refundPct > 0 ? C.primary : C.amber}
            />
          </View>
          <Text style={styles.successTitle}>Auftrag storniert</Text>
          <Text style={styles.successSub}>
            {refundPct === 100
              ? `Volle Rückerstattung — €${refundAmountEur} werden innerhalb von 3–5 Werktagen zurückgebucht.`
              : refundPct === 50
              ? `50 % Rückerstattung — €${refundAmountEur} werden innerhalb von 3–5 Werktagen zurückgebucht.`
              : 'Keine Rückerstattung gemäß Stornierungsrichtlinie (unter 24h vor Termin).'}
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(tabs)/auftraege')}>
            <Text style={styles.primaryBtnText}>Meine Aufträge</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.replace('/(tabs)/')}>
            <Text style={styles.secondaryBtnText}>Zur Startseite</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Stornierung</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Job card */}
        <View style={styles.section}>
          <View style={styles.jobCard}>
            <Ionicons name="construct-outline" size={18} color={C.sub} />
            <View style={{ flex: 1 }}>
              <Text style={styles.jobTitle}>{title}</Text>
              <Text style={styles.jobSub}>Auftrag #{contractId?.slice(0, 8) ?? '–'}</Text>
            </View>
          </View>
        </View>

        {/* Refund policy */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Rückerstattung</Text>
          {[
            { label: '> 48h vor Termin', pct: '100 %', active: hours > 48 },
            { label: '24–48h vor Termin', pct: '50 %',  active: hours <= 48 && hours > 24 },
            { label: '< 24h / No-Show',  pct: '0 %',   active: hours <= 24 },
          ].map((row) => (
            <View key={row.label} style={[styles.policyRow, row.active && styles.policyRowActive]}>
              <Text style={[styles.policyLabel, row.active && styles.policyLabelActive]}>{row.label}</Text>
              <Text style={[styles.policyPct,   row.active && styles.policyPctActive]}>{row.pct}</Text>
            </View>
          ))}
          <View style={[styles.refundBox, { backgroundColor: refundPct > 0 ? C.primaryBg : C.amberBg }]}>
            <Ionicons
              name={refundPct > 0 ? 'checkmark-circle-outline' : 'alert-circle-outline'}
              size={16}
              color={refundPct > 0 ? C.primary : C.amber}
            />
            <Text style={[styles.refundText, { color: refundPct > 0 ? C.primary : C.amber }]}>
              {refundPct === 100 ? 'Volle Rückerstattung'
                : refundPct === 50 ? '50 % Rückerstattung'
                : 'Keine Rückerstattung'}
            </Text>
          </View>
        </View>

        {/* Reason */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Stornierungsgrund *</Text>
          {REASONS.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.reasonRow, reason === r && styles.reasonRowActive]}
              onPress={() => setReason(r)}
              activeOpacity={0.75}
            >
              <View style={[styles.radio, reason === r && styles.radioActive]}>
                {reason === r && <View style={styles.radioDot} />}
              </View>
              <Text style={[styles.reasonText, reason === r && styles.reasonTextActive]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={styles.ctaBar}>
        <TouchableOpacity
          style={[styles.cancelBtn, (!reason || loading) && styles.cancelBtnDisabled]}
          onPress={handleCancel}
          disabled={!reason || loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.cancelBtnText}>Auftrag stornieren</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg },
  header:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
  backBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { ...T.h3, flex: 1, color: C.ink },

  section:      { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 },

  jobCard:      { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14 },
  jobTitle:     { fontSize: 14, fontWeight: '700', color: C.ink },
  jobSub:       { fontSize: 12, color: C.sub, marginTop: 2 },

  policyRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, marginBottom: 4, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  policyRowActive: { backgroundColor: C.primaryBg, borderColor: C.primary },
  policyLabel:  { fontSize: 13, color: C.sub },
  policyLabelActive: { color: C.primary, fontWeight: '600' },
  policyPct:    { fontSize: 13, fontWeight: '700', color: C.muted },
  policyPctActive: { color: C.primary },
  refundBox:    { flexDirection: 'row', gap: 8, alignItems: 'center', borderRadius: 10, padding: 12, marginTop: 10 },
  refundText:   { fontSize: 13, fontWeight: '600' },

  reasonRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, marginBottom: 8, backgroundColor: C.surface },
  reasonRowActive: { borderColor: C.primary, backgroundColor: C.primaryBg },
  radio:        { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  radioActive:  { borderColor: C.primary },
  radioDot:     { width: 10, height: 10, borderRadius: 5, backgroundColor: C.primary },
  reasonText:   { fontSize: 14, color: C.ink },
  reasonTextActive: { fontWeight: '600', color: C.primary },

  ctaBar:       { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, padding: 16, paddingBottom: 28 },
  cancelBtn:    { backgroundColor: C.red, borderRadius: 12, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  cancelBtnDisabled: { backgroundColor: C.border },
  cancelBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  successBox:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  iconCircle:   { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  successTitle: { ...T.h2, color: C.ink, marginBottom: 12, textAlign: 'center' },
  successSub:   { fontSize: 14, color: C.sub, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  primaryBtn:   { backgroundColor: C.ink, borderRadius: 12, paddingVertical: 15, paddingHorizontal: 40, marginBottom: 12 },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  secondaryBtn: { paddingVertical: 10 },
  secondaryBtnText: { fontSize: 14, color: C.sub },
});
