import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/colors';
import { Badge } from '../../components/ui/Badge';
import { Divider } from '../../components/ui/Divider';

// ── Constants / Mock data ─────────────────────────────────────────────────────

const CURRENT_YEAR = 2025;
const TRANSACTIONS_DONE = 23;
const TRANSACTIONS_LIMIT = 30;
const REVENUE_DONE = 1840;
const REVENUE_LIMIT = 2000;
const COMMISSION_RATE = 0.08; // 8% — must match landing.tsx and Vertrag screen

const GROSS_INCOME = 2088; // total gross this year (mock)
const PLATFORM_FEE = Math.round(GROSS_INCOME * COMMISSION_RATE);
const NET_INCOME = GROSS_INCOME - PLATFORM_FEE;

const TRANSACTIONS: {
  id: string;
  date: string;
  customer: string;
  service: string;
  gross: number;
}[] = [
  { id: 'WRK-2406-0040', date: '09.06.2025', customer: 'Frau L.',     service: 'Malerarbeiten Wohnzimmer',    gross: 365 },
  { id: 'WRK-2405-0031', date: '06.06.2025', customer: 'Herr T.',     service: 'Sanitär · WC-Montage',        gross: 165 },
  { id: 'WRK-2405-0018', date: '03.06.2025', customer: 'Familie M.',  service: 'Elektro · Verteilerdose',     gross: 594 },
  { id: 'WRK-2405-0009', date: '31.05.2025', customer: 'Herr N.',     service: 'Heizkörper-Diagnose',         gross: 291 },
  { id: 'WRK-2404-0063', date: '22.05.2025', customer: 'Familie S.',  service: 'Badezimmer · Komplettrenovierung', gross: 673 },
];

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const pct = Math.min(value / max, 1);
  const isNear = pct >= 0.75;

  return (
    <View style={styles.progressTrack}>
      <View
        style={[
          styles.progressFill,
          {
            width: `${pct * 100}%` as any,
            backgroundColor: isNear ? C.amber : C.green,
          },
        ]}
      />
    </View>
  );
}

// ── Section heading ───────────────────────────────────────────────────────────

function SectionHeading({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionHeadingRow}>
      <View style={styles.sectionHeadingIcon}>
        <Ionicons name={icon as any} size={16} color={C.sub} />
      </View>
      <View>
        <Text style={styles.sectionHeadingTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionHeadingSubtitle}>{subtitle}</Text>}
      </View>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProviderSteuerScreen() {
  const [expandedTip, setExpandedTip] = useState<number | null>(null);

  const txPct = TRANSACTIONS_DONE / TRANSACTIONS_LIMIT;
  const revPct = REVENUE_DONE / REVENUE_LIMIT;
  const isNearThreshold = txPct >= 0.75 || revPct >= 0.75;
  const isOverThreshold = TRANSACTIONS_DONE >= TRANSACTIONS_LIMIT || REVENUE_DONE >= REVENUE_LIMIT;

  function handleDownloadReport() {
    Alert.alert(
      'Bericht noch nicht verfügbar',
      'Ihr Jahresbericht 2025 ist ab dem 01. Januar 2026 verfügbar. Sie werden automatisch benachrichtigt.',
      [{ text: 'Verstanden' }]
    );
  }

  const tips = [
    {
      icon: 'storefront-outline',
      title: 'Kleinunternehmerregelung (§19 UStG)',
      body: 'Als Kleinunternehmer können Sie von der Umsatzsteuer befreit sein, wenn Ihr Jahresumsatz unter €22.000 (Vorjahr) bzw. €50.000 (laufendes Jahr) liegt. In diesem Fall stellen Sie Rechnungen ohne Umsatzsteuer aus.',
    },
    {
      icon: 'construct-outline',
      title: 'Betriebsausgaben absetzen',
      body: 'Werkzeug, Berufskleidung, Fahrtkosten (0,30 € pro km), Telefon- & Internetkosten (anteilig) sowie Fortbildungen sind als Betriebsausgaben steuermindernd absetzbar. Bewahren Sie alle Belege auf.',
    },
    {
      icon: 'car-outline',
      title: 'Fahrtkosten',
      body: 'Fahrten zu Kunden können mit der Entfernungspauschale (0,30 €/km einfach) oder mit einem Fahrtenbuch geltend gemacht werden. WERKR speichert Ihre Auftragsorte für eine einfache Dokumentation.',
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Steuer & DAC7</Text>
          <Text style={styles.subtitle}>Geschäftsjahr {CURRENT_YEAR}</Text>
        </View>
        <View style={styles.headerBadge}>
          <Ionicons name="shield-checkmark-outline" size={14} color={C.green} />
          <Text style={styles.headerBadgeText}>WERKR meldet für Sie</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* ── PStTG / DAC7 Status ── */}
        <View style={[styles.card, isOverThreshold ? styles.cardGreen : styles.cardAmber]}>
          <View style={styles.pstTgHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.pstTgLabel}>DAC7 · Plattformen-Steuertransparenzgesetz</Text>
              <Text style={styles.pstTgTitle}>Meldestatus {CURRENT_YEAR}</Text>
            </View>
            <Badge
              label={isOverThreshold ? 'Meldepflichtig' : 'Nähert sich Schwellwert'}
              variant={isOverThreshold ? 'red' : 'amber'}
            />
          </View>

          <Divider margin={14} />

          {/* Transactions progress */}
          <View style={styles.thresholdRow}>
            <View style={styles.thresholdLabelRow}>
              <Text style={styles.thresholdLabel}>Transaktionen</Text>
              <Text style={[styles.thresholdValue, txPct >= 0.75 ? styles.valueAmber : styles.valueGreen]}>
                {TRANSACTIONS_DONE} / {TRANSACTIONS_LIMIT}
              </Text>
            </View>
            <ProgressBar value={TRANSACTIONS_DONE} max={TRANSACTIONS_LIMIT} color={C.amber} />
            <Text style={styles.thresholdNote}>
              Noch {TRANSACTIONS_LIMIT - TRANSACTIONS_DONE} Transaktionen bis zur Meldepflicht
            </Text>
          </View>

          <View style={[styles.thresholdRow, { marginTop: 14 }]}>
            <View style={styles.thresholdLabelRow}>
              <Text style={styles.thresholdLabel}>Jahresumsatz</Text>
              <Text style={[styles.thresholdValue, revPct >= 0.75 ? styles.valueAmber : styles.valueGreen]}>
                €{REVENUE_DONE.toLocaleString('de-DE')} / €{REVENUE_LIMIT.toLocaleString('de-DE')}
              </Text>
            </View>
            <ProgressBar value={REVENUE_DONE} max={REVENUE_LIMIT} color={C.amber} />
            <Text style={styles.thresholdNote}>
              Noch €{(REVENUE_LIMIT - REVENUE_DONE).toLocaleString('de-DE')} bis zur Meldepflicht
            </Text>
          </View>

          <Divider margin={14} />

          <View style={styles.meldungBox}>
            <Ionicons name="information-circle-outline" size={16} color={C.amber} />
            <Text style={styles.meldungText}>
              Ab 30 Transaktionen <Text style={{ fontWeight: '700' }}>ODER</Text> €2.000 Umsatz:{' '}
              Automatische Meldung ans BZSt bis <Text style={{ fontWeight: '700' }}>31. Jan 2026</Text>
            </Text>
          </View>
        </View>

        {/* ── Steuer-Jahresreport ── */}
        <View style={styles.card}>
          <SectionHeading
            icon="document-text-outline"
            title="Steuer-Jahresreport"
            subtitle={`Automatisch generiert für ${CURRENT_YEAR}`}
          />

          <Divider margin={14} />

          {/* Breakdown */}
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Einnahmen (brutto)</Text>
            <Text style={styles.breakdownValue}>€{GROSS_INCOME.toLocaleString('de-DE')}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownLabelRow}>
              <Text style={styles.breakdownLabel}>Plattform-Provision</Text>
              <View style={styles.rateBadge}>
                <Text style={styles.rateBadgeText}>12,5 %</Text>
              </View>
            </View>
            <Text style={[styles.breakdownValue, { color: C.red }]}>−€{PLATFORM_FEE.toLocaleString('de-DE')}</Text>
          </View>

          <View style={styles.breakdownDivider} />

          <View style={styles.breakdownRow}>
            <Text style={[styles.breakdownLabel, { fontWeight: '700', color: C.ink, fontSize: 14 }]}>
              Netto-Einnahmen
            </Text>
            <Text style={[styles.breakdownValue, { color: C.green, fontWeight: '800', fontSize: 18 }]}>
              €{NET_INCOME.toLocaleString('de-DE')}
            </Text>
          </View>

          <Divider margin={14} />

          <Text style={styles.reportNote}>
            Dieser Bericht enthält alle steuerrelevanten Daten für Ihre Einkommensteuererklärung.
          </Text>

          {/* Download button — disabled in prototype */}
          <TouchableOpacity style={styles.downloadBtn} onPress={handleDownloadReport} activeOpacity={0.8}>
            <Ionicons name="download-outline" size={16} color={C.muted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.downloadBtnText}>PDF-Report herunterladen</Text>
              <Text style={styles.downloadBtnSubtext}>Verfügbar ab 01. Jan 2026</Text>
            </View>
            <Ionicons name="lock-closed-outline" size={14} color={C.muted} />
          </TouchableOpacity>
        </View>

        {/* ── Transaktionsverlauf ── */}
        <View style={styles.card}>
          <SectionHeading
            icon="receipt-outline"
            title="Transaktionsverlauf"
            subtitle="Letzte 5 Transaktionen"
          />

          <Divider margin={14} />

          {TRANSACTIONS.map((tx, i) => {
            const commission = Math.round(tx.gross * COMMISSION_RATE);
            const net = tx.gross - commission;
            return (
              <View key={tx.id}>
                <View style={styles.txRow}>
                  <View style={styles.txLeft}>
                    <Text style={styles.txDate}>{tx.date}</Text>
                    <Text style={styles.txCustomer}>{tx.customer}</Text>
                    <Text style={styles.txService}>{tx.service}</Text>
                    <Text style={styles.txId}>{tx.id}</Text>
                  </View>
                  <View style={styles.txRight}>
                    <Text style={styles.txGross}>€{tx.gross}</Text>
                    <Text style={styles.txFee}>−€{commission} Provision</Text>
                    <Text style={styles.txNet}>€{net} netto</Text>
                  </View>
                </View>
                {i < TRANSACTIONS.length - 1 && <Divider margin={10} />}
              </View>
            );
          })}

          <TouchableOpacity style={styles.allTxBtn} activeOpacity={0.75}>
            <Text style={styles.allTxBtnText}>Alle Transaktionen anzeigen</Text>
            <Ionicons name="chevron-forward-outline" size={14} color={C.sub} />
          </TouchableOpacity>
        </View>

        {/* ── Steuer-Tipps ── */}
        <View style={styles.card}>
          <SectionHeading
            icon="bulb-outline"
            title="Steuer-Tipps"
            subtitle="Für Selbstständige & Dienstleister"
          />

          <Divider margin={14} />

          {tips.map((tip, i) => (
            <TouchableOpacity
              key={i}
              style={styles.tipRow}
              onPress={() => setExpandedTip(expandedTip === i ? null : i)}
              activeOpacity={0.75}
            >
              <View style={styles.tipHeader}>
                <View style={styles.tipIconWrap}>
                  <Ionicons name={tip.icon as any} size={16} color={C.sub} />
                </View>
                <Text style={styles.tipTitle}>{tip.title}</Text>
                <Ionicons
                  name={expandedTip === i ? 'chevron-up-outline' : 'chevron-down-outline'}
                  size={14}
                  color={C.muted}
                />
              </View>
              {expandedTip === i && (
                <Text style={styles.tipBody}>{tip.body}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* ── WERKR Value Proposition ── */}
        <View style={styles.valueBox}>
          <View style={styles.valueBoxHeader}>
            <View style={styles.valueBoxIconBg}>
              <Ionicons name="shield-checkmark" size={22} color={C.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.valueBoxTitle}>WERKR erledigt Ihre DAC7-Meldung vollautomatisch</Text>
            </View>
          </View>
          <Text style={styles.valueBoxBody}>
            Kein Steuerberater nötig für die Basismeldung. WERKR übermittelt alle erforderlichen Daten fristgerecht ans Bundeszentralamt für Steuern (BZSt). Sie erhalten eine Bestätigung per E-Mail.
          </Text>
          <View style={styles.valueBoxFeatures}>
            {[
              'Automatische Übermittlung ans BZSt',
              'Fristgerechte Meldung bis 31. Jan 2026',
              'Vollständige Transaktionshistorie',
              'PDF-Jahresbericht für die Steuererklärung',
            ].map((feature, i) => (
              <View key={i} style={styles.valueBoxFeatureRow}>
                <Ionicons name="checkmark-circle" size={14} color={C.green} />
                <Text style={styles.valueBoxFeatureText}>{feature}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:              { flex: 1, backgroundColor: C.bg },

  // Header
  header:                 { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 },
  title:                  { fontSize: 24, fontWeight: '800', color: C.ink },
  subtitle:               { fontSize: 12, color: C.muted, marginTop: 2 },
  headerBadge:            { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.greenBg, borderWidth: 1, borderColor: '#A8D8BB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginTop: 4 },
  headerBadgeText:        { fontSize: 11, fontWeight: '600', color: C.green },

  scrollContent:          { paddingHorizontal: 16, paddingBottom: 20 },

  // Card
  card:                   { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 18, marginBottom: 14 },
  cardAmber:              { borderColor: '#F0C878' },
  cardGreen:              { borderColor: '#A8D8BB' },

  // PStTG
  pstTgHeader:            { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  pstTgLabel:             { fontSize: 10, fontWeight: '600', color: C.muted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 3 },
  pstTgTitle:             { fontSize: 16, fontWeight: '800', color: C.ink },

  thresholdRow:           {},
  thresholdLabelRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  thresholdLabel:         { fontSize: 12, color: C.sub, fontWeight: '600' },
  thresholdValue:         { fontSize: 13, fontWeight: '800' },
  valueAmber:             { color: C.amber },
  valueGreen:             { color: C.green },
  thresholdNote:          { fontSize: 10, color: C.muted, marginTop: 4 },

  progressTrack:          { height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' },
  progressFill:           { height: 6, borderRadius: 3 },

  meldungBox:             { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.amberBg, borderRadius: 8, padding: 12 },
  meldungText:            { flex: 1, fontSize: 12, color: C.amber, lineHeight: 18 },

  // Section heading
  sectionHeadingRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionHeadingIcon:     { width: 32, height: 32, borderRadius: 8, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  sectionHeadingTitle:    { fontSize: 15, fontWeight: '700', color: C.ink },
  sectionHeadingSubtitle: { fontSize: 11, color: C.muted, marginTop: 1 },

  // Breakdown
  breakdownRow:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  breakdownLabelRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  breakdownLabel:         { fontSize: 13, color: C.sub },
  breakdownValue:         { fontSize: 14, fontWeight: '700', color: C.ink },
  breakdownDivider:       { height: 1, backgroundColor: C.border, marginVertical: 10 },
  rateBadge:              { backgroundColor: C.redBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  rateBadgeText:          { fontSize: 10, fontWeight: '700', color: C.red },

  reportNote:             { fontSize: 12, color: C.muted, lineHeight: 18, marginBottom: 14 },

  downloadBtn:            { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, borderStyle: 'dashed' },
  downloadBtnText:        { fontSize: 13, fontWeight: '600', color: C.muted },
  downloadBtnSubtext:     { fontSize: 11, color: C.muted, marginTop: 2 },

  // Transactions
  txRow:                  { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  txLeft:                 { flex: 1 },
  txDate:                 { fontSize: 10, color: C.muted, fontWeight: '600', letterSpacing: 0.3, marginBottom: 2 },
  txCustomer:             { fontSize: 13, fontWeight: '700', color: C.ink, marginBottom: 1 },
  txService:              { fontSize: 12, color: C.sub, marginBottom: 3 },
  txId:                   { fontSize: 10, color: C.muted, fontFamily: 'monospace' },
  txRight:                { alignItems: 'flex-end' },
  txGross:                { fontSize: 15, fontWeight: '800', color: C.ink },
  txFee:                  { fontSize: 11, color: C.red, marginTop: 2 },
  txNet:                  { fontSize: 12, fontWeight: '700', color: C.green, marginTop: 2 },
  allTxBtn:               { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, marginTop: 6 },
  allTxBtnText:           { fontSize: 13, color: C.sub, fontWeight: '600' },

  // Tips
  tipRow:                 { marginBottom: 4 },
  tipHeader:              { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  tipIconWrap:            { width: 30, height: 30, borderRadius: 7, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  tipTitle:               { flex: 1, fontSize: 13, fontWeight: '600', color: C.ink },
  tipBody:                { fontSize: 12, color: C.sub, lineHeight: 19, paddingLeft: 40, paddingBottom: 8 },

  // Value box
  valueBox:               { backgroundColor: C.greenBg, borderRadius: 14, borderWidth: 1, borderColor: '#A8D8BB', padding: 18, marginBottom: 4 },
  valueBoxHeader:         { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  valueBoxIconBg:         { width: 42, height: 42, borderRadius: 11, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#A8D8BB' },
  valueBoxTitle:          { fontSize: 14, fontWeight: '800', color: C.ink, lineHeight: 20 },
  valueBoxBody:           { fontSize: 12, color: C.sub, lineHeight: 19, marginBottom: 14 },
  valueBoxFeatures:       { gap: 8 },
  valueBoxFeatureRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  valueBoxFeatureText:    { fontSize: 12, color: C.green, fontWeight: '500' },
});
