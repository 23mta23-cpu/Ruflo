import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/colors';
import { T } from '../../constants/typography';
import { Reveal } from '../../components/ui/Reveal';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

/**
 * Konto-Tab im ruhigen "Grouped Settings"-Stil (Founder-Referenz 13.07.):
 * Profil-Karte oben, betitelte Gruppen mit Icon-Chips + Chevron, dezente
 * Wert-Hinweise. Vertrauen durch Ordnung — bewusst keine Show-Effekte,
 * nur sanfte Reveal-Staffelung (reduce-motion-aware).
 */

type Row = { icon: string; label: string; route?: string; value?: string; tint?: 'default' | 'gold' };

const GRUPPEN: { title: string; rows: Row[] }[] = [
  {
    title: 'Konto',
    rows: [
      { icon: 'briefcase-outline',  label: 'Meine Aufträge',   route: '/(tabs)/auftraege' },
      { icon: 'heart-outline',      label: 'Meine Anbieter',   route: '/meine-anbieter' },
      { icon: 'chatbubble-outline', label: 'Nachrichten',      route: '/(tabs)/nachrichten' },
      { icon: 'card-outline',       label: 'Zahlungsmethoden', route: '/zahlungsmethoden' },
    ],
  },
  {
    title: 'Einstellungen',
    rows: [
      { icon: 'settings-outline',  label: 'Einstellungen & Datenschutz', route: '/einstellungen' },
      { icon: 'language-outline',  label: 'Sprache', value: 'Deutsch' },
    ],
  },
  {
    title: 'Support & Rechtliches',
    rows: [
      { icon: 'help-buoy-outline',        label: 'Support-Chat',   route: '/support-chat' },
      { icon: 'shield-checkmark-outline', label: 'Werkant Schutz', route: '/garantie', tint: 'gold' },
      { icon: 'document-text-outline',    label: 'AGB',            route: '/agb' },
      { icon: 'lock-closed-outline',      label: 'Datenschutz',    route: '/datenschutz' },
      { icon: 'information-circle-outline', label: 'Impressum',    route: '/impressum' },
    ],
  },
];

export default function Konto() {
  const router = useRouter();
  const { user } = useAuth();

  const email    = user?.email ?? '';
  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? email.split('@')[0] ?? 'Konto';
  const initials = fullName.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2) || 'WK';
  const verified = user?.email_confirmed_at != null;

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/landing');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>Profil</Text>

        {/* Profil-Karte (bzw. Login-Aufforderung für Gäste) */}
        <Reveal delay={40}>
          {user ? (
            <View style={styles.profileCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{fullName}</Text>
                <Text style={styles.email} numberOfLines={1}>{email}</Text>
                {verified && (
                  <View style={styles.badge}>
                    <Ionicons name="checkmark-circle" size={11} color={C.primary} />
                    <Text style={styles.badgeText}>E-Mail verifiziert</Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.profileCard} onPress={() => router.push('/login')} activeOpacity={0.8}>
              <View style={[styles.avatar, { backgroundColor: C.bgWarm }]}>
                <Ionicons name="person-outline" size={24} color={C.sub} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>Anmelden oder registrieren</Text>
                <Text style={styles.email}>Aufträge, Nachrichten & Zahlungen nutzen</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={C.muted} />
            </TouchableOpacity>
          )}
        </Reveal>

        {/* Gruppen */}
        {GRUPPEN.map((g, gi) => (
          <Reveal key={g.title} delay={120 + gi * 80}>
            <Text style={styles.groupTitle}>{g.title}</Text>
            <View style={styles.card}>
              {g.rows.map((item, idx) => (
                <React.Fragment key={item.label}>
                  <TouchableOpacity
                    style={styles.row}
                    onPress={item.route ? () => router.push(item.route as any) : undefined}
                    activeOpacity={item.route ? 0.6 : 1}
                    disabled={!item.route}
                  >
                    <View style={[styles.iconChip, item.tint === 'gold' && { backgroundColor: C.goldBg }]}>
                      <Ionicons name={item.icon as any} size={16} color={item.tint === 'gold' ? C.gold : C.sub} />
                    </View>
                    <Text style={styles.rowLabel}>{item.label}</Text>
                    {item.value && <Text style={styles.rowValue}>{item.value}</Text>}
                    {item.route && <Ionicons name="chevron-forward" size={16} color={C.muted} />}
                  </TouchableOpacity>
                  {idx < g.rows.length - 1 && <View style={styles.sep} />}
                </React.Fragment>
              ))}
            </View>
          </Reveal>
        ))}

        {/* Anbieter-Bereich + Abmelden */}
        <Reveal delay={400}>
          <Text style={styles.groupTitle}>Anbieter</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.row} onPress={() => router.replace('/(provider)/')} activeOpacity={0.6}>
              <View style={[styles.iconChip, { backgroundColor: C.primaryBg }]}>
                <Ionicons name="construct-outline" size={16} color={C.primary} />
              </View>
              <Text style={[styles.rowLabel, { color: C.primary, fontWeight: '600' }]}>Zum Anbieter-Bereich wechseln</Text>
              <Ionicons name="chevron-forward" size={16} color={C.primary} />
            </TouchableOpacity>
          </View>

          {user && (
            <View style={[styles.card, { marginTop: 16 }]}>
              <TouchableOpacity style={styles.row} onPress={handleSignOut} activeOpacity={0.6}>
                <View style={[styles.iconChip, { backgroundColor: '#FBEAEA' }]}>
                  <Ionicons name="log-out-outline" size={16} color={C.red} />
                </View>
                <Text style={[styles.rowLabel, { color: C.red, fontWeight: '600' }]}>Abmelden</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.version}>Werkant · Beta · Deutschlandweit</Text>
        </Reveal>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.bg },
  screenTitle: { ...T.h2, color: C.ink, paddingHorizontal: 20, paddingTop: 16, marginBottom: 14 },

  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 16, marginHorizontal: 16, padding: 16, marginBottom: 8, shadowColor: C.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  avatar:      { width: 56, height: 56, borderRadius: 16, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText:  { fontSize: 20, fontWeight: '700', color: C.surface },
  name:        { fontSize: 16, fontWeight: '700', color: C.ink },
  email:       { ...T.sm, color: C.muted, marginTop: 1 },
  badge:       { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: C.primaryBg, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, marginTop: 6 },
  badgeText:   { ...T.caption, color: C.primary, fontWeight: '600' },

  groupTitle:  { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 20, marginTop: 18, marginBottom: 8 },
  card:        { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, marginHorizontal: 16, paddingHorizontal: 14 },
  row:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  iconChip:    { width: 30, height: 30, borderRadius: 9, backgroundColor: C.bgWarm, alignItems: 'center', justifyContent: 'center' },
  rowLabel:    { ...T.body, flex: 1, color: C.ink },
  rowValue:    { ...T.sm, color: C.muted },
  sep:         { height: 1, backgroundColor: C.hair, marginLeft: 42 },

  version:     { textAlign: 'center', fontSize: 11, color: C.muted, marginTop: 22 },
});
