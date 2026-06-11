import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';

type Problem = 'partial' | 'worse' | 'dirty' | 'noshow' | null;
type Resolution = 'retry' | 'partial' | 'full' | null;

const PROBLEMS = [
  { key: 'partial' as Problem, icon: 'time-outline',         label: 'Teilweise fertig',       sub: 'Arbeit wurde angefangen, aber nicht abgeschlossen' },
  { key: 'worse'   as Problem, icon: 'trending-down-outline', label: 'Schlechter als vorher',  sub: 'Zustand nach Arbeit ist schlimmer als davor' },
  { key: 'dirty'   as Problem, icon: 'warning-outline',       label: 'Unsaubere Arbeit / Schäden', sub: 'Mängel, Schäden oder Qualitätsprobleme' },
  { key: 'noshow'  as Problem, icon: 'close-circle-outline',  label: 'Nicht erschienen',       sub: 'Handwerker ist nicht zum vereinbarten Termin erschienen' },
];

const RESOLUTIONS = [
  { key: 'retry'   as Resolution, icon: 'refresh-outline',   label: 'Nachbesserungstermin',  sub: 'Neuen Termin vereinbaren' },
  { key: 'partial' as Resolution, icon: 'cash-outline',      label: 'Teilrückerstattung',    sub: 'Anteilige Rückerstattung' },
  { key: 'full'    as Resolution, icon: 'wallet-outline',    label: 'Vollrückerstattung',    sub: 'Komplette Rückerstattung des Betrags' },
];

const STEPS = ['Problem', 'Lösung', 'Beweis'];

export default function ReklamationScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [problem, setProblem] = useState<Problem>(null);
  const [resolution, setResolution] = useState<Resolution>(null);
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const canNext = step === 0 ? !!problem : step === 1 ? !!resolution : description.length > 10;

  function handleSubmit() {
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.successScreen}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={60} color={C.green} />
          </View>
          <Text style={styles.successTitle}>Reklamation eingereicht</Text>
          <Text style={styles.successText}>
            Der Auftragnehmer hat 72 Stunden Zeit zu reagieren.
            Das Escrow-Geld bleibt bis zur Einigung gesperrt.
          </Text>
          <View style={styles.successInfoBox}>
            <InfoRow icon="lock-closed-outline"  text="Escrow gesperrt bis zur Klärung"            color={C.amber} />
            <InfoRow icon="time-outline"          text="72h Reaktionszeit für Auftragnehmer"        color={C.sub}   />
            <InfoRow icon="shield-outline"        text="Keine Reaktion = automatisch zu Ihren Gunsten" color={C.green} />
          </View>
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => router.back()}
            activeOpacity={0.85}
          >
            <Text style={styles.doneBtnText}>Zurück zur Übersicht</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step > 0 ? setStep(step - 1) : router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reklamation</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Progress Steps */}
      <View style={styles.stepsBar}>
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <View style={styles.stepItem}>
              <View style={[styles.stepDot, i <= step && styles.stepDotActive, i < step && styles.stepDotDone]}>
                {i < step
                  ? <Ionicons name="checkmark" size={12} color={C.surface} />
                  : <Text style={[styles.stepNum, i === step && styles.stepNumActive]}>{i + 1}</Text>
                }
              </View>
              <Text style={[styles.stepLabel, i === step && styles.stepLabelActive]}>{s}</Text>
            </View>
            {i < STEPS.length - 1 && (
              <View style={[styles.stepConnector, i < step && styles.stepConnectorDone]} />
            )}
          </React.Fragment>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* Step 0 – Problem */}
        {step === 0 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepQuestion}>Was ist passiert?</Text>
            {PROBLEMS.map((p) => (
              <TouchableOpacity
                key={p.key}
                style={[styles.optionCard, problem === p.key && styles.optionCardActive]}
                onPress={() => setProblem(p.key)}
                activeOpacity={0.8}
              >
                <View style={[styles.optionIcon, problem === p.key && styles.optionIconActive]}>
                  <Ionicons name={p.icon as any} size={22} color={problem === p.key ? C.surface : C.sub} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionLabel, problem === p.key && styles.optionLabelActive]}>{p.label}</Text>
                  <Text style={styles.optionSub}>{p.sub}</Text>
                </View>
                {problem === p.key && <Ionicons name="checkmark-circle" size={20} color={C.ink} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Step 1 – Resolution */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepQuestion}>Welche Lösung wünschen Sie?</Text>
            {RESOLUTIONS.map((r) => (
              <TouchableOpacity
                key={r.key}
                style={[styles.optionCard, resolution === r.key && styles.optionCardActive]}
                onPress={() => setResolution(r.key)}
                activeOpacity={0.8}
              >
                <View style={[styles.optionIcon, resolution === r.key && styles.optionIconActive]}>
                  <Ionicons name={r.icon as any} size={22} color={resolution === r.key ? C.surface : C.sub} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionLabel, resolution === r.key && styles.optionLabelActive]}>{r.label}</Text>
                  <Text style={styles.optionSub}>{r.sub}</Text>
                </View>
                {resolution === r.key && <Ionicons name="checkmark-circle" size={20} color={C.ink} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Step 2 – Evidence */}
        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepQuestion}>Fotobeweis & Beschreibung</Text>

            <TouchableOpacity style={styles.photoUpload} activeOpacity={0.7}>
              <Ionicons name="camera-outline" size={32} color={C.muted} />
              <Text style={styles.photoUploadText}>Fotos hinzufügen</Text>
              <Text style={styles.photoUploadSub}>Bis zu 5 Bilder · JPG, PNG</Text>
            </TouchableOpacity>

            <Text style={styles.inputLabel}>Beschreibung</Text>
            <TextInput
              style={styles.textarea}
              value={description}
              onChangeText={setDescription}
              placeholder="Beschreiben Sie das Problem so genau wie möglich …"
              placeholderTextColor={C.muted}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />

            <View style={styles.reviewSummary}>
              <Text style={styles.reviewSummaryTitle}>Zusammenfassung</Text>
              <Row label="Problem"  value={PROBLEMS.find(p => p.key === problem)?.label ?? ''} />
              <Row label="Lösung"   value={RESOLUTIONS.find(r => r.key === resolution)?.label ?? ''} />
              <Row label="Auftrag"  value="#WRK-2406-0047" />
            </View>
          </View>
        )}

      </ScrollView>

      {/* CTA */}
      <View style={styles.ctaBar}>
        <TouchableOpacity
          style={[styles.ctaBtn, !canNext && styles.ctaBtnDisabled]}
          onPress={() => step < 2 ? setStep(step + 1) : handleSubmit()}
          disabled={!canNext}
          activeOpacity={0.85}
        >
          <Text style={[styles.ctaBtnText, !canNext && { color: C.muted }]}>
            {step < 2 ? 'Weiter' : 'Reklamation einreichen'}
          </Text>
          <Ionicons name="arrow-forward" size={18} color={canNext ? C.surface : C.muted} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
      <Text style={{ fontSize: 12, color: C.sub }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '600', color: C.ink }}>{value}</Text>
    </View>
  );
}

function InfoRow({ icon, text, color }: { icon: string; text: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <Ionicons name={icon as any} size={18} color={color} />
      <Text style={{ fontSize: 13, color: C.sub, flex: 1 }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: C.bg },
  header:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  backBtn:            { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:        { fontSize: 18, fontWeight: '800', color: C.ink },
  stepsBar:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 32, paddingBottom: 20 },
  stepItem:           { alignItems: 'center', gap: 6 },
  stepDot:            { width: 28, height: 28, borderRadius: 14, backgroundColor: C.border, alignItems: 'center', justifyContent: 'center' },
  stepDotActive:      { backgroundColor: C.ink },
  stepDotDone:        { backgroundColor: C.green },
  stepNum:            { fontSize: 12, fontWeight: '700', color: C.muted },
  stepNumActive:      { color: C.surface },
  stepLabel:          { fontSize: 11, color: C.muted },
  stepLabelActive:    { color: C.ink, fontWeight: '700' },
  stepConnector:      { flex: 1, height: 2, backgroundColor: C.border, marginBottom: 18 },
  stepConnectorDone:  { backgroundColor: C.green },
  stepContent:        { paddingHorizontal: 20, paddingTop: 4 },
  stepQuestion:       { fontSize: 20, fontWeight: '800', color: C.ink, marginBottom: 20 },
  optionCard:         { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border, borderRadius: 12, padding: 16, marginBottom: 10 },
  optionCardActive:   { borderColor: C.ink, backgroundColor: '#FAFAF8' },
  optionIcon:         { width: 44, height: 44, borderRadius: 10, backgroundColor: '#F0EFEB', alignItems: 'center', justifyContent: 'center' },
  optionIconActive:   { backgroundColor: C.ink },
  optionLabel:        { fontSize: 14, fontWeight: '700', color: C.ink, marginBottom: 2 },
  optionLabelActive:  { color: C.ink },
  optionSub:          { fontSize: 12, color: C.sub },
  photoUpload:        { alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface, borderWidth: 2, borderColor: C.border, borderStyle: 'dashed', borderRadius: 12, padding: 32, marginBottom: 16 },
  photoUploadText:    { fontSize: 15, fontWeight: '600', color: C.sub, marginTop: 8 },
  photoUploadSub:     { fontSize: 12, color: C.muted, marginTop: 4 },
  inputLabel:         { fontSize: 13, fontWeight: '600', color: C.sub, marginBottom: 8 },
  textarea:           { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, fontSize: 14, color: C.ink, minHeight: 120, marginBottom: 16 },
  reviewSummary:      { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14 },
  reviewSummaryTitle: { fontSize: 12, fontWeight: '700', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  ctaBar:             { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, padding: 16, paddingBottom: 28 },
  ctaBtn:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.ink, borderRadius: 12, paddingVertical: 15 },
  ctaBtnDisabled:     { backgroundColor: '#E8E7E3' },
  ctaBtnText:         { fontSize: 16, fontWeight: '700', color: C.surface },
  successScreen:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successIcon:        { marginBottom: 20 },
  successTitle:       { fontSize: 24, fontWeight: '800', color: C.ink, marginBottom: 12 },
  successText:        { fontSize: 15, color: C.sub, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  successInfoBox:     { width: '100%', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 16, marginBottom: 24 },
  doneBtn:            { backgroundColor: C.ink, borderRadius: 12, paddingVertical: 15, paddingHorizontal: 40 },
  doneBtnText:        { fontSize: 16, fontWeight: '700', color: C.surface },
});
