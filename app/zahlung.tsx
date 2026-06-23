import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useStripe } from '../lib/stripe';
import { C } from '../constants/colors';
import { T } from '../constants/theme';
import { Badge } from '../components/ui/Badge';
import { Divider } from '../components/ui/Divider';
import { AnimatedButton } from '../components/ui/AnimatedButton';
import { showAlert } from '../lib/alert';
import { supabase } from '../lib/supabase';
import { getContractByIdFull, type ContractFull } from '../lib/contracts';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

export default function ZahlungScreen() {
  const router = useRouter();
  const { jobTitle: jobTitleParam, basePrice: basePriceParam, contractId } = useLocalSearchParams<{
    jobTitle?: string;
    basePrice?: string;
    contractId?: string;
  }>();

  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [contract,       setContract]       = useState<ContractFull | null>(null);
  const [loading,        setLoading]        = useState(false);
  const [paid,           setPaid]           = useState(false);
  const [agreed,         setAgreed]         = useState(false);

  useEffect(() => {
    if (!contractId) return;
    getContractByIdFull(contractId).then((c) => setContract(c)).catch(() => {});
  }, [contractId]);

  // Prefer contract data; fall back to URL params for instant-preise flow
  const jobTitle     = contract?.job?.title ?? jobTitleParam ?? '—';
  const providerName = contract?.provider?.business_name ?? null;

  // When contract loaded: use pre-computed values from DB (already in euros)
  const basePrice  = contract ? (contract.price_gross ?? 0)          : parseFloat(basePriceParam ?? '0');
  const serviceFee = contract ? (contract.customer_service_fee ?? 0)  : Math.max(basePrice * 0.025, 1.50);
  const schutzFee  = contract ? (contract.werkr_schutz_fee ?? 0)      : 1.99;
  const total      = contract ? (contract.customer_total ?? 0)        : basePrice + serviceFee + schutzFee;

  async function handlePay() {
    if (!agreed || loading) return;
    setLoading(true);

    try {
      // 1. Get session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Nicht eingeloggt');

      // 2. Call create-payment-intent Edge Function
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ contract_id: contractId ?? 'preview' }),
      });
      const { client_secret, error: fnError } = await res.json();
      if (fnError || !client_secret) throw new Error(fnError ?? 'Zahlung konnte nicht gestartet werden');

      // 3. Init Stripe PaymentSheet
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'WERKR',
        paymentIntentClientSecret: client_secret,
        defaultBillingDetails: {},
        returnURL: 'werkr://payment-complete',
        allowsDelayedPaymentMethods: true,
      });
      if (initError) throw new Error(initError.message);

      // 4. Present sheet — user confirms
      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== 'Canceled') {
          throw new Error(presentError.message);
        }
        setLoading(false);
        return;
      }

      setPaid(true);
    } catch (err: any) {
      showAlert('Zahlung fehlgeschlagen', err?.message ?? 'Bitte erneut versuchen.', [{ text: 'OK' }]);
    } finally {
      setLoading(false);
    }
  }

  /* ── Success screen ──────────────────────────────────────────────────────── */
  if (paid) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.successScroll}
        >
          <View style={styles.successIconWrap}>
            <Ionicons name="checkmark-circle" size={80} color={C.primary} />
          </View>

          <Text style={styles.successTitle}>Escrow aktiv!</Text>
          <Text style={styles.successSub}>
            €{total.toFixed(2)} sind sicher hinterlegt. Nach dem Job können Sie die Zahlung freigeben.
          </Text>

          {/* Timeline card */}
          <View style={styles.timelineCard}>
            <Text style={styles.timelineHeading}>Was passiert als nächstes?</Text>

            <TimelineStep
              icon="checkmark-circle"
              color={C.primary}
              label="Vertragsunterzeichnung erfolgt"
              status="done"
            />
            <TimelineStep
              icon="checkmark-circle"
              color={C.primary}
              label="Escrow aktiviert"
              status="done"
            />
            <TimelineStep
              icon="time"
              color={C.amber}
              label="Termin (Details im Vertrag)"
              status="current"
            />
            <TimelineStep
              icon="ellipse-outline"
              color={C.muted}
              label="Auftrag abschließen & freigeben"
              status="pending"
            />
            <TimelineStep
              icon="ellipse-outline"
              color={C.muted}
              label="Bewertung abgeben"
              status="pending"
              last
            />
          </View>

          <AnimatedButton
            style={styles.primaryBtn}
            onPress={() => contract?.job?.id
              ? router.push({ pathname: '/auftrag-detail', params: { jobId: contract.job.id } })
              : router.push('/(tabs)/auftraege')}
          >
            <Ionicons name="briefcase-outline" size={18} color={C.surface} />
            <Text style={styles.primaryBtnText}>Auftrag verfolgen</Text>
          </AnimatedButton>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryBtnText}>Meine Aufträge</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ── Main payment screen ─────────────────────────────────────────────────── */
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Zahlung & Escrow</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 150 }}
      >

        {/* Bestellübersicht */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bestellübersicht</Text>
          <View style={styles.orderCard}>
            <View style={styles.orderRow}>
              <View style={styles.orderIconWrap}>
                <Ionicons name="construct-outline" size={22} color={C.sub} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.orderJobTitle}>{jobTitle}</Text>
                {providerName ? <Text style={styles.orderProvider}>{providerName}</Text> : null}
                <View style={styles.orderMeta}>
                  <Ionicons name="lock-closed-outline" size={12} color={C.muted} />
                  <Text style={styles.orderMetaText}>Zahlung via Stripe-Escrow gesichert</Text>
                </View>
              </View>
              <Badge label="Aktiv" variant="green" />
            </View>
          </View>
        </View>

        <Divider margin={0} />

        {/* Zahlungsmethode */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Zahlungsmethode</Text>
          <View style={styles.methodInfoBox}>
            <Ionicons name="card-outline" size={18} color={C.sub} />
            <Text style={styles.methodInfoText}>
              Kreditkarte, SEPA, Apple Pay, Google Pay — Auswahl im nächsten Schritt
            </Text>
          </View>
        </View>

        <Divider margin={0} />

        {/* Kostenübersicht */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kostenübersicht</Text>
          <CostRow label={jobTitle} value={`€${basePrice.toFixed(2)}`} />
          <CostRow
            label="Servicegebühr (2,5 %, mind. 1,50)"
            value={`€${serviceFee.toFixed(2)}`}
          />
          <CostRow label="WERKR-Schutz" value={`€${schutzFee.toFixed(2)}`} />
          <View style={styles.totalDivider} />
          <CostRow label="Gesamtbetrag" value={`€${total.toFixed(2)}`} highlight />
        </View>

        <Divider margin={0} />

        {/* WERKR-Schutz info */}
        <View style={styles.section}>
          <View style={styles.schutzBox}>
            <Ionicons name="shield-checkmark-outline" size={20} color={C.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.schutzTitle}>WERKR-Schutz inklusive</Text>
              <Text style={styles.schutzText}>
                Ihr Geld ist bis zur Jobfreigabe geschützt. Bei Problemen erhalten Sie eine vollständige Rückerstattung.
              </Text>
            </View>
          </View>
        </View>

        <Divider margin={0} />

        {/* Widerrufsrecht checkbox */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setAgreed((v) => !v)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
              {agreed && <Ionicons name="checkmark" size={14} color={C.surface} />}
            </View>
            <Text style={styles.checkboxLabel}>
              Ich verzichte auf mein Widerrufsrecht gemäß{' '}
              <Text style={styles.checkboxLabelBold}>§356 Abs. 5 BGB</Text>
              {' '}und stimme zu, dass die Leistung sofort beginnen kann.
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* CTA bar */}
      <View style={styles.ctaBar}>
        <AnimatedButton
          style={[styles.payBtn, !agreed && styles.payBtnDisabled]}
          onPress={handlePay}
          disabled={!agreed || loading}
        >
          {loading
            ? <ActivityIndicator color={C.surface} size="small" />
            : <Ionicons name="lock-closed" size={18} color={!agreed ? C.muted : C.surface} />
          }
          <Text style={[styles.payBtnText, !agreed && styles.payBtnTextDisabled]}>
            {loading ? 'Wird verarbeitet…' : 'Jetzt zahlen & Escrow sperren'}
          </Text>
        </AnimatedButton>

        <Text style={styles.stripeNote}>Sichere Zahlung via Stripe · PCI DSS konform</Text>
      </View>
    </SafeAreaView>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────────────── */

function TimelineStep({
  icon, color, label, sublabel, status, last = false,
}: {
  icon: string;
  color: string;
  label: string;
  sublabel?: string;
  status: 'done' | 'current' | 'pending';
  last?: boolean;
}) {
  const labelColor = status === 'pending' ? C.muted : C.ink;
  const weight: '500' | '700' = status === 'current' ? '700' : '500';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
      <View style={{ alignItems: 'center', width: 24 }}>
        <Ionicons name={icon as any} size={22} color={color} />
        {!last && <View style={tlStyles.connector} />}
      </View>
      <View style={{ flex: 1, paddingBottom: last ? 0 : 18 }}>
        <Text style={{ fontSize: 14, fontWeight: weight, color: labelColor, lineHeight: 20 }}>
          {label}
        </Text>
        {sublabel ? (
          <Text style={{ fontSize: 12, color: C.amber, marginTop: 2 }}>{sublabel}</Text>
        ) : null}
      </View>
    </View>
  );
}

const tlStyles = StyleSheet.create({
  connector: { width: 2, flex: 1, backgroundColor: C.border, minHeight: 14, marginTop: 3 },
});


function CostRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.costRow}>
      <Text style={[styles.costLabel, highlight && styles.costLabelHighlight]}>{label}</Text>
      <Text style={[styles.costValue, highlight && styles.costValueHighlight]}>{value}</Text>
    </View>
  );
}

/* ── Styles ──────────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container:            { flex: 1, backgroundColor: C.bg },

  // Header
  header:               { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  backBtn:              { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:          { ...T.h3, flex: 1, color: C.ink, textAlign: 'center' },

  // Section wrapper
  section:              { paddingHorizontal: 20, paddingVertical: 16 },
  sectionTitle:         { ...T.label, color: C.sub, marginBottom: 14 },

  // Bestellübersicht
  orderCard:            { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16 },
  orderRow:             { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  orderIconWrap:        { width: 44, height: 44, borderRadius: 10, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  orderJobTitle:        { fontSize: 15, fontWeight: '700', color: C.ink, marginBottom: 2 },
  orderProvider:        { fontSize: 13, color: C.sub, marginBottom: 4 },
  orderMeta:            { flexDirection: 'row', alignItems: 'center', gap: 5 },
  orderMetaText:        { fontSize: 12, color: C.muted },

  // Payment method info
  methodInfoBox:        { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14 },
  methodInfoText:       { flex: 1, fontSize: 13, color: C.sub, lineHeight: 18 },

  // Cost breakdown
  costRow:              { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  costLabel:            { fontSize: 13, color: C.sub, flex: 1 },
  costLabelHighlight:   { fontSize: 15, fontWeight: '700', color: C.ink },
  costValue:            { fontSize: 13, fontWeight: '600', color: C.ink },
  costValueHighlight:   { fontSize: 17, fontWeight: '700', color: C.ink },
  totalDivider:         { height: 1, backgroundColor: C.border, marginVertical: 8 },

  // WERKR-Schutz box
  schutzBox:            { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: C.primaryBg, borderWidth: 1, borderColor: C.primary, borderRadius: 12, padding: 14 },
  schutzTitle:          { fontSize: 14, fontWeight: '700', color: C.primary, marginBottom: 3 },
  schutzText:           { fontSize: 12, color: C.sub, lineHeight: 17 },

  // Widerrufsrecht checkbox
  checkboxRow:          { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  checkbox:             { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxChecked:      { backgroundColor: C.primary, borderColor: C.primary },
  checkboxLabel:        { flex: 1, fontSize: 13, color: C.sub, lineHeight: 19 },
  checkboxLabelBold:    { fontWeight: '700', color: C.ink },

  // CTA bar
  ctaBar:               { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, padding: 16, paddingBottom: 28 },
  payBtn:               { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 12, paddingVertical: 15, marginBottom: 10 },
  payBtnDisabled:       { backgroundColor: C.border },
  payBtnText:           { fontSize: 16, fontWeight: '700', color: C.surface },
  payBtnTextDisabled:   { color: C.muted },
  stripeNote:           { fontSize: 12, color: C.muted, textAlign: 'center', marginTop: 8 },

  // Success screen
  successScroll:        { flexGrow: 1, alignItems: 'center', padding: 24, paddingBottom: 48 },
  successIconWrap:      { width: 110, height: 110, borderRadius: 55, backgroundColor: C.primaryBg, alignItems: 'center', justifyContent: 'center', marginTop: 20, marginBottom: 20 },
  successTitle:         { ...T.h1, color: C.ink, textAlign: 'center', marginBottom: 10 },
  successSub:           { fontSize: 15, color: C.sub, textAlign: 'center', lineHeight: 22, marginBottom: 28, paddingHorizontal: 8 },
  timelineCard:         { width: '100%', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 18, marginBottom: 28 },
  timelineHeading:      { ...T.label, color: C.sub, marginBottom: 18 },
  primaryBtn:           { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 12, paddingVertical: 15, marginBottom: 12 },
  primaryBtnText:       { fontSize: 16, fontWeight: '700', color: C.surface },
  secondaryBtn:         { paddingVertical: 12, alignItems: 'center' },
  secondaryBtnText:     { fontSize: 14, color: C.sub, textDecorationLine: 'underline' },
});
