import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Switch, StyleSheet,
} from 'react-native';
import { showAlert } from '../../lib/alert';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { C } from '../../constants/colors';
import { Badge } from '../../components/ui/Badge';
import { activeCategories, minRateFor } from '../../data/categories';

const COMPLETENESS = 72;

type CompletenessItem = {
  label: string;
  done: boolean;
  partial: boolean;
};

const completenessItems: CompletenessItem[] = [
  { label: 'Profilbild hochladen', done: false, partial: false },
  { label: 'Kurzbeschreibung ergänzen', done: false, partial: true },
  { label: 'Gewerbeschein verifiziert', done: true, partial: false },
];

type ServicePrice = {
  id: string;
  label: string;
  price: string;
};

const mockServicePrices: ServicePrice[] = [
  { id: 'heizung-sanitaer', label: 'Heizung & Sanitär', price: '€65/h' },
];

export default function ProviderProfil() {
  const router = useRouter();
  const [name, setName] = useState('Yilmaz GmbH');
  const [bio, setBio] = useState('Professionelle Heizungs- und Sanitärarbeiten seit 2010. Festpreise, keine Überraschungen.');
  const [phone, setPhone] = useState('+49 178 123 4567');
  const [radius, setRadius] = useState('15');
  const [minPrice, setMinPrice] = useState('65');
  const [selectedServices, setSelectedServices] = useState<string[]>(['heizung-sanitaer']);
  const [proAbo, setProAbo] = useState(true);
  const [available, setAvailable] = useState(true);

  function toggleService(s: string) {
    setSelectedServices((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  function handleSave() {
    const price = parseFloat(minPrice);
    const floor = minRateFor(selectedServices);
    if (isNaN(price) || price < floor) {
      showAlert(
        'Mindestpreis',
        floor > 13
          ? `Für deine gewählten Leistungen gilt ein Mindestpreis von €${floor},00/h.`
          : 'Der Mindestpreis muss mindestens €13,00/h betragen (§1 MiLoG).',
      );
      return;
    }
    showAlert('Gespeichert', 'Dein Profil wurde aktualisiert.');
  }

  function completenessIcon(item: CompletenessItem) {
    if (item.done) return <Ionicons name="checkmark-circle" size={16} color={C.green} />;
    if (item.partial) return <Ionicons name="remove-circle-outline" size={16} color={C.amber} />;
    return <Ionicons name="close-circle" size={16} color={C.red} />;
  }

  function completenessColor(item: CompletenessItem): string {
    if (item.done) return C.green;
    if (item.partial) return C.amber;
    return C.red;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerIconBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Mein Profil</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => showAlert('Profil teilen', 'Teilen-Link: werkr.de/anbieter/yilmaz-gmbh')}
          >
            <Ionicons name="share-social-outline" size={22} color={C.ink} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>Speichern</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <View style={styles.completenessCard}>
          <View style={styles.completenessHeader}>
            <Text style={styles.completenessTitle}>Profil-Vollständigkeit</Text>
            <Text style={styles.completenessPercent}>{COMPLETENESS} %</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${COMPLETENESS}%` }]} />
          </View>
          <Text style={styles.completenessSubtitle}>
            Ihr Profil ist zu {COMPLETENESS} % vollständig
          </Text>
          {completenessItems.map((item) => (
            <View key={item.label} style={styles.completenessItem}>
              {completenessIcon(item)}
              <Text style={[styles.completenessItemLabel, { color: completenessColor(item) }]}>
                {item.label}
              </Text>
            </View>
          ))}
          <TouchableOpacity
            onPress={() => showAlert('Profil vervollständigen', 'Bitte laden Sie ein Profilbild hoch und ergänzen Sie Ihre Kurzbeschreibung.')}
          >
            <Text style={styles.completenessLink}>Jetzt vervollständigen</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.avatarSection}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>YG</Text>
            </View>
            {proAbo && (
              <View style={styles.proChip}>
                <Text style={styles.proChipText}>PRO</Text>
              </View>
            )}
          </View>
          <View style={styles.avatarNameRow}>
            <Text style={styles.avatarName}>{name}</Text>
          </View>
          <TouchableOpacity style={styles.changePhotoBtn}>
            <Ionicons name="camera-outline" size={14} color={C.sub} />
            <Text style={styles.changePhotoText}>Foto ändern</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.section}>Statistiken</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>47</Text>
            <Text style={styles.statLabel}>Aufträge</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statValue}>4.7 ★</Text>
            <Text style={styles.statLabel}>Bewertung</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statValue}>~2h</Text>
            <Text style={styles.statLabel}>Antwortzeit</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statValue}>2%</Text>
            <Text style={styles.statLabel}>Stornierung</Text>
          </View>
        </View>

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

        <Text style={styles.section}>Leistungspreise</Text>
        <View style={styles.card}>
          {mockServicePrices.map((sp, idx) => (
            <View key={sp.id}>
              {idx > 0 && <View style={styles.sep} />}
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{sp.label}</Text>
                <Text style={styles.servicePriceText}>{sp.price}</Text>
                <TouchableOpacity
                  style={styles.editIconBtn}
                  onPress={() => showAlert('Preis bearbeiten', 'Preisbearbeitung kommt nach Backend-Integration.')}
                >
                  <Ionicons name="pencil-outline" size={16} color={C.sub} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.section}>Verifikationsstatus</Text>
        <View style={styles.card}>
          <View style={styles.verifyRow}>
            <Ionicons name="checkmark-circle" size={20} color={C.green} />
            <Text style={styles.rowLabel}>Gewerbeschein</Text>
            <Badge label="Verifiziert" variant="green" />
          </View>
          <View style={styles.sep} />
          <View style={styles.verifyRow}>
            <Ionicons name="checkmark-circle" size={20} color={C.green} />
            <Text style={styles.rowLabel}>Personalausweis</Text>
            <Badge label="Verifiziert" variant="green" />
          </View>
          <View style={styles.sep} />
          <View style={styles.verifyRow}>
            <Ionicons name="time-outline" size={20} color={C.amber} />
            <Text style={styles.rowLabel}>Steuer-ID (USt-IdNr.)</Text>
            <Badge label="Ausstehend" variant="amber" />
            <TouchableOpacity
              style={styles.uploadBtn}
              onPress={() => showAlert('Steuer-ID einreichen', 'Bitte laden Sie Ihre Umsatzsteuer-Identifikationsnummer hoch.')}
            >
              <Text style={styles.uploadBtnText}>Einreichen</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.sep} />
          <View style={styles.verifyRow}>
            <Ionicons name="ribbon-outline" size={20} color={C.muted} />
            <Text style={styles.rowLabel}>Meisterbrief</Text>
            <Badge label="Optional" variant="amber" />
          </View>
          <View style={styles.sep} />
          <View style={styles.verifyRow}>
            <Ionicons name="checkmark-circle" size={20} color={C.green} />
            <Text style={styles.rowLabel}>IBAN (Auszahlung)</Text>
            <Badge label="Hinterlegt" variant="green" />
          </View>
        </View>

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

        <Text style={styles.section}>Konto</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => showAlert('Support kontaktieren', 'Unser Support ist erreichbar unter support@werkr.de oder +49 30 123 4567.')}
          >
            <Ionicons name="help-circle-outline" size={20} color={C.ink} style={styles.rowIcon} />
            <Text style={styles.rowLabel}>Support kontaktieren</Text>
            <Ionicons name="chevron-forward" size={16} color={C.muted} />
          </TouchableOpacity>
          <View style={styles.sep} />
          <TouchableOpacity
            style={styles.row}
            onPress={() => showAlert(
              'Konto pausieren',
              'Möchten Sie Ihr Konto wirklich pausieren? Sie erhalten keine neuen Anfragen.',
              [
                { text: 'Abbrechen', style: 'cancel' },
                { text: 'Pausieren', style: 'destructive' },
              ],
            )}
          >
            <Ionicons name="pause-circle-outline" size={20} color={C.amber} style={styles.rowIcon} />
            <Text style={[styles.rowLabel, { color: C.amber }]}>Konto pausieren</Text>
            <Ionicons name="chevron-forward" size={16} color={C.muted} />
          </TouchableOpacity>
          <View style={styles.sep} />
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
          <View style={styles.sep} />
          <TouchableOpacity
            style={styles.row}
            onPress={() => showAlert(
              'Konto löschen',
              'Diese Aktion ist unwiderruflich. Alle Ihre Daten werden dauerhaft gelöscht.',
              [
                { text: 'Abbrechen', style: 'cancel' },
                { text: 'Konto löschen', style: 'destructive' },
              ],
            )}
          >
            <Ionicons name="trash-outline" size={20} color={C.red} style={styles.rowIcon} />
            <Text style={[styles.rowLabel, { color: C.red }]}>Konto löschen</Text>
            <Ionicons name="chevron-forward" size={16} color={C.muted} />
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:            { flex: 1, backgroundColor: C.bg },
  header:               { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  headerIconBtn:        { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:                { flex: 1, fontSize: 20, fontWeight: '800', color: C.ink },
  headerRight:          { flexDirection: 'row', alignItems: 'center', gap: 4 },
  saveBtn:              { backgroundColor: C.ink, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  saveBtnText:          { fontSize: 14, fontWeight: '700', color: C.surface },
  scroll:               { paddingBottom: 32 },

  completenessCard:     { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, marginHorizontal: 16, marginTop: 12, padding: 16 },
  completenessHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  completenessTitle:    { fontSize: 14, fontWeight: '700', color: C.ink },
  completenessPercent:  { fontSize: 14, fontWeight: '800', color: C.gold },
  progressTrack:        { height: 6, backgroundColor: C.border, borderRadius: 3, marginBottom: 8 },
  progressFill:         { height: 6, backgroundColor: C.gold, borderRadius: 3 },
  completenessSubtitle: { fontSize: 12, color: C.sub, marginBottom: 12 },
  completenessItem:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  completenessItemLabel:{ fontSize: 13, fontWeight: '500' },
  completenessLink:     { fontSize: 13, fontWeight: '700', color: C.gold, marginTop: 10 },

  avatarSection:        { alignItems: 'center', paddingVertical: 20, gap: 8 },
  avatarWrapper:        { position: 'relative' },
  avatar:               { width: 80, height: 80, borderRadius: 40, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.gold },
  avatarText:           { fontSize: 26, fontWeight: '800', color: C.gold },
  proChip:              { position: 'absolute', bottom: -4, right: -4, backgroundColor: C.gold, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 2, borderColor: C.surface },
  proChipText:          { fontSize: 9, fontWeight: '900', color: C.surface, letterSpacing: 0.5 },
  avatarNameRow:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avatarName:           { fontSize: 17, fontWeight: '700', color: C.ink },
  changePhotoBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 8 },
  changePhotoText:      { fontSize: 13, color: C.sub },

  statsRow:             { flexDirection: 'row', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, marginHorizontal: 16, paddingVertical: 14 },
  statCell:             { flex: 1, alignItems: 'center', gap: 2 },
  statDivider:          { width: 1, backgroundColor: C.border },
  statValue:            { fontSize: 15, fontWeight: '800', color: C.ink },
  statLabel:            { fontSize: 10, color: C.muted, fontWeight: '500', textAlign: 'center' },

  section:              { fontSize: 12, fontWeight: '600', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginLeft: 20, marginTop: 20, marginBottom: 8 },
  card:                 { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, marginHorizontal: 16, paddingHorizontal: 16 },
  row:                  { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  rowIcon:              { marginRight: 12 },
  rowLabel:             { flex: 1, fontSize: 15, color: C.ink },
  sep:                  { height: 1, backgroundColor: C.border },
  proBanner:            { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 8, padding: 12, backgroundColor: C.goldBg, borderRadius: 10 },
  proBannerText:        { fontSize: 12, color: C.gold, fontWeight: '600', flex: 1 },
  label:                { fontSize: 12, color: C.muted, fontWeight: '500', marginTop: 14, marginBottom: 4 },
  input:                { fontSize: 15, color: C.ink, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  multiline:            { minHeight: 64, textAlignVertical: 'top' },
  chipGrid:             { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  chip:                 { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  chipActive:           { backgroundColor: C.ink, borderColor: C.ink },
  chipText:             { fontSize: 13, color: C.sub, fontWeight: '500' },
  chipTextActive:       { color: C.surface },
  infoRow:              { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingVertical: 12 },
  infoText:             { fontSize: 11, color: C.muted, flex: 1, lineHeight: 16 },
  servicePriceText:     { fontSize: 14, fontWeight: '600', color: C.sub, marginRight: 8 },
  editIconBtn:          { padding: 4 },
  verifyRow:            { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13 },
  uploadBtn:            { backgroundColor: C.amberBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginLeft: 6 },
  uploadBtnText:        { fontSize: 12, color: C.amber, fontWeight: '700' },
});
