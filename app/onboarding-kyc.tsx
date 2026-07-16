import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { C } from '../constants/colors';
import { AnimatedButton } from '../components/ui/AnimatedButton';
import { CATEGORIES, categoryById, MEISTERPFLICHT_IDS, NACHBARSCHAFT_STARTKATEGORIEN } from '../data/categories';
import { FEATURES } from '../constants/features';
import { updateProviderProfile } from '../lib/providerProfiles';
import { pickDoc, uploadDoc, submitForReview, type DocKind } from '../lib/verification';
import { trackError } from '../lib/analytics';
import { getSession } from '../lib/auth';
import { isSupabaseConfigured } from '../lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────────

type Track = 'handwerker' | 'nachbarschaft';

const HANDWERKER_STEPS = 4;
const NACHBARSCHAFT_STEPS = 2;

// B2B-Gewerke aus categories-Config; Anzeigename für Dropdown
const TRADE_TYPES = CATEGORIES
  .filter((c) => c.segment === 'B2B' && c.active)
  .map((c) => ({ id: c.id, name: c.name }));

// C2C-Fähigkeiten aus categories-Config — Modell D: kontrollierter Start nur mit
// den freigegebenen Startkategorien (NACHBARSCHAFT_STARTKATEGORIEN). Speichert
// ids (nicht Namen), damit category_ids konsistent mit categoryById() bleibt.
const SKILLS = CATEGORIES
  .filter((c) => c.segment === 'C2C' && c.active && NACHBARSCHAFT_STARTKATEGORIEN.includes(c.id))
  .map((c) => c.id);

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
  const [hwIBAN, setHwIBAN] = useState('');
  const [hwTradeId, setHwTradeId] = useState('');
  const [tradeOpen, setTradeOpen] = useState(false);

  // ── Verifizierungs-Dokumente (Migration 037) ──
  const [gsDoc, setGsDoc] = useState<{ name: string; path: string } | null>(null);
  const [mbDoc, setMbDoc] = useState<{ name: string; path: string } | null>(null);
  const [uploading, setUploading] = useState<DocKind | null>(null);
  const [uploadErr, setUploadErr] = useState('');

  // ── Nachbarschaft state ──
  const [nbName, setNbName] = useState('');
  const [nbPhone, setNbPhone] = useState('');
  const [nbEmail, setNbEmail] = useState('');
  const [nbDob, setNbDob] = useState('');       // DD.MM.YYYY
  const [nbDobError, setNbDobError] = useState('');
  const [nbSkills, setNbSkills] = useState<string[]>([]);
  const [nbCustom, setNbCustom] = useState('');   // Freitext: Hilfe, die nicht in der Auswahl steht
  const [nbRate, setNbRate] = useState('15');
  const [nbBio, setNbBio] = useState('');

  const totalSteps = track === 'handwerker' ? HANDWERKER_STEPS : NACHBARSCHAFT_STEPS;
  const isDone = step > totalSteps;

  const [saving, setSaving] = useState(false);

  async function handlePickDoc(kind: DocKind) {
    setUploadErr('');
    try {
      const doc = await pickDoc();
      if (!doc) return;
      setUploading(kind);
      const path = await uploadDoc(kind, doc);
      if (kind === 'gewerbeschein') setGsDoc({ name: doc.name, path });
      else setMbDoc({ name: doc.name, path });
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : 'Upload fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setUploading(null);
    }
  }

  // Schritt-Gates: ohne Gewerbeschein kein Schritt 4, ohne Meisterbrief kein
  // Abschluss bei Meisterpflicht-Gewerk (§1 HwO Anlage A).
  const stepBlocked =
    track === 'handwerker' &&
    ((step === 3 && !gsDoc) ||
      (step === 4 && MEISTERPFLICHT_IDS.has(hwTradeId) && !mbDoc));

  async function nextStep() {
    if (stepBlocked) {
      setUploadErr(
        step === 3
          ? 'Bitte laden Sie zuerst Ihren Gewerbeschein hoch.'
          : 'Für Meisterpflicht-Gewerke ist der Meisterbrief (oder eine Ausnahmegenehmigung) erforderlich.'
      );
      return;
    }
    setUploadErr('');
    if (step < totalSteps) { setStep((s) => s + 1); return; }
    // Final step — persist profile.
    // Ohne angemeldetes Konto speichert updateProviderProfile still nichts
    // (return bei !user) → früher entstand ein Fake-Erfolg ("Bewerbung
    // eingegangen", obwohl nichts gespeichert wurde). Deshalb hier ein
    // ehrlicher Guard: kein Konto → klarer Hinweis, KEINE Erfolgsseite.
    if (isSupabaseConfigured) {
      const session = await getSession();
      if (!session) {
        setUploadErr('Bitte melden Sie sich zuerst mit Ihrem Anbieter-Konto an, um Ihre Bewerbung abzusenden.');
        return;
      }
    }
    setSaving(true);
    try {
      if (track === 'handwerker') {
        await updateProviderProfile({
          business_name: hwName,
          phone: hwPhone,
          trade_id: hwTradeId || null,
          min_hourly_rate: 13,
          category_ids: hwTradeId ? [hwTradeId] : [],
        });
        if (gsDoc) {
          await submitForReview({
            gewerbeschein: gsDoc.path,
            meisterbrief: mbDoc?.path ?? null,
          });
        }
      } else {
        // Freitext-Ergänzung an die Bio anhängen, damit sie fürs Review-Team und
        // später Kund:innen sichtbar ist (keine eigene DB-Spalte nötig).
        const extra = nbCustom.trim();
        const combinedBio = extra
          ? `${nbBio.trim()}${nbBio.trim() ? '\n' : ''}Bietet außerdem: ${extra}`
          : nbBio;
        await updateProviderProfile({
          business_name: nbName,
          phone: nbPhone,
          bio: combinedBio,
          min_hourly_rate: parseInt(nbRate, 10) || 15,
          category_ids: nbSkills,
          is_nachbarschaft: true,
        });
      }
      router.replace('/bewerbung-eingegangen');
    } catch {
      // Kein Fake-Erfolg: Bei einem Fehler NICHT auf die Erfolgsseite leiten —
      // sonst glaubt der Nutzer, die Bewerbung sei eingegangen, obwohl nichts
      // gespeichert wurde. Nutzer bleibt auf dem Schritt, Eingaben bleiben erhalten.
      trackError('kyc_submit');
      setUploadErr('Einreichung fehlgeschlagen. Bitte prüfen Sie Ihre Verbindung und versuchen Sie es erneut.');
    } finally {
      setSaving(false);
    }
  }
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
    if (age < 18) { setNbDobError(`Sie sind ${age} Jahre alt. Mindestalter: 18 Jahre. Werkant ist nicht für Minderjährige.`); return false; }
    return true;
  }

  // Live-Vorschau während der Eingabe: vorher zeigte das Feld bei jedem
  // vollständigen Datum "bestätigt" (grün) an — auch bei Minderjährigen —
  // und erst nach Klick auf "Weiter" den roten Fehler. Jetzt greift die
  // 18+-Prüfung sofort beim Tippen, nicht erst beim Absenden.
  const nbAge = nbDob.length === 10 ? calcAge(nbDob) : null;
  const nbLiveError = nbDobError || (nbAge !== null && nbAge < 18
    ? `Sie sind ${nbAge} Jahre alt. Mindestalter: 18 Jahre. Werkant ist nicht für Minderjährige.`
    : '');

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
            <Ionicons name="checkmark-circle" size={56} color={C.primary} />
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
                <SuccessItem text="Gewerbeschein hochgeladen" />
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
            onPress={() => router.replace('/(provider)/dashboard')}
          >
            <Text style={styles.successBtnText}>Zum Dashboard</Text>
          </TouchableOpacity>
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
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zurück" onPress={step > 1 ? prevStep : () => router.back()} hitSlop={12}>
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

      {/* Track switcher — nur sichtbar, solange der Nachbarschafts-Track
          aktiv ist (Fokus-Schnitt MVP: eingefroren, Default ist Handwerker) */}
      {FEATURES.NACHBARSCHAFT && (
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
      )}

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
                          Elektro- und Sanitär-/Heizungsarbeiten sind nach §1 HwO zulassungspflichtig.
                          Ohne gültigen Meistertitel oder Ausnahmegenehmigung (§8–9 HwO) dürfen
                          diese Arbeiten nicht gewerblich angeboten werden.
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.uploadArea}
                      activeOpacity={0.8}
                      onPress={() => handlePickDoc('meisterbrief')}
                      disabled={uploading !== null}
                    >
                      {uploading === 'meisterbrief' ? (
                        <ActivityIndicator color={C.primary} />
                      ) : mbDoc ? (
                        <>
                          <Ionicons name="checkmark-circle" size={32} color={C.primary} />
                          <Text style={styles.uploadTitle}>{mbDoc.name}</Text>
                          <Text style={styles.uploadDesc}>Hochgeladen — zum Ersetzen erneut tippen</Text>
                        </>
                      ) : (
                        <>
                          <Ionicons name="ribbon-outline" size={32} color={C.muted} />
                          <Text style={styles.uploadTitle}>Meisterbrief hochladen</Text>
                          <Text style={styles.uploadDesc}>JPG, PNG oder PDF · max. 10 MB</Text>
                          <View style={styles.uploadBtn}>
                            <Text style={styles.uploadBtnText}>Datei auswählen</Text>
                          </View>
                        </>
                      )}
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
                    <Ionicons name="checkmark-circle" size={40} color={C.primary} />
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
                <TouchableOpacity
                  style={styles.uploadArea}
                  activeOpacity={0.8}
                  onPress={() => handlePickDoc('gewerbeschein')}
                  disabled={uploading !== null}
                >
                  {uploading === 'gewerbeschein' ? (
                    <ActivityIndicator color={C.primary} />
                  ) : gsDoc ? (
                    <>
                      <Ionicons name="checkmark-circle" size={32} color={C.primary} />
                      <Text style={styles.uploadTitle}>{gsDoc.name}</Text>
                      <Text style={styles.uploadDesc}>Hochgeladen — zum Ersetzen erneut tippen</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="camera-outline" size={32} color={C.muted} />
                      <Text style={styles.uploadTitle}>Gewerbeschein hochladen</Text>
                      <Text style={styles.uploadDesc}>JPG, PNG oder PDF · max. 10 MB</Text>
                      <View style={styles.uploadBtn}>
                        <Text style={styles.uploadBtnText}>Datei auswählen</Text>
                      </View>
                    </>
                  )}
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
                    style={[styles.fieldInput, nbLiveError ? { borderColor: C.red } : null]}
                    value={nbDob}
                    onChangeText={handleDobChange}
                    placeholder="TT.MM.JJJJ"
                    placeholderTextColor={C.muted}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                  {nbLiveError ? (
                    <View style={styles.dobErrorRow}>
                      <Ionicons name="alert-circle" size={14} color={C.red} />
                      <Text style={styles.dobErrorText}>{nbLiveError}</Text>
                    </View>
                  ) : nbAge !== null ? (
                    <View style={styles.dobSuccessRow}>
                      <Ionicons name="checkmark-circle" size={14} color={C.primary} />
                      <Text style={styles.dobSuccessText}>{nbAge} Jahre — Altersnachweis bestätigt</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.legalNotice}>
                  <Ionicons name="shield-outline" size={14} color={C.sub} />
                  <Text style={styles.legalNoticeText}>
                    Werkant ist ausschließlich für Personen ab 18 Jahren. Gemäß JArbSchG sind Minderjährige von der Plattform ausgeschlossen.
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
                          {categoryById(skill)?.name ?? skill}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Freitext: etwas ergänzen, das nicht in der Auswahl steht */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>
                    Noch etwas hinzufügen? <Text style={styles.fieldOptional}>(optional)</Text>
                  </Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={nbCustom}
                    onChangeText={setNbCustom}
                    placeholder="z. B. Blumen gießen, Vorlesen, Pflanzen versorgen …"
                    placeholderTextColor={C.muted}
                    maxLength={80}
                  />
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

        {/* Upload-/Einreichungsfehler */}
        {uploadErr ? (
          <View style={styles.dobErrorRow}>
            <Ionicons name="alert-circle-outline" size={14} color={C.red} />
            <Text style={styles.dobErrorText}>{uploadErr}</Text>
          </View>
        ) : null}

        {/* ── CTA Button ── */}
        <AnimatedButton
          style={[styles.nextBtn, saving && { opacity: 0.7 }]}
          onPress={() => {
            if (saving) return;
            if (track === 'nachbarschaft' && step === 1 && !validateDob()) return;
            nextStep();
          }}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color={C.surface} size="small" />
            : <>
                <Text style={styles.nextBtnText}>
                  {step === totalSteps ? 'Abschließen' : 'Weiter'}
                </Text>
                <Ionicons name={step === totalSteps ? 'checkmark' : 'arrow-forward'} size={18} color={C.surface} />
              </>
          }
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
        color={pending ? C.amber : C.primary}
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
  headerTitle:        { fontSize: 16, fontWeight: '700', color: C.ink },
  headerSub:          { fontSize: 12, color: C.muted, marginTop: 1 },

  // Progress
  progressTrack:      { height: 3, backgroundColor: C.border, marginHorizontal: 20, borderRadius: 2, marginBottom: 16 },
  progressFill:       { height: 3, backgroundColor: C.primary, borderRadius: 2 },

  // Track switcher
  trackSwitcher:      { flexDirection: 'row', marginHorizontal: 20, marginBottom: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 3, gap: 3 },
  trackBtn:           { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 8 },
  trackBtnActive:     { backgroundColor: C.primary },
  trackBtnText:       { fontSize: 13, fontWeight: '500', color: C.sub },
  trackBtnTextActive: { color: C.surface, fontWeight: '700' },

  scrollContent:      { paddingHorizontal: 20, paddingBottom: 48 },

  // Step wrapper
  stepWrapper:        { marginBottom: 24 },
  stepHeaderRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 24 },
  stepIconWrap:       { width: 44, height: 44, borderRadius: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepTitle:          { fontSize: 20, fontWeight: '700', color: C.ink, marginBottom: 4 },
  stepDesc:           { fontSize: 13, color: C.sub, lineHeight: 18 },

  // Fields
  field:              { marginBottom: 16 },
  fieldLabel:         { fontSize: 13, fontWeight: '600', color: C.ink, marginBottom: 7 },
  fieldOptional:      { fontSize: 12, fontWeight: '400', color: C.muted },
  fieldInput:         { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: C.ink },
  fieldTextarea:      { minHeight: 80, paddingTop: 12 },
  fieldHint:          { fontSize: 11, color: C.amber, marginTop: 5, marginLeft: 2 },
  charCount:          { fontSize: 11, color: C.muted, textAlign: 'right', marginTop: 4 },

  // Hint box (Steuer-ID)
  hintBox:            { flexDirection: 'row', alignItems: 'center', backgroundColor: C.goldBg, borderRadius: 12, borderWidth: 1, borderColor: C.goldBd, padding: 14, marginBottom: 20, gap: 14 },
  hintIllustration:   { width: 64, height: 64, borderRadius: 8, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', gap: 4, flexShrink: 0 },
  hintIllustrationLabel: { fontSize: 8, color: C.muted, fontWeight: '600', textAlign: 'center', letterSpacing: 0.3 },
  hintTextBlock:      { flex: 1 },
  hintTitle:          { fontSize: 13, fontWeight: '700', color: C.gold, marginBottom: 4 },
  hintBody:           { fontSize: 12, color: C.sub, lineHeight: 17 },

  infoRow:            { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  infoText:           { fontSize: 11, color: C.muted },

  // Upload area
  uploadArea:         { borderWidth: 1.5, borderColor: C.border, borderStyle: 'dashed', borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingVertical: 36, paddingHorizontal: 20, backgroundColor: C.surface, marginBottom: 20, gap: 8 },
  uploadTitle:        { fontSize: 15, fontWeight: '700', color: C.ink },
  uploadDesc:         { fontSize: 12, color: C.muted },
  uploadBtn:          { marginTop: 6, paddingHorizontal: 20, paddingVertical: 9, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 8 },
  uploadBtnText:      { fontSize: 13, fontWeight: '600', color: C.sub },

  // Dropdown
  dropdownTrigger:    { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownValue:      { fontSize: 15, color: C.ink },
  dropdownList:       { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, marginTop: 4, overflow: 'hidden' },
  dropdownItem:       { paddingHorizontal: 14, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.border },
  dropdownItemSelected:{ backgroundColor: C.bg },
  dropdownItemText:   { fontSize: 14, color: C.sub },

  // DOB age verification
  dobErrorRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 6 },
  dobErrorText:       { flex: 1, fontSize: 12, color: C.red, lineHeight: 17 },
  dobSuccessRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  dobSuccessText:     { fontSize: 12, color: C.primary, fontWeight: '500' },
  legalNotice:        { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.bgWarm, borderRadius: 10, padding: 12, marginTop: 4 },
  legalNoticeText:    { flex: 1, fontSize: 11, color: C.sub, lineHeight: 16 },

  // Skills
  skillLabel:         { fontSize: 13, fontWeight: '600', color: C.ink, marginBottom: 12 },
  skillGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  skillChip:          { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  skillChipActive:    { backgroundColor: C.primary, borderColor: C.primary },
  skillChipText:      { fontSize: 13, color: C.sub, fontWeight: '500' },
  skillChipTextActive:{ color: C.surface, fontWeight: '700' },

  // Rate
  rateRow:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 0, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, overflow: 'hidden' },
  rateBtn:            { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  rateDisplay:        { flex: 1, alignItems: 'center', borderLeftWidth: 1, borderRightWidth: 1, borderColor: C.border, paddingVertical: 8 },
  rateValue:          { fontSize: 22, fontWeight: '700', color: C.ink },
  rateUnit:           { fontSize: 11, color: C.muted },
  rateHint:           { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  rateHintText:       { fontSize: 11, color: C.muted },

  // Meisterpflicht-Gate
  meisterWarning:      { flexDirection: 'row', gap: 12, backgroundColor: C.amberBg, borderRadius: 12, borderWidth: 1, borderColor: C.amber, padding: 14, marginBottom: 20 },
  meisterWarningTitle: { fontSize: 13, fontWeight: '700', color: C.amber, marginBottom: 4 },
  meisterWarningText:  { fontSize: 12, color: C.amber, lineHeight: 18 },
  meisterOk:           { alignItems: 'center', gap: 14, paddingVertical: 32, backgroundColor: C.primaryBg, borderRadius: 14, borderWidth: 1, borderColor: C.primary },
  meisterOkText:       { fontSize: 14, color: C.primary, fontWeight: '600', textAlign: 'center', paddingHorizontal: 16, lineHeight: 20 },
  dropdownItemRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  meisterBadge:        { fontSize: 10, fontWeight: '700', color: C.amber, backgroundColor: C.amberBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },

  // Next button
  nextBtn:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 14, paddingVertical: 17, marginTop: 8 },
  nextBtnText:        { fontSize: 16, fontWeight: '700', color: C.surface },
  stepHint:           { fontSize: 12, color: C.muted, textAlign: 'center', marginTop: 14 },

  // Success screen
  successContainer:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 40 },
  successIconWrap:    { width: 96, height: 96, borderRadius: 48, backgroundColor: C.primaryBg, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  successTitle:       { fontSize: 26, fontWeight: '700', color: C.ink, marginBottom: 12, textAlign: 'center' },
  successDesc:        { fontSize: 15, color: C.sub, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  successChecklist:   { width: '100%', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16, gap: 12, marginBottom: 32 },
  successItem:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  successItemText:    { fontSize: 14, color: C.ink, fontWeight: '500' },
  successBtn:         { width: '100%', backgroundColor: C.primary, borderRadius: 14, paddingVertical: 17, alignItems: 'center' },
  successBtnText:     { fontSize: 16, fontWeight: '700', color: C.surface },
});
