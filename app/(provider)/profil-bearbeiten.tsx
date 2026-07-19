import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safeBack } from '../../lib/nav';
import { C } from '../../constants/colors';
import { T } from '../../constants/typography';
import { showAlert } from '../../lib/alert';
import { toast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import { getMyProviderProfile, updateProviderProfile, type ProviderProfile } from '../../lib/providerProfiles';

const TRADES = [
  { id: 'sanitaer',      label: 'Sanitär & Heizung' },
  { id: 'elektro',       label: 'Elektriker' },
  { id: 'maler',         label: 'Maler & Lackierer' },
  { id: 'schreiner',     label: 'Schreiner / Tischler' },
  { id: 'fliesenleger',  label: 'Fliesenleger' },
  { id: 'trockenbau',    label: 'Trockenbau' },
  { id: 'dachdecker',    label: 'Dachdecker' },
  { id: 'garten',        label: 'Garten & Landschaftsbau' },
  { id: 'reinigung',     label: 'Reinigung' },
  { id: 'umzug',         label: 'Umzug & Transport' },
  { id: 'nachhilfe',     label: 'Nachhilfe & Bildung' },
  { id: 'sonstiges',     label: 'Sonstiges' },
];

export default function ProfilBearbeiten() {
  const router = useRouter();
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProviderProfile | null>(null);

  const [businessName, setBusinessName] = useState('');
  const [bio, setBio] = useState('');
  const [tradeId, setTradeId] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [minRate, setMinRate] = useState('13');

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !user?.id) {
      setLoading(false);
      return;
    }
    getMyProviderProfile(user.id)
      .then((p) => {
        if (p) {
          setProfile(p);
          setBusinessName(p.business_name ?? '');
          setBio(p.bio ?? '');
          setTradeId(p.trade_id ?? null);
          setPhone(p.phone ?? '');
          setMinRate(String(p.min_hourly_rate ?? 13));
        }
      })
      .catch(() => {
        // Ladefehler sichtbar machen — sonst zeigt das Formular leere Felder
        // und der Anbieter überschreibt beim Speichern versehentlich sein
        // echtes Profil mit Leerwerten.
        toast.error('Profil konnte nicht geladen werden — bitte erneut öffnen, bevor du speicherst.');
      })
      .finally(() => setLoading(false));
  }, [user?.id]);

  async function handleSave() {
    if (!user?.id) return;
    setSaving(true);
    try {
      if (isSupabaseConfigured) {
        const parsedRate = parseFloat(minRate.replace(',', '.'));
        await updateProviderProfile(user.id, {
          business_name: businessName.trim() || null,
          bio: bio.trim() || null,
          trade_id: tradeId,
          phone: phone.trim() || null,
          min_hourly_rate: Number.isFinite(parsedRate) && parsedRate >= 13 ? parsedRate : 13,
        });
      }
      showAlert('Gespeichert', 'Ihre Profildaten wurden aktualisiert.', [
        { text: 'OK', onPress: () => safeBack(router) },
      ]);
    } catch {
      showAlert('Fehler', 'Änderungen konnten nicht gespeichert werden. Bitte versuchen Sie es erneut.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={C.ink} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zurück" onPress={() => safeBack(router)} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={C.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profil bearbeiten</Text>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving
              ? <ActivityIndicator size="small" color={C.surface} />
              : <Text style={styles.saveBtnText}>Speichern</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Über mich ─────────────────────────────────────── */}
          <Text style={styles.section}>Über mich</Text>
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Anzeigename / Unternehmensname</Text>
            <TextInput
              style={styles.input}
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="z. B. Müller Sanitärtechnik"
              placeholderTextColor={C.muted}
              returnKeyType="next"
              maxLength={80}
            />
            <View style={styles.sep} />
            <Text style={styles.fieldLabel}>Kurzbeschreibung (Bio)</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={bio}
              onChangeText={setBio}
              placeholder="Beschreiben Sie kurz Ihre Leistungen und Erfahrungen …"
              placeholderTextColor={C.muted}
              multiline
              numberOfLines={4}
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{bio.length}/500</Text>
          </View>

          {/* ── Gewerk / Leistungsbereich ─────────────────────── */}
          <Text style={styles.section}>Mein Gewerk</Text>
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Hauptkategorie</Text>
            <View style={styles.tradeGrid}>
              {TRADES.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.tradeTile, tradeId === t.id && styles.tradeTileActive]}
                  onPress={() => setTradeId(tradeId === t.id ? null : t.id)}
                  activeOpacity={0.85}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: tradeId === t.id }}
                >
                  <Text style={styles.tradeTileText} numberOfLines={1}>{t.label}</Text>
                  <Ionicons name={tradeId === t.id ? 'radio-button-on' : 'radio-button-off'} size={17} color={tradeId === t.id ? C.primary : C.muted} />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Kontakt & Preise ─────────────────────────────── */}
          <Text style={styles.section}>Kontakt & Preise</Text>
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Telefonnummer</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+49 170 1234567"
              placeholderTextColor={C.muted}
              keyboardType="phone-pad"
              returnKeyType="next"
              maxLength={30}
            />
            <View style={styles.sep} />
            <Text style={styles.fieldLabel}>Mindest-Stundensatz (€)</Text>
            <TextInput
              style={styles.input}
              value={minRate}
              onChangeText={setMinRate}
              placeholder="13"
              placeholderTextColor={C.muted}
              keyboardType="decimal-pad"
              returnKeyType="done"
              maxLength={6}
            />
            <Text style={[styles.charCount, { marginBottom: 8 }]}>Mindestlohn 2025: €13,00/Std.</Text>
          </View>

          {/* ── Fotos & Portfolio ────────────────────────────── */}
          <Text style={styles.section}>Fotos & Portfolio</Text>
          <View style={styles.card}>
            <View style={styles.comingSoonRow}>
              <View style={styles.comingSoonIcon}>
                <Ionicons name="images-outline" size={22} color={C.muted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.comingSoonTitle}>Portfolio-Fotos folgen</Text>
                <Text style={styles.comingSoonText}>
                  Fotos von Ihren Projekten können Sie nach dem Beta-Testbetrieb direkt hochladen. Dies erhöht das Vertrauen potenzieller Kunden erheblich.
                </Text>
              </View>
            </View>
          </View>

          {/* ── Bewertungen ──────────────────────────────────── */}
          <Text style={styles.section}>Bewertungen</Text>
          <View style={styles.card}>
            {profile && profile.rating_count > 0 ? (
              <View style={styles.ratingRow}>
                <View style={styles.ratingBig}>
                  <Text style={styles.ratingScore}>{(profile.rating_avg ?? 0).toFixed(1)}</Text>
                  <Ionicons name="star" size={20} color={C.gold} style={styles.ratingStar} />
                </View>
                <Text style={styles.ratingCount}>{profile.rating_count} Bewertungen</Text>
              </View>
            ) : (
              <View style={styles.comingSoonRow}>
                <View style={styles.comingSoonIcon}>
                  <Ionicons name="star-outline" size={22} color={C.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.comingSoonTitle}>Noch keine Bewertungen</Text>
                  <Text style={styles.comingSoonText}>
                    Nach Ihrem ersten abgeschlossenen Auftrag können Kunden eine Bewertung hinterlassen.
                  </Text>
                </View>
              </View>
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: C.bg },
  loadingCenter:   { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14 },
  backBtn:         { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:     { ...T.h3, color: C.ink },
  saveBtn:         { backgroundColor: C.primary, borderRadius: 9, paddingHorizontal: 18, paddingVertical: 9, minWidth: 90, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText:     { ...T.btnSm, color: C.surface },

  scroll:          { paddingHorizontal: 16, paddingBottom: 32 },
  section:         { ...T.label, color: C.muted, marginTop: 20, marginBottom: 8, marginLeft: 4 },
  card:            { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, overflow: 'hidden' },
  sep:             { height: 1, backgroundColor: C.border, marginVertical: 12 },

  fieldLabel:      { ...T.caption, ...T.semibold, color: C.sub, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input:           { ...T.base, color: C.ink, borderWidth: 1, borderColor: C.border, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.bg, marginBottom: 4 },
  inputMulti:      { minHeight: 100, paddingTop: 10 },
  charCount:       { ...T.caption, color: C.muted, textAlign: 'right', marginBottom: 10 },

  tradeGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 10 },
  tradeTile:       { width: '46%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, borderWidth: 1.5, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, minHeight: 48, backgroundColor: C.bg },
  tradeTileActive: { borderColor: C.primary, backgroundColor: C.primaryBg },
  tradeTileText:   { flex: 1, fontSize: 13, color: C.ink, fontWeight: '600' },

  comingSoonRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingBottom: 12 },
  comingSoonIcon:  { width: 38, height: 38, borderRadius: 19, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  comingSoonTitle: { ...T.sm, ...T.semibold, color: C.ink, marginBottom: 4 },
  comingSoonText:  { ...T.caption, color: C.sub, lineHeight: 17 },

  ratingRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 12 },
  ratingBig:       { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  ratingScore:     { ...T.priceLg, color: C.ink },
  ratingStar:      { marginBottom: 2 },
  ratingCount:     { ...T.body, color: C.sub },
});
