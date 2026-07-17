import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safeBack } from '../lib/nav';
import { C } from '../constants/colors';
import { T } from '../constants/typography';
import { supabase } from '../lib/supabase';
import { showAlert } from '../lib/alert';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    if (password.length < 8) {
      showAlert('Zu kurz', 'Das Passwort muss mindestens 8 Zeichen haben.', [{ text: 'OK' }]);
      return;
    }
    if (password !== confirm) {
      showAlert('Nicht übereinstimmend', 'Die Passwörter stimmen nicht überein.', [{ text: 'OK' }]);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      showAlert('Passwort geändert', 'Ihr neues Passwort wurde gespeichert. Bitte melden Sie sich an.', [
        { text: 'OK', onPress: () => router.replace('/login') },
      ]);
    } catch (err: unknown) {
      showAlert('Fehler', err instanceof Error ? err.message : 'Passwort konnte nicht geändert werden.', [{ text: 'OK' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zurück" onPress={() => safeBack(router)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={22} color={C.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Neues Passwort</Text>
          <View style={{ width: 22 }} />
        </View>

        <View style={styles.body}>
          <Text style={styles.headline}>Passwort zurücksetzen</Text>
          <Text style={styles.subline}>Wählen Sie ein neues Passwort mit mindestens 8 Zeichen.</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Neues Passwort</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={17} color={C.muted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPw}
                placeholder="Mindestens 8 Zeichen"
                placeholderTextColor={C.muted}
                autoComplete="new-password"
              />
              <TouchableOpacity onPress={() => setShowPw((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={17} color={C.sub} style={{ marginRight: 13 }} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Passwort bestätigen</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={17} color={C.muted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry={!showPw}
                placeholder="Passwort wiederholen"
                placeholderTextColor={C.muted}
                autoComplete="new-password"
                onSubmitEditing={handleReset}
                returnKeyType="done"
              />
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.btn, loading && styles.btnLoading]}
            onPress={handleReset}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color={C.surface} />
            <Text style={styles.btnText}>{loading ? 'Speichern …' : 'Passwort speichern'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: C.bg },
  kav:         { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  headerTitle: { ...T.body, fontWeight: '700', color: C.ink },
  body:        { flex: 1, paddingHorizontal: 22, paddingTop: 12 },
  headline:    { ...T['2xl'], fontWeight: '700', color: C.ink, marginBottom: 8 },
  subline:     { ...T.body, color: C.sub, marginBottom: 32 },
  field:       { marginBottom: 16 },
  label:       { ...T.label, color: C.sub, marginBottom: 7 },
  inputRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10 },
  inputIcon:   { paddingLeft: 13 },
  input:       { flex: 1, ...T.base, color: C.ink, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 13 : 11 },
  footer:      { paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg },
  btn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 10, paddingVertical: 15 },
  btnLoading:  { opacity: 0.6 },
  btnText:     { ...T.btn, color: C.surface },
});
