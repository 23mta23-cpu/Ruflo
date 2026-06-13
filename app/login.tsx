"use client";
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
import { C } from '../constants/colors';
import { showAlert } from '../lib/alert';

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<'kunde' | 'anbieter'>('kunde');
  const [loading, setLoading] = useState(false);

  const passwordRef = useRef<TextInput>(null);

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
    // Replace with Supabase auth.signInWithPassword()
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    if (mode === 'anbieter') {
      router.replace('/(provider)/');
    } else {
      router.replace('/(tabs)/');
    }
  }

  function handleForgotPassword() {
    showAlert(
      'Passwort zurücksetzen',
      'Wir senden Ihnen einen Reset-Link an Ihre E-Mail-Adresse.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Link senden',
          onPress: () =>
            showAlert('E-Mail gesendet', 'Prüfen Sie Ihren Posteingang.', [{ text: 'OK' }]),
        },
      ],
    );
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
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={22} color={C.ink} />
          </TouchableOpacity>
          <View style={styles.logoRow}>
            <View style={styles.logoMark}>
              <Ionicons name="hammer" size={16} color={C.gold} />
            </View>
            <Text style={styles.logoText}>WERKR</Text>
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

          {/* ── Mode toggle ── */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'kunde' && styles.modeBtnActive]}
              onPress={() => setMode('kunde')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="home-outline"
                size={14}
                color={mode === 'kunde' ? C.ink : C.muted}
              />
              <Text style={[styles.modeBtnText, mode === 'kunde' && styles.modeBtnTextActive]}>
                Als Kunde
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'anbieter' && styles.modeBtnActive]}
              onPress={() => setMode('anbieter')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="construct-outline"
                size={14}
                color={mode === 'anbieter' ? C.ink : C.muted}
              />
              <Text style={[styles.modeBtnText, mode === 'anbieter' && styles.modeBtnTextActive]}>
                Als Anbieter
              </Text>
            </TouchableOpacity>
          </View>

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

          {/* ── Social login placeholders ── */}
          <TouchableOpacity
            style={styles.socialBtn}
            activeOpacity={0.8}
            onPress={() =>
              showAlert('Bald verfügbar', 'Apple-Login wird in Kürze unterstützt.', [{ text: 'OK' }])
            }
          >
            <Ionicons name="logo-apple" size={18} color={C.ink} />
            <Text style={styles.socialBtnText}>Mit Apple anmelden</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.socialBtn}
            activeOpacity={0.8}
            onPress={() =>
              showAlert('Bald verfügbar', 'Google-Login wird in Kürze unterstützt.', [{ text: 'OK' }])
            }
          >
            <Ionicons name="logo-google" size={18} color={C.sub} />
            <Text style={styles.socialBtnText}>Mit Google anmelden</Text>
          </TouchableOpacity>

          {/* ── Register CTA ── */}
          <TouchableOpacity
            style={styles.registerRow}
            onPress={() => router.push('/onboarding')}
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
  logoText: { fontSize: 18, fontWeight: '800', color: C.ink, letterSpacing: 2 },

  // Copy
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 20 },
  headline:      { fontSize: 26, fontWeight: '800', color: C.ink, marginBottom: 6 },
  subline:       { fontSize: 14, color: C.sub, marginBottom: 28 },

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
  modeBtnActive:    { backgroundColor: C.bg, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  modeBtnText:      { fontSize: 13, color: C.muted, fontWeight: '500' },
  modeBtnTextActive: { color: C.ink, fontWeight: '700' },

  // Fields
  field:          { marginBottom: 16 },
  fieldLabelRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  fieldLabel:     { fontSize: 12, fontWeight: '600', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.5 },
  forgotLink:     { fontSize: 12, color: C.ink, fontWeight: '600', textDecorationLine: 'underline' },
  fieldInputRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border, borderRadius: 12 },
  fieldIcon:      { paddingLeft: 13 },
  fieldInput:     { flex: 1, fontSize: 15, color: C.ink, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 13 : 11 },
  fieldEye:       { paddingHorizontal: 12 },

  // Divider
  dividerRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerText: { fontSize: 12, color: C.muted, fontWeight: '500' },

  // Social
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingVertical: 13,
    marginBottom: 12,
  },
  socialBtnText: { fontSize: 14, fontWeight: '600', color: C.ink },

  // Register
  registerRow:  { alignItems: 'center', marginTop: 12 },
  registerText: { fontSize: 13, color: C.sub },
  registerLink: { color: C.ink, fontWeight: '700', textDecorationLine: 'underline' },

  // Footer
  footer:         { paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg },
  loginBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.ink, borderRadius: 14, paddingVertical: 15 },
  loginBtnLoading: { opacity: 0.6 },
  loginBtnText:   { fontSize: 15, fontWeight: '700', color: '#fff' },
});
