// Was ein Bildschirm zeigt, wenn das Angefragte nicht da ist.
//
// ANLASS (16.08.2026): Der erste Kalt-Durchlauf der Geld-Bildschirme — so, wie
// eine Push-Benachrichtigung oder ein Deep-Link sie oeffnet — ergab bei
// /rechnung und /vertrag etwas Schlimmeres als eine Fehlermeldung:
//
//   /rechnung  zehn Sekunden leer, danach "Beleg — Auftrag abgeschlossen &
//              Zahlung freigegeben" fuer einen Vertrag, den es nicht gibt.
//   /vertrag   zehn Sekunden nur die Ueberschrift, danach ein vollstaendiger
//              Vertrag mit Beispielwerten und dem Status "Ausstehend".
//
// Beide bauten ihre Anzeige aus `?? 0` und `'—'` zusammen. Der Nutzer sieht
// eine plausible Rechnung ueber eine Zahlung, die nie stattgefunden hat — auf
// genau den Bildschirmen, bei denen es um sein Geld geht. Ein Toast reichte
// dagegen nicht: er verschwindet nach Sekunden, die erfundene Rechnung bleibt.
//
// Das Muster stammt aus app/auftrag-detail.tsx, das es schon richtig machte.
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/colors';
import { T } from '../../constants/typography';

type Props = {
  /** Was nicht gefunden wurde, z. B. „Beleg nicht gefunden". */
  titel: string;
  /** Ein Satz, der sagt, was das fuer den Nutzer heisst. */
  text: string;
  /** Beschriftung des Auswegs — es muss immer einen geben. */
  knopf: string;
  onKnopf: () => void;
};

export function NichtGefunden({ titel, text, knopf, onKnopf }: Props) {
  return (
    // flexGrow statt flex: der Baustein steht mal direkt in einer SafeAreaView
    // und mal in einer ScrollView. `flex: 1` heisst in React Native
    // flexBasis: 0 und bliebe im ScrollView-contentContainer 0 hoch — auf dem
    // Geraet unsichtbar, im Web nicht zu bemerken (siehe GastLoginHinweis).
    <View style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
      <Ionicons name="alert-circle-outline" size={40} color={C.muted} />
      <Text style={{ ...T.h3, color: C.ink, textAlign: 'center' }}>{titel}</Text>
      <Text style={{ ...T.body, color: C.sub, textAlign: 'center' }}>{text}</Text>
      <TouchableOpacity
        style={{
          marginTop: 8, backgroundColor: C.primary, borderRadius: 10,
          paddingHorizontal: 20, minHeight: 46,
          alignItems: 'center', justifyContent: 'center',
        }}
        onPress={onKnopf}
        accessibilityRole="button"
      >
        <Text style={{ color: C.surface, ...T.btn }}>{knopf}</Text>
      </TouchableOpacity>
    </View>
  );
}
