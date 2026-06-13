import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { C } from '../../constants/colors';
import { showAlert } from '../../lib/alert';

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

export default function ProviderProfil() {
  const router = useRouter();
  const [available, setAvailable] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(true);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <View style={styles.profileHeader}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>MK</Text>
          </View>
          <Text style={styles.profileName}>Michael Kaufmann</Text>
          <Text style={styles.ratingRow}>4.8 ★ · 47 Bewertungen</Text>
          <View style={styles.badgesRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Identität geprüft ✓</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Meister ✓</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Stripe ✓</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => showAlert('Profil', 'Öffentliche Profilansicht folgt nach Backend-Integration.')}>
            <Text style={styles.profileLink}>Profil öffentlich ansehen</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.section}>Verfügbarkeit</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { flex: 1 }]}>Verfügbar für neue Aufträge</Text>
            <Switch
              value={available}
              onValueChange={setAvailable}
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
          <View style={styles.slotSection}>
            <Text style={styles.slotLabel}>Heutige Verfügbarkeit</Text>
            <View style={styles.slotRow}>
              {AVAILABILITY_SLOTS.map((slot) => (
                <View key={slot} style={styles.slotChip}>
                  <Text style={styles.slotChipText}>{slot}</Text>
                </View>
              ))}
              <TouchableOpacity
                style={styles.slotAdd}
                onPress={() => showAlert('Slot hinzufügen', 'Funktion folgt nach Backend-Integration.')}
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
            onPress={() => showAlert('Backend ausstehend', 'Diese Funktion ist noch nicht verfügbar.')}
          />
          <View style={styles.sep} />
          <Row
            icon="briefcase-outline"
            label="Meine Leistungen"
            onPress={() => showAlert('Backend ausstehend', 'Diese Funktion ist noch nicht verfügbar.')}
          />
          <View style={styles.sep} />
          <Row
            icon="pricetag-outline"
            label="Stundensätze & Preise"
            onPress={() => showAlert('Backend ausstehend', 'Diese Funktion ist noch nicht verfügbar.')}
          />
          <View style={styles.sep} />
          <Row
            icon="images-outline"
            label="Fotos & Portfolio"
            onPress={() => showAlert('Backend ausstehend', 'Diese Funktion ist noch nicht verfügbar.')}
          />
          <View style={styles.sep} />
          <Row
            icon="star-outline"
            label="Bewertungen ansehen"
            onPress={() => showAlert('Backend ausstehend', 'Diese Funktion ist noch nicht verfügbar.')}
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
            onPress={() => showAlert('Leistung hinzufügen', 'Funktion folgt nach Backend-Integration.')}
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
            onPress={() =>
              showAlert(
                'Ausloggen',
                'Möchten Sie sich wirklich ausloggen?',
                [
                  { text: 'Abbrechen', style: 'cancel' },
                  {
                    text: 'Ausloggen',
                    style: 'destructive',
                    onPress: () => router.replace('/onboarding'),
                  },
                ],
              )
            }
          />
        </View>

        <Text style={styles.footer}>WERKR GmbH · v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
});
