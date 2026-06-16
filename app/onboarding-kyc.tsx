import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { C } from '../constants/colors';
<<<<<<< HEAD
import { T } from '../constants/typography';
import { CATEGORIES, MEISTERPFLICHT_IDS } from '../data/categories';
=======
import { AnimatedButton } from '../components/ui/AnimatedButton';
import { CATEGORIES } from '../data/categories';
>>>>>>> main

// ── Types ──────────────────────────────────────────────────────────────────────

type Track = 'handwerker' | 'nachbarschaft';

const HANDWERKER_STEPS = 4;
const NACHBARSCHAFT_STEPS = 2;

// B2B-Gewerke aus categories-Config; Anzeigename für Dropdown
const TRADE_TYPES = CATEGORIES
  .filter((c) => c.segment === 'B2B' && c.active)
  .map((c) => ({ id: c.id, name: c.name }));

// C2C-Fähigkeiten aus categories-Config
const SKILLS = CATEGORIES
  .filter((c) => c.segment === 'C2C' && c.active)
  .map((c) => c.name);

// ── Helpers ───────────────────────────────────────────────────────────────────

function ProgressBar({ step, total }: { step: number; total: number }) {
  const pct = Math.min(1, step / total);
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct * 100}%` as any }]} />
    </View>
  );
}

function Field({
  label, value, onChange, placeholder, keyboardType = 'default', maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
  maxLength?: number;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? label}
        placeholderTextColor={C.muted}
        keyboardType={keyboardType}
        maxLength={maxLength}
        autoCapitalize="none"
      />
    </View>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function OnboardingKYCScreen() {
  const router = useRouter();
  const [track, setTrack] = useState<Track>('handwerker');
  const [step, setStep] = useState(1);

  // ── Handwerker state ──
  const [hwName, setHwName] = useState('');
  const [hwAddress, setHwAddress] = useState('');
  const [hwPhone, setHwPhone] = useState('');
  const [hwEmail, setHwEmail] = useState('');
  const [hwSteuerID, setHwSteuerID] = useState('');
  const [hwSteuerIDError, setHwSteuerIDError] = useState('');
  const [hwIBAN, setHwIBAN] = useState('');
  const [hwTradeId, setHwTradeId] = useState('');
  const [hwHwkNr, setHwHwkNr] = useState('');
  const [tradeOpen, setTradeOpen] = useState(false);

  // ── Nachbarschaft state ──
  const [nbName, setNbName] = useState('');
  const [nbPhone, setNbPhone] = useState('');
  const [nbEmail, setNbEmail] = useState('');
  const [nbSteuerID, setNbSteuerID] = useState('');
  const [nbDob, setNbDob] = useState('');       // DD.MM.YYYY
  const [nbDobError, setNbDobError] = useState('');
  const [nbSkills, setNbSkills] = useState<string[]>([]);
  const [nbRate, setNbRate] = useState('15');
  const [nbBio, setNbBio] = useState('');

  const totalSteps = track === 'handwerker' ? HANDWERKER_STEPS : NACHBARSCHAFT_STEPS;
  const isDone = step > totalSteps;

  function nextStep() { setStep((s) => s + 1); }
  function prevStep() { setStep((s) => Math.max(1, s - 1)); }

  function switchTrack(t: Track) {
    setTrack(t);
    setStep(1);
  }

  function calcAge(dob: string): number | null {
    const parts = dob.split('.');
    if (parts.length !== 3) return null;
    const [d, m, y] = parts.map(Number);
    if (!d || !m || !y || y < 1900 || y > new Date().getFullYear()) return null;
    const birth = new Date(y, m - 1, d);
    if (isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const hadBirthday =
      today.getMonth() > birth.getMonth() ||
      (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
    if (!hadBirthday) age -= 1;
    return age;
  }

  function handleDobChange(raw: string) {
    // Auto-insert dots: DD.MM.YYYY
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 2) formatted = digits.slice(0, 2) + '.' + digits.slice(2);
    if (digits.length > 4) formatted = formatted.slice(0, 5) + '.' + digits.slice(4);
    setNbDob(formatted);
    setNbDobError('');
  }

  function validateDob(): boolean {
    if (nbDob.length < 10) { setNbDobError('Bitte vollständiges Geburtsdatum eingeben.'); return false; }
    const age = calcAge(nbDob);
    if (age === null) { setNbDobError('Ungültiges Datum.'); return false; }
    if (age < 18) { setNbDobError(`Du bist ${age} Jahre alt. WERKR ist ausschließlich für Personen ab 18 Jahren (§§106–107 BGB). Eine Registrierung ist auch mit Erziehungsberechtigten-Einwilligung nicht möglich.`); return false; }
    return true;
  }

  function toggleSkill(skill: string) {
    setNbSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  }

  // ── Render success ──
  if (isDone) {
    const isHW = track === 'handwerker';
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <View style={styles.successContainer}>
          <View style={styles.successIconWrap}>
            <Ionicons name="checkmark-circle" size={56} color={C.green} />
          </View>
          <Text style={styles.successTitle}>Profil wird geprüft</Text>
          <Text style={styles.successDesc}>
            {isHW
              ? 'Sie erhalten eine E-Mail innerhalb von 24h sobald Ihr Profil geprüft und freigeschaltet wurde.'
              : 'Ihr Profil wurde erfolgreich angelegt. Sie können sofort Aufträge annehmen.'}
          </Text>
          <View style={styles.successChecklist}>
            {isHW ? (
              <>
                <SuccessItem text="Persönliche Daten übermittelt" />
                <SuccessItem text="Steuer-ID & IBAN hinterlegt" />
                <SuccessItem text="HWK-Rollennummer hinterlegt" />
                <SuccessItem text="Gewerbeschein & Haftpflicht hochgeladen" />
                <SuccessItem text="Prüfung läuft — max. 24 h" pending />
              </>
            ) : (
              <>
                <SuccessItem text="Profil angelegt" />
                <SuccessItem text="Fähigkeiten eingestellt" />
              </>
            )}
          </View>
          <TouchableOpacity
            style={styles.successBtn}
            activeOpacity={0.85}
            onPress={() =>
              isHW
                ? router.replace('/bewerbung-eingegangen')
                : router.replace('/nachbarschaft')
            }
          >
            <Text style={styles.successBtnText}>
              {isHW ? 'Zum Dashboard' : 'Zur Nachbarschaft'}
            </Text>
          </TouchableOpacity>
          {isHW && (
            <TouchableOpacity
              style={styles.successProBtn}
              activeOpacity={0.8}
              onPress={() => router.push('/(provider)/pro')}
            >
              <Ionicons name="star" size={16} color={C.gold} />
              <Text style={styles.successProBtnText}>WERKR Pro entdecken · 14 Tage gratis</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ── Render steps ──
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={step > 1 ? prevStep : () => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Registrierung</Text>
          <Text style={styles.headerSub}>Schritt {step} von {totalSteps}</Text>
        </View>
        <View style={{ width: 22 }} />
      </View>

      {/* Progress bar */}
      <ProgressBar step={step} total={totalSteps} />

      {/* Track switcher */}
      <View style={styles.trackSwitcher}>
        <TouchableOpacity
          style={[styles.trackBtn, track === 'handwerker' && styles.trackBtnActive]}
          onPress={() => switchTrack('handwerker')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="construct-outline"
            size={15}
            color={track === 'handwerker' ? C.surface : C.sub}
          />
          <Text style={[styles.trackBtnText, track === 'handwerker' && styles.trackBtnTextActive]}>
            Handwerker
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.trackBtn, track === 'nachbarschaft' && styles.trackBtnActive]}
          onPress={() => switchTrack('nachbarschaft')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="people-outline"
            size={15}
            color={track === 'nachbarschaft' ? C.surface : C.sub}
          />
          <Text style={[styles.trackBtnText, track === 'nachbarschaft' && styles.trackBtnTextActive]}>
            Nachbarschaftshilfe
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {/* ════════ HANDWERKER TRACK ════════ */}
        {track === 'handwerker' && (
          <>
            {/* Step 1 — Persönliche Daten */}
            {step === 1 && (
              <StepWrapper
                icon="person-outline"
                title="Persönliche Daten"
                desc="Bitte geben Sie Ihre persönlichen Informationen ein. Diese werden für Auftraggeber nicht öffentlich angezeigt."
              >
                <Field label="Vollständiger Name" value={hwName} onChange={setHwName} placeholder="Max Mustermann" />
                <Field label="Adresse" value={hwAddress} onChange={setHwAddress} placeholder="Musterstr. 1, 50667 Köln" />
                <Field label="Telefonnummer" value={hwPhone} onChange={setHwPhone} keyboardType="phone-pad" placeholder="+49 170 1234567" />
                <Field label="E-Mail-Adresse" value={hwEmail} onChange={setHwEmail} keyboardType="email-address" placeholder="max@beispiel.de" />
              </StepWrapper>
            )}

            {/* Step 2 — Steuer-ID */}
            {step === 2 && (
              <StepWrapper
                icon="card-outline"
                title="Steuer-ID & IBAN"
                desc="Diese Angaben werden für die Auszahlung Ihrer Einnahmen benötigt."
              >
                {/* Hint box */}
                <View style={styles.hintBox}>
                  <View style={styles.hintIllustration}>
                    <Ionicons name="document-text-outline" size={28} color={C.muted} />
                    <Text style={styles.hintIllustrationLabel}>Steuerbescheid</Text>
                  </View>
                  <View style={styles.hintTextBlock}>
                    <Text style={styles.hintTitle}>Das ist Ihre Steuer-ID</Text>
                    <Text style={styles.hintBody}>
                      Sie finden sie auf Ihrem letzten Steuerbescheid oben rechts — eine{' '}
                      <Text style={{ fontWeight: '700', color: C.ink }}>11-stellige Zahl</Text>.
                    </Text>
                  </View>
                </View>

                <Field
                  label="Steuer-Identifikationsnummer"
                  value={hwSteuerID}
                  onChange={(v) => setHwSteuerID(v.replace(/\D/g, ''))}
                  keyboardType="numeric"
                  placeholder="12345678901"
                  maxLength={11}
                />
                {hwSteuerID.length > 0 && hwSteuerID.length < 11 && (
                  <Text style={styles.fieldHint}>
                    {11 - hwSteuerID.length} Zeichen fehlen noch
                  </Text>
                )}
                {hwSteuerIDError.length > 0 && (
                  <Text style={styles.fieldError}>{hwSteuerIDError}</Text>
                )}

                <Field
                  label="IBAN"
                  value={hwIBAN}
                  onChange={setHwIBAN}
                  placeholder="DE89 3704 0044 0532 0130 00"
                />
                <View style={styles.infoRow}>
                  <Ionicons name="lock-closed-outline" size={13} color={C.muted} />
                  <Text style={styles.infoText}>Bankdaten werden serverseitig tokenisiert (Stripe Connect) — kein Klartext gespeichert</Text>
                </View>
              </StepWrapper>
            )}

            {/* Step 4 — Meisterpflicht-Gate (nur bei §1 HwO Anlage-A Gewerken) */}
            {step === 4 && (
              <StepWrapper
                icon="ribbon-outline"
                title="Qualifikationsnachweis"
                desc={
                  MEISTERPFLICHT_IDS.has(hwTradeId)
                    ? 'Ihr gewähltes Gewerk unterliegt der Meisterpflicht (§1 HwO Anlage A). Sie benötigen einen Meisterbrief oder eine gleichwertige Ausnahmegenehmigung.'
                    : 'Für Ihr Gewerk ist kein Meisterpflicht-Nachweis erforderlich. Sie können direkt starten.'
                }
              >
                {MEISTERPFLICHT_IDS.has(hwTradeId) ? (
                  <>
                    <View style={styles.meisterWarning}>
                      <Ionicons name="warning-outline" size={20} color={C.amber} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.meisterWarningTitle}>Meisterpflicht-Gewerk</Text>
                        <Text style={styles.meisterWarningText}>
                          {TRADE_TYPES.find((t) => t.id === hwTradeId)?.name ?? 'Dieses Gewerk'} ist nach §1 HwO Anlage A
                          zulassungspflichtig. Ohne gültigen Meistertitel oder Ausnahmegenehmigung
                          (§8–9 HwO) darf dieses Gewerk nicht gewerblich angeboten werden.
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity style={styles.uploadArea} activeOpacity={0.8}>
                      <Ionicons name="ribbon-outline" size={32} color={C.muted} />
                      <Text style={styles.uploadTitle}>Meisterbrief hochladen</Text>
                      <Text style={styles.uploadDesc}>JPG, PNG oder PDF · max. 10 MB</Text>
                      <View style={styles.uploadBtn}>
                        <Text style={styles.uploadBtnText}>Datei auswählen</Text>
                      </View>
                    </TouchableOpacity>
                    <View style={styles.infoRow}>
                      <Ionicons name="information-circle-outline" size={13} color={C.muted} />
                      <Text style={styles.infoText}>
                        Alternativ: Ausnahmegenehmigung nach §8 HwO (Altgesellenregelung) oder EU-Berufsanerkennung
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.meisterOk}>
                    <Ionicons name="checkmark-circle" size={40} color={C.green} />
                    <Text style={styles.meisterOkText}>
                      Für {TRADE_TYPES.find((t) => t.id === hwTradeId)?.name || 'Ihr Gewerk'} ist
                      keine Meisterpflicht vorgeschrieben. Ihr Gewerbeschein ist ausreichend.
                    </Text>
                  </View>
                )}
              </StepWrapper>
            )}

            {/* Step 3 — Gewerbeschein */}
            {step === 3 && (
              <StepWrapper
                icon="briefcase-outline"
                title="Gewerbenachweis"
                desc="Laden Sie Ihren Gewerbeschein hoch und wählen Sie Ihr Gewerk. Diese Angaben werden einmalig geprüft."
              >
                {/* Upload area */}
                <TouchableOpacity style={styles.uploadArea} activeOpacity={0.8}>
                  <Ionicons name="camera-outline" size={32} color={C.muted} />
                  <Text style={styles.uploadTitle}>Gewerbeschein hochladen</Text>
                  <Text style={styles.uploadDesc}>JPG, PNG oder PDF · max. 10 MB</Text>
                  <View style={styles.uploadBtn}>
                    <Text style={styles.uploadBtnText}>Datei auswählen</Text>
                  </View>
                </TouchableOpacity>

                {/* Trade dropdown */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Gewerk</Text>
                  <TouchableOpacity
                    style={styles.dropdownTrigger}
                    activeOpacity={0.8}
                    onPress={() => setTradeOpen((o) => !o)}
                  >
                    <Text style={[styles.dropdownValue, !hwTradeId && { color: C.muted }]}>
                      {TRADE_TYPES.find((t) => t.id === hwTradeId)?.name || 'Gewerk auswählen'}
                    </Text>
                    <Ionicons
                      name={tradeOpen ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={C.sub}
                    />
                  </TouchableOpacity>
                  {tradeOpen && (
                    <View style={styles.dropdownList}>
                      {TRADE_TYPES.map((t) => (
                        <TouchableOpacity
                          key={t.id}
                          style={[styles.dropdownItem, hwTradeId === t.id && styles.dropdownItemSelected]}
                          onPress={() => { setHwTradeId(t.id); setTradeOpen(false); }}
                        >
                          <View style={styles.dropdownItemRow}>
                            <Text style={[styles.dropdownItemText, hwTradeId === t.id && { color: C.ink, fontWeight: '700' }]}>
                              {t.name}
                            </Text>
                            {MEISTERPFLICHT_IDS.has(t.id) && (
                              <Text style={styles.meisterBadge}>Meisterpflicht</Text>
                            )}
                          </View>
                          {hwTradeId === t.id && <Ionicons name="checkmark" size={16} color={C.ink} />}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* HWK-Rollennummer */}
                <Field
                  label="Handwerksrollennummer (HWK-Nr.)"
                  value={hwHwkNr}
                  onChange={setHwHwkNr}
                  placeholder="z. B. K/2024/12345"
                />
                <View style={styles.infoRow}>
                  <Ionicons name="information-circle-outline" size={13} color={C.muted} />
                  <Text style={styles.infoText}>
                    Ihre HWK-Nummer finden Sie auf Ihrer Handwerkskarte oder im Handwerksregister Ihrer Handwerkskammer (HWK).
                  </Text>
                </View>

                {/* Betriebshaftpflicht */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>
                    Betriebshaftpflicht{' '}
                    <Text style={{ color: C.amber, fontWeight: '700' }}>Pflicht</Text>
                  </Text>
                  <TouchableOpacity style={styles.uploadArea} activeOpacity={0.8}>
                    <Ionicons name="shield-checkmark-outline" size={32} color={C.muted} />
                    <Text style={styles.uploadTitle}>Versicherungsnachweis hochladen</Text>
                    <Text style={styles.uploadDesc}>JPG, PNG oder PDF · max. 10 MB</Text>
                    <View style={styles.uploadBtn}>
                      <Text style={styles.uploadBtnText}>Datei auswählen</Text>
                    </View>
                  </TouchableOpacity>
                  <View style={styles.infoRow}>
                    <Ionicons name="information-circle-outline" size={13} color={C.muted} />
                    <Text style={styles.infoText}>
                      Betriebshaftpflicht schützt Sie und Kunden bei Schäden — WERKR prüft Deckungssumme ≥ €1 Mio.
                    </Text>
                  </View>
                </View>
              </StepWrapper>
            )}
          </>
        )}

        {/* ════════ NACHBARSCHAFT TRACK ════════ */}
        {track === 'nachbarschaft' && (
          <>
            {/* Step 1 — Basisdaten */}
            {step === 1 && (
              <StepWrapper
                icon="person-outline"
                title="Über Sie"
                desc="Schnell und einfach — nur wenige Angaben nötig."
              >
                <Field label="Vollständiger Name" value={nbName} onChange={setNbName} placeholder="Max Mustermann" />
                <Field label="Telefonnummer" value={nbPhone} onChange={setNbPhone} keyboardType="phone-pad" placeholder="+49 170 1234567" />
                <Field label="E-Mail-Adresse" value={nbEmail} onChange={setNbEmail} keyboardType="email-address" placeholder="max@beispiel.de" />

                {/* Date of Birth — hard 18+ verification */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Geburtsdatum <Text style={{ color: C.red }}>*</Text></Text>
                  <TextInput
                    style={[styles.fieldInput, nbDobError ? { borderColor: C.red } : null]}
                    value={nbDob}
                    onChangeText={handleDobChange}
                    placeholder="TT.MM.JJJJ"
                    placeholderTextColor={C.muted}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                  {nbDobError ? (
                    <View style={styles.dobErrorRow}>
                      <Ionicons name="alert-circle" size={14} color={C.red} />
                      <Text style={styles.dobErrorText}>{nbDobError}</Text>
                    </View>
                  ) : nbDob.length === 10 && calcAge(nbDob) !== null ? (
                    (() => {
                      const age = calcAge(nbDob)!;
                      return age >= 18 ? (
                        <View style={styles.dobSuccessRow}>
                          <Ionicons name="checkmark-circle" size={14} color={C.green} />
                          <Text style={styles.dobSuccessText}>{age} Jahre — Altersnachweis bestätigt</Text>
                        </View>
                      ) : (
                        <View style={styles.dobMinorBlock}>
                          <View style={styles.dobErrorRow}>
                            <Ionicons name="alert-circle" size={14} color={C.red} />
                            <Text style={styles.dobErrorText}>
                              {age} Jahre — WERKR ist ausschließlich für Personen ab 18 Jahren.
                            </Text>
                          </View>
                          <Text style={styles.dobMinorHint}>
                            Auch mit Einwilligung der Erziehungsberechtigten ist eine Registrierung nicht möglich — WERKR bildet rechtlich verbindliche Dienstleistungsverträge ab, die nach §§​106​–​107 BGB und JArbSchG nur Volljährigen vorbehalten sind. Du kannst dich anmelden, sobald du 18 Jahre alt bist.
                          </Text>
                        </View>
                      );
                    })()
                  ) : null}
                </View>

                <Field
                  label="Steuerliche Identifikationsnummer"
                  value={nbSteuerID}
                  onChange={setNbSteuerID}
                  placeholder="12 345 678 901"
                  keyboardType="numeric"
                  maxLength={14}
                />
                <View style={styles.legalNotice}>
                  <Ionicons name="shield-outline" size={14} color={C.sub} />
                  <Text style={styles.legalNoticeText}>
                    WERKR ist ausschließlich für Personen ab 18 Jahren. Gemäß JArbSchG sind Minderjährige von der Plattform ausgeschlossen.
                  </Text>
                </View>
                <View style={styles.legalNotice}>
                  <Ionicons name="information-circle-outline" size={14} color={C.amber} />
                  <Text style={[styles.legalNoticeText, { color: C.amber }]}>
                    Gemäß PStTG §13 ist WERKR verpflichtet, Ihre Steuer-ID an das Bundeszentralamt für Steuern zu melden, sobald Sie ≥30 Transaktionen oder ≥€2.000 im Kalenderjahr erzielen (DAC7-Schwellenwert).
                  </Text>
                </View>
              </StepWrapper>
            )}

            {/* Step 2 — Skills & Rate */}
            {step === 2 && (
              <StepWrapper
                icon="star-outline"
                title="Fähigkeiten & Stundensatz"
                desc="Wählen Sie Ihre Tätigkeiten und legen Sie Ihren Stundensatz fest."
              >
                <Text style={styles.skillLabel}>Ich helfe gerne bei … (Mehrfachauswahl)</Text>
                <View style={styles.skillGrid}>
                  {SKILLS.map((skill) => {
                    const active = nbSkills.includes(skill);
                    return (
                      <TouchableOpacity
                        key={skill}
                        style={[styles.skillChip, active && styles.skillChipActive]}
                        onPress={() => toggleSkill(skill)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.skillChipText, active && styles.skillChipTextActive]}>
                          {skill}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Hourly rate */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Stundensatz (€)</Text>
                  <View style={styles.rateRow}>
                    <TouchableOpacity
                      style={styles.rateBtn}
                      onPress={() => setNbRate((v) => String(Math.max(13, Number(v) - 1)))}
                    >
                      <Ionicons name="remove" size={18} color={C.sub} />
                    </TouchableOpacity>
                    <View style={styles.rateDisplay}>
                      <Text style={styles.rateValue}>€{nbRate}</Text>
                      <Text style={styles.rateUnit}>/ Stunde</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.rateBtn}
                      onPress={() => setNbRate((v) => String(Math.min(80, Number(v) + 1)))}
                    >
                      <Ionicons name="add" size={18} color={C.sub} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.rateHint}>
                    <Ionicons name="information-circle-outline" size={13} color={C.amber} />
                    <Text style={[styles.rateHintText, { color: C.amber }]}>Mindestlohn: €12,41/h (§1 MiLoG) — Minimum auf €13/h gesetzt</Text>
                  </View>
                </View>

                {/* PStTG awareness notice */}
                <View style={styles.pstgGate}>
                  <Ionicons name="receipt-outline" size={14} color="#b45309" />
                  <Text style={styles.pstgGateText}>
                    Automatische Steuer-Meldung: Bei ≥30 Aufträgen oder ≥€2.000 Jahresumsatz meldet WERKR deine Daten automatisch an das Bundeszentralamt für Steuern (PStTG §13 / DAC7). Deine Steuer-ID ist bereits hinterlegt.
                  </Text>
                </View>

                {/* Short bio */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Kurze Vorstellung <Text style={styles.fieldOptional}>(optional)</Text></Text>
                  <TextInput
                    style={[styles.fieldInput, styles.fieldTextarea]}
                    value={nbBio}
                    onChangeText={setNbBio}
                    placeholder="Ich bin zuverlässig, pünktlich und helfe gerne …"
                    placeholderTextColor={C.muted}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    maxLength={200}
                  />
                  <Text style={styles.charCount}>{nbBio.length}/200</Text>
                </View>
              </StepWrapper>
            )}
          </>
        )}

        {/* ── CTA Button ── */}
        <AnimatedButton
          style={styles.nextBtn}
          onPress={() => {
            if (track === 'nachbarschaft' && step === 1 && !validateDob()) return;
            if (track === 'handwerker' && step === 2 && hwSteuerID.length < 11) {
              setHwSteuerIDError('Steuer-ID muss genau 11 Ziffern enthalten.');
              return;
            }
            setHwSteuerIDError('');
            nextStep();
          }}
        >
          <Text style={styles.nextBtnText}>
            {step === totalSteps ? 'Abschließen' : 'Weiter'}
          </Text>
          <Ionicons name={step === totalSteps ? 'checkmark' : 'arrow-forward'} size={18} color={C.surface} />
        </AnimatedButton>

        <Text style={styles.stepHint}>Schritt {step} von {totalSteps}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StepWrapper({
  icon, title, desc, children,
}: {
  icon: string;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.stepWrapper}>
      <View style={styles.stepHeaderRow}>
        <View style={styles.stepIconWrap}>
          <Ionicons name={icon as any} size={22} color={C.ink} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.stepTitle}>{title}</Text>
          <Text style={styles.stepDesc}>{desc}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

function SuccessItem({ text, pending }: { text: string; pending?: boolean }) {
  return (
    <View style={styles.successItem}>
      <Ionicons
        name={pending ? 'time-outline' : 'checkmark-circle-outline'}
        size={18}
        color={pending ? C.amber : C.green}
      />
      <Text style={[styles.successItemText, pending && { color: C.amber }]}>{text}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:               { flex: 1, backgroundColor: C.bg },

  // Header
  header:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerCenter:       { alignItems: 'center' },
  headerTitle:        { ...T.lg, ...T.bold, color: C.ink },
  headerSub:          { ...T.xs, fontSize: 12, color: C.muted, marginTop: 1 },

  // Progress
  progressTrack:      { height: 3, backgroundColor: C.border, marginHorizontal: 20, borderRadius: 2, marginBottom: 16 },
  progressFill:       { height: 3, backgroundColor: C.ink, borderRadius: 2 },

  // Track switcher
  trackSwitcher:      { flexDirection: 'row', marginHorizontal: 20, marginBottom: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 3, gap: 3 },
  trackBtn:           { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 8 },
  trackBtnActive:     { backgroundColor: C.ink },
  trackBtnText:       { ...T.sm, ...T.medium, color: C.sub },
  trackBtnTextActive: { color: C.surface, fontWeight: '700' },

  scrollContent:      { paddingHorizontal: 20, paddingBottom: 48 },

  // Step wrapper
  stepWrapper:        { marginBottom: 24 },
  stepHeaderRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 24 },
  stepIconWrap:       { width: 44, height: 44, borderRadius: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepTitle:          { ...T.xl, ...T.black, color: C.ink, marginBottom: 4 },
  stepDesc:           { ...T.sm, color: C.sub },

  // Fields
  field:              { marginBottom: 16 },
  fieldLabel:         { ...T.sm, ...T.semibold, color: C.ink, marginBottom: 7 },
  fieldOptional:      { ...T.caption, fontSize: 12, color: C.muted },
  fieldInput:         { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, ...T.base, color: C.ink },
  fieldTextarea:      { minHeight: 80, paddingTop: 12 },
  fieldHint:          { ...T.xs, color: C.amber, marginTop: 5, marginLeft: 2 },
  fieldError:         { ...T.caption, fontSize: 12, ...T.semibold, color: C.red, marginTop: 6, marginLeft: 2 },
  charCount:          { ...T.xs, color: C.muted, textAlign: 'right', marginTop: 4 },

  // Hint box (Steuer-ID)
  hintBox:            { flexDirection: 'row', alignItems: 'center', backgroundColor: C.goldBg, borderRadius: 12, borderWidth: 1, borderColor: C.gold + '80', padding: 14, marginBottom: 20, gap: 14 },
  hintIllustration:   { width: 64, height: 64, borderRadius: 8, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', gap: 4, flexShrink: 0 },
  hintIllustrationLabel: { fontSize: 8, color: C.muted, fontWeight: '600', textAlign: 'center', letterSpacing: 0.3 },
  hintTextBlock:      { flex: 1 },
  hintTitle:          { ...T.sm, ...T.bold, color: C.gold, marginBottom: 4 },
  hintBody:           { ...T.caption, fontSize: 12, color: C.sub },

  infoRow:            { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  infoText:           { ...T.xs, color: C.muted },

  // Upload area
  uploadArea:         { borderWidth: 1.5, borderColor: C.border, borderStyle: 'dashed', borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingVertical: 36, paddingHorizontal: 20, backgroundColor: C.surface, marginBottom: 20, gap: 8 },
  uploadTitle:        { ...T.base, ...T.bold, color: C.ink },
  uploadDesc:         { ...T.caption, fontSize: 12, color: C.muted },
  uploadBtn:          { marginTop: 6, paddingHorizontal: 20, paddingVertical: 9, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 8 },
  uploadBtnText:      { ...T.sm, ...T.semibold, color: C.sub },

  // Dropdown
  dropdownTrigger:    { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownValue:      { ...T.base, color: C.ink },
  dropdownList:       { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, marginTop: 4, overflow: 'hidden' },
  dropdownItem:       { paddingHorizontal: 14, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.border },
  dropdownItemSelected:{ backgroundColor: C.bg },
  dropdownItemText:   { ...T.body, color: C.sub },

  // DOB age verification
  dobErrorRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 6 },
  dobErrorText:       { flex: 1, ...T.caption, fontSize: 12, color: C.red },
  dobSuccessRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  dobSuccessText:     { ...T.caption, fontSize: 12, ...T.medium, color: C.green },
  dobMinorBlock:      { marginTop: 8, backgroundColor: C.redBg, borderRadius: 10, padding: 12, gap: 6 },
  dobMinorHint:       { ...T.xs, color: C.sub },
  legalNotice:        { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.bg, borderRadius: 10, padding: 12, marginTop: 4 },
  legalNoticeText:    { flex: 1, ...T.xs, color: C.sub },

  // Skills
  skillLabel:         { ...T.sm, ...T.semibold, color: C.ink, marginBottom: 12 },
  skillGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  skillChip:          { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  skillChipActive:    { backgroundColor: C.ink, borderColor: C.ink },
  skillChipText:      { ...T.sm, ...T.medium, color: C.sub },
  skillChipTextActive:{ color: C.surface, fontWeight: '700' },

  // Rate
  rateRow:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 0, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, overflow: 'hidden' },
  rateBtn:            { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  rateDisplay:        { flex: 1, alignItems: 'center', borderLeftWidth: 1, borderRightWidth: 1, borderColor: C.border, paddingVertical: 8 },
  rateValue:          { ...T['2xl'], ...T.black, color: C.ink },
  rateUnit:           { ...T.xs, color: C.muted },
  rateHint:           { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  rateHintText:       { ...T.xs, color: C.muted },

  // Meisterpflicht-Gate
  meisterWarning:      { flexDirection: 'row', gap: 12, backgroundColor: C.amberBg, borderRadius: 12, borderWidth: 1, borderColor: C.amber, padding: 14, marginBottom: 20 },
  meisterWarningTitle: { ...T.sm, ...T.bold, color: C.amber, marginBottom: 4 },
  meisterWarningText:  { ...T.caption, fontSize: 12, color: C.amber },
  meisterOk:           { alignItems: 'center', gap: 14, paddingVertical: 32, backgroundColor: C.greenBg, borderRadius: 14, borderWidth: 1, borderColor: C.green },
  meisterOkText:       { ...T.body, ...T.semibold, color: C.green, textAlign: 'center', paddingHorizontal: 16 },
  dropdownItemRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  meisterBadge:        { fontSize: 10, fontWeight: '700', color: C.amber, backgroundColor: C.amberBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },

  // PStTG gate notice
  pstgGate:           { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.amberBg, borderRadius: 8, borderWidth: 1, borderColor: C.amber + '60', padding: 10, marginBottom: 12 },
  pstgGateText:       { flex: 1, ...T.xs, color: C.amber },

  // Next button
  nextBtn:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.ink, borderRadius: 14, paddingVertical: 17, marginTop: 8 },
  nextBtnText:        { fontSize: 16, fontWeight: '700', color: C.surface },
  stepHint:           { ...T.caption, fontSize: 12, color: C.muted, textAlign: 'center', marginTop: 14 },

  // Success screen
  successContainer:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 40 },
  successIconWrap:    { width: 96, height: 96, borderRadius: 48, backgroundColor: C.greenBg, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  successTitle:       { ...T['2xl'], ...T.black, color: C.ink, marginBottom: 12, textAlign: 'center' },
  successDesc:        { ...T.base, color: C.sub, textAlign: 'center', marginBottom: 28 },
  successChecklist:   { width: '100%', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16, gap: 12, marginBottom: 32 },
  successItem:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  successItemText:    { ...T.body, ...T.medium, color: C.ink },
  successBtn:         { width: '100%', backgroundColor: C.ink, borderRadius: 14, paddingVertical: 17, alignItems: 'center' },
  successBtnText:     { fontSize: 16, fontWeight: '700', color: C.surface },
  successProBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: C.gold, backgroundColor: C.goldBg, width: '100%' },
  successProBtnText:  { ...T.body, ...T.bold, color: C.gold },
});
