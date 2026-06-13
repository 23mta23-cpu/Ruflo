import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { Badge } from '../components/ui/Badge';
import { showAlert } from '../lib/alert';
import { loadAccount, saveAccount } from '../lib/account';

const CHECKLIST_ITEMS = [
  'Die vereinbarte Leistung wurde vollständig erbracht',
  'Die Arbeit wurde sauber und fachgerecht ausgeführt',
  'Ich habe keine Mängel festgestellt',
  'Ich bin mit dem Ergebnis zufrieden',
] as const;

export default function AuftragAbschliessenScreen() {
  const router = useRouter();
  const [checked, setChecked] = useState<boolean[]>(CHECKLIST_ITEMS.map(() => false));

  const allChecked = checked.every(Boolean);

  function toggleItem(index: number) {
    setChecked((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  }

  function handleRelease() {
    showAlert(
      'Zahlung freigeben?',
      '€ 120,00 werden jetzt an Yilmaz GmbH ausgezahlt. Bitte bewerten Sie anschließend den Auftrag.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Freigeben',
          style: 'default',
          onPress: async () => {
            const acc = await loadAccount();
            await saveAccount({
              nbTransactionCount: acc.nbTransactionCount + 1,
              nbTotalEarnings: acc.nbTotalEarnings + 120,
            });
            router.replace('/bewertung');
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Auftrag abschließen</Text>
        <Badge label="Escrow aktiv" variant="amber" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryTopRow}>
            <View style={styles.summaryOrderId}>
              <Ionicons name="document-text-outline" size={13} color={C.muted} />
              <Text style={styles.summaryOrderIdText}>WRK-2406-0047</Text>
            </View>
            <View style={styles.summaryDateRow}>
              <Ionicons name="calendar-outline" size={13} color={C.muted} />
              <Text style={styles.summaryDateText}>Mo., 09. Jun 2025</Text>
            </View>
          </View>

          <Text style={styles.summaryService}>Heizkörper-Diagnose & Thermostat</Text>

          <View style={styles.summaryProviderRow}>
            <View style={styles.summaryAvatarWrap}>
              <View style={styles.summaryAvatar}>
                <Text style={styles.summaryAvatarText}>Y</Text>
              </View>
              <View style={styles.summaryVerifiedBadge}>
                <Ionicons name="checkmark" size={9} color={C.surface} />
              </View>
            </View>
            <Text style={styles.summaryProviderName}>Yilmaz GmbH</Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryAmountRow}>
            <Text style={styles.summaryAmountLabel}>Hinterlegter Escrow-Betrag</Text>
            <Text style={styles.summaryAmountValue}>€ 120,00</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bitte prüfen Sie vor der Freigabe</Text>
          <View style={styles.checklistCard}>
            {CHECKLIST_ITEMS.map((item, index) => {
              const isChecked = checked[index];
              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.checklistItem, isChecked && styles.checklistItemChecked]}
                  onPress={() => toggleItem(index)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isChecked ? 'checkbox' : 'checkbox-outline'}
                    size={24}
                    color={isChecked ? C.green : C.muted}
                  />
                  <Text style={[styles.checklistText, isChecked && styles.checklistTextChecked]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.releaseInfoBanner}>
          <View style={styles.releaseInfoIconWrap}>
            <Ionicons name="lock-open-outline" size={20} color={C.green} />
          </View>
          <Text style={styles.releaseInfoText}>
            Nach Ihrer Freigabe wird der Betrag sofort an Yilmaz GmbH ausgezahlt. Dies kann nicht rückgängig gemacht werden.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.problemBtn}
          onPress={() => router.push('/reklamation')}
          activeOpacity={0.7}
        >
          <Ionicons name="alert-circle-outline" size={18} color={C.red} />
          <Text style={styles.problemBtnText}>Problem melden / Reklamation</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.releaseBtn, !allChecked && styles.releaseBtnDisabled]}
          onPress={allChecked ? handleRelease : undefined}
          activeOpacity={allChecked ? 0.85 : 1}
        >
          <Ionicons
            name="lock-open"
            size={20}
            color={allChecked ? C.surface : C.muted}
          />
          <Text style={[styles.releaseBtnText, !allChecked && styles.releaseBtnTextDisabled]}>
            Zahlung freigeben & Auftrag abschließen
          </Text>
        </TouchableOpacity>
        <Text style={styles.footerHint}>
          ⚡ Auszahlung in der Regel innerhalb von 1–3 Werktagen via Stripe
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:                { flex: 1, backgroundColor: C.bg },

  header:                   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14 },
  backBtn:                  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:              { fontSize: 17, fontWeight: '800', color: C.ink, flex: 1, marginLeft: 4 },

  scrollContent:            { paddingHorizontal: 20, paddingBottom: 140, paddingTop: 4 },

  summaryCard:              { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 18, marginBottom: 24 },
  summaryTopRow:            { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryOrderId:           { flexDirection: 'row', alignItems: 'center', gap: 5 },
  summaryOrderIdText:       { fontSize: 12, color: C.muted, fontWeight: '500' },
  summaryDateRow:           { flexDirection: 'row', alignItems: 'center', gap: 5 },
  summaryDateText:          { fontSize: 12, color: C.muted },
  summaryService:           { fontSize: 18, fontWeight: '800', color: C.ink, marginBottom: 12, lineHeight: 24 },
  summaryProviderRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  summaryAvatarWrap:        { position: 'relative' },
  summaryAvatar:            { width: 36, height: 36, borderRadius: 18, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center' },
  summaryAvatarText:        { fontSize: 16, fontWeight: '700', color: C.gold },
  summaryVerifiedBadge:     { position: 'absolute', bottom: -2, right: -2, width: 15, height: 15, borderRadius: 8, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.surface },
  summaryProviderName:      { fontSize: 14, fontWeight: '700', color: C.ink },
  summaryDivider:           { height: 1, backgroundColor: C.border, marginBottom: 16 },
  summaryAmountRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryAmountLabel:       { fontSize: 13, color: C.sub },
  summaryAmountValue:       { fontSize: 28, fontWeight: '800', color: C.gold, letterSpacing: -0.5 },

  section:                  { marginBottom: 20 },
  sectionTitle:             { fontSize: 13, fontWeight: '700', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },

  checklistCard:            { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, overflow: 'hidden' },
  checklistItem:            { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  checklistItemChecked:     { backgroundColor: C.greenBg },
  checklistText:            { flex: 1, fontSize: 14, color: C.ink, lineHeight: 20 },
  checklistTextChecked:     { color: C.green, fontWeight: '600' },

  releaseInfoBanner:        { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: C.greenBg, borderWidth: 1, borderColor: '#B5DEC8', borderRadius: 12, padding: 14, marginBottom: 16 },
  releaseInfoIconWrap:      { width: 32, height: 32, borderRadius: 16, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  releaseInfoText:          { flex: 1, fontSize: 13, color: C.green, fontWeight: '500', lineHeight: 19 },

  problemBtn:               { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: C.red, borderRadius: 12, paddingVertical: 13, backgroundColor: C.surface },
  problemBtnText:           { fontSize: 14, fontWeight: '700', color: C.red },

  footer:                   { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 28 },
  releaseBtn:               { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.green, borderRadius: 14, paddingVertical: 16 },
  releaseBtnDisabled:       { backgroundColor: '#D8D7D3' },
  releaseBtnText:           { fontSize: 16, fontWeight: '800', color: C.surface },
  releaseBtnTextDisabled:   { color: C.muted },
  footerHint:               { fontSize: 12, color: C.muted, textAlign: 'center', marginTop: 10 },
});
