import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { safeBack } from '../lib/nav';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { COMPANY_LEGAL_INLINE } from '../constants/legal';

type GuaranteeItem = {
  icon: string;
  title: string;
  body: string;
};

const GUARANTEES: GuaranteeItem[] = [
  {
    icon: 'shield-checkmark',
    title: 'Escrow-Zahlungsschutz',
    body: 'Ihr Geld verlässt Werkant erst, wenn Sie die Arbeit bestätigen. Bei keiner Einigung greift unsere Schlichtung — keine Vorleistung ohne Absicherung.',
  },
  {
    icon: 'checkmark-circle',
    title: 'Verifizierte Anbieter',
    body: 'Alle Handwerker laden Gewerbeschein, Personalausweis und Steuernummer hoch. KYC-Prüfung innerhalb von 24 h durch unser Trust-Team.',
  },
  {
    icon: 'people',
    title: 'Nachbarschaft — 100% ans Hilfsprojekt',
    body: 'Bei Nachbarschaftsdiensten geht der Betrag zu 100 % an den Helfer. Werkant erhebt lediglich €1,99 Schutzgebühr — der Rest bleibt beim Helfer.',
  },
  {
    icon: 'star',
    title: 'Transparentes Bewertungssystem',
    body: 'Jede 5-Sterne-Bewertung ist an einen abgeschlossenen Auftrag gebunden — keine Fake-Reviews. Strike-System sperrt Verstöße automatisch.',
  },
  {
    icon: 'document-text',
    title: 'Digitaler Vertrag mit Widerrufsrecht',
    body: 'Jeder Auftrag ist ein rechtsverbindlicher Vertrag mit vereinbartem Preis (§312 BGB) und 14-tägigem Widerrufsrecht. Alle Dokumente stehen als PDF bereit.',
  },
  {
    icon: 'chatbubble-ellipses',
    title: 'Werkant-Schlichtung bei Streit',
    body: 'Beim Widerspruch (Reklamation) analysiert unser Team Chat-Verläufe, Fotos und Vertragsdetails. Entscheidung binnen 5 Werktagen.',
  },
  {
    icon: 'lock-closed',
    title: 'PStTG & DSGVO-Konformität',
    body: 'Plattform-Steuer-Transparenzgesetz (§5 PStTG) — Jahresbericht für alle Anbieter ab Schwellenwert. Alle Daten in EU-Rechenzentren (Frankfurt).',
  },
];

const FAQ = [
  {
    q: 'Was passiert, wenn der Handwerker nicht erscheint?',
    a: 'Sie öffnen eine Reklamation. Werkant prüft Ihre Evidenz und erstattet den eingeschlossenen Betrag innerhalb von 5 Werktagen zurück.',
  },
  {
    q: 'Wann erhalte ich mein Geld zurück?',
    a: 'Sofort nach Schließen der Reklamation — per Karte/SEPA zurück auf Ihre ursprüngliche Zahlungsmethode (Stripe-gesteuert).',
  },
  {
    q: 'Gibt es eine Höchstgrenze für die Garantie?',
    a: 'Im Beta: bis €5.000 pro Auftrag. Beim Launch wird die Grenze auf €25.000 angehoben (mit Gewerbeschein-Verifizierung beim Anbieter).',
  },
  {
    q: 'Gilt die Garantie auch für Nachbarschaftsdienste?',
    a: 'Ja — die €1,99-Schutzgebühr aktiviert Escrow auch für C2C. Bei Streit unter €50 schlichten wir kulant.',
  },
];

export default function GarantieScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zurück" onPress={() => safeBack(router)} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Werkant Garantie</Text>
        <View style={styles.headerBadge}>
          <Ionicons name="shield-checkmark" size={13} color={C.primary} />
          <Text style={styles.headerBadgeText}>Aktiv</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="shield-checkmark" size={40} color={C.primary} />
          </View>
          <Text style={styles.heroTitle}>Ihr Schutz — von Anfang bis Ende</Text>
          <Text style={styles.heroSub}>
            Werkant sichert jeden Auftrag durch Escrow, KYC-Verifizierung und digitale Verträge. Sie zahlen erst, wenn Sie zufrieden sind.
          </Text>
        </View>

        {/* Guarantees */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>WAS Werkant ABSICHERT</Text>
          {GUARANTEES.map((g) => (
            <View key={g.title} style={styles.card}>
              <View style={styles.cardIcon}>
                <Ionicons name={g.icon as any} size={22} color={C.primary} />
              </View>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{g.title}</Text>
                <Text style={styles.cardBody}>{g.body}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Fee transparency box */}
        <View style={styles.feeBox}>
          <Text style={styles.feeBoxTitle}>Faire, transparente Gebühren</Text>
          <FeeRow label="Handwerker-Provision" value="8 %" note="vom Auftragswert" />
          <FeeRow label="Kunden-Service-Gebühr" value="2,5 %" note="mind. €1,50" />
          <FeeRow label="Nachbarschaft-Schutzgebühr" value="€1,99" note="pauschal" />
          <FeeRow label="Pro-Abo (Anbieter, optional)" value="€29/mo" note="30 Tage gratis" />
          <View style={styles.feeNote}>
            <Ionicons name="information-circle-outline" size={13} color={C.muted} />
            <Text style={styles.feeNoteText}>Alle Gebühren werden vor jeder Buchung klar ausgewiesen — keine versteckten Kosten.</Text>
          </View>
        </View>

        {/* FAQ */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>HÄUFIGE FRAGEN</Text>
          {FAQ.map((item) => (
            <View key={item.q} style={styles.faqItem}>
              <Text style={styles.faqQ}>{item.q}</Text>
              <Text style={styles.faqA}>{item.a}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        <View style={styles.cta}>
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={() => router.push('/auftrag-aufgeben')}
            activeOpacity={0.85}
          >
            <Ionicons name="search-outline" size={18} color={C.surface} />
            <Text style={styles.ctaBtnText}>Jetzt Handwerker finden</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/support-chat')}
            activeOpacity={0.8}
            style={styles.ctaSecondary}
          >
            <Text style={styles.ctaSecondaryText}>Frage an Werkant-Support →</Text>
          </TouchableOpacity>
        </View>

        {/* Legal */}
        <View style={styles.legal}>
          <Text style={styles.legalText}>
            Die Werkant Garantie ist eine freiwillige Servicezusage von {COMPANY_LEGAL_INLINE}. Sie besteht zusätzlich zu gesetzlichen Verbraucherrechten. Escrow-Abwicklung via Stripe Payments. Beta-Betrieb: Haftung auf Vorsatz und grobe Fahrlässigkeit beschränkt.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function FeeRow({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <View style={styles.feeRow}>
      <Text style={styles.feeLabel}>{label}</Text>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.feeValue}>{value}</Text>
        <Text style={styles.feeNote2}>{note}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: C.bg },

  header:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14 },
  backBtn:        { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:    { flex: 1, fontSize: 18, fontWeight: '700', color: C.ink },
  headerBadge:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.primaryBg, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  headerBadgeText: { fontSize: 12, fontWeight: '700', color: C.primary },

  hero:           { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 28, backgroundColor: C.primaryBg },
  heroIcon:       { width: 80, height: 80, borderRadius: 24, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 18, shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 3 },
  heroTitle:      { fontSize: 20, fontWeight: '700', color: C.ink, textAlign: 'center', marginBottom: 10, lineHeight: 28 },
  heroSub:        { fontSize: 14, color: C.sub, textAlign: 'center', lineHeight: 21 },

  section:        { paddingHorizontal: 20, paddingVertical: 20 },
  sectionLabel:   { fontSize: 11, fontWeight: '700', color: C.primary, letterSpacing: 0.8, marginBottom: 14, textTransform: 'uppercase' },

  card:           { flexDirection: 'row', gap: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16, marginBottom: 10 },
  cardIcon:       { width: 44, height: 44, borderRadius: 12, backgroundColor: C.primaryBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardText:       { flex: 1 },
  cardTitle:      { fontSize: 14, fontWeight: '700', color: C.ink, marginBottom: 4 },
  cardBody:       { fontSize: 13, color: C.sub, lineHeight: 19 },

  feeBox:         { margin: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 18 },
  feeBoxTitle:    { fontSize: 15, fontWeight: '700', color: C.ink, marginBottom: 16 },
  feeRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  feeLabel:       { fontSize: 13, color: C.sub, flex: 1 },
  feeValue:       { fontSize: 14, fontWeight: '700', color: C.ink },
  feeNote2:       { fontSize: 10, color: C.muted, textAlign: 'right' },
  feeNote:        { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 12 },
  feeNoteText:    { flex: 1, fontSize: 11, color: C.muted, lineHeight: 16 },

  faqItem:        { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, marginBottom: 8 },
  faqQ:           { fontSize: 14, fontWeight: '700', color: C.ink, marginBottom: 6 },
  faqA:           { fontSize: 13, color: C.sub, lineHeight: 19 },

  cta:            { paddingHorizontal: 20, paddingVertical: 16, gap: 12 },
  ctaBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16 },
  ctaBtnText:     { fontSize: 15, fontWeight: '700', color: C.surface },
  ctaSecondary:   { alignItems: 'center', paddingVertical: 4 },
  ctaSecondaryText: { fontSize: 14, color: C.primary, fontWeight: '600' },

  scroll:         { paddingBottom: 40 },
  legal:          { paddingHorizontal: 20, paddingBottom: 24 },
  legalText:      { fontSize: 10, color: C.muted, lineHeight: 15 },
});
