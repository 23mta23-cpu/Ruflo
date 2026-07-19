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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safeBack, resetTo } from '../lib/nav';
import { C } from '../constants/colors';
import { T } from '../constants/typography';
import { showAlert } from '../lib/alert';
import { isSupabaseConfigured } from '../lib/supabase';
import { signIn, resetPassword, authErrorMessage, signInWithProvider, type OAuthProvider } from '../lib/auth';
import { useAuth } from '../contexts/AuthContext';
import { getJobDraftResume } from '../lib/jobDraft';
import { BrandMark } from '../components/ui/BrandMark';
import { trackEvent, trackError } from '../lib/analytics';

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordRef = useRef<TextInput>(null);
  const { user: authUser, role: authRole, loading: authLoading } = useAuth();
  const postAuthHandled = useRef(false);

  // OAuth-Rücksprung (Web): Supabase hängt Fehler als URL-Parameter an
  // (abgebrochener/fehlgeschlagener Provider-Login). Einmal anzeigen und
  // die URL bereinigen, damit ein Reload den Fehler nicht wiederholt.
  React.useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const params = new URLSearchParams(
      window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.search,
    );
    const desc = params.get('error_description') ?? (params.get('error') ? 'Anmeldung abgebrochen.' : null);
    if (desc) {
      showAlert('Anmeldung nicht abgeschlossen', desc.replace(/\+/g, ' '), [{ text: 'OK' }]);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  // Nach erfolgreichem OAuth-Rücksprung ist die Session schon da, wenn dieser
  // Screen (wieder) rendert — dieselbe Weiterleitung wie nach Passwort-Login,
  // mit Stack-Reset (alte Wizard-Instanz darf nicht im Verlauf bleiben).
  React.useEffect(() => {
    if (authLoading || !authUser || loading || postAuthHandled.current) return;
    postAuthHandled.current = true;
    (async () => {
      const effectiveRole = authRole ?? 'customer';
      const resume = effectiveRole !== 'provider' ? await getJobDraftResume() : null;
      if (resume) {
        resetTo(router, resume.track
          ? { pathname: '/auftrag-aufgeben', params: { track: resume.track } }
          : '/auftrag-aufgeben');
      } else {
        resetTo(router, effectiveRole === 'provider' ? '/(provider)/dashboard' : '/(tabs)/');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, authUser, authRole, loading]);

  async function handleSocialLogin(provider: OAuthProvider) {
    trackEvent('login_started', { provider });
    try {
      await signInWithProvider(provider);
      // Web: Seite navigiert jetzt zum Provider — kein weiterer Code läuft.
    } catch (err) {
      trackError('login_oauth');
      showAlert('Anmeldung fehlgeschlagen', authErrorMessage(err), [{ text: 'OK' }]);
    }
  }

  function validate(): string | null {
    if (!email.trim()) return 'Bitte E-Mail-Adresse eingeben.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Ungültige E-Mail-Adresse.';
    if (!password) return 'Bitte Passwort eingeben.';
    return null;
  }

  async function handleLogin() {
    const error = validate();
    if (error) {
      showAlert('Eingabe prüfen', error, [{ text: 'OK' }]);
      return;
    }
    setLoading(true);
    trackEvent('login_started');
    try {
      if (isSupabaseConfigured) {
        const { role } = await signIn(email.trim(), password);
        // EIN Login für alle Rollen (19.07.) — die Rolle kommt aus dem Profil.
        const effectiveRole = role ?? 'customer';
        trackEvent('login_completed', { role: effectiveRole });
        // Wartet ein Gast-Auftrags-Entwurf, direkt zurück in den Wizard statt
        // auf Home — sonst muss der Nutzer „Auftrag aufgeben" von Hand
        // wiederfinden (Reise-1-Restfriktion). Anbieter-Login hat Vorrang.
        // Stack-Reset statt replace: unter dem Login liegt sonst noch die
        // alte Wizard-Instanz („Schritt 4 von 4") und taucht bei Zurück auf.
        postAuthHandled.current = true;
        const resume = effectiveRole !== 'provider' ? await getJobDraftResume() : null;
        if (resume) {
          resetTo(router, resume.track
            ? { pathname: '/auftrag-aufgeben', params: { track: resume.track } }
            : '/auftrag-aufgeben');
        } else {
          resetTo(router, effectiveRole === 'provider' ? '/(provider)/dashboard' : '/(tabs)/');
        }
      } else {
        await new Promise((r) => setTimeout(r, 800));
        resetTo(router, '/(tabs)/');
      }
    } catch (err) {
      trackError('login');
      showAlert('Anmeldung fehlgeschlagen', authErrorMessage(err), [{ text: 'OK' }]);
    } finally {
      setLoading(false);
    }
  }

  function handleForgotPassword() {
    router.push({
      pathname: '/passwort-vergessen',
      params: email.trim() ? { email: email.trim() } : {},
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => safeBack(router)}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={22} color={C.ink} />
          </TouchableOpacity>
          <View style={styles.logoRow}>
            <View style={styles.logoMark}>
              <BrandMark size={18} variant="light" />
            </View>
            <Text style={styles.logoText}>werkant</Text>
          </View>
          <View style={styles.backBtn} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Welcome ── */}
          <Text style={styles.headline}>Willkommen zurück</Text>
          <Text style={styles.subline}>Melden Sie sich an, um fortzufahren.</Text>

          {/* ── Email ── */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>E-Mail-Adresse</Text>
            <View style={styles.fieldInputRow}>
              <Ionicons name="mail-outline" size={17} color={C.muted} style={styles.fieldIcon} />
              <TextInput
                style={styles.fieldInput}
                value={email}
                onChangeText={setEmail}
                placeholder="name@beispiel.de"
                placeholderTextColor={C.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            </View>
          </View>

          {/* ── Password ── */}
          <View style={styles.field}>
            <View style={styles.fieldLabelRow}>
              <Text style={styles.fieldLabel}>Passwort</Text>
              <TouchableOpacity onPress={handleForgotPassword} activeOpacity={0.7}>
                <Text style={styles.forgotLink}>Vergessen?</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.fieldInputRow}>
              <Ionicons name="lock-closed-outline" size={17} color={C.muted} style={styles.fieldIcon} />
              <TextInput
                ref={passwordRef}
                style={styles.fieldInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Ihr Passwort"
                placeholderTextColor={C.muted}
                secureTextEntry={!showPassword}
                autoComplete="password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity
                style={styles.fieldEye}
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={17}
                  color={C.sub}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Divider ── */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>oder</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* ── Social login (Supabase OAuth; Web = Redirect-Flow) ── */}
          <TouchableOpacity
            style={styles.socialBtn}
            activeOpacity={0.8}
            onPress={() => handleSocialLogin('apple')}
          >
            <Ionicons name="logo-apple" size={18} color={C.ink} />
            <Text style={styles.socialBtnText}>Mit Apple anmelden</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.socialBtn}
            activeOpacity={0.8}
            onPress={() => handleSocialLogin('google')}
          >
            <Ionicons name="logo-google" size={18} color={C.sub} />
            <Text style={styles.socialBtnText}>Mit Google anmelden</Text>
          </TouchableOpacity>

          {/* ── Register CTA ── */}
          <TouchableOpacity
            style={styles.registerRow}
            onPress={() => router.push('/registrierung')}
            activeOpacity={0.7}
          >
            <Text style={styles.registerText}>
              Noch kein Konto?{' '}
              <Text style={styles.registerLink}>Jetzt registrieren</Text>
            </Text>
          </TouchableOpacity>

          <View style={{ height: 20 }} />
        </ScrollView>

        {/* ── Footer CTA ── */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnLoading]}
            onPress={handleLogin}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading ? (
              <Text style={styles.loginBtnText}>Einloggen …</Text>
            ) : (
              <>
                <Ionicons name="log-in-outline" size={18} color="#fff" />
                <Text style={styles.loginBtnText}>Einloggen</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  kav:  { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backBtn:  { width: 36 },
  logoRow:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  logoMark: { width: 30, height: 30, borderRadius: 8, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center' },
  logoText: { ...T.lg, fontWeight: '700', color: C.ink, letterSpacing: 2 },

  // Copy
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 20 },
  headline:      { ...T['2xl'], ...T.black, color: C.ink, marginBottom: 6 },
  subline:       { ...T.body, color: C.sub, marginBottom: 28 },

  // Mode toggle
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 4,
    marginBottom: 28,
  },
  modeBtn:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 9 },
  modeBtnActive:    { backgroundColor: C.bg, shadowColor: C.ink, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  modeBtnText:      { ...T.sm, ...T.medium, color: C.muted },
  modeBtnTextActive: { color: C.ink, fontWeight: '700' },

  // Fields
  field:          { marginBottom: 16 },
  fieldLabelRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  fieldLabel:     { ...T.label, color: C.sub },
  forgotLink:     { ...T.xs, ...T.semibold, color: C.ink, textDecorationLine: 'underline' },
  fieldInputRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10 },
  fieldIcon:      { paddingLeft: 13 },
  fieldInput:     { flex: 1, ...T.base, color: C.ink, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 13 : 11 },
  fieldEye:       { paddingHorizontal: 12 },

  // Divider
  dividerRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerText: { ...T.xs, ...T.medium, color: C.muted },

  // Social
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingVertical: 13,
    marginBottom: 12,
  },
  socialBtnText: { ...T.body, ...T.semibold, color: C.ink },

  // Register
  registerRow:  { alignItems: 'center', marginTop: 12 },
  registerText: { ...T.sm, color: C.sub },
  registerLink: { color: C.primary, fontWeight: '700', textDecorationLine: 'underline' },

  // Footer
  footer:         { paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg },
  loginBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 10, paddingVertical: 15, shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 3 },
  loginBtnLoading: { opacity: 0.6 },
  loginBtnText:   { ...T.btn, color: C.surface },
});
