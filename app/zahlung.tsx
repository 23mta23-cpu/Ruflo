import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { Divider } from '../components/ui/Divider';

// Mock price params (real flow: passed via router.push({ pathname, params }))
const PLATFORM_FEE_RATE = 0.025; // 2.5% Kundenseite

export default function ZahlungScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    jobTitle?: string;
    basePrice?: string;
    contractId?: string;
  }>();

  const jobTitle  = params.jobTitle  ?? 'Heizkörper-Diagnose & Thermostat tauschen';
  const basePrice = parseFloat(params.basePrice ?? '120');
  const fee       = parseFloat((basePrice * PLATFORM_FEE_RATE).toFixed(2));
  const total     = basePrice + fee;

  const [agreed, setAgreed] = useState(false);
  const [done,   setDone]   = useState(false);

  if (done) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <Ionicons name="lock-closed" size={36} color={C.primary} />
          </View>
          <Text style={styles.successTitle}>Betrag gesichert</Text>
          <Text style={styles.successSub}>
            €{total.toFixed(2).replace('.', ',')} wurden in den WERKR-Treuhandbereich übertragen.
            Das Geld geht erst nach Ihrer Bestätigung an den Handwerker.
          </Text>
          <View style={styles.escrowTimeline}>
            <EscrowStep icon="lock-closed-outline" color={C.primary} label="Betrag eingefroren" sub="Jetzt — durch Zahlung" done />
            <EscrowStep icon="hammer-outline"      color={C.sub}     label="Leistung erbracht" sub="Handwerker schließt Job ab" />
            <EscrowStep icon="checkmark-circle-outline" color={C.sub} label="Ihre Freigabe" sub="Sie bestätigen & Zahlung geht raus" />
          </View>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.back()}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Zurück zum Auftrag</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Zahlung</Text>
        <View style={styles.sslBadge}>
          <Ionicons name="lock-closed" size={12} color={C.primary} />
          <Text style={styles.sslText}>SSL</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 160 }}>

        {/* Launch banner */}
        <View style={styles.launchBanner}>
          <Ionicons name="construct-outline" size={16} color={C.clay} />
          <Text style={styles.launchBannerText}>
            Kartenzahlung wird beim offiziellen Launch via Stripe aktiviert. Im Beta-Betrieb wird die Zahlung außerhalb der App abgewickelt.
          </Text>
        </View>

        {/* Job + price summary */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Auftrag</Text>
          <Text style={styles.jobTitle}>{jobTitle}</Text>
        </View>

        <View style={styles.priceBox}>
          <PriceLine label="Festpreis (Handwerker)" value={`€${basePrice.toFixed(2).replace('.', ',')}`} />
          <PriceLine label="WERKR Service-Gebühr (2,5%)" value={`+ €${fee.toFixed(2).replace('.', ',')}`} muted />
          <Divider margin={10} />
          <PriceLine label="Gesamtbetrag" value={`€${total.toFixed(2).replace('.', ',')}`} bold />
        </View>

        {/* Escrow explanation */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>So funktioniert WERKR Escrow</Text>
          <EscrowStep icon="lock-closed-outline"      color={C.primary} label="Betrag einfrieren"   sub="Ihr Geld bleibt bei uns — kein Cent geht an den Handwerker." />
          <EscrowStep icon="hammer-outline"            color={C.sub}     label="Arbeit abschließen"  sub="Der Handwerker schließt den Auftrag ab und reicht die Abnahme ein." />
          <EscrowStep icon="checkmark-circle-outline"  color={C.sub}     label="Sie bestätigen"      sub="Erst Ihre OK-Klick löst die Auszahlung aus." />
          <EscrowStep icon="shield-checkmark-outline"  color={C.sub}     label="WERKR-Garantie"      sub="Bei Streit greift unsere Schlichtung — Sie sind immer abgesichert." />
        </View>

        {/* Zahlungsmethode (mock) */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Zahlungsmethode</Text>
          <View style={styles.cardPlaceholder}>
            <Ionicons name="card-outline" size={20} color={C.muted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardPlaceholderTitle}>Kreditkarte / Debitkarte</Text>
              <Text style={styles.cardPlaceholderSub}>Wird beim Launch aktiviert — Stripe PCI DSS Level 1</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.muted} />
          </View>
          <View style={[styles.cardPlaceholder, { marginTop: 8, opacity: 0.6 }]}>
            <Ionicons name="logo-paypal" size={20} color={C.muted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardPlaceholderTitle}>PayPal</Text>
              <Text style={styles.cardPlaceholderSub}>Folgt beim Launch</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.muted} />
          </View>
          <View style={[styles.cardPlaceholder, { marginTop: 8, opacity: 0.6 }]}>
            <Ionicons name="repeat-outline" size={20} color={C.muted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardPlaceholderTitle}>SEPA-Lastschrift</Text>
              <Text style={styles.cardPlaceholderSub}>Für wiederkehrende Aufträge</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.muted} />
          </View>
        </View>

        {/* Trust badges */}
        <View style={styles.trustRow}>
          <TrustChip icon="shield-checkmark-outline" label="DSGVO-konform" />
          <TrustChip icon="lock-closed-outline"      label="PCI DSS L1" />
          <TrustChip icon="ribbon-outline"           label="Verschlüsselt" />
        </View>

        {/* Consent */}
        <TouchableOpacity
          style={styles.consentRow}
          onPress={() => setAgreed((v) => !v)}
          activeOpacity={0.8}
        >
          <View style={[styles.checkbox, agreed && styles.checkboxActive]}>
            {agreed && <Ionicons name="checkmark" size={14} color={C.surface} />}
          </View>
          <Text style={styles.consentText}>
            Ich stimme den{' '}
            <Text style={{ fontWeight: '700', color: C.primary }}>AGB</Text>,{' '}
            dem{' '}
            <Text style={{ fontWeight: '700', color: C.primary }}>Widerrufsrecht</Text>{' '}
            und der zahlungspflichtigen Escrow-Buchung zu.
          </Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.ctaBar}>
        <TouchableOpacity
          style={[styles.primaryBtn, !agreed && styles.primaryBtnDisabled]}
          disabled={!agreed}
          onPress={() => setDone(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="lock-closed" size={18} color={C.surface} />
          <Text style={styles.primaryBtnText}>
            Jetzt €{total.toFixed(2).replace('.', ',')} sichern (Escrow)
          </Text>
        </TouchableOpacity>
        <Text style={styles.ctaHint}>
          Ihr Geld wird eingefroren, nicht sofort ausgezahlt.
        </Text>
      </View>
    </SafeAreaView>
  );
}

function PriceLine({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
      <Text style={{ fontSize: 14, color: muted ? C.sub : C.ink, flex: 1 }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: bold ? '800' : '600', color: bold ? C.ink : C.sub }}>{value}</Text>
    </View>
  );
}

function EscrowStep({ icon, color, label, sub, done }: {
  icon: string; color: string; label: string; sub: string; done?: boolean;
}) {
  return (
    <View style={styles.escrowStep}>
      <View style={[styles.escrowIconWrap, { backgroundColor: done ? C.primaryBg : '#F2F2F0' }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.escrowLabel, done && { color: C.primary }]}>{label}</Text>
        <Text style={styles.escrowSub}>{sub}</Text>
      </View>
    </View>
  );
}

function TrustChip({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.trustChip}>
      <Ionicons name={icon as any} size={13} color={C.primary} />
      <Text style={styles.trustChipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: C.bg },
  header:              { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14 },
  backBtn:             { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:         { flex: 1, fontSize: 18, fontWeight: '800', color: C.ink },
  sslBadge:            { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.primaryBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  sslText:             { fontSize: 11, fontWeight: '700', color: C.primary },

  launchBanner:        { flexDirection: 'row', alignItems: 'flex-start', gap: 10, margin: 16, backgroundColor: C.clayBg, borderRadius: 12, padding: 14 },
  launchBannerText:    { flex: 1, fontSize: 13, color: C.clay, lineHeight: 19 },

  section:             { paddingHorizontal: 20, paddingVertical: 12 },
  sectionLabel:        { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 },
  jobTitle:            { fontSize: 15, fontWeight: '700', color: C.ink, lineHeight: 22 },

  priceBox:            { marginHorizontal: 16, marginBottom: 4, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16 },

  escrowStep:          { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  escrowIconWrap:      { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  escrowLabel:         { fontSize: 14, fontWeight: '700', color: C.ink, marginBottom: 2 },
  escrowSub:           { fontSize: 12, color: C.sub, lineHeight: 17 },

  cardPlaceholder:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14 },
  cardPlaceholderTitle: { fontSize: 14, fontWeight: '600', color: C.ink },
  cardPlaceholderSub:  { fontSize: 11, color: C.muted, marginTop: 1 },

  trustRow:            { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, paddingBottom: 8 },
  trustChip:           { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.primaryBg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  trustChipText:       { fontSize: 11, fontWeight: '600', color: C.primary },

  consentRow:          { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 20, paddingVertical: 12 },
  checkbox:            { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface, marginTop: 1 },
  checkboxActive:      { backgroundColor: C.primary, borderColor: C.primary },
  consentText:         { flex: 1, fontSize: 13, color: C.sub, lineHeight: 19 },

  ctaBar:              { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, padding: 16, paddingBottom: 28, gap: 8 },
  primaryBtn:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16 },
  primaryBtnDisabled:  { backgroundColor: C.muted },
  primaryBtnText:      { fontSize: 15, fontWeight: '700', color: C.surface },
  ctaHint:             { fontSize: 11, color: C.muted, textAlign: 'center' },

  // Success state
  successWrap:         { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successIcon:         { width: 80, height: 80, borderRadius: 24, backgroundColor: C.primaryBg, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  successTitle:        { fontSize: 22, fontWeight: '800', color: C.ink, marginBottom: 10 },
  successSub:          { fontSize: 14, color: C.sub, textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  escrowTimeline:      { width: '100%', backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 28, gap: 12 },
});
