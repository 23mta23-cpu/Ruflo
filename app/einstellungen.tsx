import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Switch, StyleSheet, Linking, Platform, Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { safeBack } from '../lib/nav';
import { showAlert } from '../lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { C } from '../constants/colors';
import { T } from '../constants/typography';
import { Reveal } from '../components/ui/Reveal';
import { toast } from '../components/ui/Toast';
import { supabase } from '../lib/supabase';
import { invalidateConsentCache } from '../lib/analytics';
import { sendVerificationEmail, verificationMailErrorText } from '../lib/auth';
import { registerForPushNotificationsAsync, unregisterPushToken } from '../lib/notifications';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

const PREFS_KEY = 'werkr_prefs_v1';

/**
 * Einstellungen im ruhigen "Grouped Settings"-Stil (Founder-Referenz 13.07.,
 * gleiche Formensprache wie app/(tabs)/konto.tsx): betitelte Gruppen-Karten,
 * Icon-Chips, dezente Separatoren, sanfte Reveal-Staffelung.
 */

interface RowProps {
  icon: string;
  label: string;
  onPress?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
}

function Row({ icon, label, onPress, right, danger }: RowProps) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={onPress ? 0.6 : 1} disabled={!onPress}>
      <View style={[styles.iconChip, danger && styles.iconChipDanger]}>
        <Ionicons name={icon as any} size={16} color={danger ? C.red : C.sub} />
      </View>
      <Text style={[styles.rowLabel, danger && { color: C.red, fontWeight: '600' }]}>{label}</Text>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={16} color={C.muted} /> : null)}
    </TouchableOpacity>
  );
}

export default function Einstellungen() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState(false);
  const [pushNotifs, setPushNotifs] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(PREFS_KEY).then((raw) => {
      if (!raw) return;
      try {
        const p = JSON.parse(raw) as { analytics?: boolean; pushNotifs?: boolean };
        if (typeof p.analytics === 'boolean') setAnalytics(p.analytics);
        if (typeof p.pushNotifs === 'boolean') setPushNotifs(p.pushNotifs);
      } catch { /* ignore corrupt prefs */ }
    });
  }, []);

  function savePrefs(patch: { analytics?: boolean; pushNotifs?: boolean }): Promise<void> {
    return AsyncStorage.getItem(PREFS_KEY).then((raw) => {
      const current = raw ? (JSON.parse(raw) as object) : {};
      return AsyncStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, ...patch }));
    });
  }

  function handleAnalytics(v: boolean) { setAnalytics(v); savePrefs({ analytics: v }); invalidateConsentCache(); }
  function handlePushNotifs(v: boolean) {
    setPushNotifs(v);
    // Serverseitig durchsetzen: Token löschen bzw. neu registrieren —
    // sonst sendet send-push trotz abgeschaltetem Toggle weiter.
    // Erst Präferenz persistieren (registerPushToken liest sie).
    savePrefs({ pushNotifs: v }).then(() => {
      if (v) registerForPushNotificationsAsync().catch(() => {});
      else unregisterPushToken().catch(() => {});
    });
  }

  async function handleDeleteAccount() {
    showAlert(
      'Konto löschen',
      'Alle persönlichen Daten werden gemäß Art. 17 DSGVO pseudonymisiert. Finanzbelege (Aufträge, Verträge) bleiben aus steuerlichen Gründen 10 Jahre erhalten (HGB §238). Aktive Aufträge müssen zuerst abgeschlossen werden.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Endgültig löschen',
          style: 'destructive',
          onPress: async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
              await AsyncStorage.clear();
              router.replace('/landing');
              return;
            }
            const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
            });
            const body = await res.json();
            if (!res.ok) {
              showAlert('Löschung fehlgeschlagen', body.error ?? 'Bitte wende dich an support@werkant.de');
              return;
            }
            await supabase.auth.signOut();
            await AsyncStorage.clear();
            router.replace('/landing');
          },
        },
      ],
    );
  }

  // E-Mail-Bestätigung: ohne sie sperrt die RLS-Gate-Funktion das Aufgeben von
  // Aufträgen und das Abgeben von Angeboten. Kam die DOI-Mail nie an, war der
  // Nutzer bisher dauerhaft blockiert — es gab keinen Weg, sie erneut
  // anzufordern (Founder-Feedback 26.07.). Die Edge Function verify-email
  // erzeugt bei POST einen frischen Token und verschickt die Mail neu.
  async function handleResendVerification() {
    if (resending) return;
    setResending(true);
    try {
      // Eine Quelle: sendVerificationEmail() kennt den Endpunkt und die
      // Fehlerübersetzung. Vorher lag hier eine Kopie aus fetch + Magic-String
      // „Mail service not configured" — derselbe String an drei Stellen.
      await sendVerificationEmail();
      toast.info('Bestätigungs-E-Mail verschickt — bitte auch den Spam-Ordner prüfen');
    } catch (e) {
      if (e instanceof Error && e.message === 'Nicht eingeloggt') {
        showAlert('Nicht angemeldet', 'Bitte melde dich an, um die Bestätigungs-E-Mail anzufordern.');
      } else {
        showAlert('Senden fehlgeschlagen', verificationMailErrorText(e));
      }
    } finally {
      setResending(false);
    }
  }

  // Art. 20 DSGVO: kompletter Datenexport über die export-my-data Edge
  // Function (JWT-auth, ratenlimitiert). Web: direkter JSON-Download;
  // Native: System-Share-Sheet (Datei-Download gibt es dort nicht).
  async function handleExportData() {
    if (exporting) return;
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showAlert('Nicht angemeldet', 'Bitte melden Sie sich an, um Ihre Daten zu exportieren.');
        return;
      }
      const res = await fetch(`${SUPABASE_URL}/functions/v1/export-my-data`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.status === 429) {
        showAlert('Zu viele Anfragen', 'Der Datenexport ist auf wenige Abrufe pro Stunde begrenzt. Bitte versuchen Sie es später erneut.');
        return;
      }
      if (!res.ok) throw new Error(`Export fehlgeschlagen (${res.status})`);
      const json = await res.text();
      if (Platform.OS === 'web') {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `werkant-datenexport-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.info('Datenexport heruntergeladen (JSON)');
      } else {
        await Share.share({ message: json });
      }
    } catch {
      showAlert('Export fehlgeschlagen', 'Ihre Daten konnten gerade nicht exportiert werden. Bitte versuchen Sie es später erneut.');
    } finally {
      setExporting(false);
    }
  }

  async function handleRevokeConsent() {
    const record = {
      accepted: false,
      analytics: false,
      pstg: false,
      version: '1.0',
      timestamp: new Date().toISOString(),
      revoked: true,
    };
    const raw = JSON.stringify(record);
    // Auch den synchronen Web-Wert überschreiben — _layout.tsx liest ihn zuerst,
    // sonst würde der Widerruf beim Reload ignoriert.
    try {
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.setItem('werkr_consent_v1', raw);
      }
    } catch { /* Storage blockiert */ }
    await AsyncStorage.setItem('werkr_consent_v1', raw);
    toast.info('Einwilligung widerrufen — beim nächsten Start neu gefragt');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zurück" onPress={() => safeBack(router)} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Einstellungen</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Konto */}
        <Reveal delay={30}>
          <Text style={styles.groupTitle}>Konto</Text>
          <View style={styles.card}>
            <Row icon="person-outline" label="Profil bearbeiten" onPress={() => router.push('/profil')} />
            <View style={styles.sep} />
            <Row icon="mail-unread-outline" label={resending ? 'Wird verschickt …' : 'Bestätigungs-E-Mail erneut senden'} onPress={handleResendVerification} />
            <View style={styles.sep} />
            <Row icon="card-outline" label="Zahlungsmethoden" onPress={() => router.push('/zahlungsmethoden')} />
            <View style={styles.sep} />
            <Row icon="notifications-outline" label="Push-Benachrichtigungen"
              right={<Switch value={pushNotifs} onValueChange={handlePushNotifs} trackColor={{ true: C.primary }} thumbColor={C.surface} />}
            />
          </View>
        </Reveal>

        {/* Datenschutz */}
        <Reveal delay={80}>
          <Text style={styles.groupTitle}>Datenschutz (DSGVO)</Text>
          <View style={styles.card}>
            <Row icon="analytics-outline" label="Analyse-Cookies"
              right={<Switch value={analytics} onValueChange={handleAnalytics} trackColor={{ true: C.primary }} thumbColor={C.surface} />}
            />
            <View style={styles.sep} />
            <Row icon="document-text-outline" label="Datenschutzerklärung"
              onPress={() => router.push('/datenschutz')} />
            <View style={styles.sep} />
            <Row icon="download-outline" label={exporting ? 'Export läuft …' : 'Meine Daten exportieren (Art. 20 DSGVO)'} onPress={handleExportData} />
            <View style={styles.sep} />
            <Row icon="refresh-outline" label="Einwilligung widerrufen" onPress={handleRevokeConsent} />
          </View>
        </Reveal>

        {/* Rechtliches */}
        <Reveal delay={130}>
          <Text style={styles.groupTitle}>Rechtliches</Text>
          <View style={styles.card}>
            <Row icon="receipt-outline" label="AGB" onPress={() => router.push('/agb')} />
            <View style={styles.sep} />
            <Row icon="return-down-back-outline" label="Widerrufsbelehrung & Formular" onPress={() => router.push('/widerruf')} />
            <View style={styles.sep} />
            <Row icon="business-outline" label="Impressum" onPress={() => router.push('/impressum')} />
            <View style={styles.sep} />
            <Row icon="shield-outline" label="PStTG / DAC7 Info" onPress={() => router.push('/datenschutz')} />
          </View>
        </Reveal>

        {/* Steuer (nur für Anbieter) */}
        <Reveal delay={180}>
          <Text style={styles.groupTitle}>Steuer & Compliance</Text>
          <View style={styles.card}>
            <Row icon="document-attach-outline" label="Jahresbericht herunterladen" onPress={() => toast.info('Ihr PStTG-Jahresbericht wird bereitgestellt, sobald Zahlungen über Werkant abgewickelt wurden')} />
            <View style={styles.sep} />
            <Row icon="mail-outline" label="Frage zur PStTG-Meldung stellen"
              onPress={() => Linking.openURL('mailto:steuer@werkant.de?subject=Frage%20zur%20PStTG-Meldung')} />
          </View>
          {/* StBerG: Werkant darf keine Steuerberatung leisten — der Support
              beantwortet ausschließlich Fragen zur eigenen PStTG-Meldung. */}
          <Text style={styles.groupNote}>
            Werkant beantwortet ausschließlich Fragen zur eigenen PStTG-/DAC7-Meldung
            und ersetzt keine Steuerberatung. Für steuerliche Fragen wende dich bitte
            an eine Steuerberaterin oder einen Steuerberater.
          </Text>
        </Reveal>

        {/* Konto löschen */}
        <Reveal delay={230}>
          <Text style={styles.groupTitle}>Konto-Aktionen</Text>
          <View style={styles.card}>
            <Row icon="log-out-outline" label="Ausloggen" onPress={async () => {
              await supabase.auth.signOut();
              await AsyncStorage.removeItem('werkr_auth_token');
              router.replace('/landing');
            }} />
            <View style={styles.sep} />
            <Row icon="trash-outline" label="Konto löschen" onPress={handleDeleteAccount} danger />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Werkant v1.0.0 · datenschutz@werkant.de</Text>
            <Text style={styles.footerText}>Werkant UG (i.G.) · Köln, Deutschland</Text>
          </View>
        </Reveal>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: C.bg },
  header:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  backBtn:    { padding: 4, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  title:      { ...T.h2, color: C.ink },

  groupTitle: { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 20, marginTop: 18, marginBottom: 8 },
  groupNote: { fontSize: 12, color: C.muted, lineHeight: 17, paddingHorizontal: 20, paddingTop: 8 },
  card:       { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, marginHorizontal: 16, paddingHorizontal: 14 },
  row:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  iconChip:   { width: 30, height: 30, borderRadius: 9, backgroundColor: C.bgWarm, alignItems: 'center', justifyContent: 'center' },
  iconChipDanger: { backgroundColor: C.redBg },
  rowLabel:   { ...T.body, flex: 1, color: C.ink },
  sep:        { height: 1, backgroundColor: C.hair, marginLeft: 42 },

  footer:     { alignItems: 'center', gap: 4, paddingVertical: 32 },
  footerText: { ...T.caption, color: C.muted },
});
