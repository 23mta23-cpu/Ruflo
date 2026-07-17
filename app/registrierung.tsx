import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safeBack } from '../lib/nav';
import { C } from '../constants/colors';
import { T } from '../constants/typography';
import { showAlert } from '../lib/alert';
import { isSupabaseConfigured } from '../lib/supabase';
import { signUp, authErrorMessage, sendVerificationEmail } from '../lib/auth';
import { getJobDraftResume } from '../lib/jobDraft';

// ── Types ──────────────────────────────────────────────────────────────────────

interface FormState {
  email: string;
  password: string;
  passwordConfirm: string;
  vorname: string;
  nachname: string;
  phone: string;
  plz: string;
  stadt: string;
  dsgvo: boolean;
  newsletter: boolean;
  accountType: 'private' | 'business';
  companyName: string;
  ustId: string;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <View style={styles.progressTrack}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.progressSegment,
            i < step ? styles.progressSegmentActive : styles.progressSegmentInactive,
            i < total - 1 && styles.progressSegmentGap,
          ]}
        />
      ))}
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType = 'default',
  secureTextEntry = false,
  maxLength,
  autoComplete,
  returnKeyType,
  onSubmitEditing,
  inputRef,
  hint,
  prefix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: TextInputProps['keyboardType'];
  secureTextEntry?: boolean;
  maxLength?: number;
  autoComplete?: TextInputProps['autoComplete'];
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
  inputRef?: React.RefObject<TextInput | null>;
  hint?: string;
  prefix?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = secureTextEntry;

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldInputRow}>
        {prefix && (
          <View style={styles.fieldPrefix}>
            <Text style={styles.fieldPrefixText}>{prefix}</Text>
          </View>
        )}
        <TextInput
          ref={inputRef as React.RefObject<TextInput>}
          style={[styles.fieldInput, prefix && styles.fieldInputWithPrefix]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder ?? label}
          placeholderTextColor={C.muted}
          keyboardType={keyboardType}
          secureTextEntry={isPassword && !showPassword}
          maxLength={maxLength}
          autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
          autoComplete={autoComplete}
          returnKeyType={returnKeyType ?? 'next'}
          onSubmitEditing={onSubmitEditing}
        />
        {isPassword && (
          <TouchableOpacity
            style={styles.fieldEye}
            onPress={() => setShowPassword((v) => !v)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={C.sub}
            />
          </TouchableOpacity>
        )}
      </View>
      {hint && <Text style={styles.fieldHint}>{hint}</Text>}
    </View>
  );
}

function Checkbox({
  checked,
  onToggle,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <TouchableOpacity style={styles.checkRow} onPress={onToggle} activeOpacity={0.7}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Ionicons name="checkmark" size={12} color="#fff" />}
      </View>
      <Text style={styles.checkLabel}>{children}</Text>
    </TouchableOpacity>
  );
}

// ── Validation ─────────────────────────────────────────────────────────────────

function validateStep1(form: FormState): string | null {
  if (!form.email.trim()) return 'Bitte E-Mail-Adresse eingeben.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Ungültige E-Mail-Adresse.';
  if (form.password.length < 8) return 'Passwort muss mindestens 8 Zeichen haben.';
  if (form.password !== form.passwordConfirm) return 'Passwörter stimmen nicht überein.';
  return null;
}

function validateStep2(form: FormState): string | null {
  if (form.accountType === 'business') {
    if (!form.companyName.trim()) return 'Bitte Firmenname eingeben.';
    if (form.ustId.trim() && !/^DE\d{9}$/.test(form.ustId.trim().toUpperCase()))
      return 'USt-IdNr. im Format DE123456789 eingeben.';
  } else {
    if (!form.vorname.trim()) return 'Bitte Vornamen eingeben.';
    if (!form.nachname.trim()) return 'Bitte Nachnamen eingeben.';
  }
  if (!form.phone.trim()) return 'Bitte Telefonnummer eingeben.';
  if (form.phone.replace(/\s/g, '').length < 9) return 'Bitte gültige Telefonnummer eingeben.';
  return null;
}

function validateStep3(form: FormState): string | null {
  if (!form.plz.trim() || form.plz.length < 5) return 'Bitte gültige Postleitzahl eingeben.';
  if (!form.stadt.trim()) return 'Bitte Stadt eingeben.';
  if (!form.dsgvo) return 'Bitte stimmen Sie der Datenschutzerklärung zu.';
  return null;
}

// ── Screen ─────────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 3;

export default function RegistrierungScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState<FormState>({
    email: '',
    password: '',
    passwordConfirm: '',
    vorname: '',
    nachname: '',
    phone: '',
    plz: '',
    stadt: '',
    dsgvo: false,
    newsletter: false,
    accountType: 'private',
    companyName: '',
    ustId: '',
  });

  // Refs for keyboard focus flow
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const nachnameRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const stadtRef = useRef<TextInput>(null);

  function patch(key: keyof FormState, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function goBack() {
    if (step > 1) {
      setStep((s) => s - 1);
    } else {
      safeBack(router);
    }
  }

  function goNext() {
    let error: string | null = null;
    if (step === 1) error = validateStep1(form);
    if (step === 2) error = validateStep2(form);
    if (error) {
      showAlert('Eingabe prüfen', error, [{ text: 'OK' }]);
      return;
    }
    setStep((s) => s + 1);
  }

  async function handleSubmit() {
    const error = validateStep3(form);
    if (error) {
      showAlert('Eingabe prüfen', error, [{ text: 'OK' }]);
      return;
    }
    setLoading(true);
    try {
      if (isSupabaseConfigured) {
        const { needsEmailConfirmation } = await signUp({
          email: form.email.trim(),
          password: form.password,
          fullName: form.accountType === 'business'
            ? form.companyName.trim()
            : `${form.vorname.trim()} ${form.nachname.trim()}`,
          phone: `+49${form.phone.replace(/\s/g, '')}`,
          plz: form.plz.trim(),
          city: form.stadt.trim(),
          role: 'customer',
          accountType: form.accountType,
          companyName: form.accountType === 'business' ? form.companyName.trim() : undefined,
          ustId: form.accountType === 'business' ? form.ustId.trim() : undefined,
        });
        // Bei aktiver E-Mail-Bestätigung existiert noch keine Session — der
        // Nutzer würde sonst in einem funktionslosen, ausgeloggten Bereich
        // landen. Stattdessen klarer Hinweis und zurück zum Login.
        if (needsEmailConfirmation) {
          showAlert(
            'Fast geschafft',
            'Wir haben dir eine Bestätigungs-E-Mail geschickt. Bitte bestätige deine Adresse und melde dich anschließend an.',
            [{ text: 'Zum Login', onPress: () => router.replace('/login') }],
          );
          return;
        }
        // Sofort eingeloggt (Confirm email aus) — Bestätigungs-Mail liegt
        // damit schon im Postfach, bevor die erste Transaktion ansteht.
        sendVerificationEmail().catch(() => { /* Gate erinnert später */ });
      } else {
        await new Promise((r) => setTimeout(r, 900));
      }
      // Wartet ein Gast-Auftrags-Entwurf, direkt zurück in den Wizard —
      // der Nutzer hat gerade genau dafür ein Konto angelegt.
      const resume = await getJobDraftResume();
      if (resume) {
        router.replace(resume.track
          ? { pathname: '/auftrag-aufgeben', params: { track: resume.track } }
          : '/auftrag-aufgeben');
      } else {
        router.replace('/(tabs)/');
      }
    } catch (err) {
      showAlert('Registrierung fehlgeschlagen', authErrorMessage(err), [{ text: 'OK' }]);
    } finally {
      setLoading(false);
    }
  }

  const stepLabel = ['Zugangsdaten', 'Persönliche Daten', 'Ihr Standort'][step - 1];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel="Zurück">
            <Ionicons name="arrow-back" size={22} color={C.ink} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Konto erstellen</Text>
            <Text style={styles.headerSub}>
              Schritt {step}/{TOTAL_STEPS} · {stepLabel}
            </Text>
          </View>
          <View style={styles.backBtn} />
        </View>

        <ProgressBar step={step} total={TOTAL_STEPS} />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ─────────────── STEP 1: Account ─────────────── */}
          {step === 1 && (
            <View>
              <Text style={styles.stepHeadline}>Zugangsdaten</Text>
              <Text style={styles.stepDesc}>
                Mit diesen Daten melden Sie sich bei Werkant an.
              </Text>

              <Field
                label="E-Mail-Adresse"
                value={form.email}
                onChange={(v) => patch('email', v)}
                placeholder="name@beispiel.de"
                keyboardType="email-address"
                autoComplete="email"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
              <Field
                label="Passwort"
                value={form.password}
                onChange={(v) => patch('password', v)}
                placeholder="Min. 8 Zeichen"
                secureTextEntry
                autoComplete="password-new"
                returnKeyType="next"
                onSubmitEditing={() => confirmRef.current?.focus()}
                inputRef={passwordRef}
                hint="Mindestens 8 Zeichen, am besten mit Zahlen und Sonderzeichen."
              />
              <Field
                label="Passwort bestätigen"
                value={form.passwordConfirm}
                onChange={(v) => patch('passwordConfirm', v)}
                placeholder="Passwort wiederholen"
                secureTextEntry
                autoComplete="password-new"
                returnKeyType="done"
                inputRef={confirmRef}
              />

              {/* Password strength mini-bar */}
              {form.password.length > 0 && (
                <View style={styles.strengthRow}>
                  {['weak', 'medium', 'strong'].map((level, i) => {
                    const len = form.password.length;
                    const active = (i === 0 && len >= 1) || (i === 1 && len >= 8) || (i === 2 && len >= 12 && /[^a-zA-Z0-9]/.test(form.password));
                    const color = i === 0 ? C.red : i === 1 ? C.amber : C.primary;
                    return (
                      <View
                        key={level}
                        style={[
                          styles.strengthBar,
                          { backgroundColor: active ? color : C.border },
                        ]}
                      />
                    );
                  })}
                  <Text style={styles.strengthLabel}>
                    {form.password.length < 8
                      ? 'Zu kurz'
                      : form.password.length < 12 || !/[^a-zA-Z0-9]/.test(form.password)
                      ? 'Mittel'
                      : 'Stark'}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ─────────────── STEP 2: Personal ─────────────── */}
          {step === 2 && (
            <View>
              <Text style={styles.stepHeadline}>Persönliche Daten</Text>
              <Text style={styles.stepDesc}>
                Ihr Name erscheint auf Auftragsbestätigungen und Bewertungen.
              </Text>

              {/* Account type toggle */}
              <View style={styles.accountTypeRow}>
                <TouchableOpacity
                  style={[styles.accountTypeBtn, form.accountType === 'private' && styles.accountTypeBtnActive]}
                  onPress={() => patch('accountType', 'private')}
                >
                  <Ionicons name="person-outline" size={16} color={form.accountType === 'private' ? C.surface : C.sub} />
                  <Text style={[styles.accountTypeBtnText, form.accountType === 'private' && { color: C.surface }]}>Privatperson</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.accountTypeBtn, form.accountType === 'business' && styles.accountTypeBtnActive]}
                  onPress={() => patch('accountType', 'business')}
                >
                  <Ionicons name="business-outline" size={16} color={form.accountType === 'business' ? C.surface : C.sub} />
                  <Text style={[styles.accountTypeBtnText, form.accountType === 'business' && { color: C.surface }]}>Unternehmen</Text>
                </TouchableOpacity>
              </View>

              {form.accountType === 'private' ? (
                <View style={styles.nameRow}>
                  <View style={styles.nameField}>
                    <Field
                      label="Vorname"
                      value={form.vorname}
                      onChange={(v) => patch('vorname', v)}
                      placeholder="Max"
                      autoComplete="given-name"
                      returnKeyType="next"
                      onSubmitEditing={() => nachnameRef.current?.focus()}
                    />
                  </View>
                  <View style={styles.nameField}>
                    <Field
                      label="Nachname"
                      value={form.nachname}
                      onChange={(v) => patch('nachname', v)}
                      placeholder="Mustermann"
                      autoComplete="family-name"
                      returnKeyType="next"
                      onSubmitEditing={() => phoneRef.current?.focus()}
                      inputRef={nachnameRef}
                    />
                  </View>
                </View>
              ) : (
                <View>
                  <Field
                    label="Firmenname"
                    value={form.companyName}
                    onChange={(v) => patch('companyName', v)}
                    placeholder="Mustermann GmbH"
                    autoComplete="organization"
                    returnKeyType="next"
                  />
                  <Field
                    label="USt-IdNr. (optional)"
                    value={form.ustId}
                    onChange={(v) => patch('ustId', v.toUpperCase())}
                    placeholder="DE123456789"
                    autoComplete="off"
                    hint="Erforderlich für Reverse-Charge (§13b UStG) bei EU-Leistungen."
                    returnKeyType="next"
                    onSubmitEditing={() => phoneRef.current?.focus()}
                  />
                </View>
              )}

              <Field
                label="Telefonnummer"
                value={form.phone}
                onChange={(v) => patch('phone', v)}
                placeholder="151 1234 5678"
                keyboardType="phone-pad"
                autoComplete="tel"
                returnKeyType="done"
                inputRef={phoneRef}
                prefix="+49"
                hint="Wird für Terminbestätigungen und Sicherheit verwendet."
              />

              <View style={styles.infoCard}>
                <Ionicons name="information-circle-outline" size={16} color={C.sub} />
                <Text style={styles.infoCardText}>
                  {form.accountType === 'business'
                    ? 'Unternehmenskunden erhalten automatisch §13b-konforme Rechnungen. Nachbarschaftshelfer sind für Firmenkunden nicht verfügbar (Scheinselbständigkeit).'
                    : 'Ihre Telefonnummer wird nicht öffentlich angezeigt und nur zur Verifizierung verwendet.'}
                </Text>
              </View>
            </View>
          )}

          {/* ─────────────── STEP 3: Location + Consent ─────────────── */}
          {step === 3 && (
            <View>
              <Text style={styles.stepHeadline}>Ihr Standort</Text>
              <Text style={styles.stepDesc}>
                Damit zeigen wir Ihnen Handwerker in Ihrer Nähe.
              </Text>

              <View style={styles.nameRow}>
                <View style={[styles.nameField, { flex: 0.45 }]}>
                  <Field
                    label="Postleitzahl"
                    value={form.plz}
                    onChange={(v) => patch('plz', v.replace(/\D/g, ''))}
                    placeholder="12345"
                    keyboardType="numeric"
                    maxLength={5}
                    autoComplete="postal-code"
                    returnKeyType="next"
                    onSubmitEditing={() => stadtRef.current?.focus()}
                  />
                </View>
                <View style={[styles.nameField, { flex: 0.55 }]}>
                  <Field
                    label="Stadt"
                    value={form.stadt}
                    onChange={(v) => patch('stadt', v)}
                    placeholder="Berlin"
                    autoComplete="address-line2"
                    returnKeyType="done"
                    inputRef={stadtRef}
                  />
                </View>
              </View>

              {/* Consent section */}
              <View style={styles.consentSection}>
                <Text style={styles.consentSectionTitle}>Einwilligungen</Text>

                <Checkbox checked={form.dsgvo} onToggle={() => patch('dsgvo', !form.dsgvo)}>
                  <Text style={styles.checkText}>
                    Ich stimme den{' '}
                    <Text style={styles.checkLink}>AGB</Text>
                    {' '}und der{' '}
                    <Text style={styles.checkLink}>Datenschutzerklärung</Text>
                    {' '}zu.{' '}
                    <Text style={styles.checkRequired}>*</Text>
                  </Text>
                </Checkbox>

                <Checkbox
                  checked={form.newsletter}
                  onToggle={() => patch('newsletter', !form.newsletter)}
                >
                  <Text style={styles.checkText}>
                    Ich möchte Neuigkeiten und Angebote von Werkant per E-Mail erhalten. (Optional)
                  </Text>
                </Checkbox>
              </View>

              <View style={styles.infoCard}>
                <Ionicons name="shield-checkmark-outline" size={16} color={C.primary} />
                <Text style={[styles.infoCardText, { color: C.primary }]}>
                  DSGVO-konform · Keine Weitergabe an Dritte · Jederzeit widerrufbar
                </Text>
              </View>
            </View>
          )}

          {/* ── Spacer ── */}
          <View style={{ height: 40 }} />
        </ScrollView>

        {/* ── Footer CTA ── */}
        <View style={styles.footer}>
          {step < TOTAL_STEPS ? (
            <TouchableOpacity style={styles.ctaBtn} onPress={goNext} activeOpacity={0.85}>
              <Text style={styles.ctaBtnText}>Weiter</Text>
              <Ionicons name="arrow-forward" size={17} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.ctaBtn, loading && styles.ctaBtnLoading]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={loading}
            >
              <Ionicons name="person-add-outline" size={17} color="#fff" />
              <Text style={styles.ctaBtnText}>
                {loading ? 'Konto wird erstellt …' : 'Konto erstellen'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.loginHint}
            onPress={() => router.push('/login')}
            activeOpacity={0.7}
          >
            <Text style={styles.loginHintText}>
              Bereits registriert?{' '}
              <Text style={styles.loginHintLink}>Einloggen</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  kav:    { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  backBtn:       { width: 36 },
  headerCenter:  { flex: 1, alignItems: 'center' },
  headerTitle:   { ...T.lg, ...T.bold, color: C.ink },
  headerSub:     { ...T.xs, color: C.sub, marginTop: 1 },

  // Progress — uses brand-dark for active segments
  progressTrack: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 20,
    gap: 6,
  },
  progressSegment:         { flex: 1, height: 3, borderRadius: 2 },
  progressSegmentActive:   { backgroundColor: C.primary },
  progressSegmentInactive: { backgroundColor: C.border },
  progressSegmentGap:      {},

  // Scroll
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 20 },

  // Step copy
  stepHeadline:  { ...T['2xl'], ...T.black, color: C.ink, marginBottom: 6 },
  stepDesc:      { ...T.body, color: C.sub, marginBottom: 24 },

  // Fields — werkr-input style
  field:          { marginBottom: 18 },
  fieldLabel:     { ...T.sm, ...T.semibold, color: C.sub, marginBottom: 7 },
  fieldInputRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, shadowColor: C.ink, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  fieldInput:     { flex: 1, ...T.base, color: C.ink, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 14 : 12 },
  fieldInputWithPrefix: { paddingLeft: 8 },
  fieldPrefix:    { paddingLeft: 14, paddingRight: 2 },
  fieldPrefixText: { ...T.base, color: C.sub, fontWeight: '500' },
  fieldEye:       { paddingHorizontal: 12 },
  fieldHint:      { ...T.caption, color: C.muted, marginTop: 6 },

  // Account type toggle (Privatperson / Unternehmen)
  accountTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  accountTypeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surface,
  },
  accountTypeBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
  accountTypeBtnText: { ...T.sm, color: C.sub, fontWeight: '600' },

  // Name row (two side-by-side)
  nameRow: { flexDirection: 'row', gap: 12 },
  nameField: { flex: 1 },

  // Strength meter
  strengthRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -8, marginBottom: 18 },
  strengthBar:   { flex: 1, height: 3, borderRadius: 2 },
  strengthLabel: { ...T.xs, color: C.sub, minWidth: 44 },

  // Info card
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  infoCardText: { flex: 1, ...T.caption, color: C.sub },

  // Consent
  consentSection:      { marginTop: 8, marginBottom: 16 },
  consentSectionTitle: { ...T.label, color: C.muted, marginBottom: 12 },
  checkRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  checkbox:    { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxChecked: { backgroundColor: C.primary, borderColor: C.primary },
  checkLabel:  { flex: 1 },
  checkText:   { ...T.sm, color: C.sub },
  checkLink:   { color: C.ink, textDecorationLine: 'underline', fontWeight: '600' },
  checkRequired: { color: C.red, fontWeight: '700' },

  // Footer — btn-werkr--primary style
  footer:        { paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg },
  ctaBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 12, paddingVertical: 15 },
  ctaBtnLoading: { opacity: 0.6 },
  ctaBtnText:    { ...T.btn, fontWeight: '600', color: C.surface },
  loginHint:     { alignItems: 'center', marginTop: 14 },
  loginHintText: { ...T.sm, color: C.sub },
  loginHintLink: { color: C.ink, fontWeight: '700', textDecorationLine: 'underline' },
});
