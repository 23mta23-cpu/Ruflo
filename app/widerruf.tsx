import React, { useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { toast } from '../components/ui/Toast';
import { COMPANY, COMPANY_FULL, COMPANY_LEGAL_INLINE, COMPANY_ADDRESS_LINE, LEGAL_PLACEHOLDER } from '../constants/legal';

// Muster-Widerrufsformular gem. Anlage 2 zu Art. 246a §1 Abs.2 S.1 Nr.1 EGBGB.
// Widerrufsbelehrung gem. §312d BGB i.V.m. Art. 246a §1 EGBGB.
// Firmendaten zentral in constants/legal.ts.

export default function WiderrufScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [adresse, setAdresse] = useState('');
  const [bestelldatum, setBestelldatum] = useState('');
  const [submitted, setSubmitted] = useState(false);

  async function handleSend() {
    if (!name.trim() || !adresse.trim()) {
      toast.warning('Bitte Name und Anschrift ausfüllen');
      return;
    }
    const text =
      `Werkant Widerrufsformular\n\n` +
      `An: ${COMPANY_FULL}\n` +
      `E-Mail: ${COMPANY.emailWithdrawal}\n\n` +
      `Hiermit widerrufe ich den von mir abgeschlossenen Vertrag über die Erbringung der folgenden Dienstleistung.\n\n` +
      `Bestellt am: ${bestelldatum || '[Datum eintragen]'}\n` +
      `Name: ${name}\n` +
      `Anschrift: ${adresse}\n\n` +
      `Datum: ${new Date().toLocaleDateString('de-DE')}`;
    await Share.share({ message: text, title: 'Widerrufsformular Werkant' });
    setSubmitted(true);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zurück" onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Widerruf</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Amber warning banner */}
        {LEGAL_PLACEHOLDER && (
          <View style={styles.banner}>
            <Ionicons name="information-circle" size={18} color={C.amber} style={styles.bannerIcon} />
            <Text style={styles.bannerText}>
              Diese Angaben sind Platzhalter und werden vor dem App-Store-Launch aktualisiert.
            </Text>
          </View>
        )}

        {/* Widerrufsbelehrung */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Widerrufsbelehrung</Text>
          <Text style={styles.body}>
            <Text style={styles.bold}>Widerrufsrecht{'\n'}</Text>
            Sie haben das Recht, binnen 14 Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt 14 Tage ab dem Tag des Vertragsabschlusses.{'\n\n'}
            Um Ihr Widerrufsrecht auszuüben, müssen Sie uns ({COMPANY_FULL}, E-Mail: {COMPANY.emailWithdrawal}) mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder eine E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.{'\n\n'}
            <Text style={styles.bold}>Erlöschen des Widerrufsrechts{'\n'}</Text>
            Das Widerrufsrecht erlischt vorzeitig, wenn die Dienstleistung vollständig erbracht ist und Sie vor Beginn der Ausführung ausdrücklich zugestimmt haben, dass wir mit der Ausführung beginnen, und Ihre Kenntnis davon bestätigt haben, dass Sie Ihr Widerrufsrecht bei vollständiger Vertragserfüllung verlieren.{'\n\n'}
            <Text style={styles.bold}>Folgen des Widerrufs{'\n'}</Text>
            Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen
            erhalten haben, unverzüglich und spätestens binnen 14 Tagen ab dem Tag zurückzuzahlen,
            an dem die Mitteilung über Ihren Widerruf bei uns eingegangen ist. Für diese Rückzahlung
            verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion
            eingesetzt haben, sofern nicht ausdrücklich etwas anderes vereinbart wurde; in keinem
            Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.{'\n\n'}
            Haben Sie verlangt, dass die Dienstleistung während der Widerrufsfrist beginnen soll,
            so haben Sie uns einen angemessenen Betrag zu zahlen, der dem Anteil der bis zu dem
            Zeitpunkt, zu dem Sie uns von der Ausübung des Widerrufsrechts unterrichten, bereits
            erbrachten Dienstleistungen im Vergleich zum Gesamtumfang der vorgesehenen
            Dienstleistungen entspricht (§357a BGB).{'\n\n'}
            Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung
            des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.
          </Text>
        </View>

        {/* Muster-Widerrufsformular — Anlage 2 EGBGB verbatim */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Muster-Widerrufsformular</Text>
          <Text style={styles.hint}>
            (Anlage 2 zu Art. 246a §1 Abs. 2 Satz 1 Nr. 1 EGBGB — gesetzlich vorgeschrieben)
          </Text>
          <Text style={styles.body}>
            Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück.
          </Text>

          <View style={styles.formBox}>
            <Text style={styles.formLabel}>An: {COMPANY_LEGAL_INLINE}</Text>
            <Text style={styles.formLabel}>{COMPANY_ADDRESS_LINE}</Text>
            <Text style={styles.formLabel}>E-Mail: {COMPANY.emailWithdrawal}</Text>
          </View>

          <Text style={styles.body}>
            Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über die Erbringung der folgenden Dienstleistung (*){'\n\n'}
            (*) Unzutreffendes streichen.
          </Text>
        </View>

        {/* Digitales Formular */}
        {!submitted ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Formular ausfüllen & senden</Text>

            <Text style={styles.label}>Bestellt am (Datum des Auftrags)</Text>
            <TextInput
              style={styles.input}
              value={bestelldatum}
              onChangeText={setBestelldatum}
              placeholder="z. B. 01.06.2025"
              placeholderTextColor={C.muted}
            />

            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Vor- und Nachname"
              placeholderTextColor={C.muted}
            />

            <Text style={styles.label}>Anschrift *</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={adresse}
              onChangeText={setAdresse}
              placeholder="Straße, PLZ, Ort"
              placeholderTextColor={C.muted}
              multiline
              numberOfLines={2}
            />

            <TouchableOpacity style={styles.cta} onPress={handleSend} activeOpacity={0.85}>
              <Ionicons name="send-outline" size={18} color={C.surface} />
              <Text style={styles.ctaText}>Widerruf erklären</Text>
            </TouchableOpacity>

            <Text style={styles.footnote}>
              Das Formular wird als Text geteilt — Sie können es per E-Mail an {COMPANY.emailWithdrawal} schicken oder ausdrucken.
            </Text>
          </View>
        ) : (
          <View style={[styles.card, styles.successCard]}>
            <Ionicons name="checkmark-circle" size={28} color={C.primary} />
            <Text style={styles.successText}>Widerruf vorbereitet</Text>
            <Text style={styles.successBody}>
              Bitte senden Sie das Formular per E-Mail an {COMPANY.emailWithdrawal}. Ihre Widerrufsfrist gilt als gewahrt, wenn Sie die Erklärung vor Fristablauf absenden.
            </Text>
          </View>
        )}

        <Text style={styles.legal}>
          Stand: Juni 2025 · Gem. §312d BGB, Art. 246a EGBGB, Anlage 2 EGBGB
        </Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.bg },
  banner:      { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.amberBg, borderRadius: 10, borderWidth: 1, borderColor: C.goldBd, padding: 12, marginBottom: 4, gap: 8 },
  bannerIcon:  { marginTop: 1, flexShrink: 0 },
  bannerText:  { flex: 1, fontSize: 13, color: C.amber, lineHeight: 18, fontWeight: '500' },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  title:       { fontSize: 17, fontWeight: '700', color: C.ink },
  scroll:      { padding: 20, paddingTop: 6, gap: 14 },
  card:        { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 16 },
  cardTitle:   { fontSize: 13, fontWeight: '700', color: C.ink, marginBottom: 10 },
  hint:        { fontSize: 11, color: C.muted, marginBottom: 10, fontStyle: 'italic' },
  body:        { fontSize: 13, color: C.sub, lineHeight: 20 },
  bold:        { fontWeight: '700', color: C.ink },
  formBox:     { backgroundColor: C.bg, borderRadius: 8, padding: 12, marginVertical: 10 },
  formLabel:   { fontSize: 13, color: C.ink, lineHeight: 20 },
  label:       { fontSize: 12, fontWeight: '600', color: C.sub, marginTop: 12, marginBottom: 4 },
  input:       { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.ink, backgroundColor: C.bg },
  inputMulti:  { minHeight: 60, textAlignVertical: 'top' },
  cta:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 12, paddingVertical: 13, marginTop: 16 },
  ctaText:     { color: C.surface, fontSize: 15, fontWeight: '700' },
  footnote:    { fontSize: 11, color: C.muted, textAlign: 'center', lineHeight: 16, marginTop: 10 },
  successCard: { alignItems: 'center', gap: 8 },
  successText: { fontSize: 15, fontWeight: '700', color: C.primary },
  successBody: { fontSize: 13, color: C.sub, lineHeight: 19, textAlign: 'center' },
  legal:       { fontSize: 11, color: C.muted, textAlign: 'center' },
});
