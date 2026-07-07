import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Switch, StyleSheet, Alert, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { C } from '../constants/colors';
import { T } from '../constants/typography';
import { toast } from '../components/ui/Toast';
import { supabase } from '../lib/supabase';
import { invalidateConsentCache } from '../lib/analytics';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

const PREFS_KEY = 'werkr_prefs_v1';

interface RowProps {
  icon: string;
  label: string;
  onPress?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
}

function Row({ icon, label, onPress, right, danger }: RowProps) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <Ionicons name={icon as any} size={20} color={danger ? C.red : C.sub} style={styles.rowIcon} />
      <Text style={[styles.rowLabel, danger && { color: C.red }]}>{label}</Text>
      {right ?? <Ionicons name="chevron-forward" size={16} color={C.muted} />}
    </TouchableOpacity>
  );
}

export default function Einstellungen() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState(false);
  const [pushNotifs, setPushNotifs] = useState(true);

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

  function savePrefs(patch: { analytics?: boolean; pushNotifs?: boolean }) {
    AsyncStorage.getItem(PREFS_KEY).then((raw) => {
      const current = raw ? (JSON.parse(raw) as object) : {};
      AsyncStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, ...patch }));
    });
  }

  function handleAnalytics(v: boolean) { setAnalytics(v); savePrefs({ analytics: v }); invalidateConsentCache(); }
  function handlePushNotifs(v: boolean) { setPushNotifs(v); savePrefs({ pushNotifs: v }); }

  async function handleDeleteAccount() {
    Alert.alert(
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
              Alert.alert('Löschung fehlgeschlagen', body.error ?? 'Bitte wende dich an support@werkant.de');
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

  async function handleRevokeConsent() {
    const record = {
      accepted: false,
      analytics: false,
      pstg: false,
      version: '1.0',
      timestamp: new Date().toISOString(),
      revoked: true,
    };
    await AsyncStorage.setItem('werkr_consent_v1', JSON.stringify(record));
    toast.info('Einwilligung widerrufen — beim nächsten Start neu gefragt');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Einstellungen</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Konto */}
        <Text style={styles.section}>Konto</Text>
        <View style={styles.card}>
          <Row icon="person-outline" label="Profil bearbeiten" onPress={() => router.push('/profil')} />
          <View style={styles.sep} />
          <Row icon="card-outline" label="Zahlungsmethoden" onPress={() => toast.info('Zahlungsmethoden — kommt mit Stripe-Integration')} />
          <View style={styles.sep} />
          <Row icon="notifications-outline" label="Push-Benachrichtigungen"
            right={<Switch value={pushNotifs} onValueChange={handlePushNotifs} trackColor={{ true: C.primary }} />}
          />
        </View>

        {/* Datenschutz */}
        <Text style={styles.section}>Datenschutz (DSGVO)</Text>
        <View style={styles.card}>
          <Row icon="analytics-outline" label="Analyse-Cookies"
            right={<Switch value={analytics} onValueChange={handleAnalytics} trackColor={{ true: C.primary }} />}
          />
          <View style={styles.sep} />
          <Row icon="document-text-outline" label="Datenschutzerklärung"
            onPress={() => router.push('/datenschutz')} />
          <View style={styles.sep} />
          <Row icon="download-outline" label="Meine Daten exportieren (Art. 20 DSGVO)" onPress={() => toast.info('Datenexport per E-Mail — kommt bald (Art. 20 DSGVO)')} />
          <View style={styles.sep} />
          <Row icon="refresh-outline" label="Einwilligung widerrufen" onPress={handleRevokeConsent} />
        </View>

        {/* Rechtliches */}
        <Text style={styles.section}>Rechtliches</Text>
        <View style={styles.card}>
          <Row icon="receipt-outline" label="AGB" onPress={() => router.push('/agb')} />
          <View style={styles.sep} />
          <Row icon="return-down-back-outline" label="Widerrufsbelehrung & Formular" onPress={() => router.push('/widerruf')} />
          <View style={styles.sep} />
          <Row icon="business-outline" label="Impressum" onPress={() => router.push('/impressum')} />
          <View style={styles.sep} />
          <Row icon="shield-outline" label="PStTG / DAC7 Info" onPress={() => router.push('/datenschutz')} />
        </View>

        {/* Steuer (nur für Anbieter) */}
        <Text style={styles.section}>Steuer & Compliance</Text>
        <View style={styles.card}>
          <Row icon="document-attach-outline" label="Jahresbericht herunterladen" onPress={() => toast.info('Jahresbericht 2025 ab 01. Jan 2026 verfügbar')} />
          <View style={styles.sep} />
          <Row icon="mail-outline" label="Steuer-Support kontaktieren"
            onPress={() => Linking.openURL('mailto:steuer@werkant.de')} />
        </View>

        {/* Konto löschen */}
        <Text style={styles.section}>Gefahrenzone</Text>
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

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: C.bg },
  header:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  backBtn:    { padding: 4 },
  title:      { ...T.h2, color: C.ink },
  section:    { ...T.label, color: C.muted, marginLeft: 20, marginTop: 20, marginBottom: 8 },
  card:       { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, marginHorizontal: 16 },
  row:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  rowIcon:    { marginRight: 12 },
  rowLabel:   { ...T.body, flex: 1, color: C.ink },
  sep:        { height: 1, backgroundColor: C.border, marginLeft: 48 },
  footer:     { alignItems: 'center', gap: 4, paddingVertical: 32 },
  footerText: { ...T.caption, color: C.muted },
});
