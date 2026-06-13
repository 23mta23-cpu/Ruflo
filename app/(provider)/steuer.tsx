import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Linking, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { C } from '../../constants/colors';
import { showAlert } from '../../lib/alert';

const YEAR = 2026;
const TOTAL_EARNINGS = 1847;
const PSTG_THRESHOLD = 2000;
const TOTAL_AUFTRAEGE = 23;

type MonthRow = {
  month: string;
  amount: number;
};

const MONTHLY: MonthRow[] = [
  { month: 'Jun', amount: 420 },
  { month: 'Mai', amount: 380 },
  { month: 'Apr', amount: 290 },
  { month: 'Mrz', amount: 350 },
  { month: 'Feb', amount: 260 },
  { month: 'Jan', amount: 147 },
];

const MONTHLY_MAX = Math.max(...MONTHLY.map((m) => m.amount));

const PROGRESS_PCT = Math.min(TOTAL_EARNINGS / PSTG_THRESHOLD, 1);
const REMAINING = PSTG_THRESHOLD - TOTAL_EARNINGS;

export default function ProviderSteuerScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Steuer & Einnahmen</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.earningsCard}>
          <Text style={styles.earningsLabel}>Einnahmen {YEAR}</Text>
          <Text style={styles.earningsAmount}>€ 1.847,00</Text>
          <View style={styles.earningsMeta}>
            <Ionicons name="calendar-outline" size={13} color={C.amber} />
            <Text style={styles.earningsMetaText}>
              Dieses Jahr · {TOTAL_AUFTRAEGE} Aufträge
            </Text>
          </View>

          <View style={styles.progressSection}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>PStTG-Schwellwert</Text>
              <Text style={styles.progressCount}>
                €{TOTAL_EARNINGS.toLocaleString('de-DE')} / €{PSTG_THRESHOLD.toLocaleString('de-DE')}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${PROGRESS_PCT * 100}%` as any }]} />
            </View>
            <Text style={styles.progressNote}>
              Noch €{REMAINING.toLocaleString('de-DE')} bis zur Meldepflicht
            </Text>
          </View>

          <View style={styles.warningRow}>
            <Ionicons name="warning-outline" size={15} color={C.amber} />
            <Text style={styles.warningText}>
              Ab €2.000 Jahresumsatz ist eine DAC7-Meldung erforderlich.
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Meine Einnahmen</Text>

        <View style={styles.card}>
          {MONTHLY.map((row, idx) => {
            const barWidth = (row.amount / MONTHLY_MAX) * 100;
            return (
              <View key={row.month}>
                <View style={styles.monthRow}>
                  <Text style={styles.monthLabel}>{row.month}</Text>
                  <View style={styles.monthBarTrack}>
                    <View
                      style={[
                        styles.monthBarFill,
                        { width: `${barWidth}%` as any },
                      ]}
                    />
                  </View>
                  <Text style={styles.monthAmount}>
                    €{row.amount.toLocaleString('de-DE')}
                  </Text>
                </View>
                {idx < MONTHLY.length - 1 && <View style={styles.sep} />}
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>PStTG / DAC7 Status</Text>

        <View style={styles.card}>
          <View style={styles.dac7Header}>
            <View style={styles.dac7IconWrap}>
              <Ionicons name="shield-checkmark-outline" size={20} color={C.green} />
            </View>
            <View>
              <Text style={styles.dac7Title}>DAC7-Status</Text>
              <Text style={styles.dac7Sub}>Plattformen-Steuertransparenzgesetz</Text>
            </View>
          </View>

          <View style={styles.sep} />

          <View style={styles.statusRow}>
            <Ionicons name="checkmark-circle" size={20} color={C.green} />
            <Text style={styles.statusLabel}>Identität verifiziert</Text>
            <View style={styles.statusBadgeGreen}>
              <Text style={styles.statusBadgeGreenText}>Verifiziert</Text>
            </View>
          </View>

          <View style={styles.sep} />

          <View style={styles.statusRow}>
            <Ionicons name="checkmark-circle" size={20} color={C.green} />
            <Text style={styles.statusLabel}>Steuer-ID hinterlegt</Text>
            <View style={styles.statusBadgeGreen}>
              <Text style={styles.statusBadgeGreenText}>Hinterlegt</Text>
            </View>
          </View>

          <View style={styles.sep} />

          <View style={styles.statusRow}>
            <Ionicons name="time-outline" size={20} color={C.amber} />
            <Text style={styles.statusLabel}>Meldepflicht {YEAR}</Text>
            <View style={styles.statusBadgeAmber}>
              <Text style={styles.statusBadgeAmberText}>Schwellwert offen</Text>
            </View>
          </View>

          <View style={styles.sep} />

          <Text style={styles.dac7InfoText}>
            WERKR ist nach §12 PStTG verpflichtet, Ihre Daten bei Überschreitung
            von 30 Transaktionen oder €2.000 Jahresumsatz an das BZSt zu melden.
          </Text>

          <TouchableOpacity
            onPress={() =>
              Linking.openURL('https://www.bundesfinanzministerium.de')
            }
            style={styles.learnLink}
            activeOpacity={0.7}
          >
            <Text style={styles.learnLinkText}>Mehr erfahren</Text>
            <Ionicons name="open-outline" size={13} color={C.gold} />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>Dokumente & Berichte</Text>

        <View style={styles.card}>
          <TouchableOpacity
            style={styles.docRow}
            onPress={() =>
              showAlert('Jahresbericht 2025', 'Noch nicht verfügbar.')
            }
            activeOpacity={0.75}
          >
            <View style={styles.docIconWrap}>
              <Ionicons name="document-text-outline" size={18} color={C.sub} />
            </View>
            <View style={styles.docInfo}>
              <Text style={styles.docTitle}>Jahresbericht 2025 herunterladen</Text>
              <Text style={styles.docSub}>Verfügbar ab 01. Jan 2026</Text>
            </View>
            <Ionicons name="download-outline" size={18} color={C.muted} />
          </TouchableOpacity>

          <View style={styles.sep} />

          <TouchableOpacity
            style={styles.docRow}
            onPress={() =>
              showAlert('Monatsbericht', 'Noch nicht verfügbar.')
            }
            activeOpacity={0.75}
          >
            <View style={styles.docIconWrap}>
              <Ionicons name="calendar-outline" size={18} color={C.sub} />
            </View>
            <View style={styles.docInfo}>
              <Text style={styles.docTitle}>Monatsbericht Juni {YEAR}</Text>
              <Text style={styles.docSub}>Generiert am 30.06.{YEAR}</Text>
            </View>
            <Ionicons name="download-outline" size={18} color={C.muted} />
          </TouchableOpacity>

          <View style={styles.sep} />

          <TouchableOpacity
            style={styles.docRow}
            onPress={() =>
              showAlert(
                'Umsatzsteuerreport',
                'Funktion ab Supabase-Integration.',
              )
            }
            activeOpacity={0.75}
          >
            <View style={styles.docIconWrap}>
              <Ionicons name="receipt-outline" size={18} color={C.sub} />
            </View>
            <View style={styles.docInfo}>
              <Text style={styles.docTitle}>Umsatzsteuerreport</Text>
              <Text style={styles.docSub}>Quartalsauswertung · §4 UStG</Text>
            </View>
            <Ionicons name="lock-closed-outline" size={16} color={C.muted} />
          </TouchableOpacity>

          <View style={styles.sep} />

          <TouchableOpacity
            style={styles.docRow}
            onPress={() =>
              Linking.openURL('mailto:steuer@werkr.de')
            }
            activeOpacity={0.75}
          >
            <View style={styles.docIconWrap}>
              <Ionicons name="mail-outline" size={18} color={C.gold} />
            </View>
            <View style={styles.docInfo}>
              <Text style={[styles.docTitle, { color: C.gold }]}>
                Steuer-Support kontaktieren
              </Text>
              <Text style={styles.docSub}>steuer@werkr.de</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.muted} />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>Auszahlungskonto</Text>

        <View style={styles.card}>
          <View style={styles.payoutHeader}>
            <View>
              <Text style={styles.payoutTitle}>Stripe Connect Express</Text>
              <Text style={styles.payoutIban}>DE** **** **** **** **12</Text>
            </View>
            <View style={styles.stripeBadge}>
              <Text style={styles.stripeBadgeText}>Aktiv</Text>
            </View>
          </View>

          <View style={styles.sep} />

          <View style={styles.payoutInfoRow}>
            <Ionicons name="calendar-outline" size={15} color={C.sub} />
            <Text style={styles.payoutInfoText}>Auszahlung: Jeden Montag</Text>
          </View>

          <View style={styles.sep} />

          <TouchableOpacity
            style={styles.manageBtn}
            onPress={() =>
              showAlert(
                'Konto verwalten',
                'Stripe-Dashboard öffnen — ab Stripe-Integration verfügbar.',
              )
            }
            activeOpacity={0.8}
          >
            <Ionicons name="card-outline" size={16} color={C.surface} />
            <Text style={styles.manageBtnText}>Konto verwalten</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            WERKR Platform GmbH ist als digitale Plattform nach §12 PStTG
            (Plattformen-Steuertransparenzgesetz) meldepflichtig. Die
            Übermittlung relevanter Anbieterdaten an das Bundeszentralamt für
            Steuern (BZSt) erfolgt automatisch bei Erreichen der gesetzlichen
            Schwellenwerte. Stand: Jan 2026.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:                   { flex: 1, backgroundColor: C.bg },

  header:                 { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  backBtn:                { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:            { flex: 1, fontSize: 20, fontWeight: '800', color: C.ink },
  headerRight:            { width: 36 },

  scroll:                 { paddingHorizontal: 16, paddingBottom: 40 },

  earningsCard:           { backgroundColor: C.goldBg, borderRadius: 16, borderWidth: 1.5, borderColor: C.gold, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 },
  earningsLabel:          { fontSize: 11, fontWeight: '700', color: C.gold, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  earningsAmount:         { fontSize: 42, fontWeight: '900', color: C.ink, letterSpacing: -1, marginBottom: 6 },
  earningsMeta:           { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 20 },
  earningsMetaText:       { fontSize: 13, color: C.sub, fontWeight: '500' },

  progressSection:        { marginBottom: 14 },
  progressLabelRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  progressLabel:          { fontSize: 11, fontWeight: '600', color: C.sub },
  progressCount:          { fontSize: 11, fontWeight: '700', color: C.amber },
  progressTrack:          { height: 8, backgroundColor: '#E8DABB', borderRadius: 4, overflow: 'hidden', marginBottom: 5 },
  progressFill:           { height: 8, backgroundColor: C.amber, borderRadius: 4 },
  progressNote:           { fontSize: 10, color: C.sub },

  warningRow:             { flexDirection: 'row', alignItems: 'flex-start', gap: 7, backgroundColor: C.amberBg, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#F0C878' },
  warningText:            { flex: 1, fontSize: 12, color: C.amber, lineHeight: 17, fontWeight: '500' },

  sectionLabel:           { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 10, marginTop: 4 },

  card:                   { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginBottom: 20, overflow: 'hidden' },

  sep:                    { height: 1, backgroundColor: C.border },

  monthRow:               { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  monthLabel:             { fontSize: 13, fontWeight: '600', color: C.sub, width: 32 },
  monthBarTrack:          { flex: 1, height: 6, backgroundColor: C.bg, borderRadius: 3, overflow: 'hidden' },
  monthBarFill:           { height: 6, backgroundColor: C.gold, borderRadius: 3 },
  monthAmount:            { fontSize: 13, fontWeight: '700', color: C.ink, textAlign: 'right', width: 68 },

  dac7Header:             { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  dac7IconWrap:           { width: 40, height: 40, borderRadius: 10, backgroundColor: C.greenBg, alignItems: 'center', justifyContent: 'center' },
  dac7Title:              { fontSize: 15, fontWeight: '800', color: C.ink },
  dac7Sub:                { fontSize: 11, color: C.muted, marginTop: 1 },

  statusRow:              { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 13 },
  statusLabel:            { flex: 1, fontSize: 14, color: C.ink, fontWeight: '500' },

  statusBadgeGreen:       { backgroundColor: C.greenBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeGreenText:   { fontSize: 11, fontWeight: '700', color: C.green },

  statusBadgeAmber:       { backgroundColor: C.amberBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeAmberText:   { fontSize: 11, fontWeight: '700', color: C.amber },

  dac7InfoText:           { fontSize: 12, color: C.sub, lineHeight: 18, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },

  learnLink:              { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 16, paddingBottom: 14 },
  learnLinkText:          { fontSize: 13, fontWeight: '600', color: C.gold },

  docRow:                 { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  docIconWrap:            { width: 36, height: 36, borderRadius: 9, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  docInfo:                { flex: 1 },
  docTitle:               { fontSize: 14, fontWeight: '600', color: C.ink },
  docSub:                 { fontSize: 11, color: C.muted, marginTop: 2 },

  payoutHeader:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16 },
  payoutTitle:            { fontSize: 15, fontWeight: '700', color: C.ink },
  payoutIban:             { fontSize: 13, color: C.sub, marginTop: 2, fontVariant: ['tabular-nums'] },

  stripeBadge:            { backgroundColor: C.greenBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#A8D8BB' },
  stripeBadgeText:        { fontSize: 12, fontWeight: '700', color: C.green },

  payoutInfoRow:          { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  payoutInfoText:         { fontSize: 13, color: C.sub },

  manageBtn:              { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.ink, borderRadius: 0, paddingVertical: 14 },
  manageBtnText:          { fontSize: 14, fontWeight: '700', color: C.surface },

  footer:                 { paddingVertical: 8 },
  footerText:             { fontSize: 10, color: C.muted, lineHeight: 15, textAlign: 'center' },
});
