import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';

// §5 TMG — Impressumspflicht. Pflichtangaben für Telemediendienstleister.
// Platzhalter-Daten müssen vor App-Store-Einreichung durch echte ersetzt werden.

export default function Impressum() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Impressum</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Section title="Angaben gem. §5 TMG">
          <Line label="Unternehmen"   value="WERKR Operations GmbH (i. Gr.)" />
          <Line label="Vertreten durch" value="[Geschäftsführer Name]" />
          <Line label="Adresse"       value="Musterstraße 1, 50667 Köln" />
          <Line label="Registergericht" value="Amtsgericht Köln" />
          <Line label="Handelsregisternr." value="HRB XXXXXX (Eintragung beantragt)" />
          <Line label="USt-IdNr."     value="DE000000000 (beantragt)" />
        </Section>

        <Section title="Kontakt">
          <Line label="E-Mail"    value="hallo@werkr.de" />
          <Line label="Telefon"  value="+49 (0) 221 XXXXXXX" />
          <Line label="Web"      value="https://werkr.de" />
        </Section>

        <Section title="Verantwortlich für den Inhalt (§ 18 Abs. 2 MStV)">
          <Line label="Name"    value="[Verantwortliche Person]" />
          <Line label="Adresse" value="Musterstraße 1, 50667 Köln" />
        </Section>

        <Section title="Plattformregulierung">
          <Paragraph text="WERKR ist ein Vermittlungsdienstleister im Sinne des §2 PStTG (Plattformen-Steuertransparenzgesetz). WERKR selbst erbringt keine Handwerks- oder Dienstleistungen, sondern vermittelt lediglich zwischen Anbietern und Auftraggebern." />
          <Paragraph text="Für Handwerksleistungen, die der Meisterpflicht unterliegen (§1 HwO), ist der jeweilige Anbieter selbst für den Nachweis der fachlichen Eignung verantwortlich." />
        </Section>

        <Section title="Streitbeilegung">
          <Paragraph text="Die EU-Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: https://ec.europa.eu/consumers/odr" />
          <Paragraph text="Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen." />
        </Section>

        <Section title="Haftung für Inhalte">
          <Paragraph text="Als Diensteanbieter sind wir gemäß §7 Abs.1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen." />
        </Section>

        <Text style={styles.note}>Stand: Juni 2025 · Platzhalter-Daten werden vor Launch ersetzt.</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.lineRow}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue}>{value}</Text>
    </View>
  );
}

function Paragraph({ text }: { text: string }) {
  return <Text style={styles.para}>{text}</Text>;
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  title:        { fontSize: 17, fontWeight: '700', color: C.ink },
  scroll:       { padding: 20, paddingTop: 6 },
  section:      { marginBottom: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  card:         { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14 },
  lineRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border },
  lineLabel:    { fontSize: 13, color: C.sub, flex: 1 },
  lineValue:    { fontSize: 13, color: C.ink, fontWeight: '500', flex: 2, textAlign: 'right' },
  para:         { fontSize: 13, color: C.sub, lineHeight: 19, paddingVertical: 6 },
  note:         { fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 8 },
});
