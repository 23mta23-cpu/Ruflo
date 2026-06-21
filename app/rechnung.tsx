import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Share,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { loadAccount } from '../lib/account';
import { Skeleton } from '../components/ui/Skeleton';
import { AnimatedButton } from '../components/ui/AnimatedButton';
import { getContractByIdFull, type ContractFull } from '../lib/contracts';

const COMMISSION = 0.08;
const VAT_RATE    = 0.19;
const NACHBARSCHAFT_BUYER_FEE = 1.99;

type LineItem = { label: string; amount: number; bold?: boolean; sub?: boolean };

function LineRow({ item }: { item: LineItem }) {
  return (
    <View style={[styles.row, item.bold && styles.totalRow]}>
      <Text style={[styles.rowLabel, item.bold && styles.boldText, item.sub && styles.subText]}>
        {item.label}
      </Text>
      <Text style={[styles.rowAmount, item.bold && styles.boldText, item.sub && styles.subText]}>
        {item.amount < 0 ? '−' : ''} €{Math.abs(item.amount).toFixed(2)}
      </Text>
    </View>
  );
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function RechnungScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ contractId?: string; track?: string }>();
  const contractId = params.contractId ?? '';

  const [contract, setContract] = useState<ContractFull | null>(null);
  const [isB2B,    setIsB2B]    = useState(false);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    async function init() {
      const [acc, ctr] = await Promise.all([
        loadAccount(),
        contractId ? getContractByIdFull(contractId) : Promise.resolve(null),
      ]);
      setIsB2B(acc.isBusinessUser);
      setContract(ctr);
      setLoading(false);
    }
    init();
  }, [contractId]);

  const gross           = contract ? (contract.customer_total ?? 0) / 100 : 0;
  const isNachbarschaft = (params.track ?? (contract as any)?.track ?? '') === 'nachbarschaft';

  const commission = isNachbarschaft ? 0 : gross * COMMISSION;
  const net        = gross - commission;
  const vatOnFee   = isB2B ? 0 : commission * VAT_RATE;
  const totalFee   = commission + vatOnFee;
  const buyerTotal = isNachbarschaft ? gross + NACHBARSCHAFT_BUYER_FEE : gross;

  const receiptNumber = contractId ? `WRK-${contractId.slice(-8).toUpperCase()}` : '—';
  const providerName  = contract?.provider?.business_name ?? '—';
  const jobLabel      = [contract?.job?.title, contract?.job?.address_city].filter(Boolean).join(' — ') || '—';

  const customerItems: LineItem[] = isNachbarschaft
    ? [
        { label: 'Auftragswert (vereinbart)', amount: gross },
        { label: 'Service- & Käuferschutz-Fee', amount: NACHBARSCHAFT_BUYER_FEE, sub: true },
        { label: 'Gesamtbetrag (du zahlst)', amount: buyerTotal, bold: true },
        { label: 'Auszahlung an Helfer (100%)', amount: gross, bold: false },
      ]
    : [
        { label: 'Auftragswert (Brutto)', amount: gross },
        { label: 'davon Plattformgebühr (8%)', amount: -commission, sub: true },
        ...(vatOnFee > 0
          ? [{ label: '  davon USt. 19% auf Gebühr', amount: -vatOnFee, sub: true }]
          : [{ label: '  Reverse Charge (Unternehmer zu Unternehmer)', amount: 0, sub: true }]),
        { label: 'Auszahlung an Anbieter', amount: net, bold: true },
      ];

  const feeItems: LineItem[] = isNachbarschaft
    ? [
        { label: 'Service- & Käuferschutz-Fee', amount: NACHBARSCHAFT_BUYER_FEE },
        { label: 'Zahlt vom Auftraggeber — Helfer erhält 100%', amount: 0, sub: true },
      ]
    : [
        { label: 'Plattformgebühr (8%)', amount: commission },
        ...(vatOnFee > 0
          ? [
              { label: 'USt. 19% (§3a UStG — WERKR-Anteil)', amount: vatOnFee, sub: true },
              { label: 'Gebühr gesamt', amount: totalFee, bold: true },
            ]
          : [{ label: 'Reverse Charge — USt wird vom Empfänger geschuldet', amount: 0, sub: true }]),
      ];

  async function handleShare() {
    await Share.share({
      message: `WERKR Beleg ${receiptNumber}\nAuftragswert: €${gross.toFixed(2)}\nAuszahlung: €${net.toFixed(2)}\nGebühr: €${commission.toFixed(2)}`,
    });
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={{ padding: 20, gap: 14 }}>
          <Skeleton height={20} borderRadius={10} />
          <Skeleton width="60%" height={16} borderRadius={8} />
          <Skeleton height={14} borderRadius={7} />
          <Skeleton width="80%" height={14} borderRadius={7} />
          <Skeleton width="45%" height={12} borderRadius={6} />
        </View>
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
        <AnimatedButton onPress={handleShare} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="share-outline" size={22} color={C.ink} />
        </AnimatedButton>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.statusBadge}>
          <Ionicons name="checkmark-circle" size={20} color={C.green} />
          <Text style={styles.statusText}>Auftrag abgeschlossen & Zahlung freigegeben</Text>
        </View>

        <View style={styles.card}>
          <MetaRow label="Belegnummer"    value={receiptNumber} />
          <MetaRow label="Datum"          value={formatDate(contract?.created_at)} />
          <MetaRow label="Auftrag"        value={jobLabel} />
          <MetaRow label="Anbieter"       value={providerName} />
          <MetaRow label="Abrechnungstyp" value={isB2B ? 'B2B (Reverse Charge)' : 'C2C / Privat'} />
        </View>

        <Text style={styles.sectionTitle}>Aufschlüsselung</Text>
        <View style={styles.card}>
          {customerItems.map((item, i) => (
            <React.Fragment key={i}>
              {i > 0 && <View style={styles.rowSep} />}
              <LineRow item={item} />
            </React.Fragment>
          ))}
        </View>

        <Text style={styles.sectionTitle}>WERKR-Gebühr (dein Anteil)</Text>
        <View style={styles.card}>
          {feeItems.map((item, i) => (
            <React.Fragment key={i}>
              {i > 0 && <View style={styles.rowSep} />}
              <LineRow item={item} />
            </React.Fragment>
          ))}
        </View>

        <View style={styles.legalBox}>
          <Text style={styles.legalText}>
            {isB2B
              ? 'Gemäß § 13b UStG schuldet der Leistungsempfänger die Umsatzsteuer (Reverse Charge). Keine USt-Ausweisung auf dieser Abrechnung.'
              : 'Plattformgebühr 8% des Auftragswerts. Die darauf anfallende USt. (§3a UStG) trägt WERKR — dein Auszahlungsbetrag = Auftragswert minus 8%. WERKR Operations GmbH, DE-USt-IdNr.: DE000000000 (Platzhalter).'}
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
  container:    { flex: 1, backgroundColor: C.bg },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  title:        { fontSize: 17, fontWeight: '700', color: C.ink },
  scroll:       { padding: 20, paddingTop: 6, gap: 14 },
  statusBadge:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.greenBg, borderRadius: 12, padding: 12 },
  statusText:   { flex: 1, fontSize: 13, color: C.green, fontWeight: '600' },
  card:         { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 4 },
  row:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  totalRow:     { paddingTop: 10 },
  rowLabel:     { flex: 1, fontSize: 14, color: C.ink },
  rowAmount:    { fontSize: 14, color: C.ink, fontWeight: '500' },
  boldText:     { fontWeight: '700', fontSize: 15 },
  subText:      { color: C.sub, fontSize: 12 },
  rowSep:       { height: 1, backgroundColor: C.border, marginVertical: 6 },
  metaRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  metaLabel:    { fontSize: 13, color: C.sub },
  metaValue:    { fontSize: 13, color: C.ink, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  legalBox:     { backgroundColor: C.goldBg, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 14 },
  legalText:    { fontSize: 11, color: C.amber, lineHeight: 16 },
});
