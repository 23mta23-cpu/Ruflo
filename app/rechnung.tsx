import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Share,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { loadAccount } from '../lib/account';

// Double-sided fee model:
//   Provider commission  — deducted from provider payout
//   Customer service fee — added on top of job price
// Both floors prevent sub-economic micro-transactions.
const PROVIDER_RATE    = 0.08;
const CUSTOMER_RATE    = 0.025;
const MIN_PROVIDER_FEE = 3.00;
const MIN_CUSTOMER_FEE = 1.50;
const VAT_RATE         = 0.19;

type LineItem = { label: string; amount: number; bold?: boolean; sub?: boolean; plus?: boolean };

function LineRow({ item }: { item: LineItem }) {
  const sign = item.plus ? '+' : item.amount < 0 ? '−' : '';
  return (
    <View style={[styles.row, item.bold && styles.totalRow]}>
      <Text style={[styles.rowLabel, item.bold && styles.boldText, item.sub && styles.subText]}>
        {item.label}
      </Text>
      <Text style={[styles.rowAmount, item.bold && styles.boldText, item.sub && styles.subText]}>
        {sign} €{Math.abs(item.amount).toFixed(2)}
      </Text>
    </View>
  );
}

export default function RechnungScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ gross?: string }>();
  const rawGross = parseFloat(params.gross ?? '120.00');
  const jobGross = isFinite(rawGross) && rawGross > 0 ? rawGross : 120;

  const [isB2B, setIsB2B] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAccount().then((acc) => { setIsB2B(acc.isBusinessUser); setLoading(false); });
  }, []);

  const providerFee   = Math.max(jobGross * PROVIDER_RATE, MIN_PROVIDER_FEE);
  const customerFee   = Math.max(jobGross * CUSTOMER_RATE, MIN_CUSTOMER_FEE);
  const providerNet   = jobGross - providerFee;
  const customerTotal = jobGross + customerFee;
  const werkrGross    = providerFee + customerFee;
  const vatOnWerkr    = isB2B ? 0 : werkrGross * VAT_RATE;
  const werkrNet      = werkrGross - vatOnWerkr;

  const providerFeeLabel = `Plattformgebühr (${(PROVIDER_RATE * 100).toFixed(0)}%, mind. €${MIN_PROVIDER_FEE.toFixed(2)})`;
  const customerFeeLabel = `Servicegebühr (${(CUSTOMER_RATE * 100).toFixed(1)}%, mind. €${MIN_CUSTOMER_FEE.toFixed(2)})`;

  const customerItems: LineItem[] = [
    { label: 'Auftragswert', amount: jobGross },
    { label: customerFeeLabel, amount: customerFee, sub: true, plus: true },
    { label: 'Gesamtbetrag (Kunde)', amount: customerTotal, bold: true },
  ];

  const providerItems: LineItem[] = [
    { label: 'Auftragswert', amount: jobGross },
    { label: providerFeeLabel, amount: -providerFee, sub: true },
    { label: 'Auszahlung (Anbieter)', amount: providerNet, bold: true },
  ];

  const werkrItems: LineItem[] = [
    { label: 'Anbieter-Provision', amount: providerFee },
    { label: 'Kunden-Servicegebühr', amount: customerFee },
    { label: 'Gebühren gesamt (Brutto)', amount: werkrGross, sub: true },
    ...(isB2B
      ? [{ label: 'Reverse Charge — USt wird vom Empfänger geschuldet', amount: 0, sub: true }]
      : [{ label: `USt. ${(VAT_RATE * 100).toFixed(0)}% auf WERKR-Gebühren (§3a UStG)`, amount: -vatOnWerkr, sub: true }]),
    { label: 'Netto-Erlös WERKR', amount: werkrNet, bold: true },
  ];

  async function handleShare() {
    await Share.share({
      message: `WERKR Beleg\nAuftragswert: €${jobGross.toFixed(2)}\nAuszahlung Anbieter: €${providerNet.toFixed(2)}\nKunde zahlt: €${customerTotal.toFixed(2)}`,
    });
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}><ActivityIndicator color={C.ink} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Beleg</Text>
        <TouchableOpacity onPress={handleShare} hitSlop={12}>
          <Ionicons name="share-outline" size={22} color={C.ink} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Status badge */}
        <View style={styles.statusBadge}>
          <Ionicons name="checkmark-circle" size={20} color={C.green} />
          <Text style={styles.statusText}>Auftrag abgeschlossen & Zahlung freigegeben</Text>
        </View>

        {/* Metadata */}
        <View style={styles.card}>
          <MetaRow label="Belegnummer"    value="WRK-2025-00512" />
          <MetaRow label="Datum"          value="12.06.2025" />
          <MetaRow label="Auftrag"        value="Heizung warten — Musterstraße 7" />
          <MetaRow label="Anbieter"       value="Yilmaz GmbH" />
          <MetaRow label="Abrechnungstyp" value={isB2B ? 'B2B (Reverse Charge)' : 'C2C / Privat'} />
        </View>

        {/* Customer view */}
        <Text style={styles.sectionTitle}>Kunde zahlt</Text>
        <View style={styles.card}>
          {customerItems.map((item, i) => (
            <React.Fragment key={i}>
              {i > 0 && <View style={styles.rowSep} />}
              <LineRow item={item} />
            </React.Fragment>
          ))}
        </View>

        {/* Provider view */}
        <Text style={styles.sectionTitle}>Anbieter erhält</Text>
        <View style={styles.card}>
          {providerItems.map((item, i) => (
            <React.Fragment key={i}>
              {i > 0 && <View style={styles.rowSep} />}
              <LineRow item={item} />
            </React.Fragment>
          ))}
        </View>

        {/* WERKR P&L */}
        <Text style={styles.sectionTitle}>Plattform-Erlös</Text>
        <View style={styles.card}>
          {werkrItems.map((item, i) => (
            <React.Fragment key={i}>
              {i > 0 && <View style={styles.rowSep} />}
              <LineRow item={item} />
            </React.Fragment>
          ))}
        </View>

        {/* Legal note */}
        <View style={styles.legalBox}>
          <Text style={styles.legalText}>
            {isB2B
              ? 'Gemäß § 13b UStG schuldet der Leistungsempfänger die Umsatzsteuer (Reverse Charge). Keine USt-Ausweisung auf dieser Abrechnung.'
              : `Anbieter-Provision ${(PROVIDER_RATE * 100).toFixed(0)}% (mind. €${MIN_PROVIDER_FEE.toFixed(2)}) wird vom Auftragswert abgezogen. Kunden-Servicegebühr ${(CUSTOMER_RATE * 100).toFixed(1)}% (mind. €${MIN_CUSTOMER_FEE.toFixed(2)}) wird dem Auftragswert aufgeschlagen. Die anfallende USt. auf WERKR-Gebühren (§ 3a UStG) trägt WERKR. WERKR Operations GmbH, DE-USt-IdNr.: DE000000000 (Platzhalter).`}
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f8fafc' },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  title:        { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  scroll:       { padding: 20, paddingTop: 6, gap: 14 },

  statusBadge:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(5, 150, 105, 0.06)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(5, 150, 105, 0.15)' },
  statusText:   { flex: 1, fontSize: 13, color: '#059669', fontWeight: '600' },
  card:         { backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 20, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 16, elevation: 1 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 4 },
  row:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  totalRow:     { paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0', marginTop: 4 },
  rowLabel:     { flex: 1, fontSize: 14, color: '#0f172a' },
  rowAmount:    { fontSize: 14, color: '#0f172a', fontWeight: '500' },
  boldText:     { fontWeight: '700', fontSize: 15 },
  subText:      { color: '#64748b', fontSize: 12 },
  rowSep:       { height: 1, backgroundColor: '#e2e8f0', marginVertical: 8 },
  metaRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 },
  metaLabel:    { fontSize: 13, color: '#64748b' },
  metaValue:    { fontSize: 13, color: '#0f172a', fontWeight: '500', maxWidth: '60%', textAlign: 'right' },

  legalBox:     { backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 14 },
  legalText:    { fontSize: 11, color: '#64748b', lineHeight: 17 },
});
