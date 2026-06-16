import React, { useState, useEffect } from 'react';
import {
<<<<<<< HEAD
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
=======
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, Switch, Modal, ActivityIndicator,
>>>>>>> main
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { C } from '../../constants/colors';
<<<<<<< HEAD
import { showAlert } from '../../lib/alert';
import { useAuth } from '../../contexts/AuthContext';
import { signOut } from '../../lib/auth';
import { isSupabaseConfigured } from '../../lib/supabase';
import { getMyProviderProfile, updateProviderProfile, type ProviderProfile } from '../../lib/providerProfiles';

type RowProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  danger?: boolean;
};

function Row({ icon, label, onPress, danger = false }: RowProps) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon} size={20} color={danger ? C.red : C.ink} style={styles.rowIcon} />
      <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={C.muted} />
    </TouchableOpacity>
  );
}

const AVAILABILITY_SLOTS = ['09:00–11:00', '14:00–16:00'];

const SKILL_CHIPS = [
  'Elektroinstallation',
  'Malerarbeiten',
  'Sanitär',
  'Trockenbau',
  'Gartenarbeit',
  'Umzugshilfe',
];

const TAB_BAR_HEIGHT = 60;

export default function ProviderProfil() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [available, setAvailable] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(true);
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
=======
import { activeCategories, minRateFor } from '../../data/categories';
import { loadProviderProfile, updateProviderProfile } from '../../lib/providerProfiles';
import { filterContent } from '../../lib/contentFilter';
import { toast } from '../../components/ui/Toast';

export default function ProviderProfil() {
  const router = useRouter();
  const [name, setName] = useState('Yilmaz GmbH');
  const [bio, setBio] = useState('Professionelle Heizungs- und Sanitärarbeiten seit 2010. Festpreise, keine Überraschungen.');
  const [phone, setPhone] = useState('+49 178 123 4567');
  const [radius, setRadius] = useState('15');
  const [minPrice, setMinPrice] = useState('65');
  const [selectedServices, setSelectedServices] = useState<string[]>(['heizung-sanitaer']);
  const [available, setAvailable] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit modal state
  const [editModal, setEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');

  useEffect(() => {
    loadProviderProfile().then((p) => {
      if (p.business_name) setName(p.business_name);
      if (p.bio) setBio(p.bio);
      if (p.phone) setPhone(p.phone);
      if (p.radius_km) setRadius(String(p.radius_km));
      if (p.min_hourly_rate) setMinPrice(String(p.min_hourly_rate));
      if (p.category_ids.length) setSelectedServices(p.category_ids);
      setAvailable(p.available);
    });
  }, []);

  function openEditModal() {
    setEditName(name);
    setEditBio(bio);
    setEditModal(true);
  }

  async function saveEditModal() {
    const bioCheck = filterContent(editBio);
    if (bioCheck.blocked) {
      toast.error(bioCheck.reason ?? 'Inhalt blockiert');
      return;
    }
    await updateProviderProfile({ business_name: editName, bio: editBio });
    setName(editName);
    setBio(editBio);
    setEditModal(false);
    toast.success('Name & Beschreibung aktualisiert');
  }
>>>>>>> main

  useEffect(() => {
    if (!isSupabaseConfigured || !user?.id) return;
    setProfileLoading(true);
    getMyProviderProfile(user.id)
      .then(setProfile)
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, [user?.id]);

  useEffect(() => {
    if (profile !== null) setAvailable(profile.available);
  }, [profile]);

  const displayName = profile?.business_name
    ?? (user?.user_metadata?.full_name as string | undefined)
    ?? 'Anbieter';
  const initials = displayName
    .split(' ')
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'A';

  async function handleSignOut() {
    showAlert(
      'Ausloggen',
      'Möchten Sie sich wirklich ausloggen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Ausloggen',
          style: 'destructive',
          onPress: async () => {
            try {
              if (isSupabaseConfigured) await signOut();
            } catch { /* ignore */ }
            router.replace('/landing');
          },
        },
      ],
    );
  }

<<<<<<< HEAD
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }]}>
=======
  async function handleSave() {
    const price = parseFloat(minPrice);
    const floor = minRateFor(selectedServices);
    if (isNaN(price) || price < floor) {
      toast.warning(
        floor > 13
          ? `Mindestpreis für deine Leistungen: €${floor},00/h`
          : 'Mindestpreis €13,00/h (§1 MiLoG)',
      );
      return;
    }
    setSaving(true);
    await updateProviderProfile({
      business_name: name,
      bio,
      phone,
      min_hourly_rate: price,
      radius_km: parseInt(radius, 10),
      category_ids: selectedServices,
      available,
    });
    setSaving(false);
    toast.success('Profil gespeichert');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Mein Profil</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator size="small" color={C.surface} />
            : <Text style={styles.saveBtnText}>Speichern</Text>
          }
        </TouchableOpacity>
      </View>
>>>>>>> main

        <View style={styles.profileHeader}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.ratingRow}>
            {profile
              ? `${profile.rating_avg > 0 ? profile.rating_avg.toFixed(1) + ' ★ · ' + profile.rating_count + ' Bewertungen' : 'Noch keine Bewertungen'}`
              : profileLoading ? 'Lade …' : '—'}
          </Text>
          <View style={styles.badgesRow}>
            {profile?.kyc_status === 'approved' && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Identität geprüft ✓</Text>
              </View>
            )}
            {profile?.meister_verified && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Meister ✓</Text>
              </View>
            )}
            {profile?.stripe_onboarded && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Stripe ✓</Text>
              </View>
            )}
            {!profile?.kyc_status || profile.kyc_status !== 'approved' ? (
              <View style={[styles.badge, { backgroundColor: C.amberBg }]}>
                <Text style={[styles.badgeText, { color: C.amber }]}>KYC ausstehend</Text>
              </View>
            ) : null}
          </View>
          <TouchableOpacity onPress={() => showAlert('Öffentliches Profil', 'Die öffentliche Profilseite wird mit dem Launch freigeschaltet — Kunden finden Sie dann direkt per Link.')}>
            <Text style={styles.profileLink}>Profil öffentlich ansehen</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.section}>Verfügbarkeit</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { flex: 1 }]}>Verfügbar für neue Aufträge</Text>
            <Switch
              value={available}
              onValueChange={async (val) => {
                setAvailable(val);
                if (isSupabaseConfigured && user?.id) {
                  await updateProviderProfile(user.id, { available: val }).catch(() => {});
                }
              }}
              trackColor={{ true: C.green, false: C.border }}
              thumbColor={C.surface}
            />
          </View>
          {!available && (
            <View style={styles.amberBanner}>
              <Ionicons name="warning-outline" size={16} color={C.amber} />
              <Text style={styles.amberBannerText}>Neukunden sehen Sie nicht in Suchergebnissen</Text>
            </View>
          )}
          <View style={styles.sep} />
<<<<<<< HEAD
          <View style={styles.slotSection}>
            <Text style={styles.slotLabel}>Heutige Verfügbarkeit</Text>
            <View style={styles.slotRow}>
              {AVAILABILITY_SLOTS.map((slot) => (
                <View key={slot} style={styles.slotChip}>
                  <Text style={styles.slotChipText}>{slot}</Text>
                </View>
              ))}
=======
          <TouchableOpacity style={styles.row} onPress={() => router.push('/(provider)/pro')} activeOpacity={0.8}>
            <Ionicons name="star-outline" size={20} color={C.gold} style={styles.rowIcon} />
            <Text style={styles.rowLabel}>Provider Pro (€29/Mo.)</Text>
            <View style={styles.proInactiveBadge}>
              <Text style={styles.proInactiveBadgeText}>Inaktiv</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.muted} style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>

        {/* Basis */}
        <Text style={styles.section}>Basisinfo</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.editRow} onPress={openEditModal} activeOpacity={0.8}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Name / Firmenname</Text>
              <Text style={styles.inputDisplay}>{name}</Text>
              <Text style={styles.label}>Kurzbeschreibung</Text>
              <Text style={styles.inputDisplaySub} numberOfLines={2}>{bio}</Text>
            </View>
            <Ionicons name="pencil-outline" size={18} color={C.muted} />
          </TouchableOpacity>
          <View style={styles.sep} />
          <Text style={styles.label}>Telefon (nicht öffentlich)</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </View>

        {/* Leistungen */}
        <Text style={styles.section}>Leistungen</Text>
        <View style={styles.chipGrid}>
          {activeCategories().map((cat) => {
            const active = selectedServices.includes(cat.id);
            return (
>>>>>>> main
              <TouchableOpacity
                style={styles.slotAdd}
                onPress={() => showAlert('Verfügbarkeit', 'Individuelle Zeitslots können Sie nach dem Beta-Testbetrieb selbst verwalten. Im Moment zeigen wir Ihre generelle Verfügbarkeit.')}
              >
                <Text style={styles.slotAddText}>+ Slot hinzufügen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <Text style={styles.section}>Mein Profil bearbeiten</Text>
        <View style={styles.card}>
          <Row
            icon="person-outline"
            label="Name & Kontaktdaten"
            onPress={() => router.push('/(provider)/profil-bearbeiten')}
          />
          <View style={styles.sep} />
          <Row
            icon="briefcase-outline"
            label="Meine Leistungen"
            onPress={() => router.push('/(provider)/profil-bearbeiten')}
          />
          <View style={styles.sep} />
          <Row
            icon="pricetag-outline"
            label="Stundensätze & Preise"
            onPress={() => router.push('/(provider)/profil-bearbeiten')}
          />
          <View style={styles.sep} />
          <Row
            icon="images-outline"
            label="Fotos & Portfolio"
            onPress={() => router.push('/(provider)/profil-bearbeiten')}
          />
          <View style={styles.sep} />
          <Row
            icon="star-outline"
            label="Bewertungen ansehen"
            onPress={() => router.push('/(provider)/profil-bearbeiten')}
          />
        </View>

        <Text style={styles.section}>Werkzeug & Ausstattung</Text>
        <View style={styles.card}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.skillScrollContent}
            style={styles.skillScroll}
          >
            {SKILL_CHIPS.map((skill) => (
              <View key={skill} style={styles.skillChip}>
                <Text style={styles.skillChipText}>{skill}</Text>
              </View>
            ))}
          </ScrollView>
          <View style={styles.sep} />
          <TouchableOpacity
            style={styles.addServiceBtn}
            onPress={() => showAlert('Leistungen', 'Eigene Leistungen und Pauschalen können Sie ab dem offiziellen Launch hinzufügen. Im Beta werden Leistungen vom WERKR-Team eingetragen.')}
            activeOpacity={0.7}
          >
            <Text style={styles.addServiceBtnText}>+ Leistung hinzufügen</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.section}>Pro-Mitgliedschaft</Text>
        <View style={[styles.card, styles.cardGold]}>
          <View style={styles.proHeader}>
            <Ionicons name="star" size={20} color={C.gold} />
            <Text style={styles.proTitle}>WERKR Pro · Aktiv</Text>
          </View>
          <Text style={styles.proRenewal}>Ihr Abo verlängert sich am 01.07.2026</Text>
          <TouchableOpacity
            style={styles.proManageBtn}
            onPress={() => router.push('/(provider)/pro')}
            activeOpacity={0.7}
          >
            <Text style={styles.proManageBtnText}>Abo verwalten</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.section}>Stripe Auszahlung</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push('/(provider)/onboarding-stripe')}
            activeOpacity={0.7}
          >
            <Ionicons name="card-outline" size={20} color={C.ink} style={styles.rowIcon} />
            <Text style={styles.rowLabel}>Konto einrichten / verwalten</Text>
            <Ionicons name="chevron-forward" size={16} color={C.muted} />
          </TouchableOpacity>
        </View>

        <Text style={styles.section}>Einstellungen</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="notifications-outline" size={20} color={C.ink} style={styles.rowIcon} />
            <Text style={styles.rowLabel}>Push-Benachrichtigungen</Text>
            <Switch
              value={pushNotifs}
              onValueChange={setPushNotifs}
              trackColor={{ true: C.green, false: C.border }}
              thumbColor={C.surface}
            />
          </View>
          <View style={styles.sep} />
          <Row
            icon="chatbubbles-outline"
            label="Support & Hilfe"
            onPress={() => router.push('/support-chat')}
          />
          <View style={styles.sep} />
          <Row
            icon="shield-outline"
            label="Datenschutz & Einwilligung"
            onPress={() => router.push('/datenschutz')}
          />
          <View style={styles.sep} />
          <Row
            icon="document-text-outline"
            label="AGB"
            onPress={() => router.push('/agb')}
          />
          <View style={styles.sep} />
          <Row
            icon="log-out-outline"
            label="Ausloggen"
            danger
            onPress={handleSignOut}
          />
        </View>

        <Text style={styles.footer}>WERKR GmbH · v1.0.0</Text>
      </ScrollView>

      {/* ── Edit Modal: business_name + bio ── */}
      <Modal visible={editModal} transparent animationType="slide" onRequestClose={() => setEditModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Profil bearbeiten</Text>
              <TouchableOpacity onPress={() => setEditModal(false)}>
                <Ionicons name="close" size={22} color={C.ink} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Unternehmensname / Name</Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Yilmaz GmbH"
              placeholderTextColor={C.muted}
              maxLength={80}
            />

            <Text style={[styles.label, { marginTop: 14 }]}>Kurzbeschreibung</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextarea]}
              value={editBio}
              onChangeText={setEditBio}
              placeholder="Beschreibe deine Dienstleistungen …"
              placeholderTextColor={C.muted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={300}
            />
            <Text style={styles.charHint}>{editBio.length}/300</Text>

            <TouchableOpacity style={styles.modalSaveBtn} onPress={saveEditModal} activeOpacity={0.85}>
              <Ionicons name="checkmark" size={18} color={C.surface} />
              <Text style={styles.modalSaveBtnText}>Speichern</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
<<<<<<< HEAD
  container:          { flex: 1, backgroundColor: C.bg },
  scroll:             { paddingBottom: 40 },

  profileHeader:      { alignItems: 'center', paddingTop: 24, paddingBottom: 20, paddingHorizontal: 16 },
  avatarCircle:       { width: 80, height: 80, borderRadius: 40, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.gold },
  avatarInitials:     { fontSize: 26, fontWeight: '800', color: C.gold },
  profileName:        { fontSize: 20, fontWeight: '800', color: C.ink, marginTop: 12 },
  ratingRow:          { fontSize: 14, color: C.sub, fontWeight: '500', marginTop: 4 },
  badgesRow:          { flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' },
  badge:              { backgroundColor: C.greenBg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText:          { fontSize: 11, fontWeight: '600', color: C.green },
  profileLink:        { fontSize: 14, fontWeight: '600', color: C.gold, marginTop: 12 },

  section:            { fontSize: 12, fontWeight: '600', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginLeft: 20, marginTop: 20, marginBottom: 8 },
  card:               { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, marginHorizontal: 16, paddingHorizontal: 16, overflow: 'hidden' },
  cardGold:           { borderColor: C.gold },
  sep:                { height: 1, backgroundColor: C.border },

  row:                { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  rowIcon:            { marginRight: 12 },
  rowLabel:           { flex: 1, fontSize: 15, color: C.ink },
  rowLabelDanger:     { color: C.red },

  amberBanner:        { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.amberBg, borderRadius: 8, padding: 10, marginBottom: 12 },
  amberBannerText:    { fontSize: 13, color: C.amber, fontWeight: '500', flex: 1 },

  slotSection:        { paddingVertical: 14 },
  slotLabel:          { fontSize: 13, fontWeight: '600', color: C.ink, marginBottom: 10 },
  slotRow:            { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  slotChip:           { backgroundColor: C.greenBg, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  slotChipText:       { fontSize: 13, fontWeight: '600', color: C.green },
  slotAdd:            { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: C.border, borderStyle: 'dashed' },
  slotAddText:        { fontSize: 13, color: C.sub },

  skillScroll:        { marginHorizontal: -16 },
  skillScrollContent: { paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  skillChip:          { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  skillChipText:      { fontSize: 13, color: C.sub, fontWeight: '500' },
  addServiceBtn:      { paddingVertical: 14, alignItems: 'center' },
  addServiceBtnText:  { fontSize: 14, color: C.muted, fontWeight: '500' },

  proHeader:          { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 16 },
  proTitle:           { fontSize: 16, fontWeight: '800', color: C.gold },
  proRenewal:         { fontSize: 13, color: C.sub, marginTop: 6, marginBottom: 14 },
  proManageBtn:       { backgroundColor: C.goldBg, borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: C.gold },
  proManageBtnText:   { fontSize: 15, fontWeight: '700', color: C.gold },

  footer:             { textAlign: 'center', fontSize: 12, color: C.muted, marginTop: 24 },
=======
  container:       { flex: 1, backgroundColor: C.bg },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  title:           { fontSize: 22, fontWeight: '800', color: C.ink },
  saveBtn:         { backgroundColor: C.ink, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 9 },
  saveBtnText:     { fontSize: 14, fontWeight: '700', color: C.surface },
  scroll:          { paddingBottom: 32 },
  avatarSection:   { alignItems: 'center', paddingVertical: 20, gap: 10 },
  avatar:          { width: 80, height: 80, borderRadius: 40, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.gold },
  avatarText:      { fontSize: 26, fontWeight: '800', color: C.gold },
  changePhotoBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 8 },
  changePhotoText: { fontSize: 13, color: C.sub },
  section:         { fontSize: 12, fontWeight: '600', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginLeft: 20, marginTop: 20, marginBottom: 8 },
  card:            { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, marginHorizontal: 16, paddingHorizontal: 16 },
  row:             { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  rowIcon:         { marginRight: 12 },
  rowLabel:        { flex: 1, fontSize: 15, color: C.ink },
  sep:             { height: 1, backgroundColor: C.border },
  proInactiveBadge:     { backgroundColor: C.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  proInactiveBadgeText: { fontSize: 11, fontWeight: '600', color: C.muted },
  label:           { fontSize: 12, color: C.muted, fontWeight: '500', marginTop: 14, marginBottom: 4 },
  input:           { fontSize: 15, color: C.ink, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  multiline:       { minHeight: 64, textAlignVertical: 'top' },
  editRow:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  inputDisplay:    { fontSize: 15, color: C.ink, fontWeight: '600', marginBottom: 6 },
  inputDisplaySub: { fontSize: 13, color: C.sub, lineHeight: 18 },
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet:      { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 36 },
  modalHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle:      { fontSize: 18, fontWeight: '800', color: C.ink },
  modalInput:      { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.ink },
  modalTextarea:   { minHeight: 100, paddingTop: 12 },
  charHint:        { fontSize: 11, color: C.muted, textAlign: 'right', marginTop: 4, marginBottom: 16 },
  modalSaveBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.ink, borderRadius: 12, paddingVertical: 15 },
  modalSaveBtnText:{ fontSize: 16, fontWeight: '700', color: C.surface },
  chipGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  chip:            { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  chipActive:      { backgroundColor: C.ink, borderColor: C.ink },
  chipText:        { fontSize: 13, color: C.sub, fontWeight: '500' },
  chipTextActive:  { color: C.surface },
  infoRow:         { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingVertical: 12 },
  infoText:        { fontSize: 11, color: C.muted, flex: 1, lineHeight: 16 },
  verifyRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  uploadBtn:       { backgroundColor: C.amberBg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  uploadBtnText:   { fontSize: 12, color: C.amber, fontWeight: '700' },
>>>>>>> main
});
