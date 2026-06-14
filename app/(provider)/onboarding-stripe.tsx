import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Switch, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Skeleton } from '../../components/ui/Skeleton';
import { showAlert } from '../../lib/alert';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/colors';
import { loadAccount, saveAccount } from '../../lib/account';

// Stripe Connect Express Onboarding (UI-Skeleton).
// Backend liefert später die account_link URL:
//   POST /api/stripe/connect → { onboarding_url }
// Auszahlungen laufen über destination charges mit
// application_fee_amount = 8% (siehe ADR-0004).

export default function OnboardingStripe() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isBusiness, setIsBusiness] = useState(false);
  const [vatId, setVatId] = useState('');
  const [onboarded, setOnboarded] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    loadAccount().then((acc) => {
      setIsBusiness(acc.isBusinessUser);
      setVatId(acc.vatId ?? '');
      setOnboarded(acc.stripeOnboarded);
      setLoading(false);
    });
  }, []);

  async function handleStart() {
    if (isBusiness && vatId.trim() && !/^DE[0-9]{9}$/.test(vatId.trim())) {
      showAlert('USt-IdNr. prüfen', 'Format: DE + 9 Ziffern (z. B. DE123456789).');
      return;
    }
    setRedirecting(true);
    await saveAccount({
      isBusinessUser: isBusiness,
      vatId: isBusiness && vatId.trim() ? vatId.trim() : null,
    });
    // NOT IMPLEMENTED: stripeOnboarded darf nur per Stripe-Webhook
    // (account.updated, charges_enabled=true) gesetzt werden — ADR-0004.
    // Kein optimistisches Setzen ohne Backend-Bestätigung (C-1).
    setRedirecting(false);
    showAlert(
      'Stripe Connect',
      'Die Stripe-Anbindung wird im Beta-Testbetrieb vorbereitet. Sie erhalten eine E-Mail sobald Ihr Konto aktiviert ist und Auszahlungen empfangen kann.',
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={{ width: 24 }} />
          <Skeleton width={110} height={17} radius={8} />
          <View style={{ width: 24 }} />
        </View>
        <View style={{ padding: 20, paddingTop: 6, gap: 14 }}>
          <View style={{ backgroundColor: '#ffffff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', padding: 16, gap: 12 }}>
            <Skeleton width="40%" height={13} radius={6} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Skeleton width="55%" height={13} radius={6} />
              <Skeleton width={48} height={28} radius={14} />
            </View>
          </View>
          <View style={{ backgroundColor: '#ffffff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', padding: 16, gap: 14 }}>
            <Skeleton width="45%" height={13} radius={6} />
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <Skeleton width={18} height={18} radius={9} />
                <Skeleton height={13} radius={6} style={{ flex: 1 }} />
              </View>
            ))}
          </View>
          <Skeleton height={50} radius={12} />
          <Skeleton width="70%" height={11} radius={6} style={{ alignSelf: 'center' }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Auszahlungen</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {onboarded ? (
          <View style={styles.card}>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: C.green }]} />
              <Text style={styles.statusText}>Auszahlungskonto aktiv</Text>
            </View>
            <Text style={styles.bodyText}>
              Dein Stripe-Konto ist verbunden. Auszahlungen erfolgen automatisch
              2 Werktage nach Auftragsabschluss — abzüglich 8% Plattformgebühr.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Konto-Typ</Text>
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>Ich bin Unternehmer:in</Text>
                  <Text style={styles.switchSub}>
                    Gewerbe oder freiberuflich mit Steuernummer
                  </Text>
                </View>
                <Switch
                  value={isBusiness}
                  onValueChange={setIsBusiness}
                  trackColor={{ false: C.border, true: C.ink }}
                  thumbColor={C.surface}
                />
              </View>
              {isBusiness && (
                <>
                  <View style={styles.sep} />
                  <Text style={styles.label}>USt-IdNr. (optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={vatId}
                    onChangeText={setVatId}
                    placeholder="DE123456789"
                    placeholderTextColor={C.muted}
                    autoCapitalize="characters"
                  />
                </>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>So funktioniert's</Text>
              <InfoRow icon="shield-checkmark-outline"
                text="Sichere Abwicklung über Stripe Connect — WERKR speichert keine Bankdaten." />
              <InfoRow icon="lock-closed-outline"
                text="Zahlung des Kunden wird treuhänderisch gehalten, bis der Auftrag abgeschlossen ist." />
              <InfoRow icon="cash-outline"
                text="Auszahlung abzüglich 8% Plattformgebühr, automatisch auf dein Bankkonto." />
              <InfoRow icon="document-text-outline"
                text={isBusiness
                  ? 'Du erhältst eine Gebührenrechnung mit ausgewiesener USt.'
                  : 'Plattformgebühr inkl. 19% USt. — Beleg in der App abrufbar.'} />
            </View>

            <TouchableOpacity
              style={[styles.cta, redirecting && { opacity: 0.6 }]}
              onPress={handleStart}
              disabled={redirecting}
              activeOpacity={0.85}
            >
              {redirecting
                ? <ActivityIndicator color={C.surface} />
                : <Text style={styles.ctaText}>Mit Stripe verbinden</Text>}
            </TouchableOpacity>
            <Text style={styles.footnote}>
              Du wirst zu Stripe weitergeleitet, um Identität und Bankkonto zu
              bestätigen (gesetzlich vorgeschrieben nach GwG — Geldwäschegesetz).
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={C.sub} style={{ marginTop: 1 }} />
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  title: { fontSize: 17, fontWeight: '700', color: C.ink },
  scroll: { padding: 20, paddingTop: 6, gap: 14 },
  card: {
    backgroundColor: C.surface, borderRadius: 14, borderWidth: 1,
    borderColor: C.border, padding: 16,
  },
  cardTitle: { fontSize: 13, fontWeight: '700', color: C.ink, marginBottom: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchLabel: { fontSize: 14, fontWeight: '600', color: C.ink },
  switchSub: { fontSize: 12, color: C.sub, marginTop: 2 },
  sep: { height: 1, backgroundColor: C.border, marginVertical: 14 },
  label: { fontSize: 12, fontWeight: '600', color: C.sub, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: C.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.ink,
    backgroundColor: C.bg,
  },
  infoRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  infoText: { flex: 1, fontSize: 13, color: C.sub, lineHeight: 19 },
  cta: {
    backgroundColor: C.ink, borderRadius: 12, paddingVertical: 15,
    alignItems: 'center',
  },
  ctaText: { color: C.surface, fontSize: 15, fontWeight: '700' },
  footnote: { fontSize: 11, color: C.muted, textAlign: 'center', lineHeight: 16 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 14, fontWeight: '700', color: C.ink },
  bodyText: { fontSize: 13, color: C.sub, lineHeight: 19 },
});
