import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { safeBack } from '../lib/nav';
import { aktionsleistenRand } from '../lib/sichererRand';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { shadow } from '../constants/theme';
import { T } from '../constants/typography';
import { showAlert } from '../lib/alert';
import { supabase, SUPABASE_FUNCTIONS_URL } from '../lib/supabase';
import { calcCancellationRefundPct, stundenBisTermin, erstattungsBetrag, OHNE_TERMIN_STUNDEN } from '../lib/cancellationRefund';
import { erstattungsdauer } from '../lib/geldFristen';
import { getContractByIdFull, type ContractFull } from '../lib/contracts';
import { mitZeitgrenze } from '../lib/retry';
import { euro } from '../lib/geld';


type Step = 'confirm' | 'cancelled';

const REASONS = [
  'Termin passt nicht mehr',
  'Habe einen anderen Anbieter gefunden',
  'Auftrag wird nicht mehr benötigt',
  'Preis zu hoch',
  'Sonstiges',
] as const;

export default function StornierungScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { jobTitle, scheduledAt, hoursUntil, contractId } = useLocalSearchParams<{
    jobTitle?: string;
    scheduledAt?: string;
    /** Alte Fassung des Aufrufs. Bleibt als Rueckfallweg, siehe unten. */
    hoursUntil?: string;
    contractId?: string;
  }>();

  const [contract, setContract] = useState<ContractFull | null>(null);
  const [ladeFehler, setLadeFehler] = useState(false);
  // Drei Zustaende, nicht zwei. Die erste Fassung dieses Fixes kannte nur
  // „geladen" und „Fehler" und liess deshalb dauerhaft „Auftrag wird geladen
  // …" stehen, auch wenn der Versuch laengst gescheitert war. Zwei
  // Zusicherungen in geldwege-check.cjs wurden dafuer zu Recht rot: ein
  // Bildschirm, der ewig „wird geladen" sagt, ist auf einem Geld-Weg genau
  // die Sorte Unklarheit, die dort niemand aushalten muss.
  const [laedt, setLaedt] = useState(true);

  // Bis zum 21.09.2026 lud dieser Bildschirm den Vertrag GAR NICHT. Er nahm
  // Titel und Termin aus den URL-Parametern, und wo der Titel fehlte, stand
  // ein Platzhalter: `jobTitle ?? 'Heizungswartung'`. Wer die Adresse direkt
  // aufrief -- geteilt, als Lesezeichen, oder nach einem Neuladen --, las
  // „Heizungswartung" und stornierte scheinbar etwas, das es nicht gibt.
  // Dieselbe Klasse wie die erfundene Rechnung vom 16.08.2026; nur greift
  // geldwege-check.cjs dort nach Geldbetraegen und Zustandssaetzen, nicht
  // nach einem erfundenen Auftragstitel.
  useEffect(() => {
    if (!contractId) { setLadeFehler(true); setLaedt(false); return; }
    // Mit Zeitgrenze: Supabase-Aufrufe haben keine eingebaute, und ohne sie
    // steht der Bildschirm bei gestoerter Verbindung unbegrenzt im
    // Ladezustand. Dasselbe Muster wie in app/zahlung.tsx.
    mitZeitgrenze(getContractByIdFull(contractId))
      // `null` heisst hier NICHT „gibt es nicht": lib/contracts.ts liefert es
      // auch bei einem Netzfehler. Beides fuehrt zum selben Ergebnis -- was
      // storniert wird und was es kostet, ist unbekannt.
      .then((c) => { setContract(c); setLadeFehler(!c); })
      .catch(() => setLadeFehler(true))
      .finally(() => setLaedt(false));
  }, [contractId]);

  // Der Vertrag ist die Quelle, die URL nur die Sofortanzeige, bis er da ist.
  const title = contract?.job?.title ?? (jobTitle || null);

  // Aus dem TERMIN rechnen, nicht aus einer uebergebenen Zahl. `hoursUntil`
  // war ein Schnappschuss: gerundet und beim Oeffnen eingefroren, waehrend die
  // Edge Function live rechnet. Wer den Bildschirm eine Stunde offen liess,
  // las einen Satz und bekam einen anderen.
  //
  // Neu gerechnet wird bei jedem Rendern (kein useMemo mit leerer
  // Abhaengigkeitsliste): sonst friert das Datum wieder ein, und genau diese
  // Falle steht seit dem 08.09.2026 in CLAUDE.md.
  const terminQuelle = contract?.job?.scheduled_at ?? (scheduledAt || null);
  const stunden = terminQuelle
    ? stundenBisTermin(terminQuelle)
    : (hoursUntil ? parseFloat(hoursUntil) : OHNE_TERMIN_STUNDEN);
  const refundPct = calcCancellationRefundPct(false, stunden) * 100;
  const hours = stunden;

  const [step,          setStep]          = useState<Step>('confirm');
  const [reason,        setReason]        = useState<string | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [refundAmountEur, setRefundAmountEur] = useState<string>('0.00');

  async function handleCancel() {
    if (!reason) {
      showAlert('Grund erforderlich', 'Bitte wählen Sie einen Stornierungsgrund.', [{ text: 'OK' }]);
      return;
    }
    if (!contractId) {
      showAlert('Kein Vertrag gefunden', 'Bitte starten Sie die Stornierung über Ihren Auftrag (Aufträge → Auftrag öffnen).', [{ text: 'OK' }]);
      return;
    }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Nicht eingeloggt');

      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/cancel-contract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ contract_id: contractId, reason }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setRefundAmountEur(data.refund_amount_eur ?? '0.00');
      setStep('cancelled');
    } catch (err: any) {
      showAlert('Stornierung fehlgeschlagen', err?.message ?? 'Bitte erneut versuchen.', [{ text: 'OK' }]);
    } finally {
      setLoading(false);
    }
  }

  if (step === 'cancelled') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.successBox}>
          <View style={[styles.iconCircle, { backgroundColor: refundPct > 0 ? C.primaryBg : C.amberBg }]}>
            <Ionicons
              name={refundPct > 0 ? 'checkmark-circle' : 'alert-circle'}
              size={40}
              color={refundPct > 0 ? C.primary : C.amber}
            />
          </View>
          <Text style={styles.successTitle}>Auftrag storniert</Text>
          <Text style={styles.successSub}>
            {refundPct === 100
              ? `Volle Rückerstattung: €${refundAmountEur} sind ${erstattungsdauer()} zurück auf Ihrem Konto.`
              : refundPct === 50
              ? `50 % Rückerstattung: €${refundAmountEur} sind ${erstattungsdauer()} zurück auf Ihrem Konto.`
              : 'Keine Rückerstattung gemäß Stornierungsrichtlinie (unter 24h vor Termin).'}
          </Text>
          <TouchableOpacity accessibilityRole="button" style={styles.primaryBtn} onPress={() => router.replace('/(tabs)/auftraege')}>
            <Text style={styles.primaryBtnText}>Meine Aufträge</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" style={styles.secondaryBtn} onPress={() => router.replace('/(tabs)/')}>
            <Text style={styles.secondaryBtnText}>Zur Startseite</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zurück" onPress={() => safeBack(router)} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Stornierung</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {ladeFehler && (
          <View style={styles.datenFehlen} accessibilityRole="alert">
            <Ionicons name="cloud-offline-outline" size={20} color={C.red} />
            <View style={{ flex: 1 }}>
              <Text style={styles.datenFehlenTitel}>Auftragsdaten fehlen</Text>
              <Text style={styles.datenFehlenText}>
                Welcher Auftrag storniert würde und wie viel Sie zurückbekommen, lässt sich
                gerade nicht laden. Eine Stornierung lässt sich nicht zurücknehmen, deshalb
                ist sie ohne diese Angaben gesperrt.
              </Text>
            </View>
          </View>
        )}
        {/* Job card */}
        <View style={styles.section}>
          <View style={styles.jobCard}>
            <Ionicons name="construct-outline" size={18} color={C.sub} />
            <View style={{ flex: 1 }}>
              <Text style={styles.jobTitle}>
                {title ?? (laedt ? 'Auftrag wird geladen …' : 'Auftrag unbekannt')}
              </Text>
              <Text style={styles.jobSub}>Auftrag #{contractId?.slice(0, 8) ?? '…'}</Text>
            </View>
          </View>
        </View>

        {/* Refund policy */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Rückerstattung</Text>
          {[
            { label: '> 48h vor Termin', pct: '100 %', active: hours > 48 },
            { label: '24–48h vor Termin', pct: '50 %',  active: hours <= 48 && hours > 24 },
            { label: '< 24h / No-Show',  pct: '0 %',   active: hours <= 24 },
          ].map((row) => (
            <View key={row.label} style={[styles.policyRow, row.active && styles.policyRowActive]}>
              <Text style={[styles.policyLabel, row.active && styles.policyLabelActive]}>{row.label}</Text>
              <Text style={[styles.policyPct,   row.active && styles.policyPctActive]}>{row.pct}</Text>
            </View>
          ))}
          <View style={[styles.refundBox, { backgroundColor: refundPct > 0 ? C.primaryBg : C.amberBg }]}>
            <Ionicons
              name={refundPct > 0 ? 'checkmark-circle-outline' : 'alert-circle-outline'}
              size={16}
              color={refundPct > 0 ? C.primary : C.amber}
            />
            <Text style={[styles.refundText, { color: refundPct > 0 ? C.primary : C.amber }]}>
              {refundPct === 100 ? 'Volle Rückerstattung'
                : refundPct === 50 ? '50 % Rückerstattung'
                : 'Keine Rückerstattung'}
            </Text>
          </View>
          {/* Ehrlich gesagt, statt es zu verschweigen: die Stufe haengt an der
              Zeit, und die laeuft weiter. Wer den Bildschirm kurz vor einer
              Kante offen hat und spaeter bestaetigt, faellt in die naechste
              Stufe. Bis 16.09.2026 war das doppelt verdeckt, weil die Zahl
              ausserdem aus einem eingefrorenen URL-Wert kam. */}
          {/* Bis zum 21.09.2026 erschien der Betrag ERST auf dem
              Erfolgsbildschirm, also NACH dem unumkehrbaren Schritt. Der
              Prozentsatz allein zwingt den Kunden zum Kopfrechnen.
              Ausdruecklich „voraussichtlich": verbindlich rechnet die Edge
              Function, und die Stufe haengt an der Zeit (Hinweis darunter). */}
          {contract?.customer_total != null && (
            <Text style={styles.betragZeile}>
              Voraussichtliche Erstattung:{' '}
              <Text style={styles.betragWert}>
                {euro(erstattungsBetrag(contract.customer_total, refundPct))}
              </Text>
              {' '}von {euro(contract.customer_total)}
            </Text>
          )}
          {stunden < 50 && stunden > 22 ? (
            <Text style={styles.stufenHinweis}>
              Die Stufe richtet sich nach dem Zeitpunkt der Stornierung. Ihr Termin
              ist in {stunden < 1 ? 'weniger als einer Stunde' : `gut ${Math.floor(stunden)} Stunden`};
              warten Sie, kann die nächste Stufe greifen.
            </Text>
          ) : null}
        </View>

        {/* Reason */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Stornierungsgrund *</Text>
          {REASONS.map((r) => (
            <TouchableOpacity
              accessibilityRole="button"
              key={r}
              style={[styles.reasonRow, reason === r && styles.reasonRowActive]}
              onPress={() => setReason(r)}
              activeOpacity={0.75}
            >
              <View style={[styles.radio, reason === r && styles.radioActive]}>
                {reason === r && <View style={styles.radioDot} />}
              </View>
              <Text style={[styles.reasonText, reason === r && styles.reasonTextActive]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.ctaBar, { paddingBottom: aktionsleistenRand(insets.bottom) }]}>
        <TouchableOpacity
          accessibilityRole="button"
          style={[styles.cancelBtn, (!contract || !reason || loading) && styles.cancelBtnDisabled]}
          onPress={handleCancel}
          disabled={!contract || !reason || loading}
          accessibilityHint={!contract ? 'Die Auftragsdaten konnten nicht geladen werden.' : undefined}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.cancelBtnText}>Auftrag stornieren</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg },
  header:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
  backBtn:      { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { ...T.h3, flex: 1, color: C.ink },

  section:      { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 },

  jobCard:      { ...shadow.sm,  flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.hair, padding: 14 },
  jobTitle:     { fontSize: 14, fontWeight: '700', color: C.ink },
  jobSub:       { fontSize: 12, color: C.sub, marginTop: 2 },

  stufenHinweis: { fontSize: 12, lineHeight: 17, color: C.sub, marginTop: 8 },
  betragZeile:  { fontSize: 13, lineHeight: 19, color: C.sub, marginTop: 10 },
  betragWert:   { fontWeight: '700', color: C.ink },
  datenFehlen:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: C.bgWarm, borderWidth: 1, borderColor: C.red, borderRadius: 12, padding: 14, margin: 20, marginBottom: 0 },
  datenFehlenTitel: { ...T.body, fontWeight: '700', color: C.ink, marginBottom: 2 },
  datenFehlenText:  { ...T.caption, color: C.sub, lineHeight: 17 },
  policyRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, marginBottom: 4, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  policyRowActive: { backgroundColor: C.primaryBg, borderColor: C.primary },
  policyLabel:  { fontSize: 13, color: C.sub },
  policyLabelActive: { color: C.primary, fontWeight: '600' },
  policyPct:    { fontSize: 13, fontWeight: '700', color: C.muted },
  policyPctActive: { color: C.primary },
  refundBox:    { flexDirection: 'row', gap: 8, alignItems: 'center', borderRadius: 10, padding: 12, marginTop: 10 },
  refundText:   { fontSize: 13, fontWeight: '600' },

  reasonRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, marginBottom: 8, backgroundColor: C.surface },
  reasonRowActive: { borderColor: C.primary, backgroundColor: C.primaryBg },
  radio:        { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  radioActive:  { borderColor: C.primary },
  radioDot:     { width: 10, height: 10, borderRadius: 5, backgroundColor: C.primary },
  reasonText:   { fontSize: 14, color: C.ink },
  reasonTextActive: { fontWeight: '600', color: C.primary },

  ctaBar:       { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, padding: 16 },
  cancelBtn:    { backgroundColor: C.red, borderRadius: 12, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  cancelBtnDisabled: { backgroundColor: C.border },
  cancelBtnText: { fontSize: 15, fontWeight: '700', color: C.surface },

  successBox:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  iconCircle:   { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  successTitle: { ...T.h2, color: C.ink, marginBottom: 12, textAlign: 'center' },
  successSub:   { fontSize: 14, color: C.sub, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  primaryBtn:   { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 15, paddingHorizontal: 40, marginBottom: 12 },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: C.surface },
  secondaryBtn: { paddingVertical: 10 },
  secondaryBtnText: { fontSize: 14, color: C.sub },
});
