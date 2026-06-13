import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  compact?: boolean; // compact = single line pill, default = full banner
};

export function BetaBanner({ compact = false }: Props) {
  if (compact) {
    return (
      <View style={styles.pill}>
        <View style={styles.dot} />
        <Text style={styles.pillText}>Exklusiver Testbetrieb · Beta</Text>
      </View>
    );
  }

  return (
    <View style={styles.banner}>
      <View style={styles.bannerLeft}>
        <Ionicons name="shield-checkmark-outline" size={16} color="#0f172a" />
        <View>
          <Text style={styles.bannerTitle}>WERKR Testbetrieb</Text>
          <Text style={styles.bannerSub}>
            Geschlossene Beta · WERKR vermittelt als reiner Plattform-Vermittler. Nutzung im Rahmen des laufenden Testbetriebs.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#f1f5f9',
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    letterSpacing: 0.2,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  bannerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  bannerSub: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 16,
  },
});
