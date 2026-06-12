import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Switch, StyleSheet, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { C } from '../../constants/colors';

const SERVICES = [
  'Heizung & Sanitär', 'Elektro', 'Renovierung', 'Maler', 'Tischler',
  'Fliesen', 'Reinigung', 'Nachhilfe', 'IT-Support', 'Garten',
];

export default function ProviderProfil() {
  const router = useRouter();
  const [name, setName] = useState('Yilmaz GmbH');
  const [bio, setBio] = useState('Professionelle Heizungs- und Sanitärarbeiten seit 2010. Festpreise, keine Überraschungen.');
  const [phone, setPhone] = useState('+49 178 123 4567');
  const [radius, setRadius] = useState('15');
  const [minPrice, setMinPrice] = useState('65');
  const [selectedServices, setSelectedServices] = useState<string[]>(['Heizung & Sanitär']);
  const [proAbo, setProAbo] = useState(true);
  const [available, setAvailable] = useState(true);

  function toggleService(s: string) {
    setSelectedServices((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  function handleSave() {
    const price = parseFloat(minPrice);
    if (isNaN(price) || price < 13) {
      Alert.alert('Mindestlohn', 'Der Mindestpreis muss mindestens €13,00/h betragen (§1 MiLoG).');
      return;
    }
    Alert.alert('Gespeichert', 'Dein Profil wurde aktualisiert.');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Mein Profil</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Speichern</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>YG</Text>
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
            <Ionicons name="radio-button-on-outline" size={20} color={available ? C.green : C.muted} style={styles.rowIcon} />
            <Text style={styles.rowLabel}>Verfügbar für Anfragen</Text>
            <Switch value={available} onValueChange={setAvailable} trackColor={{ true: C.green }} />
          </View>
          <View style={styles.sep} />
          <View style={styles.row}>
            <Ionicons name="star-outline" size={20} color={C.gold} style={styles.rowIcon} />
            <Text style={styles.rowLabel}>Provider Pro Abo (€29/Mo.)</Text>
            <Switch value={proAbo} onValueChange={setProAbo} trackColor={{ true: C.gold }} />
          </View>
        </View>

        {proAbo && (
          <View style={styles.proBanner}>
            <Ionicons name="checkmark-circle" size={16} color={C.gold} />
            <Text style={styles.proBannerText}>Pro aktiv — Featured + Statistiken + 0 Provisionsrabatt</Text>
          </View>
        )}

        {/* Basis */}
        <Text style={styles.section}>Basisinfo</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Name / Firmenname</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} />
          <View style={styles.sep} />
          <Text style={styles.label}>Kurzbeschreibung</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={3}
          />
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
          {SERVICES.map((s) => {
            const active = selectedServices.includes(s);
            return (
              <TouchableOpacity
                key={s}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggleService(s)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{s}</Text>
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
            <Ionicons name="checkmark-circle" size={20} color={C.green} />
            <Text style={styles.rowLabel}>Ausweis verifiziert</Text>
          </View>
          <View style={styles.sep} />
          <View style={styles.verifyRow}>
            <Ionicons name="checkmark-circle" size={20} color={C.green} />
            <Text style={styles.rowLabel}>Steuer-ID hinterlegt</Text>
          </View>
          <View style={styles.sep} />
          <View style={styles.verifyRow}>
            <Ionicons name="time-outline" size={20} color={C.amber} />
            <Text style={styles.rowLabel}>Gewerbeschein — ausstehend</Text>
            <TouchableOpacity style={styles.uploadBtn}>
              <Text style={styles.uploadBtnText}>Hochladen</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Danger */}
        <Text style={styles.section}>Konto</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            onPress={async () => {
              await AsyncStorage.removeItem('werkr_auth_token');
              router.replace('/onboarding');
            }}
          >
            <Ionicons name="log-out-outline" size={20} color={C.red} style={styles.rowIcon} />
            <Text style={[styles.rowLabel, { color: C.red }]}>Ausloggen</Text>
            <Ionicons name="chevron-forward" size={16} color={C.muted} />
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  proBanner:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 8, padding: 12, backgroundColor: C.goldBg, borderRadius: 10 },
  proBannerText:   { fontSize: 12, color: C.gold, fontWeight: '600', flex: 1 },
  label:           { fontSize: 12, color: C.muted, fontWeight: '500', marginTop: 14, marginBottom: 4 },
  input:           { fontSize: 15, color: C.ink, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  multiline:       { minHeight: 64, textAlignVertical: 'top' },
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
});
