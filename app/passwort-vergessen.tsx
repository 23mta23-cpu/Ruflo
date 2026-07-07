import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  KeyboardAvoidingView, Platform, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { C } from '../constants/colors';
import { supabase } from '../lib/supabase';
import { showAlert } from '../lib/alert';

export default function PasswortVergessenScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSend() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes('@')) {
      showAlert('Ungültige E-Mail', 'Bitte geben Sie eine gültige E-Mail-Adresse ein.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: 'werkr://reset-password',
    });
    setLoading(false);
    if (error) {
      showAlert('Fehler', error.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <Ionicons name="mail-outline" size={36} color={C.primary} />
          </View>
          <Text style={styles.successTitle}>E-Mail gesendet!</Text>
          <Text style={styles.successSub}>
            Wir haben einen Reset-Link an{'\n'}
            <Text style={{ fontWeight: '600', color: C.ink }}>{email.trim()}</Text>
            {'\n'}gesendet. Bitte prüfen Sie Ihren Posteingang.
          </Text>
          <Text style={styles.expiry}>Der Link ist 30 Minuten gültig.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/login')} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Zurück zur Anmeldung</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSent(false)} activeOpacity={0.75}>
            <Text style={styles.retryLink}>Andere E-Mail-Adresse eingeben</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Nav header */}
        <View style={styles.navRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={C.ink} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Passwort zurücksetzen</Text>
        </View>

        <View style={styles.body}>
          <Text style={styles.instruction}>
            Geben Sie Ihre E-Mail-Adresse ein. Wir senden Ihnen einen sicheren Reset-Link.
          </Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>E-Mail-Adresse</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="max@mustermann.de"
              placeholderTextColor={C.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
            onPress={handleSend}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <Text style={styles.primaryBtnText}>Senden…</Text>
              : <Text style={styles.primaryBtnText}>Reset-Link senden</Text>
            }
          </TouchableOpacity>

          <Text style={styles.hint}>Der Link ist 30 Minuten gültig.</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: C.bg },
  navRow:            { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, paddingHorizontal: 20, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn:           { width: 34, height: 34, borderRadius: 10, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  navTitle:          { fontSize: 16, fontWeight: '700', color: C.ink },
  body:              { flex: 1, padding: 24, paddingTop: 32 },
  instruction:       { fontSize: 14, color: C.sub, lineHeight: 22, marginBottom: 28 },
  field:             { marginBottom: 20 },
  fieldLabel:        { fontSize: 13, fontWeight: '600', color: C.ink, marginBottom: 7 },
  input:             { backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, color: C.ink },
  primaryBtn:        { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  primaryBtnDisabled:{ opacity: 0.6 },
  primaryBtnText:    { fontSize: 15, fontWeight: '700', color: C.surface },
  hint:              { marginTop: 14, textAlign: 'center', fontSize: 12, color: C.muted },
  successWrap:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  successIcon:       { width: 80, height: 80, borderRadius: 40, backgroundColor: C.primaryBg, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  successTitle:      { fontSize: 22, fontWeight: '600', color: C.ink, textAlign: 'center' },
  successSub:        { fontSize: 14, color: C.sub, textAlign: 'center', lineHeight: 22 },
  expiry:            { fontSize: 12, color: C.muted, marginTop: 4 },
  retryLink:         { fontSize: 12, color: C.muted, marginTop: 8 },
});
