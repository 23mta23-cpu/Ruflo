// Ein Gast, der ohne Konto durch die App streift, landet auf mehreren Screens,
// die ihre Daten aus einer Sitzung ziehen. Ohne eigenen Zweig zeigen sie ihm
// dann eine Leermeldung, die nach "hier ist noch nichts passiert" klingt --
// obwohl in Wahrheit nur niemand angemeldet ist. Und sie bieten ihm keinen Weg
// zur Anmeldung an. Founder-Report 09.08.2026: "kann ich mich nirgends
// einloggen, dort ist kein Button."
//
// Dieser Baustein ist die eine Antwort darauf, damit sie auf jedem Screen
// gleich aussieht und nicht siebenmal leicht abweichend nachgebaut wird.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/colors';
import { T } from '../../constants/typography';
import { shadow, R } from '../../constants/theme';

type Props = {
  /** Ionicon-Name, passend zum Zweck des Screens. */
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  /** Kurze Feststellung, warum hier nichts steht. */
  titel?: string;
  /** Was der Nutzer nach der Anmeldung hier vorfindet. */
  text: string;
  /** Zweiten Weg "Jetzt registrieren" anbieten. */
  mitRegistrierung?: boolean;
};

export function GastLoginHinweis({
  icon = 'person-outline',
  titel = 'Nicht angemeldet',
  text,
  mitRegistrierung = false,
}: Props) {
  const router = useRouter();
  return (
    <View style={styles.wrap}>
      <View style={styles.kreis}>
        <Ionicons name={icon} size={32} color={C.sub} />
      </View>
      <Text style={styles.titel}>{titel}</Text>
      <Text style={styles.text}>{text}</Text>

      <TouchableOpacity
        accessibilityRole="button"
        style={styles.primary}
        onPress={() => router.push('/login')}
        activeOpacity={0.85}
      >
        <Text style={styles.primaryText}>Einloggen</Text>
      </TouchableOpacity>

      {mitRegistrierung && (
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.secondary}
          onPress={() => router.push('/registrierung')}
          activeOpacity={0.7}
        >
          <Text style={styles.secondaryText}>Noch kein Konto? Jetzt registrieren</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // flexGrow statt flex: der Baustein steht mal direkt in einer SafeAreaView
  // (profil, einstellungen, zahlungsmethoden, meine-anbieter, nachrichten) und
  // mal INNERHALB einer ScrollView (benachrichtigungen, auftraege).
  //
  // `flex: 1` bedeutet in React Native flexBasis: 0. Direkt in einer
  // SafeAreaView ist das richtig -- der Baustein fuellt die Restflaeche und
  // zentriert sich. In einem ScrollView-contentContainer OHNE flexGrow gibt es
  // aber keine vorgegebene Hoehe: flexBasis 0 bleibt dann 0, und der Hinweis
  // waere auf dem Geraet unsichtbar -- genau der Fehler, den er beheben soll.
  // Auf react-native-web faellt das nicht auf, weil dort die Web-Flexbox
  // greift. Ein reiner Web-Test haette das also durchgewunken.
  //
  // `flexGrow: 1` laesst flexBasis auf auto: in der SafeAreaView waechst der
  // Baustein weiterhin auf die volle Hoehe, in der ScrollView nimmt er die
  // Hoehe seines Inhalts an. Beides richtig, ohne Fallunterscheidung.
  wrap:          { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 48 },
  kreis:         { width: 72, height: 72, borderRadius: 36, backgroundColor: C.bgWarm, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  titel:         { ...T.h3, color: C.ink, marginBottom: 8, textAlign: 'center' },
  text:          { ...T.body, color: C.sub, textAlign: 'center', marginBottom: 26 },
  primary:       { alignSelf: 'stretch', backgroundColor: C.primary, borderRadius: R.md, paddingVertical: 15, alignItems: 'center', ...shadow.sm },
  primaryText:   { ...T.btn, color: C.surface },
  secondary:     { marginTop: 14, paddingVertical: 8 },
  secondaryText: { ...T.body, fontWeight: '700', color: C.ink, textDecorationLine: 'underline' },
});
