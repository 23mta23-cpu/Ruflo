import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { COMPANY, COMPANY_FULL, LEGAL_PLACEHOLDER } from '../constants/legal';

// DSGVO Art. 13/14 — Informationspflicht bei der Datenerhebung.
// Firmendaten zentral in constants/legal.ts. Muss vor Launch durch Rechtsanwalt geprüft werden.

const SECTIONS = [
  {
    id: 'verantwortlicher',
    title: 'Verantwortlicher',
    content: `${COMPANY_FULL}\nE-Mail: ${COMPANY.emailPrivacy}\n\nDatenschutzbeauftragter: ${COMPANY.dpoName}, ${COMPANY.emailPrivacy} (Pflicht ab 20 Mitarbeitern oder bei umfangreicher Datenverarbeitung, §37 BDSG)`,
  },
  {
    id: 'daten',
    title: 'Welche Daten wir verarbeiten',
    content: '• Registrierungsdaten: Name, E-Mail, Telefon, Adresse\n• Identitätsdaten: Geburtsdatum (18+-Prüfung), Personalausweis-Scan\n• Gewerbedaten (Anbieter): Steuernummer, Gewerbeschein, IBAN (tokenisiert)\n• Transaktionsdaten: Aufträge, Zahlungen, Bewertungen\n• Kommunikation: Chat-Nachrichten\n• Technische Daten: IP-Adresse, Gerätekennungen, App-Version',
  },
  {
    id: 'zweck',
    title: 'Zwecke & Rechtsgrundlagen',
    content: '• Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO): Vermittlung, Abrechnung, Kommunikation\n• Rechtliche Verpflichtung (Art. 6 Abs. 1 lit. c DSGVO): PStTG/DAC7-Meldepflicht, GwG-KYC, §147 AO Aufbewahrungspflicht\n• Einwilligung (Art. 6 Abs. 1 lit. a DSGVO): Analyse-Cookies, Marketing-E-Mails\n• Berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO): Betrugsabwehr, Sicherheitsmaßnahmen',
  },
  {
    id: 'empfaenger',
    title: 'Empfänger Ihrer Daten',
    content: '• Stripe Inc. (Zahlungsabwicklung, USA) — SCCs nach Art. 46 DSGVO\n• AWS Frankfurt (Hosting, EU) — EU-Server\n• BZSt (Bundeszentralamt für Steuern) — DAC7-Meldepflicht ab 30 Transaktionen oder €2.000/Jahr\n• Auf Anfrage: Strafverfolgungsbehörden bei gesetzlicher Verpflichtung',
  },
  {
    id: 'rechte',
    title: 'Ihre Rechte',
    content: '• Art. 15 DSGVO: Auskunft über gespeicherte Daten\n• Art. 16 DSGVO: Berichtigung unrichtiger Daten\n• Art. 17 DSGVO: Löschung ("Recht auf Vergessenwerden") — Ausnahme: §147 AO Aufbewahrung 10 Jahre für Transaktionsdaten\n• Art. 18 DSGVO: Einschränkung der Verarbeitung\n• Art. 20 DSGVO: Datenportabilität (maschinenlesbarer Export)\n• Art. 21 DSGVO: Widerspruch gegen Verarbeitung\n• Art. 7 Abs. 3 DSGVO: Einwilligung jederzeit widerrufen\n\nBeschwerden: Landesbeauftragte für Datenschutz NRW, https://ldi.nrw.de',
  },
  {
    id: 'speicherdauer',
    title: 'Speicherdauer',
    content: '• Konto-/Profildaten: bis Kontolöschung\n• Transaktionsdaten: 10 Jahre (§147 AO, §257 HGB)\n• Chat-Nachrichten: 6 Monate nach Auftragsabschluss\n• Consent-Log: 3 Jahre (Art. 5 Abs. 2 DSGVO Rechenschaftspflicht)\n• IP-Adressen (Logs): 7 Tage (Sicherheit)',
  },
  {
    id: 'cookies',
    title: 'Cookies & Tracking (Planet49-Urteil EuGH)',
    content: 'Wir setzen nur technisch notwendige Cookies/Local Storage ohne Einwilligung ein.\n\nAnalytik-Cookies (z. B. App-Nutzungsstatistiken) werden nur nach ausdrücklicher Opt-in-Einwilligung gesetzt — ein "Ablehnen"-Button ist immer gleich prominent wie "Akzeptieren" (EuGH C-673/17).\n\nSie können Ihre Einwilligung jederzeit in Einstellungen → Datenschutz widerrufen.',
  },
  {
    id: 'pstg',
    title: 'PStTG / DAC7 — Steuerliche Meldepflicht',
    content: 'Werkant ist als digitale Plattform nach §2 PStTG meldepflichtig. Anbieter, die ≥ 30 Transaktionen oder ≥ €2.000 Jahresumsatz erzielen, werden dem Bundeszentralamt für Steuern (BZSt) gemeldet (Meldung bis 31. Januar des Folgejahres).\n\nDie gemeldeten Daten umfassen: Name, Adresse, Steuer-ID, Gesamtvergütung, Plattformgebühren.\n\nDiese Verarbeitung basiert auf Art. 6 Abs. 1 lit. c DSGVO (rechtliche Verpflichtung).',
  },
  {
    id: 'minderjaehrige',
    title: 'Minderjährige',
    content: 'Werkant ist ausschließlich für Personen ab 18 Jahren (§§106, 107 BGB). Die Plattform richtet sich nicht an Minderjährige. Wir erheben wissentlich keine Daten von Personen unter 18 Jahren. Das Geburtsdatum wird zur Altersverifikation erhoben und nach erfolgter Prüfung nur so lange gespeichert wie rechtlich erforderlich.',
  },
];

export default function DatenschutzScreen() {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>('daten');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Zurück" onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Datenschutz</Text>
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

        <Text style={styles.intro}>
          Wir verarbeiten Ihre Daten ausschließlich im Einklang mit der DSGVO und dem BDSG.
          Diese Erklärung gilt gem. Art. 13/14 DSGVO für alle Nutzer der Werkant-App.
        </Text>

        {SECTIONS.map((sec) => {
          const open = expanded === sec.id;
          return (
            <TouchableOpacity
              key={sec.id}
              style={styles.accordion}
              onPress={() => setExpanded(open ? null : sec.id)}
              activeOpacity={0.8}
            >
              <View style={styles.accordionHeader}>
                <Text style={styles.accordionTitle}>{sec.title}</Text>
                <Ionicons
                  name={open ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={C.sub}
                />
              </View>
              {open && <Text style={styles.accordionBody}>{sec.content}</Text>}
            </TouchableOpacity>
          );
        })}

        <Text style={styles.note}>
          Version 1.0 · Stand: Juni 2025 · {COMPANY.emailPrivacy}{'\n'}
          Muss vor Launch durch einen Datenschutzrechtsanwalt geprüft werden.
        </Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: C.bg },
  banner:          { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.amberBg, borderRadius: 10, borderWidth: 1, borderColor: C.goldBd, padding: 12, marginBottom: 8, gap: 8 },
  bannerIcon:      { marginTop: 1, flexShrink: 0 },
  bannerText:      { flex: 1, fontSize: 13, color: C.amber, lineHeight: 18, fontWeight: '500' },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  title:           { fontSize: 17, fontWeight: '700', color: C.ink },
  scroll:          { padding: 20, paddingTop: 6, gap: 8 },
  intro:           { fontSize: 13, color: C.sub, lineHeight: 19, marginBottom: 8 },
  accordion:       { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14 },
  accordionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  accordionTitle:  { fontSize: 14, fontWeight: '700', color: C.ink, flex: 1, marginRight: 8 },
  accordionBody:   { fontSize: 13, color: C.sub, lineHeight: 20, marginTop: 12 },
  note:            { fontSize: 11, color: C.muted, textAlign: 'center', lineHeight: 17, marginTop: 8 },
});
