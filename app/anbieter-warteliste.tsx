/**
 * Anbieter-Warteliste — Beta-Onboarding-Modell für Anbieter (Köln-Start).
 *
 * Entscheidung notes/04-Entscheidungen/Provider-Onboarding-Auth-Luecke.md:
 * Anbieter-Selbstregistrierung ist im Beta bewusst NICHT frei — Anbieter
 * tragen sich hier ein, das Team meldet sich persönlich (manuelles Vetting,
 * passt zur Kölner Akquise + zum "24h-Prüfung"-Versprechen). Der KYC-Flow
 * bleibt eingeloggten (eingeladenen) Anbietern vorbehalten.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { C } from '../constants/colors';
import { AnimatedButton } from '../components/ui/AnimatedButton';
import { Reveal } from '../components/ui/Reveal';
import { joinWaitlist } from '../lib/waitlist';
import { CATEGORIES } from '../data/categories';
import { trackEvent, trackError } from '../lib/analytics';
import { showAlert } from '../lib/alert';

const GEWERKE = CATEGORIES.filter((c) => c.active).map((c) => ({ id: c.id, name: c.name }));

export default function AnbieterWartelisteScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [plz, setPlz] = useState('');
  const [gewerk, setGewerk] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      showAlert('Eingabe prüfen', 'Bitte gültige E-Mail-Adresse eingeben.', [{ text: 'OK' }]);
      return;
    }
    if (!/^\d{5}$/.test(plz.trim())) {
      showAlert('Eingabe prüfen', 'Bitte gültige Postleitzahl (5 Ziffern) eingeben.', [{ text: 'OK' }]);
      return;
    }
    setSending(true);
    try {
      await joinWaitlist({
        email: email.trim(),
        city: 'Deutschland',
        plz: plz.trim(),
        // Gewerk in source kodieren — Warteliste hat bewusst keine Extra-Spalte
        source: gewerk ? `anbieter:${gewerk}` : 'anbieter',
      });
      trackEvent('provider_waitlist_joined', { gewerk: gewerk || 'none' });
      setDone(true);
    } catch (err) {
      trackError('provider_waitlist');
      showAlert(
        'Das hat nicht geklappt',
        'Ihre Anmeldung konnte nicht gespeichert werden. Bitte versuchen Sie es in Kürze erneut.',
        [{ text: 'OK' }],
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zurück" onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={22} color={C.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Anbieter werden</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {done ? (
            <Reveal>
              <View style={styles.doneCard}>
                <View style={styles.doneIcon}>
                  <Ionicons name="checkmark" size={30} color={C.primary} />
                </View>
                <Text style={styles.doneTitle}>Sie stehen auf der Liste!</Text>
                <Text style={styles.doneText}>
                  Wir melden uns persönlich bei Ihnen — mit Ihren Zugangsdaten und einem
                  kurzen Onboarding. Die ersten 20 Kölner Betriebe erhalten Gründer-Konditionen.
                </Text>
                <TouchableOpacity style={styles.doneBtn} onPress={() => router.replace('/landing')} activeOpacity={0.8}>
                  <Text style={styles.doneBtnText}>Zurück zur Startseite</Text>
                </TouchableOpacity>
              </View>
            </Reveal>
          ) : (
            <>
              <Reveal delay={40}>
                <Text style={styles.headline}>Aufträge aus Ihrem Veedel.</Text>
                <Text style={styles.subline}>
                  Werkant startet deutschlandweit mit einer handverlesenen Anbieter-Runde.
                  Tragen Sie sich ein — wir melden uns persönlich innerhalb von 48 Stunden.
                </Text>
              </Reveal>

              <Reveal delay={90}>
                <View style={styles.valueCard}>
                  {[
                    ['pricetag-outline', '8 % Provision — nur bei erfolgreichem Auftrag, keine Lead-Gebühren'],
                    ['lock-closed-outline', 'Escrow: Ihr Geld ist gesichert, bevor Sie anfahren'],
                    ['shield-checkmark-outline', 'Verifizierte Profile — Qualität statt Preiskampf'],
                  ].map(([icon, text]) => (
                    <View key={text} style={styles.valueRow}>
                      <Ionicons name={icon as any} size={17} color={C.primary} />
                      <Text style={styles.valueText}>{text}</Text>
                    </View>
                  ))}
                </View>
              </Reveal>

              <Reveal delay={140}>
                <Text style={styles.fieldLabel}>E-Mail-Adresse</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="max@betrieb.de"
                  placeholderTextColor={C.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Text style={styles.fieldLabel}>Postleitzahl</Text>
                <TextInput
                  style={styles.input}
                  value={plz}
                  onChangeText={(v) => setPlz(v.replace(/\D/g, ''))}
                  placeholder="50667"
                  placeholderTextColor={C.muted}
                  keyboardType="numeric"
                  maxLength={5}
                />
                <Text style={styles.fieldLabel}>Ihr Gewerk / Ihre Tätigkeit <Text style={styles.optional}>(optional)</Text></Text>
                <View style={styles.chipWrap}>
                  {GEWERKE.map((g) => {
                    const active = gewerk === g.id;
                    return (
                      <TouchableOpacity
                        key={g.id}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setGewerk(active ? '' : g.id)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{g.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Reveal>

              <Reveal delay={190}>
                <AnimatedButton style={styles.cta} onPress={handleSubmit} disabled={sending}>
                  <Text style={styles.ctaText}>{sending ? 'Wird gesendet …' : 'Auf die Anbieter-Liste'}</Text>
                  {!sending && <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />}
                </AnimatedButton>
                <TouchableOpacity style={styles.loginRow} onPress={() => router.push('/login')} activeOpacity={0.7}>
                  <Text style={styles.loginText}>Bereits eingeladen? </Text>
                  <Text style={styles.loginLink}>Einloggen</Text>
                </TouchableOpacity>
              </Reveal>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: C.bg },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn:     { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: C.ink },
  scroll:      { paddingHorizontal: 22, paddingBottom: 40 },

  headline:    { fontSize: 26, fontWeight: '700', color: C.ink, letterSpacing: -0.4, marginTop: 8, marginBottom: 8 },
  subline:     { fontSize: 14, lineHeight: 21, color: C.sub, marginBottom: 18 },

  valueCard:   { backgroundColor: C.primaryBg, borderRadius: 14, padding: 16, gap: 12, marginBottom: 22 },
  valueRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  valueText:   { flex: 1, fontSize: 13, lineHeight: 19, color: C.ink, fontWeight: '500' },

  fieldLabel:  { fontSize: 12, fontWeight: '700', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  optional:    { color: C.muted, textTransform: 'none', fontWeight: '500' },
  input:       { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.ink, marginBottom: 16 },

  chipWrap:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 22 },
  chip:        { paddingHorizontal: 12, paddingVertical: 8, minHeight: 44, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  chipActive:  { backgroundColor: C.primary, borderColor: C.primary },
  chipText:    { fontSize: 12.5, color: C.sub, fontWeight: '600' },
  chipTextActive: { color: C.surface },

  cta:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16 },
  ctaText:     { fontSize: 15, fontWeight: '700', color: C.surface },
  loginRow:    { flexDirection: 'row', justifyContent: 'center', marginTop: 18 },
  loginText:   { fontSize: 13.5, color: C.sub },
  loginLink:   { fontSize: 13.5, color: C.primary, fontWeight: '700', textDecorationLine: 'underline' },

  doneCard:    { alignItems: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 28, marginTop: 24 },
  doneIcon:    { width: 64, height: 64, borderRadius: 32, backgroundColor: C.primaryBg, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  doneTitle:   { fontSize: 19, fontWeight: '700', color: C.ink, marginBottom: 8 },
  doneText:    { fontSize: 14, lineHeight: 21, color: C.sub, textAlign: 'center', marginBottom: 20 },
  doneBtn:     { backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 12 },
  doneBtnText: { fontSize: 14, fontWeight: '700', color: C.surface },
});
