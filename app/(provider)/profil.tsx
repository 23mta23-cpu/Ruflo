import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Switch, Modal, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/colors';
import { activeCategories, minRateFor } from '../../data/categories';
import { loadProviderProfile, updateProviderProfile } from '../../lib/providerProfiles';
import { filterContent } from '../../lib/contentFilter';
import { toast } from '../../components/ui/Toast';
import { supabase } from '../../lib/supabase';

export default function ProviderProfil() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [phone, setPhone] = useState('');
  const [radius, setRadius] = useState('15');
  const [minPrice, setMinPrice] = useState('13');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [available, setAvailable] = useState(true);
  const [saving, setSaving] = useState(false);
  const [kycVerified, setKycVerified] = useState(false);
  const [steuerIdSet, setSteuerIdSet] = useState(false);
  const [meisterVerified, setMeisterVerified] = useState(false);

  // Edit modal state
  const [editModal, setEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');

  useEffect(() => {
    loadProviderProfile()
      .then((p) => {
        setName(p.business_name);
        setBio(p.bio);
        setPhone(p.phone);
        setRadius(String(p.radius_km));
        setMinPrice(String(p.min_hourly_rate));
        setSelectedServices(p.category_ids);
        setAvailable(p.available);
        setKycVerified(p.kyc_verified);
      })
      .catch(() => {});

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('provider_profiles')
        .select('steuer_id, meister_verified')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (!data) return;
          setSteuerIdSet(!!data.steuer_id);
          setMeisterVerified(data.meister_verified ?? false);
        });
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

  function toggleService(s: string) {
    setSelectedServices((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

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
    try {
      await updateProviderProfile({
        business_name: name,
        bio,
        phone,
        min_hourly_rate: price,
        radius_km: parseInt(radius, 10),
        category_ids: selectedServices,
        available,
      });
      toast.success('Profil gespeichert');
    } catch {
      toast.error('Fehler beim Speichern — bitte erneut versuchen');
    } finally {
      setSaving(false);
    }
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {name.split(' ').map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2) || '?'}
            </Text>
          </View>
          <TouchableOpacity style={styles.changePhotoBtn}>
            <Ionicons name="camera-outline" size={14} color={C.sub} />
            <Text style={styles.changePhotoText}>Foto ändern</Text>
          </TouchableOpacity>
        </View>

        {/* Status */}
        <Text style={styles.section}>Status</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="radio-button-on-outline" size={20} color={available ? C.primary : C.muted} style={styles.rowIcon} />
            <Text style={styles.rowLabel}>Verfügbar für Anfragen</Text>
            <Switch value={available} onValueChange={setAvailable} trackColor={{ true: C.primary }} />
          </View>
          <View style={styles.sep} />
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
              <TouchableOpacity
                key={cat.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggleService(cat.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Preise & Radius */}
        <Text style={styles.section}>Preise & Einsatzgebiet</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Mindestpreis (€/h)</Text>
          <TextInput
            style={styles.input}
            value={minPrice}
            onChangeText={setMinPrice}
            keyboardType="numeric"
          />
          <View style={styles.sep} />
          <Text style={styles.label}>Einsatzradius (km)</Text>
          <TextInput
            style={styles.input}
            value={radius}
            onChangeText={setRadius}
            keyboardType="numeric"
          />
          <View style={styles.sep} />
          <View style={styles.infoRow}>
            <Ionicons name="information-circle-outline" size={14} color={C.muted} />
            <Text style={styles.infoText}>
              Gemäß §1 MiLoG gilt ein Mindestlohn von €13,00/h. Niedrigere Preise werden blockiert.
            </Text>
          </View>
        </View>

        {/* Verifizierung */}
        <Text style={styles.section}>Verifizierung</Text>
        <View style={styles.card}>
          <View style={styles.verifyRow}>
            <Ionicons name={kycVerified ? 'checkmark-circle' : 'time-outline'} size={20} color={kycVerified ? C.primary : C.amber} />
            <Text style={styles.rowLabel}>{kycVerified ? 'Ausweis verifiziert' : 'Ausweis — Prüfung ausstehend'}</Text>
          </View>
          <View style={styles.sep} />
          <View style={styles.verifyRow}>
            <Ionicons name={steuerIdSet ? 'checkmark-circle' : 'time-outline'} size={20} color={steuerIdSet ? C.primary : C.amber} />
            <Text style={styles.rowLabel}>{steuerIdSet ? 'Steuer-ID hinterlegt' : 'Steuer-ID — ausstehend'}</Text>
          </View>
          <View style={styles.sep} />
          <View style={styles.verifyRow}>
            <Ionicons name={meisterVerified ? 'checkmark-circle' : 'time-outline'} size={20} color={meisterVerified ? C.primary : C.amber} />
            <Text style={styles.rowLabel}>{meisterVerified ? 'Gewerbeschein verifiziert' : 'Gewerbeschein — ausstehend'}</Text>
            {!meisterVerified && (
              <TouchableOpacity
                style={styles.uploadBtn}
                onPress={() => toast.info('Senden Sie Ihren Gewerbeschein an: verify@werkr.de')}
              >
                <Text style={styles.uploadBtnText}>Einreichen</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Auszahlungen */}
        <Text style={styles.section}>Auszahlungen</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push('/(provider)/onboarding-stripe')}
          >
            <Ionicons name="card-outline" size={20} color={C.ink} style={styles.rowIcon} />
            <Text style={styles.rowLabel}>Auszahlungskonto (Stripe)</Text>
            <Ionicons name="chevron-forward" size={16} color={C.muted} />
          </TouchableOpacity>
        </View>

        {/* Danger */}
        <Text style={styles.section}>Konto</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            onPress={async () => {
              await supabase.auth.signOut();
              router.replace('/landing');
            }}
          >
            <Ionicons name="log-out-outline" size={20} color={C.red} style={styles.rowIcon} />
            <Text style={[styles.rowLabel, { color: C.red }]}>Ausloggen</Text>
            <Ionicons name="chevron-forward" size={16} color={C.muted} />
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
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
              placeholder="z. B. Muster Handwerk GmbH"
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
  container:       { flex: 1, backgroundColor: C.bg },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  title:           { fontSize: 22, fontWeight: '800', color: C.ink },
  saveBtn:         { backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 9 },
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
  modalSaveBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 12, paddingVertical: 15 },
  modalSaveBtnText:{ fontSize: 16, fontWeight: '700', color: C.surface },
  chipGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  chip:            { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  chipActive:      { backgroundColor: C.primary, borderColor: C.primary },
  chipText:        { fontSize: 13, color: C.sub, fontWeight: '500' },
  chipTextActive:  { color: C.surface },
  infoRow:         { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingVertical: 12 },
  infoText:        { fontSize: 11, color: C.muted, flex: 1, lineHeight: 16 },
  verifyRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  uploadBtn:       { backgroundColor: C.amberBg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  uploadBtnText:   { fontSize: 12, color: C.amber, fontWeight: '700' },
});
