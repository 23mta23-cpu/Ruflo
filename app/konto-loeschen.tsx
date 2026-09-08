/**
 * Öffentliche Beschreibung des Löschwegs — Art. 17 DSGVO und Pflichtangabe
 * für Google Play.
 *
 * ANLASS: Google verlangt seit 2024 eine von AUSSEN erreichbare Seite, die
 * beschreibt, wie ein Konto und die zugehörigen Daten gelöscht werden. Der
 * Knopf in den Einstellungen genügt dort nicht — die Seite muss ohne
 * Anmeldung und ohne installierte App lesbar sein. Apple verlangt umgekehrt
 * die Löschung IN der App; beides existiert damit nebeneinander.
 *
 * Diese Seite verspricht bewusst NICHT, dass alles verschwindet: Verträge und
 * Rechnungen unterliegen der zehnjährigen Aufbewahrung nach § 147 AO und
 * § 257 HGB. Das Profil wird pseudonymisiert (Edge Function delete-account),
 * die Vertragszeilen bleiben. Wer hier „alle Daten werden gelöscht" schreibt,
 * sagt die Unwahrheit — und das ist genau die Klasse Zusage, die dieses
 * Projekt sonst überall gegen den Code prüft.
 */
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/colors';
import { T } from '../constants/typography';
import { S, R } from '../constants/theme';
import { safeBack } from '../lib/nav';
import { COMPANY, MAIL } from '../constants/legal';

export default function KontoLoeschenScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Zurück"
          onPress={() => safeBack(router)}
          hitSlop={12}
          style={s.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={s.title}>Konto löschen</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={s.inhalt}>
        <Text style={s.absatz}>
          Sie können Ihr Werkant-Konto jederzeit löschen. Diese Seite beschreibt,
          wie das geht und was mit Ihren Daten geschieht.
        </Text>

        <Text style={s.h2}>In der App</Text>
        <Text style={s.absatz}>
          Einstellungen → Konto löschen. Sie werden einmal um Bestätigung
          gebeten, danach wird die Löschung sofort ausgeführt.
        </Text>

        <Text style={s.h2}>Ohne die App</Text>
        <Text style={s.absatz}>
          Schreiben Sie an {MAIL.datenschutz} von der E-Mail-Adresse, mit der
          Sie sich registriert haben. Wir löschen das Konto und bestätigen die
          Löschung.
        </Text>
        <TouchableOpacity
          accessibilityRole="link"
          onPress={() => Linking.openURL(`mailto:${MAIL.datenschutz}?subject=${encodeURIComponent('Löschung meines Werkant-Kontos')}`)}
          activeOpacity={0.7}
        >
          <Text style={s.link}>{MAIL.datenschutz}</Text>
        </TouchableOpacity>

        <Text style={s.h2}>Was gelöscht wird</Text>
        <Text style={s.absatz}>
          Name, E-Mail-Adresse, Telefonnummer, Anschrift, Profilbild,
          Anbieterangaben und hochgeladene Nachweise. Ihr Profil wird
          unwiderruflich unkenntlich gemacht; eine Anmeldung ist danach nicht
          mehr möglich.
        </Text>

        <Text style={s.h2}>Was bleibt, und warum</Text>
        <Text style={s.absatz}>
          Abgeschlossene Verträge, Rechnungen und Zahlungsvorgänge bleiben
          gespeichert. Dazu sind wir gesetzlich verpflichtet: § 147
          Abgabenordnung und § 257 Handelsgesetzbuch schreiben eine
          Aufbewahrung von zehn Jahren vor. Diese Unterlagen sind dann nicht
          mehr mit Ihrem Namen verknüpft, sondern nur noch mit der
          Vertragsnummer.
        </Text>
        <Text style={s.absatz}>
          Meldungen und Maßnahmen nach dem Digital Services Act bleiben drei
          Jahre erhalten, damit wir sie gegenüber der Aufsicht belegen können.
        </Text>

        <Text style={s.h2}>Wie lange es dauert</Text>
        <Text style={s.absatz}>
          Die Löschung über die App wirkt sofort. Bei einer Anfrage per E-Mail
          antworten wir innerhalb eines Monats (Art. 12 Absatz 3 DSGVO), in
          aller Regel deutlich schneller.
        </Text>

        <Text style={s.h2}>Ihre weiteren Rechte</Text>
        <Text style={s.absatz}>
          Sie können eine Kopie Ihrer Daten anfordern (Art. 15 DSGVO):
          in der App unter Einstellungen → Meine Daten exportieren, oder per
          E-Mail an dieselbe Adresse. Näheres in der Datenschutzerklärung.
        </Text>

        <View style={s.trenner} />
        <Text style={s.klein}>
          Verantwortlich: {COMPANY.name}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  backBtn:   { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:     { fontSize: 17, fontWeight: '700', color: C.ink },
  inhalt:    { paddingHorizontal: 20, paddingBottom: 40 },
  h2:        { ...T.h3, color: C.ink, marginTop: S.lg, marginBottom: S.xs },
  absatz:    { ...T.body, color: C.sub, lineHeight: 21, marginBottom: S.xs },
  link:      { ...T.body, color: C.primary, fontWeight: '700' },
  trenner:   { height: 1, backgroundColor: C.border, marginVertical: S.lg },
  klein:     { ...T.caption, color: C.muted },
  radius:    { borderRadius: R.md },
});
