import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { C } from '../constants/colors';
import { showAlert } from '../lib/alert';
import { checkContent, BLOCK_REASON_LABELS } from '../lib/contentFilter';

type Category = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  regulated?: boolean; // §1 HwO Anlage A — Meisterpflicht
};

const CATEGORIES: Category[] = [
  { id: 'handwerker', label: 'Handwerker', icon: 'construct-outline' },
  { id: 'sanitaer', label: 'Sanitär & Heizung', icon: 'water-outline', regulated: true },
  { id: 'elektrik', label: 'Elektrik', icon: 'flash-outline', regulated: true },
  { id: 'maler', label: 'Malerarbeiten', icon: 'color-palette-outline', regulated: true },
  { id: 'garten', label: 'Gartenarbeit', icon: 'leaf-outline' },
  { id: 'reinigung', label: 'Haushaltsreinigung', icon: 'sparkles-outline' },
];

const URGENCY_OPTIONS = ['Nicht dringend', 'Diese Woche', 'Heute/Morgen'];

const TIME_OPTIONS = [
  {
    id: 'flexibel',
    icon: 'calendar-outline' as keyof typeof Ionicons.glyphMap,
    title: 'Ich bin flexibel',
    subtitle: 'Ich kann innerhalb von 2 Wochen',
    badge: null,
  },
  {
    id: 'diese-woche',
    icon: 'time-outline' as keyof typeof Ionicons.glyphMap,
    title: 'Diese Woche',
    subtitle: 'Ich brauche jemanden in den nächsten 7 Tagen',
    badge: null,
  },
  {
    id: 'dringend',
    icon: 'flash-outline' as keyof typeof Ionicons.glyphMap,
    title: 'Dringend (heute/morgen)',
    subtitle: '',
    badge: 'Express-Aufschlag möglich',
  },
];

const BUDGET_OPTIONS = ['< €100', '€100–500', '€500–2.000', 'Auf Anfrage'];

const LABEL_BY_TIME_ID: Record<string, string> = {
  flexibel: 'Flexibel (2 Wochen)',
  'diese-woche': 'Diese Woche',
  dringend: 'Dringend (heute/morgen)',
};

export default function AuftragAufgebenScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState('');
  const [description, setDescription] = useState('');
  const [contentError, setContentError] = useState<string | null>(null);
  const [plz, setPlz] = useState('');
  const [urgency, setUrgency] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [budget, setBudget] = useState('');
  const [consent, setConsent] = useState(false);

  const step1Valid = selectedCategory !== '';
  const step2Valid = description.length >= 30 && plz.length === 5 && /^\d{5}$/.test(plz);
  const step3Valid = selectedTime !== '';
  const step4Valid = consent;

  function handleBack() {
    if (step === 1) {
      router.back();
    } else {
      setStep((s) => s - 1);
    }
  }

  function handleNext() {
    if (step === 2) {
      const check = checkContent(description);
      if (!check.allowed) {
        setContentError(`Diese Dienstleistung ist auf WERKR nicht erlaubt: ${BLOCK_REASON_LABELS[check.reason]}.`);
        return;
      }
      setContentError(null);
    }
    setStep((s) => s + 1);
  }

  function handleSubmit() {
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSuccess(true);
    }, 1500);
  }

  function getCategoryLabel(id: string) {
    return CATEGORIES.find((c) => c.id === id)?.label ?? id;
  }

  if (success) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={36} color={C.green} />
          </View>
          <Text style={styles.successHeading}>Auftrag eingereicht!</Text>
          <Text style={styles.successBody}>
            Wir suchen passende Anbieter in Ihrer Nähe. Sie erhalten in ca. 30 Min. erste Angebote
            in Ihrer Nachrichten-Box.
          </Text>
          <View style={styles.refChip}>
            <Text style={styles.refText}>#AUF-2406-1234</Text>
          </View>
          <TouchableOpacity
            style={styles.btnGreen}
            onPress={() => router.push('/nachrichten')}
          >
            <Text style={styles.btnGreenText}>Nachrichten öffnen</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnOutline}
            onPress={() => router.replace('/(tabs)/')}
          >
            <Text style={styles.btnOutlineText}>Zur Startseite</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={C.ink} />
          </TouchableOpacity>
          <Text style={styles.stepLabel}>Schritt {step} von 4</Text>
          <View style={styles.backBtn} />
        </View>

        <View style={styles.progressBar}>
          {[1, 2, 3, 4].map((n) => (
            <View
              key={n}
              style={[
                styles.progressSegment,
                n <= step ? styles.progressActive : styles.progressInactive,
              ]}
            />
          ))}
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {step === 1 && (
            <Step1
              selectedCategory={selectedCategory}
              onSelect={setSelectedCategory}
            />
          )}
          {step === 2 && (
            <Step2
              description={description}
              onDescriptionChange={(v) => { setDescription(v); if (contentError) setContentError(null); }}
              plz={plz}
              onPlzChange={setPlz}
              urgency={urgency}
              onUrgencyChange={setUrgency}
              contentError={contentError}
            />
          )}
          {step === 3 && (
            <Step3
              selectedTime={selectedTime}
              onSelectTime={setSelectedTime}
              preferredTime={preferredTime}
              onPreferredTimeChange={setPreferredTime}
            />
          )}
          {step === 4 && (
            <Step4
              budget={budget}
              onBudgetChange={setBudget}
              consent={consent}
              onConsentChange={setConsent}
              selectedCategory={selectedCategory}
              description={description}
              plz={plz}
              selectedTime={selectedTime}
              getCategoryLabel={getCategoryLabel}
            />
          )}
        </ScrollView>

        <View style={styles.footer}>
          {step < 4 ? (
            <TouchableOpacity
              style={[
                styles.btnPrimary,
                !(step === 1
                  ? step1Valid
                  : step === 2
                  ? step2Valid
                  : step3Valid) && styles.btnDisabled,
              ]}
              onPress={handleNext}
              disabled={
                step === 1 ? !step1Valid : step === 2 ? !step2Valid : !step3Valid
              }
            >
              <Text style={styles.btnPrimaryText}>Weiter</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.btnGreen, !step4Valid && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={!step4Valid || submitting}
            >
              {submitting ? (
                <ActivityIndicator color={C.surface} />
              ) : (
                <Text style={styles.btnGreenText}>Auftrag abschicken</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type Step1Props = {
  selectedCategory: string;
  onSelect: (id: string) => void;
};

function Step1({ selectedCategory, onSelect }: Step1Props) {
  const selectedCat = CATEGORIES.find((c) => c.id === selectedCategory);
  return (
    <View>
      <Text style={styles.stepTitle}>Was benötigen Sie?</Text>
      <Text style={styles.stepSubtitle}>Wählen Sie eine Kategorie</Text>
      <View style={styles.categoryGrid}>
        {CATEGORIES.map((cat) => {
          const active = selectedCategory === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryTile, active && styles.categoryTileActive]}
              onPress={() => onSelect(cat.id)}
            >
              <Ionicons
                name={cat.icon}
                size={28}
                color={active ? C.gold : C.sub}
              />
              <Text style={[styles.categoryLabel, active && styles.categoryLabelActive]}>
                {cat.label}
              </Text>
              {cat.regulated && (
                <View style={styles.regulatedBadge}>
                  <Text style={styles.regulatedBadgeText}>Meisterpflicht</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedCat?.regulated && (
        <View style={styles.meisterBanner}>
          <Ionicons name="ribbon-outline" size={18} color={C.amber} />
          <View style={{ flex: 1 }}>
            <Text style={styles.meisterBannerTitle}>Meisterpflicht-Gewerk (§1 HwO)</Text>
            <Text style={styles.meisterBannerText}>
              WERKR vermittelt für dieses Gewerk ausschließlich zugelassene Meisterbetriebe.
              Ihr Auftrag wird nur an Anbieter mit gültigem Meisterbrief weitergeleitet.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

type Step2Props = {
  description: string;
  onDescriptionChange: (v: string) => void;
  plz: string;
  onPlzChange: (v: string) => void;
  urgency: string;
  onUrgencyChange: (v: string) => void;
  contentError: string | null;
};

function Step2({ description, onDescriptionChange, plz, onPlzChange, urgency, onUrgencyChange, contentError }: Step2Props) {
  const remaining = 500 - description.length;
  const tooShort = description.length < 30;
  return (
    <View>
      <Text style={styles.stepTitle}>Beschreiben Sie den Auftrag</Text>

      <Text style={styles.fieldLabel}>Was soll gemacht werden?</Text>
      <TextInput
        style={styles.textarea}
        multiline
        numberOfLines={4}
        placeholder="Beschreiben Sie, was gemacht werden soll (z.B. Badezimmer fließen, ca. 12 m², Wandfliesen 20x20cm)…"
        placeholderTextColor={C.muted}
        value={description}
        onChangeText={(v) => onDescriptionChange(v.slice(0, 500))}
        textAlignVertical="top"
      />
      <View style={styles.charRow}>
        {tooShort && description.length > 0 && (
          <Text style={styles.charWarning}>Mindestens 30 Zeichen</Text>
        )}
        <Text style={[styles.charCount, remaining < 50 && styles.charCountWarn]}>
          {description.length}/500
        </Text>
      </View>
      {contentError && (
        <View style={styles.contentErrorBox}>
          <Ionicons name="ban-outline" size={14} color="#dc2626" />
          <Text style={styles.contentErrorText}>{contentError}</Text>
        </View>
      )}

      <Text style={styles.fieldLabel}>Wo soll gearbeitet werden?</Text>
      <TextInput
        style={styles.input}
        placeholder="Ihre PLZ, z.B. 50667"
        placeholderTextColor={C.muted}
        value={plz}
        onChangeText={(v) => onPlzChange(v.replace(/\D/g, '').slice(0, 5))}
        keyboardType="numeric"
        maxLength={5}
      />

      <TouchableOpacity
        style={styles.photoRow}
        onPress={() =>
          showAlert('Fotos hinzufügen', 'Kamera-Zugriff kommt mit App-Store-Release')
        }
      >
        <Ionicons name="camera-outline" size={22} color={C.gold} />
        <Text style={styles.photoLabel}>Fotos hinzufügen</Text>
      </TouchableOpacity>

      <Text style={styles.fieldLabel}>Dringlichkeit</Text>
      <View style={styles.chipRow}>
        {URGENCY_OPTIONS.map((opt) => {
          const active = urgency === opt;
          return (
            <TouchableOpacity
              key={opt}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onUrgencyChange(opt)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

type Step3Props = {
  selectedTime: string;
  onSelectTime: (id: string) => void;
  preferredTime: string;
  onPreferredTimeChange: (v: string) => void;
};

function Step3({ selectedTime, onSelectTime, preferredTime, onPreferredTimeChange }: Step3Props) {
  return (
    <View>
      <Text style={styles.stepTitle}>Wann soll der Auftrag stattfinden?</Text>
      {TIME_OPTIONS.map((opt) => {
        const active = selectedTime === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            style={[styles.timeCard, active && styles.timeCardActive]}
            onPress={() => onSelectTime(opt.id)}
          >
            <View style={styles.timeCardIcon}>
              <Ionicons name={opt.icon} size={24} color={active ? C.gold : C.sub} />
            </View>
            <View style={styles.timeCardText}>
              <Text style={[styles.timeCardTitle, active && styles.timeCardTitleActive]}>
                {opt.title}
              </Text>
              {opt.subtitle !== '' && (
                <Text style={styles.timeCardSubtitle}>{opt.subtitle}</Text>
              )}
              {opt.badge !== null && (
                <View style={styles.amberBadge}>
                  <Text style={styles.amberBadgeText}>{opt.badge}</Text>
                </View>
              )}
            </View>
            {active && (
              <Ionicons name="checkmark-circle" size={22} color={C.gold} />
            )}
          </TouchableOpacity>
        );
      })}

      <Text style={styles.fieldLabel}>Bevorzugte Uhrzeit (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="z.B. Nachmittags, nach 14:00"
        placeholderTextColor={C.muted}
        value={preferredTime}
        onChangeText={onPreferredTimeChange}
      />
    </View>
  );
}

type Step4Props = {
  budget: string;
  onBudgetChange: (v: string) => void;
  consent: boolean;
  onConsentChange: (v: boolean) => void;
  selectedCategory: string;
  description: string;
  plz: string;
  selectedTime: string;
  getCategoryLabel: (id: string) => string;
};

function Step4({
  budget,
  onBudgetChange,
  consent,
  onConsentChange,
  selectedCategory,
  description,
  plz,
  selectedTime,
  getCategoryLabel,
}: Step4Props) {
  const descSnippet = description.length > 60 ? description.slice(0, 60) + '…' : description;
  const timeLabel = LABEL_BY_TIME_ID[selectedTime] ?? selectedTime;
  return (
    <View>
      <Text style={styles.stepTitle}>Fast geschafft!</Text>

      <Text style={styles.fieldLabel}>Ihr Budget (optional)</Text>
      <View style={styles.chipRow}>
        {BUDGET_OPTIONS.map((opt) => {
          const active = budget === opt;
          return (
            <TouchableOpacity
              key={opt}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onBudgetChange(opt)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.feeNote}>
        WERKR-Gebühr von 8% wird beim Auftragsabschluss berechnet.
      </Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Zusammenfassung</Text>
        <SummaryRow label="Kategorie" value={getCategoryLabel(selectedCategory)} />
        <SummaryRow label="Beschreibung" value={descSnippet} />
        <SummaryRow label="PLZ" value={plz} />
        <SummaryRow label="Zeitrahmen" value={timeLabel} />
        {budget !== '' && <SummaryRow label="Budget" value={budget} />}
        <Text style={styles.summaryNote}>
          Ihre Daten werden nur an geprüfte Anbieter weitergegeben.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.consentRow}
        onPress={() => onConsentChange(!consent)}
        activeOpacity={0.7}
      >
        <View style={[styles.checkbox, consent && styles.checkboxChecked]}>
          {consent && <Ionicons name="checkmark" size={14} color={C.surface} />}
        </View>
        <Text style={styles.consentText}>
          Ich stimme zu, dass WERKR mein Anliegen an passende Anbieter weiterleitet.
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  stepLabel: { fontSize: 14, color: C.sub, fontWeight: '500' },
  progressBar: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  progressActive: { backgroundColor: C.gold },
  progressInactive: { backgroundColor: C.border },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 24 },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: C.ink,
    marginTop: 12,
    marginBottom: 4,
  },
  stepSubtitle: { fontSize: 14, color: C.sub, marginBottom: 20 },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  categoryTile: {
    width: '47%',
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
  },
  categoryTileActive: {
    borderColor: C.gold,
    backgroundColor: C.goldBg,
  },
  categoryLabel: { fontSize: 13, color: C.sub, textAlign: 'center', fontWeight: '500' },
  categoryLabelActive: { color: C.gold },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: C.ink,
    marginTop: 20,
    marginBottom: 8,
  },
  textarea: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: C.ink,
    minHeight: 110,
  },
  charRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  charCount: { fontSize: 12, color: C.muted, marginLeft: 'auto' },
  charCountWarn: { color: C.red },
  charWarning: { fontSize: 12, color: C.red },
  input: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: C.ink,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 14,
  },
  photoLabel: { fontSize: 14, color: C.gold, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: C.surface,
  },
  chipActive: { borderColor: C.gold, backgroundColor: C.goldBg },
  chipText: { fontSize: 13, color: C.sub, fontWeight: '500' },
  chipTextActive: { color: C.gold },
  timeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  timeCardActive: { borderColor: C.gold, backgroundColor: C.goldBg },
  timeCardIcon: { width: 36, alignItems: 'center' },
  timeCardText: { flex: 1 },
  timeCardTitle: { fontSize: 15, fontWeight: '600', color: C.ink },
  timeCardTitleActive: { color: C.gold },
  timeCardSubtitle: { fontSize: 13, color: C.sub, marginTop: 2 },
  amberBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3E2',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
  },
  amberBadgeText: { fontSize: 11, color: '#C07010', fontWeight: '600' },
  feeNote: { fontSize: 12, color: C.muted, marginTop: 8, marginBottom: 20 },
  summaryCard: {
    backgroundColor: C.goldBg,
    borderWidth: 1,
    borderColor: C.gold,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  summaryTitle: { fontSize: 15, fontWeight: '700', color: C.ink, marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 13, color: C.sub, flex: 1 },
  summaryValue: { fontSize: 13, color: C.ink, fontWeight: '500', flex: 2, textAlign: 'right' },
  summaryNote: { fontSize: 11, color: C.sub, marginTop: 8, fontStyle: 'italic' },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: C.green, borderColor: C.green },
  consentText: { flex: 1, fontSize: 13, color: C.sub, lineHeight: 19 },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bg,
  },
  btnPrimary: {
    backgroundColor: C.gold,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnPrimaryText: { color: C.surface, fontSize: 16, fontWeight: '700' },
  btnGreen: {
    backgroundColor: C.green,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnGreenText: { color: C.surface, fontSize: 16, fontWeight: '700' },
  btnOutline: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  btnOutlineText: { color: C.ink, fontSize: 15, fontWeight: '600' },
  btnDisabled: { opacity: 0.4 },
  contentErrorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
  },
  contentErrorText: { flex: 1, fontSize: 12, color: '#dc2626', lineHeight: 17 },
  regulatedBadge: {
    backgroundColor: C.amberBg,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  regulatedBadgeText: { fontSize: 9, fontWeight: '700', color: C.amber },
  meisterBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: C.amberBg,
    borderWidth: 1,
    borderColor: C.amber,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  meisterBannerTitle: { fontSize: 13, fontWeight: '700', color: C.amber, marginBottom: 3 },
  meisterBannerText: { fontSize: 12, color: C.amber, lineHeight: 17 },
  successContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
    gap: 16,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.greenBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  successHeading: {
    fontSize: 26,
    fontWeight: '700',
    color: C.ink,
    textAlign: 'center',
  },
  successBody: {
    fontSize: 15,
    color: C.sub,
    textAlign: 'center',
    lineHeight: 22,
  },
  refChip: {
    backgroundColor: C.goldBg,
    borderWidth: 1,
    borderColor: C.gold,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginVertical: 4,
  },
  refText: { fontSize: 14, color: C.gold, fontWeight: '700' },
});
