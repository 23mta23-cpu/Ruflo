import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { safeBack } from '../lib/nav';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useStripe } from '../lib/stripe';
import { C } from '../constants/colors';
import { shadow } from '../constants/theme';
import { T } from '../constants/typography';
import { Badge } from '../components/ui/Badge';
import { Divider } from '../components/ui/Divider';
import { AnimatedButton } from '../components/ui/AnimatedButton';
import { showAlert } from '../lib/alert';
import { trackEvent } from '../lib/analytics';
import { supabase } from '../lib/supabase';
import {
  haltWiderrufsEinwilligungFest, WIDERRUF_ZUSTIMMUNG, WIDERRUF_ERKLAERUNG,
} from '../lib/widerruf';
import { getContractByIdFull, type ContractFull } from '../lib/contracts';
import { toast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { mitZeitgrenze } from '../lib/retry';
import { NichtGefunden } from '../components/ui/NichtGefunden';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

export default function ZahlungScreen() {
  const router = useRouter();
  // `basePrice` als Parameter ist RAUS. Kein einziger Aufrufer hat ihn je
  // uebergeben (angebot.tsx, auftrag-detail.tsx 2x, vertrag.tsx — alle
  // schicken contractId), aber der Ersatzpfad darunter rechnete daraus eine
  // vollstaendige Bestelluebersicht: bei fehlendem Vertrag kam
  // `Math.max(0 * 0.025, 1.50)` heraus, also 1,50 € Servicegebuehr plus
  // 1,99 € Schutzgebuehr fuer einen Auftrag ueber 0 €.
  //
  // Der Kunde sah damit eine plausible Zahlungsuebersicht fuer einen Vertrag,
  // den es nicht gibt. Der Bezahlknopf war zwar abgesichert — aber erst NACH
  // dem Antippen, mit "Kein Vertrag gefunden". Bis dahin stand da eine
  // Rechnung. (Gefunden 16.08.2026 beim Kalt-Oeffnen der Geld-Bildschirme.)
  const { jobTitle: jobTitleParam, contractId } = useLocalSearchParams<{
    jobTitle?: string;
    contractId?: string;
  }>();

  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const { user } = useAuth();
  const [contract,       setContract]       = useState<ContractFull | null>(null);
  const [loading,        setLoading]        = useState(false);
  const [paid,           setPaid]           = useState(false);
  const [agreed,         setAgreed]         = useState(false);

  const [ladeFehler, setLadeFehler] = useState(false);

  useEffect(() => {
    if (!contractId) { setLadeFehler(true); return; }
    // Mit Zeitgrenze: Supabase-Aufrufe haben keine eingebaute, und ohne sie
    // stand die Geschwister-Seite /rechnung bei gestoerter Verbindung zehn
    // Sekunden lang leer da.
    mitZeitgrenze(getContractByIdFull(contractId))
      .then((c) => { setContract(c); if (!c) setLadeFehler(true); })
      .catch(() => { setLadeFehler(true); toast.error('Vertragsdaten konnten nicht geladen werden'); });
  }, [contractId]);

  const jobTitle     = contract?.job?.title ?? jobTitleParam ?? '—';
  const providerName = contract?.provider?.business_name ?? null;

  // AUSSCHLIESSLICH aus dem Vertrag. Ohne ihn wird unten gar keine Uebersicht
  // gezeigt — lieber keine Zahl als eine erfundene.
  const basePrice  = contract?.price_gross          ?? 0;
  const serviceFee = contract?.customer_service_fee ?? 0;
  const schutzFee  = contract?.werkr_schutz_fee     ?? 0;
  const total      = contract?.customer_total       ?? 0;

  async function handlePay() {
    if (!agreed || loading) return;

    // Ohne Vertrag gibt es nichts zu bezahlen — der Server wuerde die
    // Anfrage ohnehin ablehnen (contract_id muss eine UUID sein).
    if (!contractId) {
      showAlert('Kein Vertrag gefunden', 'Bitte starten Sie die Zahlung über Ihren Auftrag (Aufträge → Auftrag öffnen).', [{ text: 'OK' }]);
      return;
    }

    // Web: Stripe React Native is native-only; direct user to the app
    if (Platform.OS === 'web') {
      showAlert(
        'Zahlung via App',
        'Bitte laden Sie die Werkant App herunter, um sicher zu bezahlen. Die Zahlung ist aus Sicherheitsgründen nur in der mobilen App verfügbar.',
        [{ text: 'OK' }],
      );
      return;
    }

    setLoading(true);
    trackEvent('payment_started');

    // Den Nachweis VOR der Zahlung festhalten, nicht danach. Bis 16.08.2026
    // lag die Zustimmung nur in `agreed` und verschwand mit dem Bildschirm:
    // widerruft ein Kunde nach getaner Arbeit, konnte niemand belegen, dass er
    // je zugestimmt hat. Schlaegt das Festhalten fehl, wird auch nicht bezahlt
    // — eine Zahlung ohne belegte Einwilligung ist genau die Lage, die der
    // Haken verhindern soll.
    const nachweis = await haltWiderrufsEinwilligungFest(contractId, user?.id ?? '');
    if (nachweis === 'fehler') {
      setLoading(false);
      showAlert(
        'Zahlung nicht gestartet',
        'Ihre Zustimmung konnte nicht gespeichert werden. Es wurde nichts abgebucht. Bitte versuchen Sie es in einem Moment noch einmal.',
        [{ text: 'OK' }],
      );
      return;
    }

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
        body: JSON.stringify({ contract_id: contractId }),
      });
      const { client_secret, error: fnError } = await res.json();
      if (fnError || !client_secret) throw new Error(fnError ?? 'Zahlung konnte nicht gestartet werden');

      // 3. Init Stripe PaymentSheet
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'Werkant',
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
      trackEvent('payment_completed');
    } catch (err: any) {
      trackEvent('payment_failed');
      showAlert('Zahlung fehlgeschlagen', err?.message ?? 'Bitte erneut versuchen.', [{ text: 'OK' }]);
    } finally {
      setLoading(false);
    }
  }

  /* ── Success screen ──────────────────────────────────────────────────────── */
  // Ohne Vertrag KEINE Zahlungsuebersicht.
  if (!contract && ladeFehler) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Zurück"
            onPress={() => safeBack(router)}
            hitSlop={12}
            style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="chevron-back" size={24} color={C.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Zahlung & Escrow</Text>
          <View style={{ width: 44 }} />
        </View>
        <NichtGefunden
          titel="Kein Vertrag zu bezahlen"
          text="Zu diesem Auftrag besteht kein offener Vertrag — oder er gehört nicht zu Ihrem Konto. Ein Vertrag entsteht, wenn Sie ein Angebot annehmen. Es wurde nichts abgebucht."
          knopf="Zu meinen Aufträgen"
          onKnopf={() => safeBack(router, '/(tabs)/auftraege')}
        />
      </SafeAreaView>
    );
  }

  // Solange noch geladen wird: sagen, dass geladen wird. Ein leerer
  // Bildschirm oder ein reiner Kringel traegt kein Wort — wer nicht sieht,
  // bekommt davon nichts.
  if (!contract) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Zurück"
            onPress={() => safeBack(router)}
            hitSlop={12}
            style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="chevron-back" size={24} color={C.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Zahlung & Escrow</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator color={C.primary} />
          <Text style={{ ...T.body, color: C.sub }}>Vertragsdaten werden geladen …</Text>
        </View>
      </SafeAreaView>
    );
  }

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
            onPress={() => safeBack(router)}
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
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zurück" onPress={() => safeBack(router)} style={styles.backBtn}>
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
          <CostRow label="Werkant-Schutz" value={`€${schutzFee.toFixed(2)}`} />
          <View style={styles.totalDivider} />
          <CostRow label="Gesamtbetrag" value={`€${total.toFixed(2)}`} highlight />
        </View>

        <Divider margin={0} />

        {/* Werkant-Schutz info */}
        <View style={styles.section}>
          <View style={styles.schutzBox}>
            <Ionicons name="shield-checkmark-outline" size={20} color={C.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.schutzTitle}>Werkant-Schutz inklusive</Text>
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
            <Text style={styles.checkboxLabel}>{WIDERRUF_ZUSTIMMUNG}</Text>
          </TouchableOpacity>

          {/* Founder-Befund 16.08.2026: „Den verzicht habe ich nicht
              verstanden was steht da und muss das sein?"
              Der Satz oben ist inhaltlich UNVERAENDERT — dieselbe Norm,
              dieselbe Erklaerung; daran etwas zu drehen ist eine
              Anwaltsfrage, keine Textfrage. Was gefehlt hat, ist die
              Uebersetzung daneben: was Sie aufgeben, warum, und was
              passiert, wenn Sie NICHT zustimmen. Ein Text, den der
              Verbraucher nicht versteht, ist auch rechtlich wackelig. */}
          <Text style={styles.widerrufErklaerung}>{WIDERRUF_ERKLAERUNG}</Text>
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
  orderCard:            { ...shadow.sm,  backgroundColor: C.surface, borderWidth: 1, borderColor: C.hair, borderRadius: 16, padding: 16 },
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

  // Werkant-Schutz box
  schutzBox:            { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: C.primaryBg, borderWidth: 1, borderColor: C.primary, borderRadius: 12, padding: 14 },
  schutzTitle:          { fontSize: 14, fontWeight: '700', color: C.primary, marginBottom: 3 },
  schutzText:           { fontSize: 12, color: C.sub, lineHeight: 17 },

  // Widerrufsrecht checkbox
  checkboxRow:          { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  checkbox:             { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxChecked:      { backgroundColor: C.primary, borderColor: C.primary },
  checkboxLabel:        { flex: 1, fontSize: 13, color: C.sub, lineHeight: 19 },
  widerrufErklaerung:   { fontSize: 12, color: C.sub, lineHeight: 18, marginTop: 10 },
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
  timelineCard:         { ...shadow.sm,  width: '100%', backgroundColor: C.surface, borderWidth: 1, borderColor: C.hair, borderRadius: 16, padding: 18, marginBottom: 28 },
  timelineHeading:      { ...T.label, color: C.sub, marginBottom: 18 },
  primaryBtn:           { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 12, paddingVertical: 15, marginBottom: 12 },
  primaryBtnText:       { fontSize: 16, fontWeight: '700', color: C.surface },
  secondaryBtn:         { paddingVertical: 12, alignItems: 'center' },
  secondaryBtnText:     { fontSize: 14, color: C.sub, textDecorationLine: 'underline' },
});
