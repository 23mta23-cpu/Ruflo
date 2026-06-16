import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Share,
} from 'react-native';
import { Skeleton } from '../components/ui/Skeleton';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { T } from '../constants/typography';
import { loadAccount } from '../lib/account';
<<<<<<< HEAD
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
=======
import { Skeleton } from '../components/ui/Skeleton';
import { AnimatedButton } from '../components/ui/AnimatedButton';

const COMMISSION = 0.08;
const VAT_RATE    = 0.19;

// Nachbarschaft-Track: fixed buyer protection fee charged to the CUSTOMER.
// The helper receives 100% of the agreed gross amount.
// Psychology: framed as Treuhand-Sicherheit (escrow protection) to maximise conversion.
const NACHBARSCHAFT_BUYER_FEE = 1.99;

// Wallet-first refund policy (ADR-Stornofalle):
// Cancellations credit the buyer protection fee to the in-app wallet,
// NOT to the original payment method, to protect platform Stripe fees.

type LineItem = { label: string; amount: number; bold?: boolean; sub?: boolean };
>>>>>>> main

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
<<<<<<< HEAD
  const jobGross = isFinite(rawGross) && rawGross > 0 ? rawGross : 120;

  const feeTrack: FeeTrack =
    params.track === 'nachbarschaft' ? 'nachbarschaft' : 'handwerker';
=======
  const gross = isFinite(rawGross) && rawGross > 0 ? rawGross : 120;
  const isNachbarschaft = params.track === 'nachbarschaft';
>>>>>>> main

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

<<<<<<< HEAD
  const fees = calcFees(jobGross, feeTrack, isB2B);
=======
  // Nachbarschaft: helper gets 100%, buyer pays +1,99€ service fee on top
  // Handwerker / B2B: 8% commission from helper's payout (existing model)
  const commission   = isNachbarschaft ? 0 : gross * COMMISSION;
  const net          = gross - commission;
  const vatOnFee     = isB2B ? 0 : commission * VAT_RATE;
  const totalFee     = commission + vatOnFee;
  const buyerTotal   = isNachbarschaft ? gross + NACHBARSCHAFT_BUYER_FEE : gross;

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
>>>>>>> main

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
<<<<<<< HEAD
        <View style={styles.header}>
          <View style={{ width: 24 }} />
          <Skeleton width={80} height={17} radius={8} />
          <View style={{ width: 24 }} />
        </View>
        <View style={{ padding: 20, gap: 14 }}>
          <Skeleton height={52} radius={14} />
          <View style={{ backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 20, gap: 12 }}>
            {[1,2,3,4,5,6].map((i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Skeleton width="35%" height={13} radius={6} />
                <Skeleton width="45%" height={13} radius={6} />
              </View>
            ))}
          </View>
          <Skeleton height={110} radius={14} />
          <Skeleton height={110} radius={14} />
=======
        <View style={{ padding: 20, gap: 14 }}>
          <Skeleton height={20} borderRadius={10} />
          <Skeleton width="60%" height={16} borderRadius={8} />
          <Skeleton height={14} borderRadius={7} />
          <Skeleton width="80%" height={14} borderRadius={7} />
          <Skeleton width="45%" height={12} borderRadius={6} />
>>>>>>> main
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
  container:      { flex: 1, backgroundColor: C.bg },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  title:          { ...T.lg, ...T.bold, color: C.ink },
  scroll:         { padding: 20, paddingTop: 6, gap: 14 },

  statusBadge:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.greenBg, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.green + '40' },
  statusText:     { flex: 1, ...T.sm, ...T.semibold, color: C.green },
  card:           { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 20, shadowColor: C.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 16, elevation: 1 },
  sectionTitle:   { ...T.label, color: C.muted, letterSpacing: 0.8, marginTop: 4 },
  row:            { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  totalRow:       { paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border, marginTop: 4 },
  rowLabel:       { flex: 1, ...T.body, color: C.ink },
  rowAmount:      { ...T.body, ...T.medium, color: C.ink },
  boldText:       { fontWeight: '700', ...T.base },
  subText:        { color: C.sub, ...T.caption, fontSize: 12 },
  rowSep:         { height: 1, backgroundColor: C.border, marginVertical: 8 },
  metaRow:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 },
  metaLabel:      { ...T.sm, color: C.sub },
  metaValue:      { ...T.sm, ...T.medium, color: C.ink, maxWidth: '60%', textAlign: 'right' },

  legalBox:       { backgroundColor: C.bg, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14 },
  legalText:      { ...T.xs, color: C.sub },

  werkrSchutzBox: { backgroundColor: C.greenBg, borderRadius: 14, borderWidth: 1, borderColor: C.green + '40', padding: 16, gap: 10 },
  bulletRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bulletIcon:     { marginTop: 1 },
  bulletText:     { flex: 1, ...T.sm, ...T.medium, color: C.green },
});
