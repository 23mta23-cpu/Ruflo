import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';

// TODO: replace placeholder before App Store submission
// §5 TMG / §55 RStV — Pflichtangaben für Telemediendienstleister.
// Platzhalter müssen vor App-Store-Einreichung durch echte Angaben ersetzt werden.

export default function Impressum() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Impressum</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Amber warning banner */}
        <View style={styles.banner}>
          <Ionicons name="information-circle" size={18} color={C.amber} style={styles.bannerIcon} />
          <Text style={styles.bannerText}>
            Diese Angaben sind Platzhalter und werden vor dem App-Store-Launch aktualisiert.
          </Text>
        </View>

        {/* §5 TMG */}
        <Section title="§ 5 TMG">
          <Text style={styles.blockLine}>WERKR GmbH</Text>
          <Text style={styles.blockLine}>Gesellschaft mit beschränkter Haftung (i. Gr.)</Text>
          <Text style={[styles.blockLine, styles.blockLineSpacer]}>Geschäftsführer: [Ihr Name]</Text>
          <Text style={styles.blockLine}>Musterstraße 1</Text>
          <Text style={styles.blockLine}>50667 Köln</Text>
          <Text style={styles.blockLine}>Deutschland</Text>
        </Section>

        {/* Registereintrag */}
        <Section title="Registereintrag">
          <Row label="Registergericht" value="Amtsgericht Köln" />
          <Row label="Handelsregisternummer" value="in Beantragung" isLast />
        </Section>

        {/* Kontakt */}
        <Section title="Kontakt">
          <TouchableOpacity
            style={styles.contactRow}
            onPress={() => Linking.openURL('mailto:kontakt@werkr.de')}
            activeOpacity={0.7}
          >
            <View style={styles.contactLeft}>
              <Ionicons name="mail-outline" size={16} color={C.sub} style={styles.contactIcon} />
              <Text style={styles.contactLabel}>E-Mail</Text>
            </View>
            <Text style={styles.contactValue}>kontakt@werkr.de</Text>
            <Ionicons name="chevron-forward" size={14} color={C.muted} />
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          <TouchableOpacity
            style={[styles.contactRow, styles.contactRowLast]}
            onPress={() => Linking.openURL('tel:+492210000000')}
            activeOpacity={0.7}
          >
            <View style={styles.contactLeft}>
              <Ionicons name="call-outline" size={16} color={C.sub} style={styles.contactIcon} />
              <Text style={styles.contactLabel}>Telefon</Text>
            </View>
            <Text style={styles.contactValue}>+49 (0)221 000 000 0</Text>
            <Ionicons name="chevron-forward" size={14} color={C.muted} />
          </TouchableOpacity>
        </Section>

        {/* Umsatzsteuer-ID */}
        <Section title="Umsatzsteuer-ID">
          <Text style={styles.para}>§ 27 a UStG</Text>
          <Text style={[styles.para, styles.amberText]}>in Beantragung</Text>
        </Section>

        {/* Online-Streitschlichtung */}
        <Section title="Online-Streitschlichtung">
          <Text style={styles.para}>
            {'Die EU-Kommission stellt eine Plattform für Online-Streitbeilegung (OS) bereit: '}
            <Text
              style={styles.link}
              onPress={() => Linking.openURL('https://ec.europa.eu/consumers/odr')}
            >
              https://ec.europa.eu/consumers/odr
            </Text>
          </Text>
          <Text style={[styles.para, styles.paraTop]}>
            Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
            Verbraucherschlichtungsstelle teilzunehmen.
          </Text>
        </Section>

        {/* Verantwortlich §55 Abs. 2 RStV */}
        <Section title="Verantwortlich für den Inhalt (§ 55 Abs. 2 RStV)">
          <Text style={styles.blockLine}>[Ihr Name]</Text>
          <Text style={styles.blockLine}>Musterstraße 1</Text>
          <Text style={styles.blockLine}>50667 Köln</Text>
        </Section>

        {/* Haftungsausschluss */}
        <Section title="Haftungsausschluss">
          <Text style={styles.para}>
            Für externe Links übernehmen wir trotz sorgfältiger inhaltlicher Kontrolle keine Haftung
            — für den Inhalt verlinkter Seiten sind ausschließlich deren Betreiber verantwortlich.
          </Text>
          <Text style={[styles.para, styles.paraTop]}>
            Die Inhalte dieser App wurden mit größtmöglicher Sorgfalt erstellt; eine Gewähr für
            Vollständigkeit, Aktualität und Richtigkeit können wir jedoch nicht übernehmen.
          </Text>
        </Section>

        {/* Footer */}
        <Text style={styles.footer}>
          Letzte Aktualisierung: Juni 2026 · Alle Angaben ohne Gewähr
        </Text>
        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

interface RowProps {
  label: string;
  value: string;
  isLast?: boolean;
}

function Row({ label, value, isLast = false }: RowProps) {
  return (
    <View style={[styles.row, isLast && styles.rowLast]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  backButton: { width: 32, alignItems: 'flex-start' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.ink },
  headerSpacer: { width: 32 },
  scroll: { padding: 20, paddingTop: 16 },
  banner: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.amberBg, borderRadius: 10, borderWidth: 1, borderColor: '#F5D9A8', padding: 12, marginBottom: 20, gap: 8 },
  bannerIcon: { marginTop: 1, flexShrink: 0 },
  bannerText: { flex: 1, fontSize: 13, color: C.amber, lineHeight: 18, fontWeight: '500' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 8 },
  card: { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 12 },
  blockLine: { fontSize: 14, color: C.ink, lineHeight: 21 },
  blockLineSpacer: { marginBottom: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.border },
  rowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  rowLabel: { fontSize: 13, color: C.sub, flex: 1, paddingRight: 8 },
  rowValue: { fontSize: 13, color: C.ink, fontWeight: '500', textAlign: 'right', flexShrink: 1 },
  contactRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  contactRowLast: { paddingBottom: 0 },
  contactLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  contactIcon: { marginRight: 8 },
  contactLabel: { fontSize: 13, color: C.sub },
  contactValue: { fontSize: 13, color: C.ink, fontWeight: '500', marginRight: 6 },
  rowDivider: { height: 1, backgroundColor: C.border, marginHorizontal: -14 },
  para: { fontSize: 13, color: C.sub, lineHeight: 19 },
  paraTop: { marginTop: 8 },
  amberText: { color: C.amber, fontWeight: '600', marginTop: 2 },
  link: { color: C.ink, textDecorationLine: 'underline' },
  footer: { fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 4 },
  bottomPad: { height: 40 },
});
