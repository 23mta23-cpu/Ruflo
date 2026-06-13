import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { Badge } from '../components/ui/Badge';
import { Divider } from '../components/ui/Divider';
import { showAlert } from '../lib/alert';

type State = 'pending' | 'signed' | 'extension';

const BASE_PRICE = 120;
const BASE_END = 16; // 14:00 Start + ~2h Grunddauer

export default function VertragScreen() {
  const router = useRouter();
  const [state, setState] = useState<State>('pending');
  const [customerSigned, setCustomerSigned] = useState(false);

  // Vertragsverlängerung — Anbieter legt Zusatzzeit & Aufpreis fest, Kunde bestätigt
  const [extraHours, setExtraHours] = useState(2);
  const [extraDays, setExtraDays] = useState(0);
  const [extraCost, setExtraCost] = useState(30);

  const total = BASE_PRICE; // bindend vereinbarter Festpreis
  const newTotal = BASE_PRICE + extraCost;

  function formatEnd(): string {
    const dayLabel = extraDays > 0 ? `+${extraDays} Tag${extraDays > 1 ? 'e' : ''} · ` : '';
    const hh = String(Math.min(BASE_END + extraHours, 23)).padStart(2, '0');
    return `${dayLabel}ca. ${hh}:00 Uhr`;
  }

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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 150 }}>

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
          <ContractRow label="inkl. Plattformgebühr (8%)" value="€ 9,60" />
          <ContractRow label="Zu zahlen (gesamt)" value={`€${total.toFixed(2).replace('.', ',')}`} highlight />
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

        {/* Extension UI — Anbieter legt Zusatzzeit & Aufpreis selbst fest */}
        {state === 'extension' && (
          <>
            <Divider margin={0} />
            <View style={[styles.section, { backgroundColor: C.goldBg }]}>
              <Text style={[styles.sectionTitle, { color: C.gold }]}>Verlängerung festlegen</Text>

              <Stepper
                label="Zusätzliche Stunden"
                value={extraHours}
                unit="h"
                onDec={() => setExtraHours((v) => Math.max(0, v - 1))}
                onInc={() => setExtraHours((v) => Math.min(12, v + 1))}
              />
              <Stepper
                label="Zusätzliche Tage"
                value={extraDays}
                unit={extraDays === 1 ? 'Tag' : 'Tage'}
                onDec={() => setExtraDays((v) => Math.max(0, v - 1))}
                onInc={() => setExtraDays((v) => Math.min(14, v + 1))}
              />
              <Stepper
                label="Aufpreis"
                value={extraCost}
                unit="€"
                prefixUnit
                step={5}
                onDec={() => setExtraCost((v) => Math.max(0, v - 5))}
                onInc={() => setExtraCost((v) => Math.min(2000, v + 5))}
              />

              <View style={styles.extensionSummary}>
                <ContractRow label="Neues Ende (ca.)" value={formatEnd()} />
                <ContractRow
                  label="Aufpreis"
                  value={`+€${extraCost.toFixed(2).replace('.', ',')}`}
                />
                <View style={styles.feeDivider} />
                <ContractRow
                  label="Neuer Gesamtbetrag"
                  value={`€${newTotal.toFixed(2).replace('.', ',')}`}
                  highlight
                />
              </View>

              <Text style={styles.extensionHint}>
                Der Kunde muss die Verlängerung bestätigen. Erst danach wird der Escrow-Betrag
                auf €{newTotal.toFixed(2).replace('.', ',')} erhöht.
              </Text>

              <View style={styles.extensionActions}>
                <TouchableOpacity
                  style={styles.extensionCancelBtn}
                  onPress={() => setState('signed')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.extensionCancelText}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.extensionSendBtn,
                    extraCost === 0 && extraHours === 0 && extraDays === 0 && styles.extensionSendBtnDisabled,
                  ]}
                  disabled={extraCost === 0 && extraHours === 0 && extraDays === 0}
                  onPress={() => {
                    showAlert(
                      'Verlängerung gesendet',
                      `Ihr Verlängerungsvorschlag (+${extraHours}h${extraDays > 0 ? `, +${extraDays} Tag(e)` : ''}, neuer Gesamtbetrag €${newTotal.toFixed(2).replace('.', ',')}) wurde an den Kunden gesendet. Sie werden benachrichtigt, sobald er bestätigt.`,
                      [{ text: 'OK', onPress: () => setState('signed') }],
                    );
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="send-outline" size={16} color={C.surface} />
                  <Text style={styles.extensionSendText}>An Kunde senden</Text>
                </TouchableOpacity>
              </View>
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
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={() => { setCustomerSigned(true); setState('signed'); }}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-circle" size={20} color={C.surface} />
            <Text style={styles.ctaBtnText}>Vertrag bestätigen & Escrow sperren</Text>
          </TouchableOpacity>
        </View>
      )}
      {state === 'signed' && (
        <View style={styles.ctaBar}>
          <TouchableOpacity
            style={[styles.ctaBtn, { backgroundColor: C.green }]}
            onPress={() => router.push('/rechnung')}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-done-circle" size={20} color={C.surface} />
            <Text style={styles.ctaBtnText}>Job abschließen & Beleg öffnen</Text>
          </TouchableOpacity>
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

function Stepper({
  label, value, unit, onDec, onInc, prefixUnit, step = 1,
}: {
  label: string;
  value: number;
  unit: string;
  onDec: () => void;
  onInc: () => void;
  prefixUnit?: boolean;
  step?: number;
}) {
  const display = prefixUnit ? `${unit}${value}` : `${value} ${unit}`;
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControl}>
        <TouchableOpacity style={styles.stepperBtn} onPress={onDec} activeOpacity={0.7} hitSlop={8}>
          <Ionicons name="remove" size={18} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.stepperValue}>{display}</Text>
        <TouchableOpacity style={styles.stepperBtn} onPress={onInc} activeOpacity={0.7} hitSlop={8}>
          <Ionicons name="add" size={18} color={C.ink} />
        </TouchableOpacity>
      </View>
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
  headerTitle:      { flex: 1, fontSize: 18, fontWeight: '800', color: C.ink },
  contractIdBar:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingBottom: 16 },
  contractId:       { flex: 1, fontSize: 12, color: C.sub },
  contractDate:     { fontSize: 12, color: C.muted },
  section:          { paddingHorizontal: 20, paddingVertical: 16 },
  sectionTitle:     { fontSize: 13, fontWeight: '700', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 },
  partiesRow:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  escrowBox:        { paddingLeft: 8 },
  escrowStep:       { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  escrowDot:        { width: 12, height: 12, borderRadius: 6, marginTop: 3 },
  escrowLine:       { width: 2, height: 20, backgroundColor: C.border, marginLeft: 5 },
  escrowStepTitle:  { fontSize: 13, fontWeight: '600', color: C.ink },
  escrowStepSub:    { fontSize: 12, color: C.sub, marginTop: 1 },
  strikeNotice:     { flexDirection: 'row', gap: 10, backgroundColor: C.amberBg, borderRadius: 10, padding: 12 },
  strikeNoticeText: { flex: 1, fontSize: 12, color: C.amber, lineHeight: 18 },
  extensionBtn:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.goldBg, borderWidth: 1, borderColor: C.gold, borderRadius: 10, padding: 14 },
  extensionBtnText: { flex: 1, fontSize: 14, fontWeight: '600', color: C.gold },
  extensionHint:    { fontSize: 12, color: C.amber, marginTop: 12, lineHeight: 17, fontStyle: 'italic' },

  // Verlängerung — Stepper
  stepperRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  stepperLabel:     { fontSize: 13, color: C.ink, fontWeight: '600', flex: 1 },
  stepperControl:   { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, overflow: 'hidden' },
  stepperBtn:       { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  stepperValue:     { minWidth: 64, textAlign: 'center', fontSize: 15, fontWeight: '700', color: C.ink, paddingHorizontal: 6 },

  extensionSummary: { backgroundColor: C.surface, borderRadius: 10, padding: 14, marginTop: 6 },
  extensionActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  extensionCancelBtn:  { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingVertical: 13, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surface },
  extensionCancelText: { fontSize: 14, fontWeight: '700', color: C.sub },
  extensionSendBtn:    { flex: 1.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, paddingVertical: 13, backgroundColor: C.gold },
  extensionSendBtnDisabled: { backgroundColor: '#D8CFA8' },
  extensionSendText:   { fontSize: 14, fontWeight: '700', color: C.surface },
  feeDivider:       { height: 1, backgroundColor: C.border, marginVertical: 8 },
  legalBox:         { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#F0EFEB', borderRadius: 10, padding: 12 },
  legalText:        { flex: 1, fontSize: 11, color: C.sub, lineHeight: 17 },
  ctaBar:           { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, padding: 16, paddingBottom: 28 },
  ctaHint:          { fontSize: 11, color: C.muted, textAlign: 'center', marginBottom: 10 },
  ctaBtn:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.ink, borderRadius: 12, paddingVertical: 15 },
  ctaBtnText:       { fontSize: 15, fontWeight: '700', color: C.surface },
});
