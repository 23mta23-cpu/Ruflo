import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';

// AGB gem. §307 BGB (keine überraschenden Klauseln), §312 BGB (Fernabsatz),
// §13 UWG, §305c BGB. Muss vor Launch durch Rechtsanwalt geprüft werden.

const SECTIONS = [
  {
    id: 'geltungsbereich',
    title: '§1 Geltungsbereich',
    content: `(1) Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für alle Nutzer der WERKR-Plattform (App und Web) der WERKR Operations GmbH (i. Gr.), Musterstraße 1, 50667 Köln ("WERKR").

(2) WERKR ist ausschließlich Vermittler zwischen Auftraggebern (Kunden) und Anbietern (Handwerker, Dienstleister). WERKR selbst erbringt keine Handwerks- oder sonstigen Dienstleistungen.

(3) Durch die Registrierung akzeptieren Sie diese AGB. Abweichende Bedingungen des Nutzers gelten nur, wenn WERKR diesen ausdrücklich und schriftlich zugestimmt hat.`,
  },
  {
    id: 'leistungen',
    title: '§2 Leistungen der Plattform',
    content: `(1) WERKR stellt eine digitale Plattform zur Verfügung, über die Auftraggeber Anbieter für Dienstleistungen suchen und beauftragen können.

(2) WERKR bietet:
• Profilverwaltung für Anbieter (inkl. Verifizierung)
• Such- und Buchungsfunktionen für Auftraggeber
• Digitale Vertragsabwicklung mit Escrow-Zahlung über Stripe
• Bewertungssystem
• Kommunikations-Chat

(3) WERKR ist keine Vertragspartei des Dienstleistungsvertrags zwischen Auftraggeber und Anbieter.`,
  },
  {
    id: 'registrierung',
    title: '§3 Registrierung & Pflichten',
    content: `(1) Die Nutzung setzt eine Registrierung voraus. Nutzer müssen mindestens 18 Jahre alt sein (§§106, 107 BGB — beschränkte Geschäftsfähigkeit Minderjähriger).

(2) Anbieter sind verpflichtet, korrekte Angaben zu machen (Name, Steuernummer, Qualifikationen). Meisterpflichtige Gewerke (§1 HwO Anlage A) dürfen nur mit gültigem Meistertitel oder gleichwertiger Ausnahmegenehmigung angeboten werden.

(3) Nutzer sind verpflichtet, ihre Zugangsdaten geheim zu halten und WERKR bei Verdacht auf Missbrauch unverzüglich zu informieren.

(4) Ein Nutzer darf nur ein Konto führen.

(5) Anbieter sind selbstständig tätige Gewerbetreibende oder Freiberufler im Sinne des §7 SGB IV. WERKR begründet kein Arbeitsverhältnis, kein arbeitnehmerähnliches Verhältnis und keine sonstige sozialversicherungspflichtige Beschäftigung. Anbieter sind in der Gestaltung ihrer Tätigkeit frei und nicht verpflichtet, ausschließlich über WERKR tätig zu sein.`,
  },
  {
    id: 'vertraege',
    title: '§4 Vertragsabschluss & Escrow',
    content: `(1) Ein Auftrag kommt durch digitale Unterzeichnung des WERKR-Vertrags durch beide Parteien zustande.

(2) Der Auftragswert wird mit Unterzeichnung über Stripe in Escrow gesperrt. Das Geld wird erst nach Auftragsabschluss und Freigabe durch den Auftraggeber ausgezahlt.

(3) Die Auszahlung an den Anbieter erfolgt abzüglich der Plattformgebühr von 8% des Auftragswerts innerhalb von 2 Werktagen nach Freigabe.

(4) WERKR ist kein Zahlungsdienstleister im Sinne des ZAG (Zahlungsdiensteaufsichtsgesetz) und kein Kreditinstitut. Die Zahlungsabwicklung sowie das treuhänderisch gehaltene Escrow-Guthaben werden ausschließlich durch Stripe Payments Europe, Ltd. bereitgestellt — ein von der Central Bank of Ireland nach der EU-Zahlungsdiensterichtlinie (PSD2) lizenziertes E-Geld-Institut. WERKR hat zu keinem Zeitpunkt direkten Zugriff auf die eingehaltenen Gelder.`,
  },
  {
    id: 'widerruf',
    title: '§5 Widerrufsrecht (§312 BGB)',
    content: `(1) Verbraucher haben das Recht, diesen Vertrag binnen 14 Tagen ohne Angabe von Gründen zu widerrufen.

(2) Das Widerrufsrecht erlischt vorzeitig, wenn die Dienstleistung vollständig erbracht wurde, bevor die Widerrufsfrist abgelaufen ist, und der Verbraucher dem Beginn der Dienstleistung und dem Erlöschen des Widerrufsrechts ausdrücklich zugestimmt hat.

(3) Zur Ausübung des Widerrufsrechts genügt eine eindeutige Erklärung (z. B. per E-Mail an widerruf@werkr.de).

(4) Das Muster-Widerrufsformular (Anlage 2 EGBGB) ist verfügbar unter: Einstellungen → Widerrufsbelehrung & Formular.`,
  },
  {
    id: 'gebuehren',
    title: '§6 Gebühren & Abrechnung',
    content: `(1) Die Nutzung der Plattform als Auftraggeber ist kostenlos.

(2) Anbieter zahlen eine Plattformgebühr von 8% des Auftragswerts. Die Gebühr wird automatisch vor der Auszahlung einbehalten. Eine etwaige Umsatzsteuer auf die Plattformgebühr trägt WERKR.

(3) Anbieter mit aktiver Pro-Mitgliedschaft (€29/Monat) erhalten zusätzliche Funktionen (bevorzugte Platzierung, erweiterte Statistiken). Die Pro-Mitgliedschaft verlängert sich automatisch monatlich und kann jederzeit mit einer Frist von einem Monat zum Monatsende gekündigt werden.

(4) Preisänderungen werden mit einer Frist von 6 Wochen angekündigt.`,
  },
  {
    id: 'strikes',
    title: '§7 Strike-System & Sperrung',
    content: `(1) Verstöße gegen diese AGB oder gegen den Grundsatz von Treu und Glauben (§242 BGB) führen zu einem Strike.

(2) Strikes werden vergeben bei:
• Preiserhöhungen nach Vertragsabschluss
• Nichterscheinen ohne Stornierung
• Beauftragung außerhalb der Plattform (Umgehung der Gebühr)
• Falsche Angaben / gefälschte Qualifikationsnachweise

(3) 3 Strikes innerhalb von 12 Monaten führen zur dauerhaften Sperrung. Eine Sperrung kann bei schwerwiegenden Verstößen auch nach dem ersten Strike erfolgen.`,
  },
  {
    id: 'haftung',
    title: '§8 Haftungsbeschränkung',
    content: `(1) WERKR haftet als Vermittler nicht für die Qualität der durch Anbieter erbrachten Leistungen.

(2) WERKR haftet nicht für mittelbare Schäden, entgangenen Gewinn oder Datenverlust, soweit diese nicht durch Vorsatz oder grobe Fahrlässigkeit von WERKR verursacht wurden.

(3) Die Haftung für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit sowie für Schäden nach dem Produkthaftungsgesetz bleibt unbeschränkt.

(4) Für Reklamationen steht ein strukturiertes Meldeverfahren in der App zur Verfügung.`,
  },
  {
    id: 'recht',
    title: '§9 Anwendbares Recht & Gerichtsstand',
    content: `(1) Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts.

(2) Gerichtsstand für Streitigkeiten mit Vollkaufleuten oder juristischen Personen des öffentlichen Rechts ist Köln.

(3) WERKR ist nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.`,
    osLink: 'EU-Plattform zur Online-Streitbeilegung (OS)',
  },
  {
    id: 'aenderungen',
    title: '§10 Änderungen der AGB',
    content: `(1) WERKR behält sich vor, diese AGB mit einer Ankündigungsfrist von 6 Wochen zu ändern.

(2) Änderungen werden per E-Mail und In-App-Benachrichtigung mitgeteilt. Widerspricht der Nutzer nicht innerhalb von 6 Wochen, gelten die neuen AGB als akzeptiert.

(3) Auf das Widerspruchsrecht und die Folgen des Nichtwidersprechens wird bei der Ankündigung ausdrücklich hingewiesen.

(4) Stimmt der Nutzer den geänderten AGB nicht zu, kann er sein Konto bis zum Ablauf der Widerspruchsfrist ohne Nachteile kündigen (§308 Nr.5 BGB).`,
  },
];

export default function AgbScreen() {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>('leistungen');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>AGB</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Allgemeine Geschäftsbedingungen der WERKR Operations GmbH · Version 1.0 · Stand: Juni 2025
        </Text>

        {SECTIONS.map((sec) => {
          const open = expanded === sec.id;
          return (
            <TouchableOpacity
              key={sec.id}
              style={[styles.accordion, open && styles.accordionOpen]}
              onPress={() => setExpanded(open ? null : sec.id)}
              activeOpacity={0.8}
            >
              <View style={styles.accordionHeader}>
                <Text style={[styles.accordionTitle, open && styles.accordionTitleOpen]}>
                  {sec.title}
                </Text>
                <Ionicons
                  name={open ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={open ? C.ink : C.sub}
                />
              </View>
              {open && (
                <>
                  <Text style={styles.accordionBody}>{sec.content}</Text>
                  {(sec as { osLink?: string }).osLink && (
                    <Text
                      style={[styles.accordionBody, styles.link]}
                      onPress={() => Linking.openURL('https://ec.europa.eu/consumers/odr/main')}
                    >
                      {(sec as { osLink?: string }).osLink}
                    </Text>
                  )}
                </>
              )}
            </TouchableOpacity>
          );
        })}

        <View style={styles.legalBox}>
          <Ionicons name="alert-circle-outline" size={16} color={C.amber} />
          <Text style={styles.legalNote}>
            Diese AGB sind ein Entwurf und müssen vor dem Launch durch einen auf IT- und Vertragsrecht
            spezialisierten Rechtsanwalt geprüft und freigegeben werden. Insbesondere §307 BGB
            (unangemessene Benachteiligung) und §305c BGB (Überraschungsklauseln) sind zu beachten.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: C.bg },
  header:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  title:             { fontSize: 17, fontWeight: '700', color: C.ink },
  scroll:            { padding: 20, paddingTop: 6, gap: 8 },
  intro:             { fontSize: 12, color: C.muted, lineHeight: 18, marginBottom: 8, textAlign: 'center' },
  accordion:         { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14 },
  accordionOpen:     { borderColor: C.ink },
  accordionHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  accordionTitle:    { fontSize: 14, fontWeight: '600', color: C.sub, flex: 1, marginRight: 8 },
  accordionTitleOpen:{ color: C.ink, fontWeight: '700' },
  accordionBody:     { fontSize: 13, color: C.sub, lineHeight: 20, marginTop: 12 },
  legalBox:          { flexDirection: 'row', gap: 10, backgroundColor: C.amberBg, borderRadius: 12, borderWidth: 1, borderColor: C.amber, padding: 14, marginTop: 8 },
  legalNote:         { flex: 1, fontSize: 11, color: C.amber, lineHeight: 17 },
  link:              { color: C.ink, textDecorationLine: 'underline', marginTop: 6 },
});
