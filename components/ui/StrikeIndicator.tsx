import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/colors';

interface Props {
  count: number;
  max?: number;
}

export function StrikeIndicator({ count, max = 3 }: Props) {
  const color = count >= max ? C.red : count >= 2 ? C.amber : C.muted;
  return (
    <View style={styles.row}>
      {Array.from({ length: max }).map((_, i) => (
        <Ionicons
          key={i}
          name={i < count ? 'alert-circle' : 'alert-circle-outline'}
          size={16}
          color={i < count ? color : C.border}
        />
      ))}
      <Text style={[styles.label, { color }]}>{count}/{max} Strikes</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  label: { fontSize: 12, fontWeight: '600', marginLeft: 2 },
});
