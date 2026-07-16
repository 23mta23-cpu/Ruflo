import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { T } from '../constants/typography';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

type ProfileData = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
};

function memberSince(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}

export default function ProfilScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [jobCount, setJobCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let active = true;

    Promise.all([
      supabase
        .from('profiles')
        .select('full_name, email, phone, created_at')
        .eq('id', user.id)
        .single(),
      supabase
        .from('contracts')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', user.id)
        .eq('status', 'completed'),
    ]).then(([profileRes, contractsRes]) => {
      if (!active) return;
      if (profileRes.data) setProfile(profileRes.data as ProfileData);
      setJobCount(contractsRes.count ?? 0);
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      setLoading(false);
    });

    return () => { active = false; };
  }, [user]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zurück" onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={C.ink} />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={C.ink} />
        </View>
      </SafeAreaView>
    );
  }

  const initials = (profile?.full_name ?? user?.email ?? '?')
    .split(' ')
    .map((w) => w.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        <View style={styles.topBar}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zurück" onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={C.ink} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Mein Profil</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Avatar + Name */}
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>{profile?.full_name ?? '—'}</Text>
          <Text style={styles.email}>{profile?.email ?? user?.email ?? '—'}</Text>
          {profile?.created_at && (
            <Text style={styles.since}>Mitglied seit {memberSince(profile.created_at)}</Text>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsCard}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{jobCount}</Text>
            <Text style={styles.statLabel}>Aufträge</Text>
          </View>
        </View>

        {/* Contact info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kontakt</Text>
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={18} color={C.muted} />
            <Text style={styles.infoText}>{profile?.email ?? user?.email ?? '—'}</Text>
          </View>
          {profile?.phone ? (
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={18} color={C.muted} />
              <Text style={styles.infoText}>{profile.phone}</Text>
            </View>
          ) : null}
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => router.push('/einstellungen')}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={18} color={C.ink} />
            <Text style={styles.actionText}>Einstellungen</Text>
            <Ionicons name="chevron-forward" size={16} color={C.muted} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg },
  topBar:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  backBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  topTitle:     { fontSize: 17, fontWeight: '700', color: C.ink },
  hero:         { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20 },
  avatar:       { width: 80, height: 80, borderRadius: 40, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: C.gold, marginBottom: 14 },
  avatarText:   { fontSize: 30, fontWeight: '700', color: C.gold },
  name:         { ...T.h2, color: C.ink, marginBottom: 4 },
  email:        { ...T.body, color: C.sub, marginBottom: 4 },
  since:        { ...T.caption, color: C.muted },
  statsCard:    { flexDirection: 'row', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, marginHorizontal: 20, marginBottom: 20, paddingVertical: 16 },
  stat:         { flex: 1, alignItems: 'center', gap: 4 },
  statValue:    { fontSize: 22, fontWeight: '700', color: C.ink },
  statLabel:    { ...T.caption, color: C.muted },
  statDivider:  { width: 1, backgroundColor: C.border },
  section:      { marginHorizontal: 20, marginBottom: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, overflow: 'hidden' },
  sectionTitle: { ...T.label, color: C.sub, padding: 14, paddingBottom: 8 },
  infoRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.border },
  infoText:     { ...T.body, color: C.ink, flex: 1 },
  actionRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  actionText:   { ...T.body, color: C.ink, fontWeight: '600' },
});
