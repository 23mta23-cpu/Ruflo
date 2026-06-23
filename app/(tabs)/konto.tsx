import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/colors';
import { T } from '../../constants/theme';
import { AnimatedButton } from '../../components/ui/AnimatedButton';
import { toast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const MENU = [
  { icon: 'heart-outline',      label: 'Meine Anbieter',        route: '/meine-anbieter' },
  { icon: 'briefcase-outline',  label: 'Meine Aufträge',        route: '/(tabs)/auftraege' },
  { icon: 'chatbubble-outline', label: 'Nachrichten',           route: '/(tabs)/nachrichten' },
  { icon: 'card-outline',       label: 'Zahlungsmethoden',      route: '/zahlungsmethoden' },
  { icon: 'settings-outline',   label: 'Einstellungen & DSGVO', route: '/einstellungen' },
];

export default function Konto() {
  const router = useRouter();
  const { user } = useAuth();

  const email     = user?.email ?? '';
  const fullName  = (user?.user_metadata?.full_name as string | undefined) ?? email.split('@')[0] ?? 'Konto';
  const initials  = fullName.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2) || 'WR';
  const verified  = user?.email_confirmed_at != null;

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/landing');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Profile header */}
        <View style={styles.hero}>
          <View style={styles.avatarOuter}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </View>
          <Text style={styles.name}>{fullName}</Text>
          <Text style={styles.email}>{email}</Text>
          <View style={styles.badgeRow}>
            {verified && (
              <View style={styles.badge}>
                <Ionicons name="checkmark-circle" size={12} color={C.primary} />
                <Text style={styles.badgeText}>E-Mail verifiziert</Text>
              </View>
            )}
          </View>
        </View>

        {/* Quick links */}

        {/* Menu */}
        <View style={styles.card}>
          {MENU.map((item, idx) => (
            <React.Fragment key={item.label}>
              <TouchableOpacity
                style={styles.row}
                onPress={() => item.route ? router.push(item.route as any) : toast.info('Zahlungsmethoden — kommt mit Stripe-Integration')}
                activeOpacity={0.7}
              >
                <Ionicons name={item.icon as any} size={20} color={C.sub} style={styles.rowIcon} />
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={C.muted} />
              </TouchableOpacity>
              {idx < MENU.length - 1 && <View style={styles.sep} />}
            </React.Fragment>
          ))}
        </View>

        {/* Switch to provider */}
        <AnimatedButton
          style={styles.providerBtn}
          onPress={() => router.replace('/(provider)/')}
        >
          <Ionicons name="construct-outline" size={18} color={C.surface} />
          <Text style={styles.providerBtnText}>Zum Anbieter-Bereich wechseln</Text>
          <Ionicons name="arrow-forward" size={16} color={C.surface} />
        </AnimatedButton>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={18} color={C.red} />
          <Text style={styles.signOutText}>Abmelden</Text>
        </TouchableOpacity>

        {/* Legal */}
        <View style={styles.legalRow}>
          {[
            { label: 'AGB',         route: '/agb' },
            { label: 'Datenschutz', route: '/datenschutz' },
            { label: 'Impressum',   route: '/impressum' },
          ].map((l) => (
            <TouchableOpacity key={l.label} onPress={() => router.push(l.route as any)}>
              <Text style={styles.legalLink}>{l.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: C.bg },
  hero:           { alignItems: 'center', paddingTop: 24, paddingBottom: 24 },
  avatarOuter:    { width: 84, height: 84, borderRadius: 20, backgroundColor: C.primaryBg, borderWidth: 1.5, borderColor: C.primaryBd, alignItems: 'center', justifyContent: 'center', marginBottom: 14, shadowColor: C.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.14, shadowRadius: 10, elevation: 3 },
  avatar:         { width: 68, height: 68, borderRadius: 19, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText:     { fontSize: 24, fontWeight: '700', color: C.surface },
  name:           { ...T.h2, fontWeight: '700', color: C.ink, marginBottom: 4 },
  email:          { ...T.bodySmall, color: C.muted, marginBottom: 10 },
  badgeRow:       { flexDirection: 'row', gap: 8 },
  badge:          { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.primaryBg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText:      { ...T.caption, color: C.primary, fontWeight: '600' },
  statsRow:       { flexDirection: 'row', marginHorizontal: 16, marginBottom: 24, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  stat:           { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statValue:      { ...T.h2, color: C.ink },
  statLabel:      { ...T.caption, color: C.muted, marginTop: 2 },
  card:           { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, marginHorizontal: 16, marginBottom: 16, paddingHorizontal: 16 },
  row:            { flexDirection: 'row', alignItems: 'center', paddingVertical: 13 },
  rowIcon:        { marginRight: 12 },
  rowLabel:       { ...T.body, flex: 1, color: C.ink },
  sep:            { height: 1, backgroundColor: C.border, marginLeft: 48 },
  providerBtn:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.primary, marginHorizontal: 16, borderRadius: 12, padding: 16, justifyContent: 'center', shadowColor: C.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3 },
  providerBtnText:{ fontSize: 15, fontWeight: '700', color: C.surface, flex: 1, textAlign: 'center' },
  signOutBtn:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 16, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 16 },
  signOutText:    { fontSize: 15, fontWeight: '600', color: C.red },
  legalRow:       { flexDirection: 'row', justifyContent: 'center', gap: 16, paddingVertical: 8 },
  legalLink:      { fontSize: 12, color: C.muted, textDecorationLine: 'underline' },
});
