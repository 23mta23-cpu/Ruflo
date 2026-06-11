import React from 'react';
import { View, StyleSheet } from 'react-native';
import { C } from '../../constants/colors';

export function StrikeIndicator({ count, max = 3 }: { count: number; max?: number }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: max }).map((_, i) => (
        <View
          key={i}
          style={[styles.dot, i < count ? styles.filled : styles.empty]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row:    { flexDirection: 'row', gap: 3 },
  dot:    { width: 8, height: 8, borderRadius: 4 },
  filled: { backgroundColor: C.red },
  empty:  { backgroundColor: C.border },
});
