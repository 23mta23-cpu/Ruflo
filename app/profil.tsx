import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { safeBack } from '../lib/nav';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { T } from '../constants/typography';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { toast } from '../components/ui/Toast';

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
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setNameInput(profile?.full_name ?? '');
    setPhoneInput(profile?.phone ?? '');
    setEditing(true);
  }

  async function handleSave() {
    if (!user) return;
    const name = nameInput.trim();
    if (!name) { toast.error('Name darf nicht leer sein'); return; }
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: name, phone: phoneInput.trim() || null })
      .eq('id', user.id);
    setSaving(false);
    if (error) { toast.error('Speichern fehlgeschlagen'); return; }
    setProfile((p) => p ? { ...p, full_name: name, phone: phoneInput.trim() || null } : p);
    setEditing(false);
    toast.info('Profil aktualisiert');
  }

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let active = true;

    Promise.all([
      supabase
        .from('profiles')
        .select('full_name, email, phone, created_at')
        .eq('id', user.id)
        // maybeSingle: fehlt die Profilzeile (verwaistes Konto), soll die
        // Auftragszahl trotzdem geladen werden — single() hätte das ganze
        // Promise.all verworfen.
        .maybeSingle(),
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
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zurück" onPress={() => safeBack(router)} style={styles.backBtn}>
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
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zurück" onPress={() => safeBack(router)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={C.ink} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Mein Profil</Text>
          {editing ? (
            <View style={{ width: 36 }} />
          ) : (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Profil bearbeiten" onPress={startEdit} style={styles.backBtn}>
              <Ionicons name="create-outline" size={22} color={C.primary} />
            </TouchableOpacity>
          )}
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
        {editing ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Profil bearbeiten</Text>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>Name</Text>
              <TextInput
                style={styles.input}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Dein Name"
                placeholderTextColor={C.muted}
                autoCapitalize="words"
              />
            </View>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>Telefon (optional)</Text>
              <TextInput
                style={styles.input}
                value={phoneInput}
                onChangeText={setPhoneInput}
                placeholder="z. B. 0221 1234567"
                placeholderTextColor={C.muted}
                keyboardType="phone-pad"
              />
            </View>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>E-Mail (nicht änderbar)</Text>
              <Text style={styles.infoText}>{profile?.email ?? user?.email ?? '—'}</Text>
            </View>
            <View style={styles.editActions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnGhost]}
                onPress={() => setEditing(false)}
                disabled={saving}
                accessibilityRole="button"
              >
                <Text style={styles.btnGhostText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
                accessibilityRole="button"
              >
                <Text style={styles.btnPrimaryText}>{saving ? 'Speichern …' : 'Speichern'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
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
        )}

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
  editField:    { paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.border },
  editLabel:    { ...T.label, color: C.sub, marginBottom: 6 },
  input:        { ...T.body, color: C.ink, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.bg },
  editActions:  { flexDirection: 'row', gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: C.border },
  btn:          { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  btnGhost:     { borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  btnGhostText: { ...T.btn, color: C.sub },
  btnPrimary:   { backgroundColor: C.primary },
  btnPrimaryText: { ...T.btn, color: '#FFF' },
});
