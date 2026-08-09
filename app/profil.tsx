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
import { shadow, R } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { toast } from '../components/ui/Toast';

type ProfileData = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  plz: string | null;
  city: string | null;
  account_type: string | null;
  company_name: string | null;
  ust_id: string | null;
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
  const [plzInput, setPlzInput] = useState('');
  const [cityInput, setCityInput] = useState('');
  const [companyInput, setCompanyInput] = useState('');
  const [ustInput, setUstInput] = useState('');
  const [saving, setSaving] = useState(false);

  const isBusiness = profile?.account_type === 'business';

  function startEdit() {
    setNameInput(profile?.full_name ?? '');
    setPhoneInput(profile?.phone ?? '');
    setPlzInput(profile?.plz ?? '');
    setCityInput(profile?.city ?? '');
    setCompanyInput(profile?.company_name ?? '');
    setUstInput(profile?.ust_id ?? '');
    setEditing(true);
  }

  async function handleSave() {
    if (!user) return;
    const name = nameInput.trim();
    if (!name) { toast.error('Name darf nicht leer sein'); return; }
    const plz = plzInput.trim();
    if (plz && !/^\d{5}$/.test(plz)) { toast.error('PLZ muss 5 Ziffern haben'); return; }

    // company_name und ust_id waren bisher NUR bei der Registrierung setzbar
    // (lib/auth.ts) und danach unveränderlich — ein Tippfehler in der
    // USt-IdNr. wäre dauerhaft gewesen, obwohl sie die Reverse-Charge-
    // Rechnungsstellung steuert (Founder-Punkt 16, Feld-Asymmetrie).
    const patch: Record<string, string | null> = {
      full_name: name,
      phone: phoneInput.trim() || null,
      plz: plz || null,
      city: cityInput.trim() || null,
    };
    if (isBusiness) {
      patch.company_name = companyInput.trim() || null;
      patch.ust_id = ustInput.trim() || null;
    }

    setSaving(true);
    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
    setSaving(false);
    if (error) { toast.error('Speichern fehlgeschlagen'); return; }
    setProfile((p) => p ? { ...p, ...patch } as ProfileData : p);
    setEditing(false);
    toast.info('Profil aktualisiert');
  }

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let active = true;

    Promise.all([
      supabase
        .from('profiles')
        .select('full_name, email, phone, created_at, plz, city, account_type, company_name, ust_id')
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

  // Gast: dieser Screen ist ueber das Personen-Symbol im Home-Header
  // erreichbar, BEVOR jemand ein Konto hat. Ohne diesen Zweig rendert er ein
  // leeres "Mein Profil" mit Fragezeichen-Avatar und Gedankenstrichen statt
  // Name und E-Mail -- und ohne eine einzige Anmelde-Moeglichkeit. Wer den Weg
  // "Unterstuetzung finden" ohne Konto geht, landet damit in einer Sackgasse,
  // aus der nur der Zurueck-Pfeil herausfuehrt (Founder-Report 09.08.2026).
  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zurück" onPress={() => safeBack(router)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={C.ink} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Profil</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.gastWrap}>
          <View style={[styles.avatar, { backgroundColor: C.bgWarm, borderColor: C.border }]}>
            <Ionicons name="person-outline" size={34} color={C.sub} />
          </View>
          <Text style={styles.gastTitel}>Noch nicht angemeldet</Text>
          <Text style={styles.gastText}>
            Melden Sie sich an, um Aufträge zu vergeben, Nachrichten zu lesen und
            Zahlungen zu verwalten. Das Stöbern bleibt auch ohne Konto möglich.
          </Text>

          <TouchableOpacity
            accessibilityRole="button"
            style={styles.gastPrimary}
            onPress={() => router.push('/login')}
            activeOpacity={0.85}
          >
            <Text style={styles.gastPrimaryText}>Einloggen</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            style={styles.gastSecondary}
            onPress={() => router.push('/registrierung')}
            activeOpacity={0.7}
          >
            <Text style={styles.gastSecondaryText}>Noch kein Konto? Jetzt registrieren</Text>
          </TouchableOpacity>
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
              <Text style={styles.editLabel}>PLZ (optional)</Text>
              <TextInput
                style={styles.input}
                value={plzInput}
                onChangeText={setPlzInput}
                placeholder="z. B. 50667"
                placeholderTextColor={C.muted}
                keyboardType="number-pad"
                maxLength={5}
              />
            </View>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>Ort (optional)</Text>
              <TextInput
                style={styles.input}
                value={cityInput}
                onChangeText={setCityInput}
                placeholder="z. B. Köln"
                placeholderTextColor={C.muted}
                autoCapitalize="words"
              />
            </View>
            {isBusiness ? (
              <>
                <View style={styles.editField}>
                  <Text style={styles.editLabel}>Firmenname</Text>
                  <TextInput
                    style={styles.input}
                    value={companyInput}
                    onChangeText={setCompanyInput}
                    placeholder="z. B. Mustermann GmbH"
                    placeholderTextColor={C.muted}
                    autoCapitalize="words"
                  />
                </View>
                <View style={styles.editField}>
                  <Text style={styles.editLabel}>USt-IdNr. (optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={ustInput}
                    onChangeText={setUstInput}
                    placeholder="z. B. DE123456789"
                    placeholderTextColor={C.muted}
                    autoCapitalize="characters"
                  />
                  <Text style={styles.fieldHint}>
                    Steuert die Rechnungsstellung (Reverse-Charge). Bitte genau prüfen.
                  </Text>
                </View>
              </>
            ) : null}
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
            {(profile?.plz || profile?.city) ? (
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={18} color={C.muted} />
                <Text style={styles.infoText}>
                  {[profile?.plz, profile?.city].filter(Boolean).join(' ')}
                </Text>
              </View>
            ) : null}
            {isBusiness && profile?.company_name ? (
              <View style={styles.infoRow}>
                <Ionicons name="business-outline" size={18} color={C.muted} />
                <Text style={styles.infoText}>{profile.company_name}</Text>
              </View>
            ) : null}
            {isBusiness && profile?.ust_id ? (
              <View style={styles.infoRow}>
                <Ionicons name="receipt-outline" size={18} color={C.muted} />
                <Text style={styles.infoText}>{profile.ust_id}</Text>
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

  // Gast-Zustand (kein Konto)
  gastWrap:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 60 },
  gastTitel:      { ...T.h2, color: C.ink, marginBottom: 8, textAlign: 'center' },
  gastText:       { ...T.body, color: C.sub, textAlign: 'center', marginBottom: 28 },
  gastPrimary:    { width: '100%', backgroundColor: C.primary, borderRadius: R.md, paddingVertical: 15, alignItems: 'center', ...shadow.sm },
  gastPrimaryText:{ ...T.btn, color: C.surface },
  gastSecondary:  { marginTop: 16, paddingVertical: 8 },
  gastSecondaryText: { ...T.body, fontWeight: '700', color: C.ink, textDecorationLine: 'underline' },

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
  fieldHint:    { ...T.caption, color: C.muted, marginTop: 6, lineHeight: 15 },
  input:        { ...T.body, color: C.ink, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.bg },
  editActions:  { flexDirection: 'row', gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: C.border },
  btn:          { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  btnGhost:     { borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  btnGhostText: { ...T.btn, color: C.sub },
  btnPrimary:   { backgroundColor: C.primary },
  btnPrimaryText: { ...T.btn, color: '#FFF' },
});
