import React, { useState } from 'react';
import {
  View, Text, Modal, ScrollView, TouchableOpacity, StyleSheet, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/colors';

interface Props {
  visible: boolean;
  onAccept: (analytics: boolean) => void;
}

const ITEMS = [
  {
    id: 'necessary',
    icon: 'shield-checkmark-outline' as const,
    title: 'Notwendig',
    desc: 'Betrieb der Plattform, Authentifizierung, Escrow-Zahlungsabwicklung. Kann nicht deaktiviert werden.',
    required: true,
  },
  {
    id: 'analytics',
    icon: 'bar-chart-outline' as const,
    title: 'Analyse',
    desc: 'Anonymisierte Nutzungsstatistiken zur Verbesserung der App (keine personenbezogenen Daten).',
    required: false,
  },
  {
    id: 'pstg',
    icon: 'document-text-outline' as const,
    title: 'PStTG / DAC7-Meldung',
    desc: 'Gesetzlich vorgeschriebene Meldung an das BZSt bei ≥30 Transaktionen oder ≥€2.000 Umsatz p.a.',
    required: true,
  },
];

export function DsgvoConsent({ visible, onAccept }: Props) {
  const [analytics, setAnalytics] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Ionicons name="shield-outline" size={28} color={C.primary} />
            <Text style={styles.title}>Datenschutz & Einwilligung</Text>
          </View>

          <Text style={styles.intro}>
            WERKR verarbeitet deine Daten gemäß <Text style={styles.link} onPress={() => Linking.openURL('https://werkr.de/datenschutz')}>Datenschutzerklärung</Text> und <Text style={styles.link} onPress={() => Linking.openURL('https://werkr.de/agb')}>AGB</Text>. Mindestens 18 Jahre erforderlich (§ JArbSchG).
          </Text>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {ITEMS.map((item) => (
              <View key={item.id} style={styles.item}>
                <TouchableOpacity
                  style={styles.itemHeader}
                  onPress={() => setExpanded(expanded === item.id ? null : item.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.itemLeft}>
                    <Ionicons name={item.icon} size={18} color={item.required ? C.primary : C.sub} />
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    {item.required && (
                      <View style={styles.reqBadge}>
                        <Text style={styles.reqBadgeText}>Pflicht</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.itemRight}>
                    {!item.required && (
                      <TouchableOpacity
                        style={[styles.toggle, analytics && styles.toggleOn]}
                        onPress={() => setAnalytics(!analytics)}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.toggleThumb, analytics && styles.toggleThumbOn]} />
                      </TouchableOpacity>
                    )}
                    {item.required && (
                      <Ionicons name="checkmark-circle" size={20} color={C.primary} />
                    )}
                    <Ionicons
                      name={expanded === item.id ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={C.muted}
                      style={{ marginLeft: 6 }}
                    />
                  </View>
                </TouchableOpacity>
                {expanded === item.id && (
                  <Text style={styles.itemDesc}>{item.desc}</Text>
                )}
              </View>
            ))}

            <View style={styles.legalBox}>
              <Ionicons name="information-circle-outline" size={14} color={C.muted} />
              <Text style={styles.legalText}>
                Du kannst deine Einwilligung jederzeit in den Einstellungen widerrufen. Pflichtdaten sind für den Vertragsabschluss notwendig (Art. 6 Abs. 1 lit. b DSGVO). DAC7-Meldepflicht ergibt sich aus dem PStTG.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.btnRow}>
            <TouchableOpacity
              style={styles.declineBtn}
              onPress={() => onAccept(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.declineText}>Nur notwendige</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.acceptBtn}
              onPress={() => onAccept(analytics)}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark" size={18} color={C.surface} />
              <Text style={styles.acceptText}>Einverstanden</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>
            WERKR GmbH · Datenschutzbeauftragter: datenschutz@werkr.de
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet:          { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingBottom: 36, maxHeight: '92%' },
  handle:         { width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 20 },
  header:         { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  title:          { fontSize: 20, fontWeight: '800', color: C.ink },
  intro:          { fontSize: 13, color: C.sub, lineHeight: 19, marginBottom: 16 },
  link:           { color: C.primary, textDecorationLine: 'underline' },
  list:           { maxHeight: 360 },
  item:           { borderWidth: 1, borderColor: C.border, borderRadius: 10, marginBottom: 8, padding: 12 },
  itemHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemLeft:       { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  itemTitle:      { fontSize: 14, fontWeight: '600', color: C.ink },
  itemRight:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reqBadge:       { backgroundColor: C.primaryBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  reqBadgeText:   { fontSize: 10, color: C.primary, fontWeight: '600' },
  itemDesc:       { fontSize: 12, color: C.sub, marginTop: 8, lineHeight: 17 },
  toggle:         { width: 38, height: 22, borderRadius: 11, backgroundColor: C.border, justifyContent: 'center', paddingHorizontal: 2 },
  toggleOn:       { backgroundColor: C.primary },
  toggleThumb:    { width: 18, height: 18, borderRadius: 9, backgroundColor: C.surface },
  toggleThumbOn:  { alignSelf: 'flex-end' },
  legalBox:       { flexDirection: 'row', gap: 6, backgroundColor: C.bg, borderRadius: 8, padding: 10, marginTop: 4, marginBottom: 12 },
  legalText:      { flex: 1, fontSize: 11, color: C.muted, lineHeight: 16 },
  btnRow:         { flexDirection: 'row', gap: 10, marginTop: 8 },
  declineBtn:     { flex: 1, paddingVertical: 15, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  declineText:    { fontSize: 14, fontWeight: '600', color: C.sub },
  acceptBtn:      { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, paddingVertical: 15, borderRadius: 14 },
  acceptText:     { fontSize: 15, fontWeight: '700', color: C.surface },
  footer:         { fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 10 },
});
