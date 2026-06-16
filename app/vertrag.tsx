import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { T } from '../constants/theme';
import { Badge } from '../components/ui/Badge';
import { Divider } from '../components/ui/Divider';
import { AnimatedButton } from '../components/ui/AnimatedButton';

type State = 'pending' | 'signed' | 'extension';

export default function VertragScreen() {
  const router = useRouter();
  const [state, setState] = useState<State>('pending');
  const [customerSigned, setCustomerSigned] = useState(false);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Digitaler Vertrag</Text>
        <Badge label={state === 'signed' ? 'Aktiv' : 'Ausstehend'} variant={state === 'signed' ? 'green' : 'amber'} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* Contract ID */}
        <View style={styles.contractIdBar}>
          <Ionicons name="document-text-outline" size={14} color={C.sub} />
          <Text style={styles.contractId}>Vertrag #WRK-2406-0047</Text>
          <Text style={styles.contractDate}>09. Jun 2025</Text>
        </View>

        {/* Parties */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vertragsparteien</Text>
          <View style={styles.partiesRow}>
            <PartyCard icon="person" label="Auftraggeber" name="Familie Müller" verified />
            <Ionicons name="swap-horizontal" size={20} color={C.muted} />
            <PartyCard icon="briefcase" label="Auftragnehmer" name="Yilmaz GmbH" verified />
          </View>
        </View>

        <Divider margin={0} />

        {/* Terms */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vereinbarte Leistung</Text>
          <ContractRow label="Leistung"       value="Heizkörper-Diagnose & Thermostat tauschen" />
          <ContractRow label="Festpreis"      value="€120,00" highlight />
          <ContractRow label="Termin"         value="Mo., 09. Jun 2025 · 14:00 Uhr" />
          <ContractRow label="Dauer (ca.)"    value="1–2 Stunden" />
          <ContractRow label="Adresse"        value="Musterstraße 12, 50667 Köln" />
          <ContractRow label="Stornierung"    value="Kostenlos bis 24h vorher" />
          <View style={styles.feeDivider} />
          <ContractRow label="Plattformgebühr (8%)" value="€ 9,60" />
          <ContractRow label="Auszahlung Anbieter"  value="€110,40" highlight />
        </View>

        <Divider margin={0} />

        {/* Escrow */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Zahlungsabwicklung (Escrow)</Text>
          <View style={styles.escrowBox}>
            <View style={styles.escrowStep}>
              <View style={[styles.escrowDot, { backgroundColor: state === 'signed' ? C.green : C.amber }]} />
              <View>
                <Text style={styles.escrowStepTitle}>Betrag eingefroren</Text>
                <Text style={styles.escrowStepSub}>€120 werden bei Buchung gesperrt</Text>
              </View>
            </View>
            <View style={styles.escrowLine} />
            <View style={styles.escrowStep}>
              <View style={[styles.escrowDot, { backgroundColor: C.border }]} />
              <View>
                <Text style={styles.escrowStepTitle}>Job abgeschlossen</Text>
                <Text style={styles.escrowStepSub}>Beide Parteien bestätigen</Text>
              </View>
            </View>
            <View style={styles.escrowLine} />
            <View style={styles.escrowStep}>
              <View style={[styles.escrowDot, { backgroundColor: C.border }]} />
              <View>
                <Text style={styles.escrowStepTitle}>Auszahlung freigegeben</Text>
                <Text style={styles.escrowStepSub}>Geld geht an Auftragnehmer</Text>
              </View>
            </View>
          </View>
        </View>

        <Divider margin={0} />

        {/* Widerrufsrecht §312 BGB */}
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

        {/* Strike Notice */}
        <View style={styles.section}>
          <View style={styles.strikeNotice}>
            <Ionicons name="alert-circle-outline" size={16} color={C.amber} />
            <Text style={styles.strikeNoticeText}>
              Vertragsbruch (Preiserhöhung, Nichterscheinen, Abbruch ohne Grund) führt automatisch zu einem Strike.
            </Text>
          </View>
        </View>

        {/* Verlängerungsantrag */}
        {state === 'signed' && (
          <>
            <Divider margin={0} />
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Vertragsverlängerung</Text>
              <TouchableOpacity
                style={styles.extensionBtn}
                onPress={() => setState('extension')}
                activeOpacity={0.8}
              >
                <Ionicons name="time-outline" size={18} color={C.gold} />
                <Text style={styles.extensionBtnText}>Verlängerungsantrag stellen</Text>
                <Ionicons name="chevron-forward" size={16} color={C.gold} />
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Extension UI */}
        {state === 'extension' && (
          <>
            <Divider margin={0} />
            <View style={[styles.section, { backgroundColor: C.goldBg }]}>
              <Text style={[styles.sectionTitle, { color: C.gold }]}>Verlängerungsantrag läuft</Text>
              <ContractRow label="Neues Enddatum"  value="Mo., 09. Jun 2025 · 17:00 Uhr" />
              <ContractRow label="Preisänderung"   value="+€30 (gesamt €150)" highlight />
              <Text style={styles.extensionHint}>
                Kunde muss Verlängerung bestätigen. Escrow bleibt bis neue Deadline gesperrt.
              </Text>
            </View>
          </>
        )}

        {/* Signatures */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Unterschriften</Text>
          <SignatureRow
            name="Yilmaz GmbH"
            role="Auftragnehmer"
            signed
            time="09. Jun · 10:21"
          />
          <SignatureRow
            name="Familie Müller"
            role="Auftraggeber"
            signed={customerSigned}
            time={customerSigned ? '09. Jun · 10:24' : undefined}
          />
        </View>

      </ScrollView>

      {/* CTA */}
      {state === 'pending' && !customerSigned && (
        <View style={styles.ctaBar}>
          <Text style={styles.ctaHint}>Mit Bestätigung akzeptieren Sie alle Vertragsbedingungen</Text>
          <AnimatedButton
            style={styles.ctaBtn}
            onPress={() => { setCustomerSigned(true); setState('signed'); }}
          >
            <Ionicons name="checkmark-circle" size={20} color={C.surface} />
            <Text style={styles.ctaBtnText}>Vertrag bestätigen & Escrow sperren</Text>
          </AnimatedButton>
        </View>
      )}
      {state === 'signed' && (
        <View style={styles.ctaBar}>
          <AnimatedButton
            style={[styles.ctaBtn, { backgroundColor: C.green }]}
            onPress={() => router.push('/rechnung')}
          >
            <Ionicons name="checkmark-done-circle" size={20} color={C.surface} />
            <Text style={styles.ctaBtnText}>Job abschließen & Beleg öffnen</Text>
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
  extensionBtn:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.goldBg, borderWidth: 1, borderColor: C.gold, borderRadius: 10, padding: 14 },
  extensionBtnText: { flex: 1, fontSize: 14, fontWeight: '600', color: C.gold },
  extensionHint:    { fontSize: 12, color: C.amber, marginTop: 10, fontStyle: 'italic' },
  feeDivider:       { height: 1, backgroundColor: C.border, marginVertical: 8 },
  legalBox:         { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#F0EFEB', borderRadius: 10, padding: 12 },
  legalText:        { ...T.caption, flex: 1, color: C.sub, lineHeight: 17 },
  ctaBar:           { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, padding: 16, paddingBottom: 28 },
  ctaHint:          { ...T.caption, color: C.muted, textAlign: 'center', marginBottom: 10 },
  ctaBtn:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.ink, borderRadius: 12, paddingVertical: 15 },
  ctaBtnText:       { ...T.body, fontWeight: '700', color: C.surface },
});
