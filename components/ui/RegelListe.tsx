/**
 * Zeigt die Regeln aus `constants/regeln.ts`.
 *
 * Warum ein eigener Baustein und keine Liste je Bildschirm: zwei Kopien
 * derselben Zusage laufen auseinander, und dann steht auf einer Seite etwas
 * anderes als auf der anderen. Genau das war am 15.09.2026 der Befund auf der
 * Startseite („Beta, deutschlandweit verfuegbar" gegen „Geschlossener
 * Beta-Betrieb" in der Fusszeile).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/colors';
import { T } from '../../constants/typography';
import { regelnFuer } from '../../constants/regeln';

type Props = {
  /** Wessen Regeln. „beide" erscheint in jeder der zwei Ansichten. */
  fuer: 'kunde' | 'betrieb';
  /** Ueberschrift ueber der Liste. */
  titel?: string;
  /** Ohne eigenen Seitenabstand, fuer Bildschirme, die ihren Rand selbst setzen. */
  ohneRand?: boolean;
};

export function RegelListe({ fuer, titel = 'WAS BEI UNS ANDERS IST', ohneRand = false }: Props) {
  const regeln = regelnFuer(fuer);
  return (
    <View style={[styles.block, ohneRand && styles.blockOhneRand]}>
      <Text style={styles.label}>{titel}</Text>
      {regeln.map((r) => (
        <View key={r.titel} style={styles.zeile}>
          <View style={styles.symbolFeld}>
            <Ionicons name={r.symbol as any} size={20} color={C.primary} />
          </View>
          <View style={styles.text}>
            <Text style={styles.titel}>{r.titel}</Text>
            <Text style={styles.body}>{r.text}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block:        { paddingHorizontal: 20, paddingVertical: 20 },
  blockOhneRand: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 12 },
  label:      { ...T.label, color: C.muted, marginBottom: 12 },
  zeile:      { flexDirection: 'row', gap: 12, backgroundColor: C.surface,
                borderWidth: 1, borderColor: C.border, borderRadius: 14,
                padding: 14, marginBottom: 10 },
  symbolFeld: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.primaryBg,
                alignItems: 'center', justifyContent: 'center' },
  // minWidth: 0, sonst weigert sich das Textfeld zu schrumpfen und der Text
  // laeuft bei 360 px ueber den Rand (scripts/rand-ueberstand-check.cjs).
  text:       { flex: 1, minWidth: 0 },
  titel:      { ...T.h3, color: C.ink, marginBottom: 4 },
  body:       { ...T.body, color: C.sub },
});
