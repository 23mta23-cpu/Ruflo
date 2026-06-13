import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/colors';

const MENU = [
  { icon: 'heart-outline',      label: 'Meine Anbieter',        route: '/meine-anbieter' },
  { icon: 'briefcase-outline',  label: 'Meine Aufträge',        route: '/(tabs)/auftraege' },
  { icon: 'chatbubble-outline', label: 'Nachrichten',           route: '/nachrichten' },
  { icon: 'card-outline',       label: 'Zahlungsmethoden',      route: '/zahlungsmethoden' },
  { icon: 'chatbubbles-outline', label: 'Support & Hilfe',        route: '/support-chat' },
  { icon: 'settings-outline',   label: 'Einstellungen & DSGVO', route: '/einstellungen' },
];

const TAB_BAR_HEIGHT = 60;

export default function Konto() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Profile header */}
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>MK</Text>
          </View>
          <Text style={styles.name}>Max Kunde</Text>
          <Text style={styles.email}>max.kunde@example.de</Text>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Ionicons name="checkmark-circle" size={12} color={C.green} />
              <Text style={styles.badgeText}>E-Mail verifiziert</Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: 'Aufträge', value: '12' },
            { label: 'Anbieter', value: '4' },
            { label: 'Bewertungen', value: '9' },
          ].map((s) => (
            <View key={s.label} style={styles.stat}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Menu */}
        <View style={styles.card}>
          {MENU.map((item, idx) => (
            <React.Fragment key={item.label}>
              <TouchableOpacity
                style={styles.row}
                onPress={() => item.route ? router.push(item.route as any) : undefined}
                activeOpacity={item.route ? 0.7 : 1}
              >
                <Ionicons name={item.icon as any} size={20} color={C.sub} style={styles.rowIcon} />
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={C.muted} />
              </TouchableOpacity>
              {idx < MENU.length - 1 && <View style={styles.sep} />}
            </React.Fragment>
          ))}
        </View>

        {/* WERKR-Schutz info */}
        <View style={styles.schutzCard}>
          <View style={styles.schutzHeader}>
            <Ionicons name="shield-checkmark-outline" size={18} color={C.green} />
            <Text style={styles.schutzTitle}>WERKR-Schutz aktiv</Text>
          </View>
          <Text style={styles.schutzBody}>
            Alle Zahlungen laufen über Escrow — Ihr Geld ist gesichert, bis der Auftrag abgeschlossen ist. Bei Streitigkeiten greift unser Käuferschutz.
          </Text>
          <Text style={styles.schutzFee}>Schutzgebühr: €1,99 pro Nachbarschaft-Auftrag · keine Gebühr bei Handwerker-Aufträgen</Text>
        </View>

        {/* Switch to provider */}
        <TouchableOpacity
          style={styles.providerBtn}
          onPress={() => router.replace('/(provider)/')}
          activeOpacity={0.8}
        >
          <Ionicons name="construct-outline" size={18} color={C.surface} />
          <Text style={styles.providerBtnText}>Zum Anbieter-Bereich wechseln</Text>
          <Ionicons name="arrow-forward" size={16} color={C.surface} />
        </TouchableOpacity>

        <View style={{ height: TAB_BAR_HEIGHT + insets.bottom + 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: C.bg },
  hero:           { alignItems: 'center', paddingTop: 28, paddingBottom: 24 },
  avatar:         { width: 72, height: 72, borderRadius: 36, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText:     { fontSize: 24, fontWeight: '800', color: C.surface },
  name:           { fontSize: 20, fontWeight: '800', color: C.ink, marginBottom: 4 },
  email:          { fontSize: 13, color: C.muted, marginBottom: 10 },
  badgeRow:       { flexDirection: 'row', gap: 8 },
  badge:          { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.greenBg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText:      { fontSize: 11, color: C.green, fontWeight: '600' },
  statsRow:       { flexDirection: 'row', marginHorizontal: 16, marginBottom: 24, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  stat:           { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statValue:      { fontSize: 22, fontWeight: '800', color: C.ink },
  statLabel:      { fontSize: 11, color: C.muted, marginTop: 2 },
  card:           { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, marginHorizontal: 16, marginBottom: 16, paddingHorizontal: 16 },
  row:            { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  rowIcon:        { marginRight: 12 },
  rowLabel:       { flex: 1, fontSize: 15, color: C.ink },
  sep:            { height: 1, backgroundColor: C.border, marginLeft: 48 },
  schutzCard:     { backgroundColor: C.greenBg, borderWidth: 1, borderColor: '#C3E6D0', borderRadius: 12, marginHorizontal: 16, marginBottom: 16, padding: 14 },
  schutzHeader:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  schutzTitle:    { fontSize: 14, fontWeight: '700', color: C.ink },
  schutzBody:     { fontSize: 13, color: C.sub, lineHeight: 19, marginBottom: 8 },
  schutzFee:      { fontSize: 11, color: C.muted, fontStyle: 'italic' },
  providerBtn:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.ink, marginHorizontal: 16, borderRadius: 14, padding: 16, justifyContent: 'center' },
  providerBtnText:{ fontSize: 15, fontWeight: '700', color: C.surface, flex: 1, textAlign: 'center' },
});
