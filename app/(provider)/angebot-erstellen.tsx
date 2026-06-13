import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { C } from '../../constants/colors';
import { showAlert } from '../../lib/alert';

type PriceType = 'festpreis' | 'stundensatz';
type Duration = '< 1h' | '1–3h' | '3–8h' | 'Mehrere Tage';

export default function AngebotErstellen() {
  const router = useRouter();

  const [description, setDescription] = useState('');
  const [priceType, setPriceType] = useState<PriceType>('festpreis');
  const [totalPrice, setTotalPrice] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [duration, setDuration] = useState<Duration | null>(null);
  const [materialsIncluded, setMaterialsIncluded] = useState(false);
  const [materialCost, setMaterialCost] = useState('');
  const [note, setNote] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [loading, setLoading] = useState(false);

  const durations: Duration[] = ['< 1h', '1–3h', '3–8h', 'Mehrere Tage'];

  const getPriceValue = () => {
    if (priceType === 'festpreis') {
      return parseFloat(totalPrice.replace(',', '.')) || 0;
    }
    const rate = parseFloat(hourlyRate.replace(',', '.')) || 0;
    const hours = parseFloat(estimatedHours.replace(',', '.')) || 0;
    return rate * hours;
  };

  const werkrFee = getPriceValue() * 0.08;
  const netAmount = getPriceValue() - werkrFee;
  const matCost = parseFloat(materialCost.replace(',', '.')) || 0;
  const totalPayout = netAmount + (materialsIncluded ? matCost : 0);

  const formatEur = (val: number) =>
    val.toFixed(2).replace('.', ',');

  const isValid =
    description.trim().length >= 20 &&
    getPriceValue() > 0 &&
    appointmentDate.trim().length > 0;

  const handleSubmit = () => {
    if (!isValid || loading) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      showAlert(
        'Angebot gesendet',
        'Angebot wurde an Maria K. gesendet. Sie wird in der App benachrichtigt.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    }, 1500);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={C.ink} />
          </TouchableOpacity>
          <View style={s.headerText}>
            <Text style={s.headerTitle}>Angebot erstellen</Text>
            <Text style={s.headerSub}>Anfrage #AUF-2406-1234</Text>
          </View>
        </View>

        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.inquiryCard}>
            <View style={s.inquiryBorder} />
            <View style={s.inquiryBody}>
              <Text style={s.inquiryLabel}>Kundenanfrage</Text>
              <Row label="Kunde" value="Maria K." />
              <Row label="Leistung" value="Badezimmer fließen, ca. 12 m², Wandfliesen 20x20cm" />
              <Row label="Adresse" value="50667 Köln, Kölner Str. 22" />
              <Row label="Wunschzeit" value="Diese Woche, nachmittags" />
              <View style={s.chipRow}>
                <View style={s.urgencyChip}>
                  <Text style={s.urgencyChipText}>Diese Woche</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>Leistungsumfang</Text>
            <Text style={s.fieldLabel}>Beschreibung der Leistung</Text>
            <TextInput
              style={s.textArea}
              value={description}
              onChangeText={setDescription}
              placeholder="Was genau werden Sie ausführen? (Material, Umfang, Besonderheiten…)"
              placeholderTextColor={C.muted}
              multiline
              numberOfLines={4}
              maxLength={500}
              textAlignVertical="top"
            />
            <View style={s.charCountRow}>
              <Text style={s.infoText}>
                Diese Beschreibung ist der Kern Ihres Angebots und Teil des digitalen Vertrags.
              </Text>
              <Text style={s.charCount}>{description.length}/500</Text>
            </View>
          </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>Preis & Zeit</Text>

            <Text style={s.fieldLabel}>Preistyp</Text>
            <View style={s.toggleRow}>
              <TouchableOpacity
                style={[s.toggleChip, priceType === 'festpreis' && s.toggleChipActive]}
                onPress={() => setPriceType('festpreis')}
              >
                <Text style={[s.toggleChipText, priceType === 'festpreis' && s.toggleChipTextActive]}>
                  Festpreis
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.toggleChip, priceType === 'stundensatz' && s.toggleChipActive]}
                onPress={() => setPriceType('stundensatz')}
              >
                <Text style={[s.toggleChipText, priceType === 'stundensatz' && s.toggleChipTextActive]}>
                  Stundensatz
                </Text>
              </TouchableOpacity>
            </View>

            {priceType === 'festpreis' ? (
              <>
                <Text style={s.fieldLabel}>Gesamtpreis (€)</Text>
                <TextInput
                  style={s.input}
                  value={totalPrice}
                  onChangeText={setTotalPrice}
                  placeholder="z.B. 320,00"
                  placeholderTextColor={C.muted}
                  keyboardType="decimal-pad"
                />
              </>
            ) : (
              <View style={s.sideBySide}>
                <View style={s.halfField}>
                  <Text style={s.fieldLabel}>Stundensatz (€/h)</Text>
                  <TextInput
                    style={s.input}
                    value={hourlyRate}
                    onChangeText={setHourlyRate}
                    placeholder="z.B. 55,00"
                    placeholderTextColor={C.muted}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={s.halfField}>
                  <Text style={s.fieldLabel}>Geschätzte Stunden</Text>
                  <TextInput
                    style={s.input}
                    value={estimatedHours}
                    onChangeText={setEstimatedHours}
                    placeholder="z.B. 6"
                    placeholderTextColor={C.muted}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            )}

            {getPriceValue() > 0 && (
              <View style={s.feeRow}>
                <Text style={s.feeLabel}>WERKR-Gebühr (8%): €{formatEur(werkrFee)}</Text>
                <Text style={s.netAmount}>Ihr Nettobetrag: €{formatEur(netAmount)}</Text>
              </View>
            )}

            <Text style={s.fieldLabel}>Wunschtermin</Text>
            <TextInput
              style={s.input}
              value={appointmentDate}
              onChangeText={setAppointmentDate}
              placeholder="z.B. 15.06.2026, 14:00 Uhr"
              placeholderTextColor={C.muted}
            />

            <Text style={s.fieldLabel}>Geschätzte Dauer</Text>
            <View style={s.chipGroup}>
              {durations.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[s.durationChip, duration === d && s.durationChipActive]}
                  onPress={() => setDuration(d)}
                >
                  <Text style={[s.durationChipText, duration === d && s.durationChipTextActive]}>
                    {d}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>Materialien</Text>
            <View style={s.switchRow}>
              <Text style={s.switchLabel}>Materialkosten enthalten?</Text>
              <Switch
                value={materialsIncluded}
                onValueChange={setMaterialsIncluded}
                trackColor={{ false: C.border, true: C.gold }}
                thumbColor={C.surface}
              />
            </View>
            {materialsIncluded && (
              <>
                <Text style={s.fieldLabel}>Materialkosten (€)</Text>
                <TextInput
                  style={s.input}
                  value={materialCost}
                  onChangeText={setMaterialCost}
                  placeholder="z.B. 80,00"
                  placeholderTextColor={C.muted}
                  keyboardType="decimal-pad"
                />
              </>
            )}
            <Text style={s.infoText}>
              Bei Materialkosten empfehlen wir, eine Aufstellung im Kommentar beizufügen.
            </Text>
          </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>Anmerkungen</Text>
            <Text style={s.fieldLabel}>Optionale Anmerkung</Text>
            <TextInput
              style={s.textAreaSmall}
              value={note}
              onChangeText={setNote}
              placeholder="Weitere Informationen für den Kunden…"
              placeholderTextColor={C.muted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={s.section}>
            <View style={s.validityRow}>
              <Text style={s.fieldLabel}>Angebot gültig bis:</Text>
              <Text style={s.validityHint}>Empfehlung: +48h</Text>
            </View>
            <TextInput
              style={s.input}
              value={validUntil}
              onChangeText={setValidUntil}
              placeholder="z.B. 16.06.2026"
              placeholderTextColor={C.muted}
            />
          </View>

          <View style={s.breakdownCard}>
            <Text style={s.breakdownTitle}>Preisübersicht</Text>
            <BreakdownRow label="Leistungspreis" value={`€${formatEur(getPriceValue())}`} />
            {materialsIncluded && (
              <BreakdownRow label="Materialkosten" value={`€${formatEur(matCost)}`} />
            )}
            <BreakdownRow label="WERKR-Gebühr (8%)" value={`−€${formatEur(werkrFee)}`} muted />
            <View style={s.breakdownDivider} />
            <BreakdownRow label="Nettobetrag" value={`€${formatEur(netAmount)}`} bold />
            <View style={s.payoutRow}>
              <Ionicons name="card-outline" size={14} color={C.sub} style={s.payoutIcon} />
              <Text style={s.payoutText}>
                Auszahlungsbetrag via Stripe: €{formatEur(totalPayout)} (nach Auftragsabschluss)
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[s.submitBtn, !isValid && s.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!isValid || loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={C.surface} size="small" />
            ) : (
              <Text style={s.submitBtnText}>Angebot senden</Text>
            )}
          </TouchableOpacity>

          <View style={s.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.inquiryRow}>
      <Text style={s.inquiryRowLabel}>{label}:</Text>
      <Text style={s.inquiryRowValue}>{value}</Text>
    </View>
  );
}

function BreakdownRow({
  label,
  value,
  muted,
  bold,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
}) {
  return (
    <View style={s.breakdownRow}>
      <Text style={[s.breakdownLabel, muted && s.mutedText, bold && s.boldText]}>{label}</Text>
      <Text style={[s.breakdownValue, muted && s.mutedText, bold && s.boldText]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.ink },
  headerSub: { fontSize: 12, color: C.muted, marginTop: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16 },
  inquiryCard: {
    flexDirection: 'row',
    backgroundColor: C.amberBg,
    borderRadius: 10,
    overflow: 'hidden',
  },
  inquiryBorder: { width: 4, backgroundColor: C.amber },
  inquiryBody: { flex: 1, padding: 14, gap: 6 },
  inquiryLabel: { fontSize: 11, fontWeight: '700', color: C.amber, textTransform: 'uppercase', letterSpacing: 0.6 },
  inquiryRow: { flexDirection: 'row', gap: 6 },
  inquiryRowLabel: { fontSize: 13, color: C.sub, minWidth: 72 },
  inquiryRowValue: { fontSize: 13, color: C.ink, flex: 1 },
  chipRow: { flexDirection: 'row', marginTop: 4 },
  urgencyChip: {
    backgroundColor: C.amber,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  urgencyChipText: { fontSize: 12, color: C.surface, fontWeight: '600' },
  section: {
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    gap: 8,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: C.ink, marginBottom: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: C.sub },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: C.ink,
    backgroundColor: C.bg,
  },
  textArea: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    color: C.ink,
    backgroundColor: C.bg,
    minHeight: 100,
  },
  textAreaSmall: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    color: C.ink,
    backgroundColor: C.bg,
    minHeight: 76,
  },
  charCountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  charCount: { fontSize: 11, color: C.muted },
  infoText: { fontSize: 12, color: C.muted, lineHeight: 16, flex: 1 },
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggleChip: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  toggleChipActive: { borderColor: C.gold, backgroundColor: C.goldBg },
  toggleChipText: { fontSize: 14, color: C.sub, fontWeight: '600' },
  toggleChipTextActive: { color: C.gold },
  sideBySide: { flexDirection: 'row', gap: 10 },
  halfField: { flex: 1, gap: 6 },
  feeRow: { gap: 2 },
  feeLabel: { fontSize: 12, color: C.muted },
  netAmount: { fontSize: 13, fontWeight: '700', color: C.green },
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  durationChip: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  durationChipActive: { borderColor: C.gold, backgroundColor: C.goldBg },
  durationChipText: { fontSize: 13, color: C.sub },
  durationChipTextActive: { color: C.gold, fontWeight: '600' },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: { fontSize: 14, color: C.ink },
  validityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  validityHint: { fontSize: 11, color: C.muted },
  breakdownCard: {
    backgroundColor: C.goldBg,
    borderWidth: 1.5,
    borderColor: C.gold,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  breakdownTitle: { fontSize: 13, fontWeight: '700', color: C.gold, marginBottom: 2 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  breakdownLabel: { fontSize: 13, color: C.sub },
  breakdownValue: { fontSize: 13, color: C.ink },
  mutedText: { color: C.muted },
  boldText: { fontWeight: '700', color: C.ink, fontSize: 14 },
  breakdownDivider: { height: 1, backgroundColor: C.border, marginVertical: 2 },
  payoutRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 4 },
  payoutIcon: { marginRight: 5, marginTop: 1 },
  payoutText: { fontSize: 12, color: C.sub, flex: 1, lineHeight: 16 },
  submitBtn: {
    backgroundColor: C.gold,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: {
    backgroundColor: C.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: C.surface },
  bottomSpacer: { height: 16 },
});
