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
import {
  calcFees,
  FeeTrack,
  PROVIDER_COMMISSION_RATE,
  CUSTOMER_FEE_RATE,
  MIN_PROVIDER_FEE,
  MIN_CUSTOMER_FEE,
  VAT_RATE,
} from '../lib/feeEngine';

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
  const params = useLocalSearchParams<{ gross?: string; track?: string }>();
  const rawGross = parseFloat(params.gross ?? '120.00');
  const jobGross = isFinite(rawGross) && rawGross > 0 ? rawGross : 120;

  const feeTrack: FeeTrack =
    params.track === 'nachbarschaft' ? 'nachbarschaft' : 'handwerker';

  const [isB2B, setIsB2B] = useState(false);
  const [loading, setLoading] = useState(true);

  const [invoiceNumber] = useState(() => {
    const now = new Date();
    const seq = String(Math.floor(now.getTime() / 1000) % 99999).padStart(5, '0');
    return `WRK-${now.getFullYear()}-${seq}`;
  });

  const invoiceDate = new Date().toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  useEffect(() => {
    loadAccount().then((acc) => { setIsB2B(acc.isBusinessUser); setLoading(false); });
  }, []);

  const fees = calcFees(jobGross, feeTrack, isB2B);

  async function handleShare() {
    if (fees.track === 'nachbarschaft') {
      await Share.share({
        message: `WERKR Beleg\nAuftragswert: €${fees.jobPrice.toFixed(2)}\nWERKR-Schutz: €${fees.werkrSchutz.toFixed(2)}\nGesamtbetrag: €${fees.customerTotal.toFixed(2)}\nAuszahlung Helfer: €${fees.providerPayout.toFixed(2)}`,
      });
    } else {
      await Share.share({
        message: `WERKR Beleg\nAuftragswert: €${fees.jobPrice.toFixed(2)}\nAuszahlung Anbieter: €${fees.providerPayout.toFixed(2)}\nKunde zahlt: €${fees.customerTotal.toFixed(2)}`,
      });
    }
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
          <MetaRow label="Belegnummer"    value={invoiceNumber} />
          <MetaRow label="Rechnungsdatum" value={invoiceDate} />
          <MetaRow label="Leistungsdatum" value={invoiceDate} />
          <MetaRow label="Auftrag"        value={feeTrack === 'nachbarschaft' ? 'Nachbarschaftshilfe — Musterstraße 7' : 'Heizung warten — Musterstraße 7'} />
          <MetaRow label="Leistungserbringer" value={feeTrack === 'nachbarschaft' ? 'Max Mustermann (Privat)' : 'Yilmaz GmbH'} />
          <MetaRow label="Auftraggeber"   value={'Max Kunde\nMusterstraße 12, 10115 Berlin'} />
          <MetaRow label="Vermittler"     value="WERKR Operations UG (haftungsbeschränkt)" />
          <MetaRow label="Track"          value={feeTrack === 'nachbarschaft' ? 'Nachbarschaft (C2C)' : 'Handwerker'} />
          {feeTrack === 'handwerker' && (
            <MetaRow label="Abrechnungstyp" value={isB2B ? 'B2B (Reverse Charge §13b UStG)' : 'B2C (§3a UStG)' } />
          )}
        </View>

        {feeTrack === 'nachbarschaft'
          ? <NachbarschaftReceipt fees={fees as import('../lib/feeEngine').NachbarschaftFees} />
          : <HandwerkerReceipt fees={fees as import('../lib/feeEngine').HandwerkerFees} isB2B={isB2B} />
        }

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Nachbarschaft receipt sections
// ---------------------------------------------------------------------------

function NachbarschaftReceipt({ fees }: { fees: import('../lib/feeEngine').NachbarschaftFees }) {
  const customerItems: LineItem[] = [
    { label: 'Auftragswert', amount: fees.jobPrice },
    { label: '+ WERKR-Schutz (Escrow & Käuferschutz)', amount: fees.werkrSchutz, sub: true, plus: true },
    { label: 'Gesamtbetrag', amount: fees.customerTotal, bold: true },
  ];

  const providerItems: LineItem[] = [
    { label: 'Auftragswert', amount: fees.jobPrice },
    { label: 'Provision', amount: 0, sub: true },
    { label: 'Auszahlung', amount: fees.providerPayout, bold: true },
  ];

  return (
    <>
      {/* Customer view */}
      <Text style={styles.sectionTitle}>Was du zahlst</Text>
      <View style={styles.card}>
        {customerItems.map((item, i) => (
          <React.Fragment key={i}>
            {i > 0 && <View style={styles.rowSep} />}
            <LineRow item={item} />
          </React.Fragment>
        ))}
      </View>

      {/* Provider view */}
      <Text style={styles.sectionTitle}>Was der Helfer erhält</Text>
      <View style={styles.card}>
        {providerItems.map((item, i) => (
          <React.Fragment key={i}>
            {i > 0 && <View style={styles.rowSep} />}
            {i === 1
              ? (
                <View style={[styles.row]}>
                  <Text style={[styles.rowLabel, styles.subText]}>Provision</Text>
                  <Text style={[styles.rowAmount, styles.subText]}>€0.00 (Helfer erhält 100%)</Text>
                </View>
              )
              : <LineRow item={item} />
            }
          </React.Fragment>
        ))}
      </View>

      {/* WERKR-Schutz info box */}
      <Text style={styles.sectionTitle}>Warum WERKR-Schutz?</Text>
      <View style={styles.werkrSchutzBox}>
        <View style={styles.bulletRow}>
          <Ionicons name="shield-checkmark-outline" size={16} color="#059669" style={styles.bulletIcon} />
          <Text style={styles.bulletText}>Geld erst freigegeben nach Auftragsbestätigung</Text>
        </View>
        <View style={styles.bulletRow}>
          <Ionicons name="time-outline" size={16} color="#059669" style={styles.bulletIcon} />
          <Text style={styles.bulletText}>7 Tage Reklamationsrecht</Text>
        </View>
        <View style={styles.bulletRow}>
          <Ionicons name="people-outline" size={16} color="#059669" style={styles.bulletIcon} />
          <Text style={styles.bulletText}>WERKR vermittelt bei Streitigkeiten</Text>
        </View>
      </View>

      {/* Legal note */}
      <View style={styles.legalBox}>
        <Text style={styles.legalText}>
          WERKR-Schutz (€1.99 pro Auftrag) sichert Zahlung & Vermittlung ab. WERKR Operations UG (haftungsbeschränkt) · Plattform-Vermittler gemäß PStTG.
        </Text>
      </View>
    </>
  );
}

// ---------------------------------------------------------------------------
// Handwerker receipt sections
// ---------------------------------------------------------------------------

function HandwerkerReceipt({
  fees,
  isB2B,
}: {
  fees: import('../lib/feeEngine').HandwerkerFees;
  isB2B: boolean;
}) {
  const providerFeeLabel = `Plattformgebühr (${(PROVIDER_COMMISSION_RATE * 100).toFixed(0)}%, mind. €${MIN_PROVIDER_FEE.toFixed(2)})`;
  const customerFeeLabel = `Servicegebühr (${(CUSTOMER_FEE_RATE * 100).toFixed(1)}%, mind. €${MIN_CUSTOMER_FEE.toFixed(2)})`;

  const customerItems: LineItem[] = [
    { label: 'Auftragswert', amount: fees.jobPrice },
    { label: customerFeeLabel, amount: fees.customerServiceFee, sub: true, plus: true },
    { label: 'Gesamtbetrag (Kunde)', amount: fees.customerTotal, bold: true },
  ];

  const providerItems: LineItem[] = [
    { label: 'Auftragswert', amount: fees.jobPrice },
    { label: providerFeeLabel, amount: -fees.providerCommission, sub: true },
    { label: 'Auszahlung (Anbieter)', amount: fees.providerPayout, bold: true },
  ];

  const werkrItems: LineItem[] = [
    { label: 'Anbieter-Provision', amount: fees.providerCommission },
    { label: 'Kunden-Servicegebühr', amount: fees.customerServiceFee },
    { label: 'Gebühren gesamt (Brutto)', amount: fees.werkrGross, sub: true },
    ...(isB2B
      ? [{ label: 'Reverse Charge — USt wird vom Empfänger geschuldet', amount: 0, sub: true }]
      : [{ label: `USt. ${(VAT_RATE * 100).toFixed(0)}% auf WERKR-Gebühren (§3a UStG)`, amount: -fees.vatOnWerkr, sub: true }]),
    { label: 'Netto-Erlös WERKR', amount: fees.werkrNet, bold: true },
  ];

  return (
    <>
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
            ? 'Gemäß § 13b UStG schuldet der Leistungsempfänger die Umsatzsteuer (Reverse Charge). Keine USt-Ausweisung auf dieser Abrechnung. Pflichtangaben gemäß § 14 Abs. 4 UStG.'
            : `Anbieter-Provision ${(PROVIDER_COMMISSION_RATE * 100).toFixed(0)}% (mind. €${MIN_PROVIDER_FEE.toFixed(2)}) wird vom Auftragswert abgezogen. Kunden-Servicegebühr ${(CUSTOMER_FEE_RATE * 100).toFixed(1)}% (mind. €${MIN_CUSTOMER_FEE.toFixed(2)}) wird dem Auftragswert aufgeschlagen. Die anfallende USt. auf WERKR-Gebühren (§ 3a UStG) trägt WERKR. WERKR Operations GmbH, DE-USt-IdNr.: DE000000000 (Platzhalter). Pflichtangaben gemäß § 14 Abs. 4 UStG.`}
        </Text>
      </View>
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#f8fafc' },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  title:          { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  scroll:         { padding: 20, paddingTop: 6, gap: 14 },

  statusBadge:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(5, 150, 105, 0.06)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(5, 150, 105, 0.15)' },
  statusText:     { flex: 1, fontSize: 13, color: '#059669', fontWeight: '600' },
  card:           { backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 20, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 16, elevation: 1 },
  sectionTitle:   { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 4 },
  row:            { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  totalRow:       { paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0', marginTop: 4 },
  rowLabel:       { flex: 1, fontSize: 14, color: '#0f172a' },
  rowAmount:      { fontSize: 14, color: '#0f172a', fontWeight: '500' },
  boldText:       { fontWeight: '700', fontSize: 15 },
  subText:        { color: '#64748b', fontSize: 12 },
  rowSep:         { height: 1, backgroundColor: '#e2e8f0', marginVertical: 8 },
  metaRow:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 },
  metaLabel:      { fontSize: 13, color: '#64748b' },
  metaValue:      { fontSize: 13, color: '#0f172a', fontWeight: '500', maxWidth: '60%', textAlign: 'right' },

  legalBox:       { backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 14 },
  legalText:      { fontSize: 11, color: '#64748b', lineHeight: 17 },

  werkrSchutzBox: { backgroundColor: 'rgba(5, 150, 105, 0.06)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(5, 150, 105, 0.15)', padding: 16, gap: 10 },
  bulletRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bulletIcon:     { marginTop: 1 },
  bulletText:     { flex: 1, fontSize: 13, color: '#059669', lineHeight: 19, fontWeight: '500' },
});
