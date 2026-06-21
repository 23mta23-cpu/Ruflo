import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { T } from '../constants/theme';
import { Badge } from '../components/ui/Badge';
import { Divider } from '../components/ui/Divider';
import { AnimatedButton } from '../components/ui/AnimatedButton';
import { getContractByIdFull, getContractByJobId, type ContractFull } from '../lib/contracts';

function eur(cents: number) {
  return `€ ${(cents / 100).toFixed(2).replace('.', ',')}`;
}

function fmtDt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function VertragScreen() {
  const router = useRouter();
  const { contractId, jobId } = useLocalSearchParams<{ contractId?: string; jobId?: string }>();
  const [contract, setContract] = useState<ContractFull | null>(null);
  const [loading, setLoading] = useState(!!(contractId || jobId));

  useEffect(() => {
    async function load() {
      if (contractId) {
        const c = await getContractByIdFull(contractId);
        setContract(c);
      } else if (jobId) {
        const byJob = await getContractByJobId(jobId);
        if (byJob) {
          const c = await getContractByIdFull(byJob.id);
          setContract(c);
        }
      }
      setLoading(false);
    }
    if (contractId || jobId) load();
  }, [contractId, jobId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={C.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Digitaler Vertrag</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // Derive display values — use real data when available, fallback for preview
  const customerName = contract?.customer?.full_name ?? 'Auftraggeber';
  const providerName = contract?.provider?.business_name ?? 'Anbieter';
  const jobTitle     = contract?.job?.title ?? 'Dienstleistung';
  const priceGross   = contract?.price_gross ?? 0;
  const providerPayout = contract?.provider_payout ?? 0;
  const customerTotal  = contract?.customer_total ?? 0;
  const customerServiceFee = contract?.customer_service_fee ?? 0;
  const jobCity      = contract?.job?.address_city ?? '—';
  const contractDate = contract?.created_at
    ? new Date(contract.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—';
  const contractIdShort = contractId
    ? `WRK-${contractId.slice(0, 8).toUpperCase()}`
    : 'WRK-PREVIEW';

  const isSigned = !!contract?.customer_signed_at && !!contract?.provider_signed_at;
  const providerSignedAt = contract?.provider_signed_at ? fmtDt(contract.provider_signed_at) : undefined;
  const customerSignedAt = contract?.customer_signed_at ? fmtDt(contract.customer_signed_at) : undefined;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Digitaler Vertrag</Text>
        <Badge label={isSigned ? 'Aktiv' : 'Ausstehend'} variant={isSigned ? 'green' : 'amber'} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        <View style={styles.contractIdBar}>
          <Ionicons name="document-text-outline" size={14} color={C.sub} />
          <Text style={styles.contractId}>Vertrag #{contractIdShort}</Text>
          <Text style={styles.contractDate}>{contractDate}</Text>
        </View>

        {/* Parties */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vertragsparteien</Text>
          <View style={styles.partiesRow}>
            <PartyCard icon="person"    label="Auftraggeber"  name={customerName} verified />
            <Ionicons name="swap-horizontal" size={20} color={C.muted} />
            <PartyCard icon="briefcase" label="Auftragnehmer" name={providerName} verified />
          </View>
        </View>

        <Divider margin={0} />

        {/* Terms */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vereinbarte Leistung</Text>
          <ContractRow label="Leistung"    value={jobTitle} />
          <ContractRow label="Festpreis"   value={`€ ${priceGross.toFixed(2).replace('.', ',')}`} highlight />
          <ContractRow label="Ort"         value={jobCity} />
          <ContractRow label="Stornierung" value="Kostenlos bis 48h vorher" />
          <View style={styles.feeDivider} />
          <ContractRow label="Plattformgebühr (8%)" value={`€ ${(priceGross * 0.08).toFixed(2).replace('.', ',')}`} />
          <ContractRow label="Auszahlung Anbieter"  value={`€ ${providerPayout.toFixed(2).replace('.', ',')}`} highlight />
          {customerServiceFee > 0 && (
            <>
              <View style={styles.feeDivider} />
              <ContractRow label="Service-Gebühr (Kunde)" value={`€ ${customerServiceFee.toFixed(2).replace('.', ',')}`} />
              <ContractRow label="Gesamtbetrag (Kunde)"   value={`€ ${customerTotal.toFixed(2).replace('.', ',')}`} highlight />
            </>
          )}
        </View>

        <Divider margin={0} />

        {/* Escrow */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Zahlungsabwicklung (Escrow)</Text>
          <View style={styles.escrowBox}>
            <View style={styles.escrowStep}>
              <View style={[styles.escrowDot, { backgroundColor: isSigned ? C.green : C.amber }]} />
              <View>
                <Text style={styles.escrowStepTitle}>Betrag eingefroren</Text>
                <Text style={styles.escrowStepSub}>€{customerTotal.toFixed(0)} werden bei Buchung gesperrt</Text>
              </View>
            </View>
            <View style={styles.escrowLine} />
            <View style={styles.escrowStep}>
              <View style={[styles.escrowDot, { backgroundColor: contract?.escrow_captured_at ? C.green : C.border }]} />
              <View>
                <Text style={styles.escrowStepTitle}>Job abgeschlossen</Text>
                <Text style={styles.escrowStepSub}>Beide Parteien bestätigen</Text>
              </View>
            </View>
            <View style={styles.escrowLine} />
            <View style={styles.escrowStep}>
              <View style={[styles.escrowDot, { backgroundColor: contract?.escrow_released_at ? C.green : C.border }]} />
              <View>
                <Text style={styles.escrowStepTitle}>Auszahlung freigegeben</Text>
                <Text style={styles.escrowStepSub}>Geld geht an Auftragnehmer</Text>
              </View>
            </View>
          </View>
        </View>

        <Divider margin={0} />

        {/* Legal */}
        <View style={styles.section}>
          <View style={styles.legalBox}>
            <Ionicons name="information-circle-outline" size={16} color={C.sub} />
            <Text style={styles.legalText}>
              <Text style={{ fontWeight: '700' }}>Widerrufsrecht (§312 BGB): </Text>
              Sie können diesen Vertrag innerhalb von 14 Tagen ohne Angabe von Gründen widerrufen. Das Widerrufsrecht erlischt vorzeitig, wenn die Leistung vor Ablauf der Frist vollständig erbracht wird und Sie dem ausdrücklich zugestimmt haben.
            </Text>
          </View>
        </View>

        <Divider margin={0} />

        <View style={styles.section}>
          <View style={styles.strikeNotice}>
            <Ionicons name="alert-circle-outline" size={16} color={C.amber} />
            <Text style={styles.strikeNoticeText}>
              Vertragsbruch (Preiserhöhung, Nichterscheinen, Abbruch ohne Grund) führt automatisch zu einem Strike.
            </Text>
          </View>
        </View>

        {/* Signatures */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Unterschriften</Text>
          <SignatureRow
            name={providerName}
            role="Auftragnehmer"
            signed={!!contract?.provider_signed_at}
            time={providerSignedAt}
          />
          <SignatureRow
            name={customerName}
            role="Auftraggeber"
            signed={!!contract?.customer_signed_at}
            time={customerSignedAt}
          />
        </View>

      </ScrollView>

      {/* CTA */}
      {contract && !isSigned && (
        <View style={styles.ctaBar}>
          <Text style={styles.ctaHint}>Mit Bestätigung akzeptieren Sie alle Vertragsbedingungen</Text>
          <AnimatedButton
            style={styles.ctaBtn}
            onPress={() => router.push({ pathname: '/zahlung', params: { contractId: contractId ?? '' } })}
          >
            <Ionicons name="checkmark-circle" size={20} color={C.surface} />
            <Text style={styles.ctaBtnText}>Vertrag bestätigen & Zahlung starten</Text>
          </AnimatedButton>
        </View>
      )}
      {isSigned && (
        <View style={styles.ctaBar}>
          <AnimatedButton
            style={[styles.ctaBtn, { backgroundColor: C.green }]}
            onPress={() => router.push({ pathname: '/auftrag-abschliessen', params: { contractId: contractId ?? '' } })}
          >
            <Ionicons name="checkmark-done-circle" size={20} color={C.surface} />
            <Text style={styles.ctaBtnText}>Auftrag abschließen</Text>
          </AnimatedButton>
        </View>
      )}
    </SafeAreaView>
  );
}

function PartyCard({ icon, label, name, verified }: { icon: string; label: string; name: string; verified?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12 }}>
      <Ionicons name={icon as any} size={20} color={C.sub} style={{ marginBottom: 6 }} />
      <Text style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink, textAlign: 'center' }}>{name}</Text>
      {verified && <Ionicons name="checkmark-circle" size={14} color={C.gold} style={{ marginTop: 4 }} />}
    </View>
  );
}

function ContractRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'flex-start', gap: 12 }}>
      <Text style={{ fontSize: 13, color: C.sub, flex: 1 }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: highlight ? '800' : '600', color: C.ink, flex: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

function SignatureRow({ name, role, signed, time }: { name: string; role: string; signed: boolean; time?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: signed ? C.green : C.border, borderRadius: 10, padding: 12, marginBottom: 8 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>{name}</Text>
        <Text style={{ fontSize: 12, color: C.sub }}>{role}</Text>
      </View>
      {signed
        ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="checkmark-circle" size={18} color={C.green} />
            <Text style={{ fontSize: 11, color: C.green }}>{time}</Text>
          </View>
        : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="time-outline" size={18} color={C.amber} />
            <Text style={{ fontSize: 11, color: C.amber }}>Ausstehend</Text>
          </View>
      }
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: C.bg },
  header:           { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  backBtn:          { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:      { ...T.h3, flex: 1, color: C.ink },
  contractIdBar:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingBottom: 16 },
  contractId:       { flex: 1, fontSize: 12, color: C.sub },
  contractDate:     { fontSize: 12, color: C.muted },
  section:          { paddingHorizontal: 20, paddingVertical: 16 },
  sectionTitle:     { ...T.label, color: C.sub, marginBottom: 14 },
  partiesRow:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  escrowBox:        { paddingLeft: 8 },
  escrowStep:       { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  escrowDot:        { width: 12, height: 12, borderRadius: 6, marginTop: 3 },
  escrowLine:       { width: 2, height: 20, backgroundColor: C.border, marginLeft: 5 },
  escrowStepTitle:  { ...T.bodySmall, fontWeight: '600', color: C.ink },
  escrowStepSub:    { ...T.caption, fontSize: 12, color: C.sub, marginTop: 1 },
  strikeNotice:     { flexDirection: 'row', gap: 10, backgroundColor: C.amberBg, borderRadius: 10, padding: 12 },
  strikeNoticeText: { flex: 1, fontSize: 12, color: C.amber, lineHeight: 18 },
  feeDivider:       { height: 1, backgroundColor: C.border, marginVertical: 8 },
  legalBox:         { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#F0EFEB', borderRadius: 10, padding: 12 },
  legalText:        { ...T.caption, flex: 1, color: C.sub, lineHeight: 17 },
  ctaBar:           { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, padding: 16, paddingBottom: 28 },
  ctaHint:          { ...T.caption, color: C.muted, textAlign: 'center', marginBottom: 10 },
  ctaBtn:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.ink, borderRadius: 12, paddingVertical: 15 },
  ctaBtnText:       { ...T.body, fontWeight: '700', color: C.surface },
});
