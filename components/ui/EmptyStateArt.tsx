/**
 * EmptyStateArt — illustrierter Blickfang für leere Zustände.
 *
 * Ersetzt das flache graue Icon im Kreis durch eine geschichtete
 * Mini-Illustration aus Markenfarben (versetzte Kreise + Haupt-Icon +
 * zwei schwebende Akzent-Chips). Kein Bild-Asset, keine Abhängigkeit —
 * nur Views/Ionicons, dadurch scharf auf jeder Auflösung und themen-treu.
 * Schwebt per Reveal sanft ein (reduce-motion-aware).
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/colors';
import { Reveal } from './Reveal';

interface Props {
  /** Ionicons-Name des Haupt-Icons, z. B. "briefcase-outline" */
  icon: string;
  /** Icons der zwei Akzent-Chips (Default: sparkles + checkmark) */
  accessoryTop?: string;
  accessoryBottom?: string;
  size?: number;
}

export function EmptyStateArt({
  icon,
  accessoryTop = 'sparkles',
  accessoryBottom = 'checkmark',
  size = 120,
}: Props) {
  const s = size / 120; // Skalierungsfaktor relativ zum Referenzmaß
  return (
    <Reveal offset={10}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        {/* Hintergrund: zwei versetzte, weiche Kreise */}
        <View style={[styles.circle, { width: 104 * s, height: 104 * s, borderRadius: 52 * s, backgroundColor: C.primaryBg }]} />
        <View style={[styles.circle, { width: 64 * s, height: 64 * s, borderRadius: 32 * s, backgroundColor: C.goldBg, top: 6 * s, left: 8 * s }]} />
        {/* Haupt-Icon auf Karte */}
        <View style={[styles.iconCard, { width: 58 * s, height: 58 * s, borderRadius: 16 * s }]}>
          <Ionicons name={icon as any} size={26 * s} color={C.primary} />
        </View>
        {/* Schwebende Akzent-Chips */}
        <View style={[styles.chip, { top: 8 * s, right: 10 * s, width: 28 * s, height: 28 * s, borderRadius: 14 * s }]}>
          <Ionicons name={accessoryTop as any} size={13 * s} color={C.gold} />
        </View>
        <View style={[styles.chip, { bottom: 10 * s, left: 6 * s, width: 26 * s, height: 26 * s, borderRadius: 13 * s }]}>
          <Ionicons name={accessoryBottom as any} size={13 * s} color={C.primary} />
        </View>
      </View>
    </Reveal>
  );
}

const styles = StyleSheet.create({
  circle:   { position: 'absolute' },
  iconCard: {
    backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border,
    shadowColor: C.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  chip: {
    position: 'absolute', backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border,
    shadowColor: C.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 5, elevation: 2,
  },
});
