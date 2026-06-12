import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Switch, StyleSheet, Linking,
} from 'react-native';
import { showAlert } from '../lib/alert';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { C } from '../constants/colors';

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

  async function handleDeleteAccount() {
    showAlert(
      'Konto löschen',
      'Alle deine Daten werden unwiderruflich gelöscht (Art. 17 DSGVO). Aktive Aufträge werden abgebrochen. Sicher?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Endgültig löschen',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.clear();
            router.replace('/onboarding');
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
    showAlert('Einwilligung widerrufen', 'Beim nächsten App-Start wirst du erneut gefragt.');
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
          <Row icon="person-outline" label="Profil bearbeiten" onPress={() => {}} />
          <View style={styles.sep} />
          <Row icon="card-outline" label="Zahlungsmethoden" onPress={() => {}} />
          <View style={styles.sep} />
          <Row icon="notifications-outline" label="Push-Benachrichtigungen"
            right={<Switch value={pushNotifs} onValueChange={setPushNotifs} trackColor={{ true: C.green }} />}
          />
        </View>

        {/* Datenschutz */}
        <Text style={styles.section}>Datenschutz (DSGVO)</Text>
        <View style={styles.card}>
          <Row icon="analytics-outline" label="Analyse-Cookies"
            right={<Switch value={analytics} onValueChange={setAnalytics} trackColor={{ true: C.green }} />}
          />
          <View style={styles.sep} />
          <Row icon="document-text-outline" label="Datenschutzerklärung"
            onPress={() => router.push('/datenschutz')} />
          <View style={styles.sep} />
          <Row icon="download-outline" label="Meine Daten exportieren (Art. 20 DSGVO)" onPress={() => {}} />
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
          <Row icon="shield-outline" label="PStTG / DAC7 Info" onPress={() => {}} />
        </View>

        {/* Steuer (nur für Anbieter) */}
        <Text style={styles.section}>Steuer & Compliance</Text>
        <View style={styles.card}>
          <Row icon="document-attach-outline" label="Jahresbericht herunterladen" onPress={() => {}} />
          <View style={styles.sep} />
          <Row icon="mail-outline" label="Steuer-Support kontaktieren"
            onPress={() => Linking.openURL('mailto:steuer@werkr.de')} />
        </View>

        {/* Konto löschen */}
        <Text style={styles.section}>Gefahrenzone</Text>
        <View style={styles.card}>
          <Row icon="log-out-outline" label="Ausloggen" onPress={async () => {
            await AsyncStorage.removeItem('werkr_auth_token');
            router.replace('/onboarding');
          }} />
          <View style={styles.sep} />
          <Row icon="trash-outline" label="Konto löschen" onPress={handleDeleteAccount} danger />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>WERKR v1.0.0 · datenschutz@werkr.de</Text>
          <Text style={styles.footerText}>WERKR GmbH · Musterstraße 1 · 50667 Köln</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: C.bg },
  header:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  backBtn:    { padding: 4 },
  title:      { fontSize: 20, fontWeight: '800', color: C.ink },
  section:    { fontSize: 12, fontWeight: '600', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginLeft: 20, marginTop: 20, marginBottom: 8 },
  card:       { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, marginHorizontal: 16 },
  row:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  rowIcon:    { marginRight: 12 },
  rowLabel:   { flex: 1, fontSize: 15, color: C.ink },
  sep:        { height: 1, backgroundColor: C.border, marginLeft: 48 },
  footer:     { alignItems: 'center', gap: 4, paddingVertical: 32 },
  footerText: { fontSize: 12, color: C.muted },
});
